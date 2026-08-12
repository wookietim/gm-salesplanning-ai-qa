const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SECTION_START = '<!-- GM_QA_RESULTS_START -->';
const SECTION_END = '<!-- GM_QA_RESULTS_END -->';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const QA_RUNS_DIR = path.join(REPO_ROOT, 'QA-Runs');

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
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRunSection({ report, ticketKeys }) {
  const heading = '<h2>Latest QA Agent Runs</h2>';
  const items = ticketKeys.map((ticketKey) => {
    const susan = findLatestSusanResult(ticketKey);
    if (!susan) {
      return `<li><strong>${escapeXml(ticketKey)}</strong>: no matching Susan result was found in QA-Runs.</li>`;
    }

    const totals = susan.totals || {};
    return `<li><strong>${escapeXml(ticketKey)}</strong> — ${escapeXml(susan.overall_status || 'UNKNOWN')} (pass: ${escapeXml(totals.PASS || 0)}, fail: ${escapeXml(totals.FAIL || 0)}, partial: ${escapeXml(totals['PARTIAL'] || 0)}, manual-only: ${escapeXml(totals['MANUAL-ONLY'] || 0)})</li>`;
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

module.exports = {
  getConfluenceTicketList,
  writeRunResultsToConfluence,
};
