const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SECTION_START = '<!-- GM_QA_RESULTS_START -->';
const SECTION_END = '<!-- GM_QA_RESULTS_END -->';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const QA_RUNS_DIR = path.join(REPO_ROOT, 'QA-Runs');
const FAILURE_REASON_DESCRIPTIONS = {
  'sad-path-source-signals': 'Components are missing error handling, loading states, or fallback UI — sad-path tests require these signals to validate against.',
  'jira-issue-key-coverage': 'Test plans were generated without this Jira ticket scoped in — plans need to be regenerated with the ticket key to pass this check.',
};
const ROW_COLORS = {
  pass: 'rgb(227,252,239)',
  blocked: 'rgb(255,247,214)',
  fail: 'rgb(255,235,230)',
};

function requestJson(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method || 'GET',
        headers: options.headers || {},
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Confluence request failed (${res.statusCode}): ${body.slice(0, 300)}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Unable to parse Confluence response: ${error.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function getHeaders(token) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getPage(env) {
  if (!env.CONFLUENCE_BASE_URL || !env.CONFLUENCE_API_TOKEN || !env.CONFLUENCE_PAGE_ID) {
    throw new Error('Missing Confluence settings in .env');
  }

  const baseUrl = env.CONFLUENCE_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/rest/api/content/${env.CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
  return requestJson(url, {
    headers: getHeaders(env.CONFLUENCE_API_TOKEN),
  });
}

function extractTicketKeysFromStorage(storageValue) {
  return Array.from(new Set((storageValue.match(/SSPLAN-\d+/gi) || []).map((key) => key.toUpperCase())));
}

function findLatestSusanResult(ticketKey) {
  if (!fs.existsSync(QA_RUNS_DIR)) {
    return null;
  }

  const files = fs
    .readdirSync(QA_RUNS_DIR)
    .filter((file) => file.startsWith(`susan-result-${ticketKey}-`) && file.endsWith('.json'))
    .map((file) => ({
      file,
      fullPath: path.join(QA_RUNS_DIR, file),
      mtimeMs: fs.statSync(path.join(QA_RUNS_DIR, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!files.length) {
    return null;
  }

  return JSON.parse(fs.readFileSync(files[0].fullPath, 'utf8'));
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTests(tests, markAsPassed) {
  const safeTests = Array.isArray(tests) ? tests : [];
  if (!markAsPassed) {
    return safeTests.map((test) => ({
      ...test,
      reasons: Array.isArray(test?.reasons) ? test.reasons.filter(Boolean) : [],
    }));
  }

  return safeTests.map((test) => ({
    ...test,
    status: 'pass',
    reasons: [],
  }));
}

function getCounts(tests) {
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

function getRowColor({ failed, blocked }) {
  if (failed > 0) return ROW_COLORS.fail;
  if (blocked > 0) return ROW_COLORS.blocked;
  return ROW_COLORS.pass;
}

function formatToday(today) {
  if (today && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return today;
  }
  return new Date().toISOString().slice(0, 10);
}

function buildFailureSummary(tests) {
  const counts = new Map();

  tests
    .filter((test) => test.status !== 'pass' && test.status !== 'blocked')
    .forEach((test) => {
      (test.reasons || []).forEach((reason) => {
        counts.set(reason, (counts.get(reason) || 0) + 1);
      });
    });

  if (!counts.size) {
    return '';
  }

  const items = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => {
      const description = FAILURE_REASON_DESCRIPTIONS[reason] || reason;
      return `<li style="margin:0;padding:0;line-height:1.6;"><strong>${escapeXml(count)}x ${escapeXml(reason)}:</strong> ${escapeXml(description)}</li>`;
    })
    .join('');

  return `<p><strong>⚠️ Why tests failed:</strong></p><ul style="margin:0;padding-left:16px;">${items}</ul><p> </p>`;
}

function buildTestItem(test) {
  const icon = test.status === 'pass' ? '✅' : test.status === 'blocked' ? '⛔' : '❌';
  const label = test.label || 'Test';
  const testId = test.testId ? ` (${test.testId})` : '';
  return `<li style="margin:0;padding:0;line-height:1.2;">${escapeXml(icon)} ${escapeXml(test.component || 'Unknown component')} — ${escapeXml(label)}${escapeXml(testId)}</li>`;
}

function buildTicketRowMarkup({ env, ticketKey, ticketSummary, tests, today }) {
  const counts = getCounts(tests);
  const color = getRowColor(counts);
  const jiraBase = (env.JIRA_BASE_URL || env.JIRA_BASE || '').replace(/\/$/, '');
  const ticketHref = `${jiraBase}/browse/${ticketKey}`;
  const totalTests = tests.length;
  const failureSummary = counts.failed > 0 ? buildFailureSummary(tests) : '';
  const testItems = tests.map(buildTestItem).join('');
  const detailMarkup = `${failureSummary}<ul>${testItems}</ul>`;
  const cell = (value) => `<td style="background-color:${color};"><p>${value}</p></td>`;

  return [
    '<tr>',
    cell(`<a href="${escapeXml(ticketHref)}" target="_blank" rel="noopener noreferrer">${escapeXml(ticketKey)}</a>`),
    cell(escapeXml(today)),
    cell(escapeXml(ticketSummary)),
    cell(escapeXml(counts.passed)),
    cell(escapeXml(counts.failed)),
    cell(escapeXml(counts.blocked)),
    cell(escapeXml(counts.failed)),
    '</tr>',
    `<tr><td colspan="7" style="background-color:${color};border-top:none;padding:0 8px 6px 8px;"><ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">Show tests (${escapeXml(totalTests)})</ac:parameter><ac:rich-text-body>${detailMarkup}</ac:rich-text-body></ac:structured-macro></td></tr>`,
  ].join('');
}

function upsertManagedTicketRows(storageValue, ticketKey, rowMarkup) {
  const escapedTicketKey = escapeRegex(ticketKey);
  const existingRowPattern = new RegExp(`<tr>[\\s\\S]*?${escapedTicketKey}[\\s\\S]*?<\\/tr>\\s*<tr>[\\s\\S]*?<\\/tr>`, 'i');
  if (existingRowPattern.test(storageValue)) {
    return storageValue.replace(existingRowPattern, rowMarkup);
  }

  const tableEnd = '</tbody></table>';
  if (!storageValue.includes(tableEnd)) {
    throw new Error('Unable to find AI QA Summary table closing tag.');
  }

  return storageValue.replace(tableEnd, `${rowMarkup}${tableEnd}`);
}

function buildRunSection({ report, ticketKeys }) {
  const heading = '<h2>Latest QA Agent Runs</h2>';
  const items = ticketKeys.map((ticketKey) => {
    const susan = findLatestSusanResult(ticketKey);
    if (!susan) {
      return `<li><strong>${escapeXml(ticketKey)}</strong>: no matching Susan result was found in QA-Runs.</li>`;
    }

    const totals = susan.totals || {};
    return `<li><strong>${escapeXml(ticketKey)}</strong> — ${escapeXml(susan.overall_status || 'UNKNOWN')} (pass: ${escapeXml(totals.PASS || 0)}, fail: ${escapeXml(totals.FAIL || 0)}, partial: ${escapeXml(totals.PARTIAL || 0)}, manual-only: ${escapeXml(totals['MANUAL-ONLY'] || 0)})</li>`;
  });

  const generatedAt = new Date().toISOString();
  const reportPath = report?.runId ? escapeXml(report.runId) : 'manual';
  const details = `<p>Generated from Pablo run <code>${reportPath}</code> at ${escapeXml(generatedAt)}.</p>`;
  return `${SECTION_START}${heading}${details}<ul>${items.join('')}</ul>${SECTION_END}`;
}

function upsertRunSection(storageValue, sectionMarkup) {
  const pattern = new RegExp(`${SECTION_START}[\\s\\S]*?${SECTION_END}`);
  if (pattern.test(storageValue)) {
    return storageValue.replace(pattern, sectionMarkup);
  }
  return `${sectionMarkup}${storageValue}`;
}

async function updatePage(env, page, storageValue) {
  const baseUrl = env.CONFLUENCE_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}/rest/api/content/${env.CONFLUENCE_PAGE_ID}`;
  const payload = {
    id: page.id,
    type: page.type,
    title: page.title,
    version: {
      number: (page.version?.number || 1) + 1,
    },
    body: {
      storage: {
        value: storageValue,
        representation: 'storage',
      },
    },
  };

  return requestJson(url, {
    method: 'PUT',
    headers: getHeaders(env.CONFLUENCE_API_TOKEN),
    body: JSON.stringify(payload),
  });
}

async function getConfluenceTicketList(env) {
  const page = await getPage(env);
  const storageValue = page.body?.storage?.value || '';
  return {
    title: page.title,
    tickets: extractTicketKeysFromStorage(storageValue),
  };
}

async function writeRunResultsToConfluence({ env, reportPath, ticketKeys }) {
  const page = await getPage(env);
  const report = reportPath && fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    : null;
  const sectionMarkup = buildRunSection({ report, ticketKeys });
  const currentStorage = page.body?.storage?.value || '';
  const updatedStorage = upsertRunSection(currentStorage, sectionMarkup);
  const updatedPage = await updatePage(env, page, updatedStorage);

  return {
    pageTitle: updatedPage.title,
    pageVersion: updatedPage.version?.number,
    ticketKeys,
  };
}

async function upsertTicketRow({ env, ticketKey, ticketSummary, tests, markAsPassed, today }) {
  if (!ticketKey) {
    throw new Error('ticketKey is required');
  }
  if (!ticketSummary) {
    throw new Error('ticketSummary is required');
  }

  const normalizedTicketKey = String(ticketKey).toUpperCase();
  const page = await getPage(env);
  const normalizedTests = normalizeTests(tests, markAsPassed);
  const currentStorage = page.body?.storage?.value || '';
  const rowMarkup = buildTicketRowMarkup({
    env,
    ticketKey: normalizedTicketKey,
    ticketSummary,
    tests: normalizedTests,
    today: formatToday(today),
  });
  const updatedStorage = upsertManagedTicketRows(currentStorage, normalizedTicketKey, rowMarkup);
  const updatedPage = await updatePage(env, page, updatedStorage);

  return {
    pageVersion: updatedPage.version?.number,
  };
}

module.exports = {
  getConfluenceTicketList,
  writeRunResultsToConfluence,
  upsertTicketRow,
};
