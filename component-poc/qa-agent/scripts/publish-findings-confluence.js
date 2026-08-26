#!/usr/bin/env node
/**
 * publish-findings-confluence.js
 *
 * Publishes a "Live UI Findings" section to the AI QA Summary Confluence page.
 *
 * Why a standalone section rather than table rows: the managed QA summary table
 * is strictly one row pair per Jira ticket (confluence-writer AGENT.md rule 8 —
 * non-ticket-scoped results must never become ticket rows). These findings come
 * from exploratory live-UI inspection and have no Jira key yet, so they are
 * rendered as their own <h2> section, mirroring the existing standalone
 * "E2E Test Run" section that publish-e2e-confluence.js maintains.
 *
 * The section is upserted by heading match, so re-running replaces it rather
 * than appending duplicates.
 *
 * Usage:
 *   node publish-findings-confluence.js --findings=<json> --env=<path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const PAGE_ID = '1353804850';
const HEADING = 'Live UI Findings';

const SEVERITY_COLORS = {
  high: 'rgb(255,235,230)',
  medium: 'rgb(255,247,214)',
  low: 'rgb(227,252,239)',
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

function buildSection(findings, today) {
  const rows = findings
    .map((f) => {
      const color = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.low;
      const cell = (v, bold) =>
        `<td style="background-color: ${color};"><p>${bold ? `<strong>${v}</strong>` : v}</p></td>`;
      return (
        '<tr>' +
        cell(escapeXml(f.id), true) +
        cell(escapeXml(f.title)) +
        cell(escapeXml(f.severity)) +
        cell(escapeXml(f.where)) +
        cell(escapeXml(f.evidence)) +
        '</tr>'
      );
    })
    .join('');

  const header =
    '<tr>' +
    ['ID', 'Finding', 'Severity', 'Where', 'Evidence']
      .map((h) => `<th><p><strong>${h}</strong></p></th>`)
      .join('') +
    '</tr>';

  const detail = findings
    .map(
      (f) =>
        `<h3>${escapeXml(f.id)} — ${escapeXml(f.title)}</h3>` +
        `<p><strong>Observed:</strong> ${escapeXml(f.observed)}</p>` +
        `<p><strong>Expected:</strong> ${escapeXml(f.expected)}</p>` +
        `<p><strong>Why it matters:</strong> ${escapeXml(f.impact)}</p>` +
        (f.note ? `<p><em>${escapeXml(f.note)}</em></p>` : '')
    )
    .join('');

  return (
    `<h2>${HEADING} — ${escapeXml(today)}</h2>` +
    '<p>Findings from manual inspection of the live deployed app ' +
    '(<a href="https://dev.salesplanning.ingka.com">dev.salesplanning.ingka.com</a>) ' +
    'against <strong>real backend data</strong>. These are <strong>not</strong> covered by the ' +
    'automated E2E suite, which runs entirely against mocked API responses and therefore ' +
    'cannot observe real-data sign conventions or zero-value states. ' +
    'No Jira tickets raised yet.</p>' +
    `<table><tbody>${header}${rows}</tbody></table>` +
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    `<ac:parameter ac:name="title">Detail for all ${findings.length} findings</ac:parameter>` +
    `<ac:rich-text-body>${detail}</ac:rich-text-body>` +
    '</ac:structured-macro>'
  );
}

/** Upsert by heading so re-runs replace rather than duplicate. */
function sectionPattern() {
  return new RegExp(`<h2>${HEADING}[^<]*</h2>[\\s\\S]*?</ac:structured-macro>`, 'i');
}

function upsertSection(storageValue, section) {
  const existing = sectionPattern();
  if (existing.test(storageValue)) {
    return { storage: storageValue.replace(existing, section), action: 'updated' };
  }
  return { storage: storageValue + section, action: 'appended' };
}

/**
 * Removes the findings section entirely. Withdrawing findings has to be as
 * easy as filing them — otherwise a finding later confirmed as expected
 * behaviour is stranded on the page as a phantom defect.
 */
function removeSection(storageValue) {
  const existing = sectionPattern();
  if (!existing.test(storageValue)) {
    return { storage: storageValue, action: 'absent (nothing to remove)' };
  }
  return { storage: storageValue.replace(existing, ''), action: 'removed' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const findingsPath = args.findings;
  const envPath = args.env;
  if (!findingsPath || !envPath) {
    throw new Error('Both --findings=<json> and --env=<path> are required');
  }

  const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  if (!Array.isArray(findings)) {
    throw new Error('Findings file must be an array');
  }
  // An empty array is meaningful, not an error: it means "there are no
  // outstanding findings", and the section should be taken down.
  const isEmpty = findings.length === 0;

  const { baseUrl, token } = loadEnv(envPath);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(`${baseUrl}/rest/api/content/${PAGE_ID}?expand=version,body.storage`, {
    headers,
  });
  if (!res.ok) throw new Error(`Failed to read page: ${res.status}`);
  const page = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const { storage, action } = isEmpty
    ? removeSection(page.body.storage.value)
    : upsertSection(page.body.storage.value, buildSection(findings, today));

  console.log(`[Confluence] Page: ${page.title} (v${page.version.number})`);
  console.log(
    isEmpty
      ? `[Confluence] Findings section: ${action} (no outstanding findings)`
      : `[Confluence] Findings section: ${action} (${findings.length} findings)`
  );

  if (args['dry-run']) {
    const out = path.join('/tmp', 'confluence-findings-preview.html');
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
