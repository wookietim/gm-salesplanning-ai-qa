#!/usr/bin/env node
/**
 * Publishes the latest e2e run to the Confluence QA Summary page.
 *
 * The QA Summary table is otherwise ticket-scoped, but a full Playwright suite
 * is not attributable to a single Jira ticket, so the established convention on
 * that page is one managed "E2E Test Run" row plus a collapsed detail row
 * listing every test grouped by its describe block. This script upserts that
 * pair and leaves all other rows untouched.
 *
 * Usage:
 *   node publish-e2e-confluence.js [--result <path>] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROW_LABEL = 'E2E Test Run';
const ROW_COLORS = {
  pass: 'rgb(227,252,239)',
  blocked: 'rgb(255,247,214)',
  fail: 'rgb(255,235,230)',
};

const DEFAULT_RESULT = path.join(__dirname, '..', 'agents', 'e2e', 'results', 'latest.json');
const DEFAULT_ENV = path.join(__dirname, '..', '..', '..', '.env');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[token.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      args[token.slice(2)] = true;
    }
  }
  return args;
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`No .env found at ${envPath}`);
  }
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

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
        res.on('data', (c) => chunks.push(c));
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
    if (options.body) req.write(options.body);
    req.end();
  });
}

const headersFor = (token) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iconFor(status) {
  if (status === 'passed') return '✅';
  if (status === 'skipped') return '⛔';
  if (status === 'flaky') return '⚠️';
  return '❌';
}

/**
 * Groups specs by their describe ancestry so the detail row mirrors the
 * structure of the suite rather than presenting one flat list of 211 tests.
 */
function groupBySuite(specs) {
  const groups = new Map();
  for (const spec of specs) {
    const key = (spec.suitePath || []).join(' › ') || '(top level)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(spec);
  }
  return groups;
}

function buildDetailBody(specs, note, targetUrl) {
  const parts = [];
  // State the target explicitly. Without it a reader cannot tell whether a run
  // exercised the deployed environment or a local build, and that distinction
  // has already caused confusion once.
  if (targetUrl) {
    // Be explicit about what "tested against" does and does not mean. The suite
    // loads the real deployed frontend bundle, but Playwright intercepts every
    // API call, so the data is fixture data and the backend is never exercised.
    // Stating only the URL invites the reader to assume full end-to-end cover.
    parts.push(
      `<p><strong>🎯 Frontend build under test:</strong> <code>${escapeXml(targetUrl)}</code> ` +
        `(the deployed HTML + JS/CSS bundle is loaded from this host)</p>` +
        `<p><strong>⚠️ Scope:</strong> API responses are <strong>mocked</strong> ` +
        `(<code>/metrics</code>, <code>/metrics/hierarchy</code>, MSAL login and MS Graph ` +
        `are all intercepted). These tests verify <strong>frontend behaviour against ` +
        `fixture data</strong> — they do <strong>not</strong> exercise the real backend, ` +
        `real data, or real authentication.</p>`
    );
  }
  if (note) {
    parts.push(`<p><strong>ℹ️ Run note:</strong> ${escapeXml(note)}</p>`);
  }
  const failing = specs.filter((s) => s.status !== 'passed' && s.status !== 'skipped');

  if (failing.length) {
    const items = failing
      .map((s) => {
        const reason = (s.errorMessage || '').split('\n')[0].slice(0, 300) || 'No error detail reported';
        return `<li style="line-height: 1.4;"><strong>${escapeXml(s.title)}</strong>: ${escapeXml(reason)}</li>`;
      })
      .join('');
    parts.push(`<p><strong>⚠️ Why tests failed:</strong></p><ul>${items}</ul>`);
  }

  for (const [suite, group] of groupBySuite(specs)) {
    const items = group
      .map(
        (s) =>
          `<li style="line-height: 1.4;">${iconFor(s.status)} ${escapeXml(s.title)}</li>`
      )
      .join('');
    parts.push(`<h3>${escapeXml(suite)}</h3><ul>${items}</ul>`);
  }

  return parts.join('');
}

function buildRowMarkup(result) {
  const t = result.totals;
  const passed = t.passed;
  const failed = t.failed + (t.flaky || 0);
  const blocked = t.skipped;

  const color = failed > 0 ? ROW_COLORS.fail : blocked > 0 ? ROW_COLORS.blocked : ROW_COLORS.pass;
  const today = new Date().toISOString().slice(0, 10);
  const seconds = (result.durationMs / 1000).toFixed(1);
  const description = `Playwright E2E — gm-salesplanning-frontend (${seconds}s, Chromium)` +
    (result.note ? ` — ${result.note}` : '');

  // Bugs found counts confirmed product defects. Harness/environment failures
  // are not product bugs, so this is derived from failures only.
  const bugsFound = failed;

  const cell = (value, bold) =>
    `<td style="background-color: ${color};"><p>${bold ? `<strong>${value}</strong>` : value}</p></td>`;

  const summaryRow = [
    '<tr>',
    cell(escapeXml(ROW_LABEL), true),
    cell(escapeXml(today)),
    cell(escapeXml(description)),
    cell(escapeXml(passed), true),
    cell(escapeXml(failed), true),
    cell(escapeXml(blocked)),
    cell(escapeXml(bugsFound)),
    '</tr>',
  ].join('');

  const titleParts = [`${passed} passed`];
  if (failed) titleParts.push(`${failed} failed`);
  if (blocked) titleParts.push(`${blocked} skipped`);
  const prefix = failed > 0 ? '⚠️ ' : '';
  const expandTitle = `${prefix}Show all ${t.total} tests (${titleParts.join(' · ')})`;

  const detailRow =
    `<tr><td colspan="7" style="background-color: ${color};">` +
    '<div class="content-wrapper">' +
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    `<ac:parameter ac:name="title">${escapeXml(expandTitle)}</ac:parameter>` +
    `<ac:rich-text-body>${buildDetailBody(result.specs, result.note, result.targetUrl)}</ac:rich-text-body>` +
    '</ac:structured-macro></div></td></tr>';

  return summaryRow + detailRow;
}

/**
 * Replaces the existing managed E2E row pair, or appends one when absent.
 * Matching is confined within a single row so the header row can never be
 * swallowed by a greedy match.
 */
function upsertE2eRows(storageValue, rowMarkup) {
  const withinRow = '(?:(?!<\\/tr>)[\\s\\S])*?';
  const existing = new RegExp(
    `<tr[^>]*>${withinRow}${ROW_LABEL}${withinRow}<\\/tr>\\s*<tr[^>]*>${withinRow}<\\/tr>`,
    'i'
  );

  if (existing.test(storageValue)) {
    return { storage: storageValue.replace(existing, rowMarkup), action: 'updated' };
  }

  if (storageValue.includes('</tbody></table>')) {
    return { storage: storageValue.replace('</tbody></table>', `${rowMarkup}</tbody></table>`), action: 'created' };
  }
  const idx = storageValue.lastIndexOf('</table>');
  if (idx === -1) throw new Error('Could not find the QA Summary table on the Confluence page.');
  return {
    storage: `${storageValue.slice(0, idx)}${rowMarkup}</table>${storageValue.slice(idx + 8)}`,
    action: 'created',
  };
}

/**
 * Older revisions of the page carried a standalone "E2E Test Run" <h2> section
 * below the table that repeated the full 211-test listing already collapsed
 * inside the table row — the same content twice on one page.
 *
 * The table row is the canonical home for the E2E detail (Tim, 2026-08-26), so
 * this strips the duplicate section if it is present. Removing rather than
 * merely refreshing means the page self-heals if an old copy is ever restored.
 */
function removeStandaloneSection(storageValue) {
  const heading = /<h2>E2E Test Run[^<]*<\/h2>\s*<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/i;
  if (!heading.test(storageValue)) return { storage: storageValue, removed: false };
  return { storage: storageValue.replace(heading, ''), removed: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resultPath = args.result ? path.resolve(args.result) : DEFAULT_RESULT;
  const env = loadEnv(args.env ? path.resolve(args.env) : DEFAULT_ENV);

  for (const key of ['CONFLUENCE_BASE_URL', 'CONFLUENCE_API_TOKEN', 'CONFLUENCE_PAGE_ID']) {
    if (!env[key]) throw new Error(`Missing ${key} in .env`);
  }

  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  if (result.status === 'blocked') {
    throw new Error('Refusing to publish a blocked run — the suite never executed.');
  }

  const baseUrl = env.CONFLUENCE_BASE_URL.replace(/\/$/, '');
  const page = await requestJson(
    `${baseUrl}/rest/api/content/${env.CONFLUENCE_PAGE_ID}?expand=body.storage,version`,
    { headers: headersFor(env.CONFLUENCE_API_TOKEN) }
  );

  const rowMarkup = buildRowMarkup(result);
  const { storage: withRow, action } = upsertE2eRows(page.body?.storage?.value || '', rowMarkup);
  const { storage, removed } = removeStandaloneSection(withRow);

  console.log(`[Confluence] Page: ${page.title} (v${page.version?.number})`);
  console.log(`[Confluence] Row action: ${action}`);
  console.log(
    `[Confluence] Duplicate standalone section: ${removed ? 'removed' : 'not present'}`
  );
  console.log(
    `[Confluence] Totals: ${result.totals.passed} passed, ` +
      `${result.totals.failed + result.totals.flaky} failed, ${result.totals.skipped} skipped`
  );

  if (args['dry-run']) {
    const out = path.join(path.dirname(resultPath), 'confluence-preview.html');
    fs.writeFileSync(out, storage);
    console.log(`[Confluence] Dry run — preview written to ${out}`);
    return;
  }

  const updated = await requestJson(`${baseUrl}/rest/api/content/${env.CONFLUENCE_PAGE_ID}`, {
    method: 'PUT',
    headers: headersFor(env.CONFLUENCE_API_TOKEN),
    body: JSON.stringify({
      id: page.id,
      type: page.type,
      title: page.title,
      version: { number: (page.version?.number || 1) + 1 },
      body: { storage: { value: storage, representation: 'storage' } },
    }),
  });

  console.log(`[Confluence] Published. New version: ${updated.version?.number}`);
}

main().catch((error) => {
  console.error(`[Confluence] ${error.message}`);
  process.exit(1);
});
