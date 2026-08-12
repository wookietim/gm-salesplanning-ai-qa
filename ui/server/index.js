const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const { listTicketsByStatus } = require('./commands/jira');
const { runPabloStream } = require('./commands/pablo');
const { getConfluenceTicketList, writeRunResultsToConfluence } = require('./commands/confluence');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = 3001;
const ticketKeyRegex = /SSPLAN-\d+/gi;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function startStream(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
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
  sendEvent(res, { type: 'line', text: `Fetching Jira tickets with status \"${status}\"...` });
  const tickets = await listTicketsByStatus(status, buildEnv(), maxResults);

  if (!tickets.length) {
    sendEvent(res, { type: 'line', text: `No ${status} tickets found.` });
  } else {
    tickets.forEach((ticket) => {
      sendEvent(res, { type: 'line', text: `${ticket.key} — ${ticket.summary} [${ticket.status}]` });
    });
  }

  sendEvent(res, { type: 'done', text: `Returned ${tickets.length} ${status} ticket(s).` });
  res.end();
}

app.post('/api/command', async (req, res) => {
  startStream(res);

  const text = String(req.body?.text || '').trim();
  const lowerText = text.toLowerCase();
  const ticketKeys = extractTicketKeys(text);
  let closed = false;

  req.on('close', () => {
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
          if (closed) {
            return;
          }

          try {
            if (lowerText.includes('confluence')) {
              sendEvent(res, { type: 'line', text: 'Writing latest run summary to Confluence...' });
              const result = await writeRunResultsToConfluence({
                env: buildEnv(),
                reportPath: resultPath,
                ticketKeys,
              });
              sendEvent(res, {
                type: 'line',
                text: `Confluence updated: ${result.pageTitle} (version ${result.pageVersion})`,
              });
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

      req.on('close', () => {
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
