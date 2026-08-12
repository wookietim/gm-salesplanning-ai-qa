import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';

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

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'agent',
      text: 'Ask me to list Jira tickets, run Pablo for SSPLAN keys, or write results to Confluence.',
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  const updateAssistantMessage = (messageId, text) => {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, text } : message))
    );
  };

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
      const response = await fetch('/api/command', {
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
        <ChatWindow messages={messages} isStreaming={isStreaming} />

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
      </main>
    </div>
  );
}
