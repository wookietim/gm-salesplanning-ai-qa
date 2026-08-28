#!/usr/bin/env node
/**
 * publish-integration-confluence.js
 *
 * Publishes a "UI ↔ API Integration Run" section to the AI QA Summary page.
 *
 * Why a THIRD section exists. The Playwright E2E suite mocks /metrics, so it
 * proves the UI renders *fixture* data correctly. The API probes never open the
 * UI, so they prove the API is internally sane. A wrong field mapping - the UI
 * reading netSalesIndexToGoal where it should read netQuantityIndexToGoal -
 * passes BOTH, because each side is only ever checked against itself. This
 * suite drives the real UI, calls the real API for the same slice, and asserts
 * the numbers on screen are the numbers the API returned. That seam is the only
 * place such a bug is visible.
 *
 * "Harness" is a first-class outcome and is rendered distinctly from "failed".
 * A DOM scraper that hits a shared ancestor reports every row as wrong; a
 * changed class name reports zero rows. Both are defects in this tooling, not
 * in the product, and calling them failures would manufacture fake bugs. This
 * happened twice for real while the suite was being written.
 *
 * Usage:
 *   node publish-integration-confluence.js --results=<json> --env=<path> [--dry-run] [--remove]
 */

const fs = require('fs');
const path = require('path');
const { stepsFor } = require('./repro-steps');

const PAGE_ID = '1353804850';
const HEADING = 'UI ↔ API Integration Run';

const OUTCOME_STYLE = {
  passed: { color: 'rgb(227,252,239)', label: 'Passed' },
  failed: { color: 'rgb(255,235,230)', label: 'Failed' },
  harness: { color: 'rgb(255,250,230)', label: 'Harness issue' },
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
  const counts = { passed: 0, failed: 0, harness: 0, observed: 0 };
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
    ['Check', 'Outcome', 'Evidence', 'Replicate by hand']
      .map((c) => `<th><p><strong>${c}</strong></p></th>`)
      .join('') +
    '</tr>';

  const body = groups
    .map((g) => {
      const groupRow =
        '<tr><td colspan="4" style="background-color: rgb(244,245,247);">' +
        `<p><strong>${escapeXml(g.name)}</strong></p></td></tr>`;
      const rows = g.rows
        .map((r) => {
          const style = OUTCOME_STYLE[r.outcome] || OUTCOME_STYLE.observed;
          const detail = (r.reasons && r.reasons.length ? r.reasons.join('; ') : r.note) || '—';
          const cell = (v, bold) =>
            `<td style="background-color: ${style.color};"><p>${
              bold ? `<strong>${v}</strong>` : v
            }</p></td>`;

          // Steps are authored in repro-steps.js and already carry their own
          // inline markup, so they are emitted as-is rather than escaped. They
          // are collapsed per row because 72 checks x ~9 steps would otherwise
          // bury the results the table exists to show.
          const steps = stepsFor(r, payload);
          const stepsCell =
            `<td style="background-color: ${style.color};">` +
            '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
            '<ac:parameter ac:name="title">Show steps</ac:parameter>' +
            '<ac:rich-text-body>' +
            `<ol>${steps.map((s) => `<li><p>${s}</p></li>`).join('')}</ol>` +
            '</ac:rich-text-body>' +
            '</ac:structured-macro>' +
            '</td>';

          return (
            '<tr>' +
            cell(escapeXml(r.name)) +
            cell(escapeXml(style.label), true) +
            cell(escapeXml(detail)) +
            stepsCell +
            '</tr>'
          );
        })
        .join('');
      return groupRow + rows;
    })
    .join('');

  const observedNote = counts.observed
    ? '<p><strong>About observations:</strong> these are behaviours the suite can ' +
      'measure precisely but cannot judge, because the intended design is not ' +
      'documented. They are raised as questions for the product team and are ' +
      '<strong>not</strong> reported as defects.</p>'
    : '';

  const harnessNote = counts.harness
    ? '<p><strong>About harness issues:</strong> these checks could not reach a verdict ' +
      'because the test tooling failed to read the page — a changed class name or a ' +
      'selector matching a shared ancestor. They are defects in this suite, not in the ' +
      'product, and are reported separately so they are never mistaken for bugs.</p>'
    : '';

  // Collapsed by default, matching the E2E row. Counts live in the title so the
  // section still reads correctly while shut, and a failure is prefixed with a
  // warning so a bad run cannot hide behind a closed drawer.
  const titleParts = [`${counts.passed || 0} passed`];
  if (counts.failed) titleParts.push(`${counts.failed} failed`);
  if (counts.harness) titleParts.push(`${counts.harness} harness`);
  if (counts.observed) titleParts.push(`${counts.observed} observed`);
  const expandTitle =
    `${counts.failed ? '⚠️ ' : ''}Show all ${results.length} checks ` +
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
    '<p>These checks drive the <strong>real UI</strong> in an authenticated browser and, ' +
    'for the same data slice, call the <strong>real API</strong> at ' +
    `<code>${escapeXml(payload.env || 'unknown')}</code>. Each check asserts that the value ` +
    'rendered on screen is the value the API actually returned.</p>' +
    '<p><strong>Why this is separate from the other two runs:</strong> the Playwright E2E ' +
    'suite mocks every API call, so it proves the UI renders <em>fixture</em> data ' +
    'correctly. The API probes never open the UI, so they prove the API is internally ' +
    'consistent. A wrong field mapping — the UI reading the sales index where it should ' +
    'read the quantity index — would pass both, because each side is only checked against ' +
    'itself. This run covers that seam, and only that seam.</p>' +
    `<p><strong>Result:</strong> ${counts.passed || 0} passed, ${counts.failed || 0} failed, ` +
    `${counts.harness || 0} harness issue(s), ${counts.observed || 0} observation(s), ` +
    `across ${results.length} checks ` +
    `(retail unit <code>${escapeXml(payload.retailUnit || 'n/a')}</code>).</p>` +
    harnessNote +
    observedNote +
    '<p><strong>Replicating a check by hand:</strong> every row has a ' +
    '<em>Show steps</em> drawer with numbered steps — the exact URL, what to look at ' +
    'on screen, and what to compare it against. Most steps involve reading an API ' +
    'response, and the only practical manual route is DevTools → Network, because the ' +
    'endpoint is a POST that needs the signed-in session\'s token and so cannot simply ' +
    'be opened in a tab. Checks that only concern what is on screen say so and do not ' +
    'mention DevTools.</p>' +
    detailTable +
    (payload.note ? `<p><em>${escapeXml(payload.note)}</em></p>` : '') +
    '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    '<ac:parameter ac:name="title">Run metadata</ac:parameter>' +
    '<ac:rich-text-body>' +
    `<p>Environment: <code>${escapeXml(payload.env)}</code></p>` +
    `<p>Retail unit: ${escapeXml(payload.retailUnit || 'n/a')}</p>` +
    `<p>Run at: ${escapeXml(payload.ranAt || today)}</p>` +
    `<p>Checks: ${results.length}</p>` +
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
    `[Confluence] Integration section: ${action} ` +
      `(${counts.passed || 0} passed, ${counts.failed || 0} failed, ${counts.harness || 0} harness)`
  );

  if (args['dry-run']) {
    const out = path.join('/tmp', 'confluence-integration-preview.html');
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
