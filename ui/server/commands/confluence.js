const https = require('https');
const http = require('http');

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

/**
 * Extract all data row-pairs (summary row + detail row) from the table body.
 * Header rows (those whose first <td> does not contain an SSPLAN- key) are
 * returned separately so we can rebuild the table cleanly.
 *
 * Returns { headerRows: string[], dataPairs: Array<{ ticketNumber: number, parentNumber: number|null, markup: string }> }
 */
function parseTableRows(tableBody) {
  // Split into individual <tr>…</tr> blocks, preserving their content.
  const trPattern = /<tr[\s\S]*?<\/tr>/gi;
  const allRows = tableBody.match(trPattern) || [];

  const headerRows = [];
  const dataPairs = [];
  let i = 0;

  while (i < allRows.length) {
    const row = allRows[i];
    const ticketMatch = row.match(/SSPLAN-(\d+)/i);

    if (!ticketMatch) {
      headerRows.push(row);
      i += 1;
      continue;
    }

    // This is a summary row — the next row is its detail row.
    const detailRow = allRows[i + 1] || '';
    const pairMarkup = detailRow ? row + detailRow : row;
    const ticketNumber = parseInt(ticketMatch[1], 10);

    // Detect subtask: rendered markup contains "↳ subtask of SSPLAN-NNN"
    const parentMatch = pairMarkup.match(/↳\s*subtask\s*of\s*SSPLAN-(\d+)/i);
    const parentNumber = parentMatch ? parseInt(parentMatch[1], 10) : null;

    dataPairs.push({ ticketNumber, parentNumber, markup: pairMarkup });
    i += detailRow ? 2 : 1;
  }

  return { headerRows, dataPairs };
}

/**
 * Sort data row-pairs: stories in ascending numeric order, subtasks
 * immediately after their parent story in ascending numeric order.
 * Orphaned subtasks (parent not present) are sorted by their own number.
 */
function sortDataPairs(dataPairs) {
  const stories = dataPairs.filter((p) => p.parentNumber === null);
  const subtasks = dataPairs.filter((p) => p.parentNumber !== null);

  stories.sort((a, b) => a.ticketNumber - b.ticketNumber);

  const sorted = [];
  for (const story of stories) {
    sorted.push(story);
    const children = subtasks
      .filter((s) => s.parentNumber === story.ticketNumber)
      .sort((a, b) => a.ticketNumber - b.ticketNumber);
    sorted.push(...children);
  }

  // Append orphaned subtasks (parent story not in the table) sorted numerically.
  const placedSubtaskNums = new Set(subtasks.filter((s) => stories.some((st) => st.ticketNumber === s.parentNumber)).map((s) => s.ticketNumber));
  const orphans = subtasks
    .filter((s) => !placedSubtaskNums.has(s.ticketNumber))
    .sort((a, b) => a.ticketNumber - b.ticketNumber);
  sorted.push(...orphans);

  return sorted;
}

/**
 * After upsert, re-sort the table rows so stories appear in ascending numeric
 * order and subtasks are grouped under their parent in ascending numeric order.
 */
function resortTableRows(storageValue) {
  // Locate the last <table>…</table> block (the AI QA Summary table).
  const tablePattern = /(<table[\s\S]*?>)([\s\S]*?)(<\/table>)/i;
  const match = storageValue.match(tablePattern);
  if (!match) return storageValue;

  const [fullTable, tableOpen, tableBody, tableClose] = match;

  const { headerRows, dataPairs } = parseTableRows(tableBody);
  const sortedPairs = sortDataPairs(dataPairs);

  const rebuiltBody = [...headerRows, ...sortedPairs.map((p) => p.markup)].join('');
  const rebuiltTable = `${tableOpen}${rebuiltBody}${tableClose}`;

  return storageValue.replace(fullTable, rebuiltTable);
}

function upsertManagedTicketRows(storageValue, ticketKey, rowMarkup) {
  const escapedTicketKey = escapeRegex(ticketKey);
  // Match only the specific row that contains this ticket key — do NOT allow the
  // opening <tr> to span across other </tr> boundaries (which would eat the header row).
  // (?:(?!<\/tr>)[\s\S])*? = any char that does not start </tr>, so the match stays
  // within a single table row.
  const singleRow = `(?:(?!<\\/tr>)[\\s\\S])*?`;
  const existingRowPattern = new RegExp(
    `<tr[^>]*>${singleRow}${escapedTicketKey}${singleRow}<\\/tr>\\s*<tr[^>]*>${singleRow}<\\/tr>`,
    'i'
  );
  if (existingRowPattern.test(storageValue)) {
    return resortTableRows(storageValue.replace(existingRowPattern, rowMarkup));
  }

  // Try </tbody></table> first, then fall back to plain </table>.
  let updated;
  if (storageValue.includes('</tbody></table>')) {
    updated = storageValue.replace('</tbody></table>', `${rowMarkup}</tbody></table>`);
  } else if (storageValue.includes('</tbody>\n</table>')) {
    updated = storageValue.replace('</tbody>\n</table>', `${rowMarkup}</tbody>\n</table>`);
  } else if (storageValue.includes('</table>')) {
    // Insert before the last </table> in case there are multiple tables.
    const idx = storageValue.lastIndexOf('</table>');
    updated = `${storageValue.slice(0, idx)}${rowMarkup}</table>${storageValue.slice(idx + 8)}`;
  } else {
    throw new Error('Unable to find the AI QA Summary table closing tag on the Confluence page.');
  }

  return resortTableRows(updated);
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

/**
 * Upsert a free-form HTML section on the page, identified by a sentinel comment.
 * If a section with the same sectionId already exists it is replaced; otherwise
 * it is appended at the end of the page body.
 *
 * The block is wrapped in:
 *   <!-- section:sectionId -->  …html…  <!-- /section:sectionId -->
 */
async function upsertRawSection({ env, sectionId, html }) {
  if (!sectionId) throw new Error('sectionId is required');
  if (!html) throw new Error('html is required');

  const page = await getPage(env);
  let storage = page.body?.storage?.value || '';

  const open = `<!-- section:${sectionId} -->`;
  const close = `<!-- /section:${sectionId} -->`;
  const wrapped = `${open}${html}${close}`;

  const pattern = new RegExp(`${escapeRegex(open)}[\\s\\S]*?${escapeRegex(close)}`, 'i');
  if (pattern.test(storage)) {
    storage = storage.replace(pattern, wrapped);
  } else {
    storage += wrapped;
  }

  const updatedPage = await updatePage(env, page, storage);
  return { pageVersion: updatedPage.version?.number };
}

/**
 * Remove a managed ticket row (summary + detail pair) from the AI QA Summary
 * table by ticket key.  Useful for cleaning up synthetic rows like E2E-RUN.
 */
async function removeTicketRow({ env, ticketKey }) {
  if (!ticketKey) throw new Error('ticketKey is required');

  const normalizedKey = String(ticketKey).toUpperCase();
  const page = await getPage(env);
  let storage = page.body?.storage?.value || '';

  const escapedKey = escapeRegex(normalizedKey);
  const singleRow = `(?:(?!<\\/tr>)[\\s\\S])*?`;
  const pattern = new RegExp(
    `<tr[^>]*>${singleRow}${escapedKey}${singleRow}<\\/tr>\\s*<tr[^>]*>${singleRow}<\\/tr>`,
    'i'
  );

  if (!pattern.test(storage)) {
    return { removed: false };
  }

  const updatedPage = await updatePage(env, page, storage.replace(pattern, ''));
  return { removed: true, pageVersion: updatedPage.version?.number };
}

module.exports = {
  getConfluenceTicketList,
  upsertTicketRow,
  upsertRawSection,
  removeTicketRow,
};
