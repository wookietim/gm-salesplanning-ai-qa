#!/usr/bin/env node
/**
 * publish-api-confluence.js
 *
 * Publishes an "API Probe Run" section to the AI QA Summary Confluence page.
 *
 * Why this is a separate section from the E2E one: the Playwright suite mocks
 * /metrics entirely, so it never touches a backend. These probes do the opposite
 * - they hit the real API at api.dev.salesplanning.ingka.com with a live token
 * from an authenticated browser session. Merging the two would misrepresent
 * both, so they stay distinct.
 *
 * Why not table rows: the managed QA summary table is one row pair per Jira
 * ticket (confluence-writer AGENT.md rule 8). These results are not
 * ticket-scoped, so they render as their own <h2>, upserted by heading match.
 *
 * Observations are rendered distinctly from passes and failures. An observation
 * is a probe whose intended behaviour is genuinely unknown - reporting one as a
 * failure would manufacture a defect out of a design choice.
 *
 * Usage:
 *   node publish-api-confluence.js --results=<json> --env=<path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const PAGE_ID = '1353804850';
const HEADING = 'API Probe Run';

const OUTCOME_STYLE = {
  passed: { color: 'rgb(227,252,239)', label: 'Passed' },
  failed: { color: 'rgb(255,235,230)', label: 'Failed' },
  observed: { color: 'rgb(234,242,255)', label: 'Observation' },
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
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function loadEnv(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const get = (key) => (raw.match(new RegExp('^' + key + '=(.*)$', 'm')) || [])[1];
  const baseUrl = (get('CONFLUENCE_BASE_URL') || get('CONFLUENCE_URL') || '').trim();
  const token = (get('CONFLUENCE_TOKEN') || get('CONFLUENCE_API_TOKEN') || '').trim();
  if (!baseUrl || !token) throw new Error('Confluence base URL or token missing from env file');
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

function summarise(results) {
  const counts = { passed: 0, failed: 0, observed: 0 };
  results.forEach((r) => {
    counts[r.outcome] = (counts[r.outcome] || 0) + 1;
  });
  return counts;
}

function buildSection(payload, today) {
  const results = payload.results || [];
  const counts = summarise(results);

  const groups = [];
  results.forEach((r) => {
    let g = groups.find((x) => x.name === r.group);
    if (!g) groups.push((g = { name: r.group, rows: [] }));
    g.rows.push(r);
  });

  const header =
    '<tr>' +
    ['Probe', 'Outcome', 'HTTP', 'Time', 'Detail']
      .map((h) => `<th><p><strong>${h}</strong></p></th>`)
      .join('') +
    '</tr>';

  const body = groups
    .map((g) => {
      const groupRow =
        '<tr><td colspan="5" style="background-color: rgb(244,245,247);">' +
        `<p><strong>${escapeXml(g.name)}</strong></p></td></tr>`;
      const rows = g.rows
        .map((r) => {
          const style = OUTCOME_STYLE[r.outcome] || OUTCOME_STYLE.observed;
          const detail = (r.reasons && r.reasons.length ? r.reasons.join('; ') : r.note) || '—';
          const cell = (v, bold) =>
            `<td style="background-color: ${style.color};"><p>${
              bold ? `<strong>${v}</strong>` : v
            }</p></td>`;
          return (
            '<tr>' +
            cell(escapeXml(r.name)) +
            cell(escapeXml(style.label), true) +
            cell(escapeXml(r.status === null ? 'n/a' : r.status)) +
            cell(escapeXml(r.ms === undefined ? '—' : r.ms + 'ms')) +
            cell(escapeXml(detail)) +
            '</tr>'
          );
        })
        .join('');
      return groupRow + rows;
    })
    .join('');

  const observations = results.filter((r) => r.outcome === 'observed');
  const observationNote = observations.length
    ? '<p><strong>About observations:</strong> these probes exercised behaviour whose ' +
      'intended design is not documented, so they are reported as observations rather ' +
      'than failures. They have been reviewed and confirmed as expected behaviour — ' +
      'they are <strong>not</strong> defects.</p>'
    : '';

  // The detail table is collapsed by default, matching the E2E row. The title
  // carries the counts so the section is still readable while closed, and a
  // failure prefixes a warning so nothing bad can hide behind a shut drawer.
  const titleParts = [`${counts.passed || 0} passed`];
  if (counts.failed) titleParts.push(`${counts.failed} failed`);
  if (counts.observed) titleParts.push(`${counts.observed} observed`);
  const expandTitle =
    `${counts.failed ? '⚠️ ' : ''}Show all ${results.length} probes ` +
    `(${titleParts.join(' · ')})`;

  const detailTable =
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    `<ac:parameter ac:name="title">${escapeXml(expandTitle)}</ac:parameter>` +
    '<ac:rich-text-body>' +
    `<table><tbody>${header}${body}</tbody></table>` +
    '</ac:rich-text-body>' +
    '</ac:structured-macro>';

  return (
    `<h2>${HEADING} — ${escapeXml(today)}</h2>` +
    '<p>Probes run against the <strong>real backend API</strong> at ' +
    `<code>${escapeXml(payload.target || 'unknown')}</code>, using a live token from an ` +
    'authenticated browser session.</p>' +
    '<p><strong>Scope — how this differs from the E2E run:</strong> the Playwright E2E ' +
    'suite mocks every API call, so it verifies UI behaviour against fixture data and ' +
    'never contacts a backend. These probes are the inverse: they contact the real API ' +
    'directly and verify its contract, validation and authentication. Neither ' +
    'replaces the other.</p>' +
    `<p><strong>Result:</strong> ${counts.passed || 0} passed, ${counts.failed || 0} failed, ` +
    `${counts.observed || 0} observation(s), across ${results.length} probes.</p>` +
    observationNote +
    detailTable +
    (payload.note ? `<p><em>${escapeXml(payload.note)}</em></p>` : '') +
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    '<ac:parameter ac:name="title">Run metadata</ac:parameter>' +
    '<ac:rich-text-body>' +
    `<p>Target: <code>${escapeXml(payload.target)}</code></p>` +
    `<p>Run at: ${escapeXml(payload.ranAt || today)}</p>` +
    `<p>Probes: ${results.length}</p>` +
    '</ac:rich-text-body>' +
    '</ac:structured-macro>'
  );
}

/**
 * Bounds the managed section from its heading to the start of the next <h2>,
 * or the end of the page.
 *
 * This deliberately does NOT end at </ac:structured-macro>. The section now
 * contains two macros - the collapsible detail table and the run metadata -
 * and a lazy match would stop at the first, leaving the metadata block behind
 * to be duplicated on every subsequent publish.
 */
function sectionPattern() {
  return new RegExp(`<h2>${HEADING}[^<]*</h2>[\\s\\S]*?(?=<h2>|$)`, 'i');
}

function upsertSection(storageValue, section) {
  const existing = sectionPattern();
  if (existing.test(storageValue)) {
    return { storage: storageValue.replace(existing, section), action: 'updated' };
  }
  return { storage: storageValue + section, action: 'appended' };
}

/** Removing has to be as easy as publishing, so a stale run can be withdrawn. */
function removeSection(storageValue) {
  const existing = sectionPattern();
  if (!existing.test(storageValue)) {
    return { storage: storageValue, action: 'absent (nothing to remove)' };
  }
  return { storage: storageValue.replace(existing, ''), action: 'removed' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.results || !args.env) {
    throw new Error('Both --results=<json> and --env=<path> are required');
  }

  const payload = JSON.parse(fs.readFileSync(args.results, 'utf8'));
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error('Results file must be an object with a "results" array');
  }

  const { baseUrl, token } = loadEnv(args.env);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const res = await fetch(`${baseUrl}/rest/api/content/${PAGE_ID}?expand=version,body.storage`, {
    headers,
  });
  if (!res.ok) throw new Error(`Failed to read page: ${res.status}`);
  const page = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const { storage, action } = args.remove
    ? removeSection(page.body.storage.value)
    : upsertSection(page.body.storage.value, buildSection(payload, today));

  const counts = summarise(payload.results);
  console.log(`[Confluence] Page: ${page.title} (v${page.version.number})`);
  console.log(
    `[Confluence] API section: ${action} ` +
      `(${counts.passed || 0} passed, ${counts.failed || 0} failed, ${counts.observed || 0} observed)`
  );

  if (args['dry-run']) {
    const out = path.join('/tmp', 'confluence-api-preview.html');
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

if (require.main === module) {
  main().catch((err) => {
    console.error(`[Confluence] ERROR: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { buildSection, upsertSection, removeSection, summarise };
