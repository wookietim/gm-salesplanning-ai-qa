import { useEffect, useRef, useState } from 'react';
import { API_BASE } from './api';
import BatchResultsPanel from './components/BatchResultsPanel';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';
import ResultsPanel from './components/ResultsPanel';

const suggestions = ['List In Review tickets', 'List Done tickets'];

const decoder = new TextDecoder();

function parseSseChunk(buffer, onEvent) {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() || '';

  parts.forEach((part) => {
    const dataLine = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s*/, ''))
      .join('');

    if (!dataLine) {
      return;
    }

    try {
      onEvent(JSON.parse(dataLine));
    } catch (error) {
      onEvent({ type: 'error', text: `Unable to parse stream event: ${error.message}` });
    }
  });

  return remainder;
}

function getTestCounts(tests = []) {
  return tests.reduce(
    (totals, test) => {
      if (test.status === 'pass') {
        totals.passed += 1;
      } else if (test.status === 'blocked') {
        totals.blocked += 1;
      } else {
        totals.failed += 1;
      }
      return totals;
    },
    { passed: 0, failed: 0, blocked: 0 }
  );
}

async function streamCommand({ text, signal, onEvent }) {
  const response = await fetch(`${API_BASE}/api/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseChunk(buffer, onEvent);
  }

  if (buffer.trim()) {
    parseSseChunk(`${buffer}\n\n`, onEvent);
  }
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'agent',
      text: 'Ask me to list Jira tickets, run Pablo for SSPLAN keys, or write results to Confluence.',
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runState, setRunState] = useState({ ticket: null, lines: [], tests: [], status: 'idle' });
  const [batchState, setBatchState] = useState({ active: false, tickets: [] });
  const runRequestIdRef = useRef(null);
  const runAbortControllerRef = useRef(null);
  const batchRequestIdRef = useRef(null);
  const batchAbortControllerRef = useRef(null);

  useEffect(
    () => () => {
      runAbortControllerRef.current?.abort();
      batchAbortControllerRef.current?.abort();
    },
    []
  );

  const updateAssistantMessage = (messageId, text) => {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, text } : message))
    );
  };

  const buildRunSummary = (lines, fallbackText) => {
    const reversedLines = [...lines].reverse();
    const totalsLine = reversedLines.find((line) => /pass(?:ed)?|fail(?:ed)?/i.test(line));

    if (totalsLine) {
      const passedMatch = totalsLine.match(/pass(?:ed)?[:\s]+(\d+)/i);
      const failedMatch = totalsLine.match(/fail(?:ed)?[:\s]+(\d+)/i);

      if (passedMatch || failedMatch) {
        const passed = passedMatch ? passedMatch[1] : '0';
        const failed = failedMatch ? failedMatch[1] : '0';
        return `Summary: ${passed} passed, ${failed} failed`;
      }
    }

    return fallbackText || 'Done.';
  };

  const updateBatchTicket = (index, updater) => {
    setBatchState((current) => ({
      ...current,
      tickets: current.tickets.map((ticket, ticketIndex) =>
        ticketIndex === index ? updater(ticket) : ticket
      ),
    }));
  };

  const runTicket = async (ticketKey, ticketSummary) => {
    const command = `Run tests for ${ticketKey}`;
    const runId = crypto.randomUUID();
    const controller = new AbortController();

    runAbortControllerRef.current?.abort();
    batchAbortControllerRef.current?.abort();
    runRequestIdRef.current = runId;
    runAbortControllerRef.current = controller;
    batchRequestIdRef.current = null;
    batchAbortControllerRef.current = null;

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'agent',
        text: `Running tests for ${ticketKey}...`,
      },
    ]);
    setBatchState({ active: false, tickets: [] });
    setRunState({
      ticket: { key: ticketKey, summary: ticketSummary },
      lines: [],
      tests: [],
      status: 'running',
    });

    try {
      let collectedLines = [];
      const handleRunEvent = (event) => {
        if (runRequestIdRef.current !== runId) {
          return;
        }

        if (event.type === 'tests') {
          setRunState((current) => ({ ...current, tests: event.tests || [] }));
        }

        if (event.type === 'line') {
          collectedLines = [...collectedLines, event.text];
          setRunState((current) => ({
            ...current,
            lines: [...current.lines, event.text],
          }));
        }

        if (event.type === 'done') {
          const summary = buildRunSummary(collectedLines, event.text);
          setRunState((current) => ({
            ...current,
            lines:
              summary && current.lines[current.lines.length - 1] !== summary
                ? [...current.lines, summary]
                : current.lines,
            status: 'done',
          }));
        }

        if (event.type === 'error') {
          const errorLine = `Error: ${event.text}`;
          collectedLines = [...collectedLines, errorLine];
          setRunState((current) => ({
            ...current,
            lines: [...current.lines, errorLine],
            status: 'error',
          }));
        }
      };

      await streamCommand({ text: command, signal: controller.signal, onEvent: handleRunEvent });
    } catch (error) {
      if (error.name === 'AbortError' || runRequestIdRef.current !== runId) {
        return;
      }

      setRunState((current) => ({
        ...current,
        lines: [...current.lines, `Error: ${error.message}`],
        status: 'error',
      }));
    } finally {
      if (runRequestIdRef.current === runId) {
        runAbortControllerRef.current = null;
      }
    }
  };

  const runBatchTickets = async (tickets, { regenerate = false } = {}) => {
    if (!tickets?.length) {
      return;
    }

    const runId = crypto.randomUUID();
    const controller = new AbortController();

    runAbortControllerRef.current?.abort();
    batchAbortControllerRef.current?.abort();
    runRequestIdRef.current = null;
    runAbortControllerRef.current = null;
    batchRequestIdRef.current = runId;
    batchAbortControllerRef.current = controller;

    setRunState({ ticket: null, lines: [], tests: [], status: 'idle' });
    setBatchState({
      active: true,
      tickets: tickets.map((ticket) => ({
        ...ticket,
        status: 'pending',
        tests: [],
        lines: [],
        passed: 0,
        failed: 0,
        blocked: 0,
      })),
    });

    for (let index = 0; index < tickets.length; index += 1) {
      if (batchRequestIdRef.current !== runId) {
        return;
      }

      const ticket = tickets[index];
      let collectedLines = [];
      updateBatchTicket(index, (current) => ({
        ...current,
        status: 'running',
        tests: [],
        lines: [],
        passed: 0,
        failed: 0,
        blocked: 0,
      }));

      try {
        await streamCommand({
          text: `${regenerate ? 'Regenerate tests for' : 'Run tests for'} ${ticket.key}`,
          signal: controller.signal,
          onEvent: (event) => {
            if (batchRequestIdRef.current !== runId) {
              return;
            }

            if (event.type === 'line') {
              collectedLines = [...collectedLines, event.text];
              updateBatchTicket(index, (current) => ({
                ...current,
                lines: [...current.lines, event.text],
              }));
            }

            if (event.type === 'tests') {
              const nextTests = event.tests || [];
              const counts = getTestCounts(nextTests);
              updateBatchTicket(index, (current) => ({
                ...current,
                tests: nextTests,
                passed: counts.passed,
                failed: counts.failed,
                blocked: counts.blocked,
              }));
            }

            if (event.type === 'done') {
              const summary = buildRunSummary(collectedLines, event.text);
              updateBatchTicket(index, (current) => ({
                ...current,
                lines:
                  summary && current.lines[current.lines.length - 1] !== summary
                    ? [...current.lines, summary]
                    : current.lines,
                status: 'done',
              }));
            }

            if (event.type === 'error') {
              const errorLine = `Error: ${event.text}`;
              collectedLines = [...collectedLines, errorLine];
              updateBatchTicket(index, (current) => ({
                ...current,
                lines: [...current.lines, errorLine],
                status: 'error',
              }));
            }
          },
        });
      } catch (error) {
        if (error.name === 'AbortError' || batchRequestIdRef.current !== runId) {
          return;
        }

        updateBatchTicket(index, (current) => ({
          ...current,
          lines: [...current.lines, `Error: ${error.message}`],
          status: 'error',
        }));
      }
    }

    if (batchRequestIdRef.current === runId) {
      batchAbortControllerRef.current = null;
    }
  };

  const runAllTickets = (tickets) => runBatchTickets(tickets);

  const regenerateAllTickets = (tickets) => runBatchTickets(tickets, { regenerate: true });

  const sendCommand = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    const userMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    const agentMessageId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      userMessage,
      { id: agentMessageId, role: 'agent', text: '' },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      let buffer = '';
      let transcript = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, (event) => {
          if (event.type === 'tickets') {
            setMessages((current) =>
              current.map((m) =>
                m.id === agentMessageId ? { ...m, tickets: event.tickets } : m
              )
            );
          }

          if (event.type === 'line') {
            transcript = transcript ? `${transcript}\n${event.text}` : event.text;
            updateAssistantMessage(agentMessageId, transcript);
          }

          if (event.type === 'error') {
            transcript = transcript ? `${transcript}\nError: ${event.text}` : `Error: ${event.text}`;
            updateAssistantMessage(agentMessageId, transcript);
            setIsStreaming(false);
          }

          if (event.type === 'done') {
            if (!transcript && event.text) {
              transcript = event.text;
            }
            updateAssistantMessage(agentMessageId, transcript || event.text || 'Done.');
            setIsStreaming(false);
          }
        });
      }

      if (buffer.trim()) {
        parseSseChunk(`${buffer}\n\n`, (event) => {
          if (event.type === 'line') {
            transcript = transcript ? `${transcript}\n${event.text}` : event.text;
          }
        });
        updateAssistantMessage(agentMessageId, transcript);
      }
    } catch (error) {
      updateAssistantMessage(agentMessageId, `Error: ${error.message}`);
      setIsStreaming(false);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">IKEA QA Agent</p>
          <h1>GM Sales Planning QA</h1>
        </div>
        <span className="accent-bar" />
      </header>

      <main className="chat-panel">
        <div className="chat-left">
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            onRunTicket={runTicket}
            onRunAll={runAllTickets}
            onRegenerateAll={regenerateAllTickets}
          />

          <div className="composer-panel">
            <div className="suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip"
                  onClick={() => sendCommand(suggestion)}
                  disabled={isStreaming}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <InputBar onSend={sendCommand} disabled={isStreaming} />
          </div>
        </div>

        {batchState.active ? (
          <BatchResultsPanel batchState={batchState} />
        ) : (
          <ResultsPanel runState={runState} />
        )}
      </main>
    </div>
  );
}
