#!/usr/bin/env node
/**
 * publish-ticket-confluence.js
 *
 * Upserts a single Jira-ticket row pair into the managed QA summary table on
 * the AI QA Summary Confluence page, following confluence-writer AGENT.md.
 *
 * Why this exists separately from publish-findings-confluence.js: that script
 * deliberately renders a standalone section because its findings have no Jira
 * key (rule 8 — non-ticket-scoped results must never become ticket rows). The
 * inverse case, a result that *is* scoped to a real ticket, belongs in the
 * managed table as a row pair, and nothing wrote those rows before.
 *
 * Input JSON shape (as produced by a ticket-scoped Pablo run):
 *   { ticket, title, ru, ranAt, results: [{ group, name, outcome, reasons, note }] }
 * where outcome is 'passed' | 'failed' | 'blocked'.
 *
 * Usage:
 *   node publish-ticket-confluence.js --result=<json> --env=<path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const PAGE_ID = '1353804850';
const JIRA_BROWSE = 'https://jira.digital.ingka.com/browse/';

const COLORS = {
  red: 'rgb(255,235,230)',
  yellow: 'rgb(255,247,214)',
  green: 'rgb(227,252,239)',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      out[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[token.slice(2)] = next;
        i++;
      } else {
        out[token.slice(2)] = true;
      }
    }
  }
  return out;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function loadEnv(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const get = (key) => (raw.match(new RegExp('^' + key + '=(.*)$', 'm')) || [])[1];
  const baseUrl = get('CONFLUENCE_BASE_URL') || get('CONFLUENCE_URL');
  const token = get('CONFLUENCE_TOKEN') || get('CONFLUENCE_API_TOKEN');
  if (!baseUrl || !token) throw new Error('Confluence base URL or token missing from env file');
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

/** Rule 9: colour is derived from the counts, never guessed or carried over. */
function colorFor(counts) {
  if (counts.failed > 0) return COLORS.red;
  if (counts.blocked > 0) return COLORS.yellow;
  return COLORS.green;
}

function countOutcomes(results) {
  const counts = { passed: 0, failed: 0, blocked: 0 };
  for (const r of results) {
    if (r.outcome === 'passed') counts.passed++;
    else if (r.outcome === 'failed') counts.failed++;
    else counts.blocked++;
  }
  return counts;
}

const ICONS = { passed: '✅', failed: '❌' };

function buildRowPair(payload) {
  const { ticket, title, results } = payload;
  const counts = countOutcomes(results);
  const bg = colorFor(counts);
  const total = results.length;
  const ranDate = String(payload.ranAt || '').slice(0, 10);

  const cell = (inner) => `<td style="background-color: ${bg};">${inner}</td>`;
  const link =
    `<a href="${JIRA_BROWSE}${escapeXml(ticket)}">${escapeXml(ticket)}</a>`;

  const summary =
    '<tr>' +
    cell(`<p><strong>${link}</strong></p>`) +
    cell(`<p>${escapeXml(ranDate)}</p>`) +
    cell(`<p>${escapeXml(title || '')}</p>`) +
    cell(`<p><strong>${counts.passed}</strong></p>`) +
    cell(`<p><strong>${counts.failed}</strong></p>`) +
    cell(`<p>${counts.blocked}</p>`) +
    cell(`<p>${counts.failed}</p>`) +
    '</tr>';

  const failing = results.filter((r) => r.outcome === 'failed');

  const failureSection = failing.length
    ? '<p><strong>⚠️ Why tests failed:</strong></p><ul>' +
      failing
        .map(
          (r) =>
            `<li style="line-height: 1.4;"><strong>${escapeXml(r.name)}</strong>: ` +
            `${escapeXml(r.note || '')}</li>`
        )
        .join('') +
      '</ul>'
    : '';

  const list =
    '<h3>All checks</h3><ul>' +
    results
      .map((r) => {
        const icon = ICONS[r.outcome] || '⛔';
        const reasons = (r.reasons || []).length
          ? '<ul>' +
            r.reasons
              .map(
                (x) =>
                  `<li style="line-height: 1.4;"><code>${escapeXml(x)}</code></li>`
              )
              .join('') +
            '</ul>'
          : '';
        return (
          `<li style="line-height: 1.4;">${icon} <strong>${escapeXml(r.group)}</strong> — ` +
          `${escapeXml(r.name)}${reasons}</li>`
        );
      })
      .join('') +
    '</ul>';

  // Standing preference: every reported result carries by-hand repro steps.
  const repro = payload.repro
    ? '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
      '<ac:parameter ac:name="title">Replicate all of this by hand</ac:parameter>' +
      `<ac:rich-text-body>${payload.repro}</ac:rich-text-body>` +
      '</ac:structured-macro>'
    : '';

  const scope = payload.scope
    ? `<p><strong>🎯 Scope:</strong> ${payload.scope}</p>`
    : '';

  const detail =
    `<tr><td colspan="7" style="background-color: ${bg}; border-top: none; ` +
    'padding: 0 8px 6px 8px;"><div class="content-wrapper">' +
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    `<ac:parameter ac:name="title">Show tests (${total})</ac:parameter>` +
    '<ac:rich-text-body>' +
    scope +
    failureSection +
    list +
    repro +
    '</ac:rich-text-body></ac:structured-macro></div></td></tr>';

  return { rows: summary + detail, counts, total };
}

/**
 * Replaces an existing row pair for this ticket, or inserts one at the end of
 * the managed table. The managed table is identified by its "Jira Ticket"
 * header so we never touch the standalone run tables further down the page.
 */
function upsertRowPair(storage, ticket, rows) {
  const headerIdx = storage.indexOf('<p>Jira Ticket</p>');
  if (headerIdx === -1) throw new Error('Managed QA summary table not found on page');
  const tableStart = storage.lastIndexOf('<table', headerIdx);
  const tableEnd = storage.indexOf('</tbody>', headerIdx);
  if (tableStart === -1 || tableEnd === -1) {
    throw new Error('Could not determine managed table bounds');
  }

  const table = storage.slice(tableStart, tableEnd);
  const marker = `${JIRA_BROWSE}${ticket}"`;
  const at = table.indexOf(marker);

  if (at !== -1) {
    // Replace the summary row containing the link plus the detail row after it.
    const rowStart = table.lastIndexOf('<tr', at);
    const firstEnd = table.indexOf('</tr>', rowStart) + 5;
    const secondEnd = table.indexOf('</tr>', firstEnd) + 5;
    const updated = table.slice(0, rowStart) + rows + table.slice(secondEnd);
    return {
      storage: storage.slice(0, tableStart) + updated + storage.slice(tableEnd),
      action: 'updated',
    };
  }

  return {
    storage: storage.slice(0, tableEnd) + rows + storage.slice(tableEnd),
    action: 'added',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.result || !args.env) {
    throw new Error('Both --result=<json> and --env=<path> are required');
  }

  const payload = JSON.parse(fs.readFileSync(args.result, 'utf8'));
  if (!payload.ticket) throw new Error('Result file has no "ticket" key');
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    // Rule 8: never write a ticket row without a real ticket-scoped result.
    throw new Error('Result file has no executed checks — refusing to write a ticket row');
  }

  const { baseUrl, token } = loadEnv(args.env);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(`${baseUrl}/rest/api/content/${PAGE_ID}?expand=version,body.storage`, {
    headers,
  });
  if (!res.ok) throw new Error(`Failed to read page: ${res.status}`);
  const page = await res.json();

  const { rows, counts, total } = buildRowPair(payload);
  const { storage, action } = upsertRowPair(page.body.storage.value, payload.ticket, rows);

  console.log(`[Confluence] Page: ${page.title} (v${page.version.number})`);
  console.log(
    `[Confluence] ${payload.ticket} row ${action} — ` +
      `${counts.passed} passed, ${counts.failed} failed, ${counts.blocked} blocked (${total} checks)`
  );

  if (args['dry-run']) {
    const out = path.join('/tmp', 'confluence-ticket-preview.html');
    fs.writeFileSync(out, storage);
    console.log(`[Confluence] Dry run — preview written to ${out}`);
    return;
  }

  const put = await fetch(`${baseUrl}/rest/api/content/${PAGE_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: PAGE_ID,
      type: 'page',
      title: page.title,
      version: { number: page.version.number + 1 },
      body: { storage: { value: storage, representation: 'storage' } },
    }),
  });
  if (!put.ok) throw new Error(`Failed to publish: ${put.status} ${await put.text()}`);
  const updated = await put.json();
  console.log(`[Confluence] Published. New version: ${updated.version.number}`);
}

main().catch((err) => {
  console.error(`[Confluence] ERROR: ${err.message}`);
  process.exit(1);
});
