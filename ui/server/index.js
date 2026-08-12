const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const { listTicketsByStatus } = require('./commands/jira');
const { runPabloStream } = require('./commands/pablo');
const { getConfluenceTicketList, writeRunResultsToConfluence, upsertTicketRow } = require('./commands/confluence');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = 3001;
const ticketKeyRegex = /SSPLAN-\d+/gi;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

function startStream(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // Disable TCP Nagle algorithm so small SSE packets are sent immediately
  if (res.socket) {
    res.socket.setNoDelay(true);
  }
  res.flushHeaders();
}

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  // Flush after every event so the browser receives it immediately
  if (typeof res.flush === 'function') res.flush();
}

function extractTicketKeys(text) {
  return Array.from(new Set((text.match(ticketKeyRegex) || []).map((key) => key.toUpperCase())));
}

function buildEnv() {
  return {
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
    JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
    CONFLUENCE_BASE_URL: process.env.CONFLUENCE_BASE_URL,
    CONFLUENCE_SPACE_KEY: process.env.CONFLUENCE_SPACE_KEY,
    CONFLUENCE_PAGE_ID: process.env.CONFLUENCE_PAGE_ID,
    CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN,
  };
}

async function handleJiraStatus(res, status, maxResults) {
  sendEvent(res, { type: 'line', text: `Fetching Jira tickets with status "${status}"...` });
  const tickets = await listTicketsByStatus(status, buildEnv(), maxResults);

  if (!tickets.length) {
    sendEvent(res, { type: 'line', text: `No ${status} tickets found.` });
  } else {
    // Emit structured ticket list so the frontend can render action buttons
    sendEvent(res, { type: 'tickets', tickets });
  }

  sendEvent(res, { type: 'done', text: `Returned ${tickets.length} ${status} ticket(s).` });
  res.end();
}

app.post('/api/confluence-write', async (req, res) => {
  try {
    const { ticketKey, ticketSummary, tests, markAsPassed } = req.body || {};
    const result = await upsertTicketRow({
      env: buildEnv(),
      ticketKey,
      ticketSummary,
      tests,
      markAsPassed: Boolean(markAsPassed),
      today: new Date().toISOString().slice(0, 10),
    });

    res.json({ ok: true, version: result.pageVersion });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

app.post('/api/command', async (req, res) => {
  startStream(res);

  const text = String(req.body?.text || '').trim();
  const lowerText = text.toLowerCase();
  const ticketKeys = extractTicketKeys(text);
  let closed = false;

  // Use res.on('close') not req.on('close') — req closes as soon as the
  // request body is consumed, which would immediately kill Pablo.
  // res closes only when the client actually disconnects.
  res.on('close', () => {
    closed = true;
  });

  try {
    if (lowerText.includes('in review')) {
      await handleJiraStatus(res, 'In Review', 50);
      return;
    }

    if (lowerText.includes('done')) {
      await handleJiraStatus(res, 'Done', 50);
      return;
    }

    if (lowerText.includes('confluence') && !ticketKeys.length && !lowerText.includes('test')) {
      sendEvent(res, { type: 'line', text: 'Reading Confluence page ticket list...' });
      const result = await getConfluenceTicketList(buildEnv());
      sendEvent(res, { type: 'line', text: `Page: ${result.title}` });
      if (result.tickets.length) {
        result.tickets.forEach((ticket) => sendEvent(res, { type: 'line', text: ticket }));
      } else {
        sendEvent(res, { type: 'line', text: 'No ticket keys found on the Confluence page.' });
      }
      sendEvent(res, { type: 'done', text: `Returned ${result.tickets.length} Confluence ticket(s).` });
      res.end();
      return;
    }

    if ((lowerText.includes('run tests') || lowerText.includes('test')) && ticketKeys.length) {
      sendEvent(res, { type: 'line', text: `Running Pablo for ${ticketKeys.join(', ')}...` });

      const child = runPabloStream({
        ticketKeys,
        env: buildEnv(),
        onLine: (line) => {
          if (!closed) {
            sendEvent(res, { type: 'line', text: line });
          }
        },
        onDone: async ({ resultPath }) => {
          if (closed) return;

          try {
            // Read Susan's latest results and stream as structured test list
            const susanLatest = path.resolve(
              path.dirname(resultPath),
              '../../susan/results/latest.json'
            );
            if (fs.existsSync(susanLatest)) {
              const susan = JSON.parse(fs.readFileSync(susanLatest, 'utf8'));
              const tests = [];
              for (const comp of (susan.componentResults || [])) {
                for (const t of (comp.tests || [])) {
                  tests.push({
                    component: comp.component,
                    testId: t.testId || '',
                    label: (t.testId || '').includes('HP') ? 'Happy Path' : 'Sad Path',
                    status: t.status || 'fail',
                    reasons: (t.checks || [])
                      .filter(c => c.status === 'fail')
                      .map(c => c.name),
                  });
                }
              }
              sendEvent(res, { type: 'tests', tests });
            }

            if (lowerText.includes('confluence')) {
              sendEvent(res, { type: 'line', text: 'Writing latest run summary to Confluence...' });
              const result = await writeRunResultsToConfluence({
                env: buildEnv(), reportPath: resultPath, ticketKeys,
              });
              sendEvent(res, { type: 'line', text: `Confluence updated: ${result.pageTitle} (version ${result.pageVersion})` });
            }

            sendEvent(res, { type: 'done', text: 'Pablo run complete.' });
            res.end();
          } catch (error) {
            sendEvent(res, { type: 'error', text: error.message });
            res.end();
          }
        },
        onError: (error) => {
          if (!closed) {
            sendEvent(res, { type: 'error', text: error.message });
            res.end();
          }
        },
      });

      res.on('close', () => {
        if (child && !child.killed) {
          child.kill('SIGTERM');
        }
      });
      return;
    }

    sendEvent(res, {
      type: 'line',
      text: 'I can handle: listing Jira tickets (in review / done), running tests for ticket keys, writing results to Confluence.',
    });
    sendEvent(res, { type: 'done', text: 'Ready for the next command.' });
    res.end();
  } catch (error) {
    sendEvent(res, { type: 'error', text: error.message });
    res.end();
  }
});

app.listen(port, () => {
  console.log(`GM Sales Planning QA server listening on http://localhost:${port}`);
});
