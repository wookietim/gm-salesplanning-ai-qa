#!/usr/bin/env node
/**
 * publish-setup-confluence.js
 *
 * Creates or updates the "QA Agent System - Setup & Getting Started" page as a
 * CHILD of the QA Summary results dashboard (page 1353804850).
 *
 * Sibling of publish-architecture-confluence.js. That page explains what the
 * system IS; this one explains how to get it RUNNING on a fresh machine. They
 * are deliberately separate so neither grows into an unreadable monolith.
 *
 * Editorial rules enforced here:
 *   1. NO REAL CREDENTIALS. The .env section is placeholders only. Anyone
 *      copying from this page must have to go and fetch their own tokens.
 *   2. Document the traps that actually cost time on this repo - the machine
 *      specific adapter paths and the run-e2e.js base URL default - rather
 *      than only the happy path.
 *
 * Usage:
 *   node publish-setup-confluence.js --env=<path> [--dry-run] [--out=<file>]
 */

const fs = require('fs');

const PARENT_ID = '1353804850';
const TITLE = 'QA Agent System - Setup & Getting Started';
const SPACE_KEY = 'SSP';
const REPO = 'https://github.com/wookietim/gm-salesplanning-ai-qa';

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
      if (next && !next.startsWith('--')) { out[token.slice(2)] = next; i++; }
      else out[token.slice(2)] = true;
    }
  }
  return out;
}

function loadEnv(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const get = (key) => (raw.match(new RegExp('^' + key + '=(.*)$', 'm')) || [])[1];
  const baseUrl = (get('CONFLUENCE_BASE_URL') || get('CONFLUENCE_URL') || '').trim();
  const token = (get('CONFLUENCE_TOKEN') || get('CONFLUENCE_API_TOKEN') || '').trim();
  if (!baseUrl || !token) throw new Error('Confluence base URL or token missing from env file');
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function code(text, language) {
  return (
    '<ac:structured-macro ac:name="code">' +
    `<ac:parameter ac:name="language">${language || 'text'}</ac:parameter>` +
    `<ac:plain-text-body><![CDATA[${text}]]></ac:plain-text-body>` +
    '</ac:structured-macro>'
  );
}

function panel(type, title, bodyHtml) {
  return (
    `<ac:structured-macro ac:name="${type}">` +
    (title ? `<ac:parameter ac:name="title">${esc(title)}</ac:parameter>` : '') +
    `<ac:rich-text-body>${bodyHtml}</ac:rich-text-body>` +
    '</ac:structured-macro>'
  );
}

function table(headers, rows) {
  const head =
    '<tr>' + headers.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const body = rows
    .map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>')
    .join('');
  return `<table><tbody>${head}${body}</tbody></table>`;
}

/* ---------- body ---------- */

function buildBody() {
  const out = [];

  out.push(
    panel(
      'info',
      'What this page is',
      '<p>A start-to-finish guide to getting the QA agent system running on a ' +
        'machine that has never run it before, and to confirming it actually ' +
        'works before you trust a result.</p>' +
        '<p>For what the system <em>is</em> - the agent roster, which agents are ' +
        'implemented versus definition-only, and how the pieces fit together - ' +
        'see the sibling page <strong>QA Agent System - Architecture &amp; ' +
        'Reference</strong>.</p>'
    )
  );

  /* ---- 0. Copilot desktop app ---- */

  out.push('<h2>0. Run it in the GitHub Copilot desktop app</h2>');

  out.push(
    '<p>This system is usable from a plain terminal, but it is <strong>designed ' +
      'around the GitHub Copilot desktop app</strong> and a meaningful part of it ' +
      'only works comfortably there. If you have a choice, use the app.</p>'
  );

  out.push(
    table(
      ['What you get', 'Why it matters here'],
      [
        [
          '<strong>Browser canvas</strong>',
          'Suite 3 (UI-API integration) captures a real auth token from the ' +
            'running app and replays it against the API from inside the page. ' +
            'That needs a live, authenticated browser session the agent can ' +
            'execute JavaScript in. Outside the app you have to drive this by hand.',
        ],
        [
          '<strong>Background shells</strong>',
          'The Playwright suite takes about three minutes. The app runs it in ' +
            'the background and notifies on completion, so the agent can keep ' +
            'working instead of blocking.',
        ],
        [
          '<strong>Session persistence</strong>',
          'Runs are long and stateful. Sessions survive across turns, so a ' +
            'multi-suite run plus publishing is one continuous piece of work.',
        ],
        [
          '<strong>Worktree isolation</strong>',
          'Each session gets its own branch and checkout, so an agent editing ' +
            'test scripts cannot disturb your working copy.',
        ],
        [
          '<strong>Agent roster</strong>',
          'Pablo, Susan, Bob and the rest are picked up automatically from ' +
            '<code>component-poc/qa-agent/agents/</code>. You ask for them by ' +
            'name in chat.',
        ],
      ]
    )
  );

  out.push(
    panel(
      'note',
      'Practical consequence',
      '<p>Suite 1 (Playwright) and suite 2 (API probes) are ordinary Node ' +
        'scripts and run fine anywhere. <strong>Suite 3 effectively requires the ' +
        'desktop app.</strong> If you only have a terminal, expect to run two of ' +
        'the three suites.</p>'
    )
  );

  /* ---- 1. Prerequisites ---- */

  out.push('<h2>1. Prerequisites</h2>');

  out.push(
    table(
      ['Requirement', 'Notes'],
      [
        ['<strong>Node.js 20+</strong>', 'Check with <code>node --version</code>. The scripts use built-in <code>fetch</code>, which needs Node 18 as an absolute floor; 20 is what this has been run on.'],
        ['<strong>Git</strong>', 'Standard install.'],
        ['<strong>GitHub Copilot desktop app</strong>', 'Strongly recommended - see section 0.'],
        ['<strong>Network access to the dev environment</strong>', 'Both the frontend and its API must be reachable from your machine, on VPN if required. If the browser cannot load the app, nothing else will work.'],
        ['<strong>Jira + Confluence API tokens</strong>', 'Only needed if you intend to publish results or file tickets. The suites themselves run without them.'],
      ]
    )
  );

  /* ---- 2. Clone and install ---- */

  out.push('<h2>2. Clone and install</h2>');

  out.push(
    code(
      'git clone ' + REPO + '.git\n' +
        'cd gm-salesplanning-ai-qa\n\n' +
        '# Playwright suite dependencies\n' +
        'cd e2e\n' +
        'npm install\n' +
        'npx playwright install chromium\n' +
        'cd ..',
      'bash'
    )
  );

  out.push(
    '<p>The <code>npx playwright install chromium</code> step is easy to skip and ' +
      'produces a confusing failure later - Playwright reports that it cannot ' +
      'find a browser executable rather than saying the browser was never ' +
      'downloaded. The suites are configured for chromium only, so there is no ' +
      'need to install the full browser set.</p>'
  );

  out.push(
    '<p>The publisher and probe scripts under ' +
      '<code>component-poc/qa-agent/scripts/</code> use only Node built-ins and ' +
      'need no install step of their own.</p>'
  );

  /* ---- 3. .env ---- */

  out.push('<h2>3. Configure <code>.env</code></h2>');

  out.push(
    '<p>Credentials live in a single <code>.env</code> at the repository root. ' +
      'It is gitignored. A template ships in the repo as ' +
      '<code>.env.example</code>, which is the one env file git is allowed to ' +
      'track:</p>'
  );

  out.push(code('cp .env.example .env', 'bash'));

  out.push('<p>Then fill it in. The full set of keys:</p>');

  out.push(
    code(
      '# --- Jira -------------------------------------------------------------\n' +
        'JIRA_BASE_URL=https://your-org.atlassian.net\n' +
        'JIRA_USER_EMAIL=you@example.com\n' +
        'JIRA_API_TOKEN=replace-me\n' +
        'JIRA_PROJECT=SSPLAN\n\n' +
        '# --- Confluence -------------------------------------------------------\n' +
        'CONFLUENCE_BASE_URL=https://your-org.atlassian.net/wiki\n' +
        'CONFLUENCE_SPACE_KEY=SSP\n' +
        'CONFLUENCE_PAGE_ID=1234567890\n' +
        'CONFLUENCE_API_TOKEN=replace-me\n\n' +
        '# --- Target application -----------------------------------------------\n' +
        'LIVE_UI_URL=https://dev.salesplanning.ingka.com',
      'bash'
    )
  );

  out.push(
    panel(
      'warning',
      'These are placeholders, not working values',
      '<p>Every <code>replace-me</code> above is a placeholder. Real tokens are ' +
        'deliberately <strong>not</strong> published on this page and must never ' +
        'be pasted into Confluence, a ticket, or a commit.</p>' +
        '<p>Generate your own at <strong>id.atlassian.com &gt; Security &gt; API ' +
        'tokens</strong>. A token carries your own permissions, so treat it like ' +
        'your password.</p>'
    )
  );

  out.push('<p>What each key is for:</p>');

  out.push(
    table(
      ['Key', 'Purpose', 'Required for'],
      [
        ['<code>JIRA_BASE_URL</code>', 'Jira instance, no trailing slash.', 'Jira integration'],
        ['<code>JIRA_USER_EMAIL</code>', 'Account the agents act as.', 'Jira integration'],
        ['<code>JIRA_API_TOKEN</code>', 'Jira API token.', 'Jira integration'],
        ['<code>JIRA_PROJECT</code>', 'Project key for test plans and defects.', 'Jira integration'],
        ['<code>CONFLUENCE_BASE_URL</code>', 'Confluence instance, no trailing slash. Usually ends in <code>/wiki</code>.', 'Publishing'],
        ['<code>CONFLUENCE_SPACE_KEY</code>', 'Space the QA pages live in.', 'Publishing'],
        ['<code>CONFLUENCE_PAGE_ID</code>', 'Numeric ID of the QA Summary dashboard. Read it from the page URL, or from <em>Page Information</em> if the URL is the friendly variant.', 'Publishing'],
        ['<code>CONFLUENCE_API_TOKEN</code>', 'Sent as a Bearer token by the <code>publish-*</code> scripts.', 'Publishing'],
        ['<code>LIVE_UI_URL</code>', 'The deployed frontend the suites target.', 'All suites'],
      ]
    )
  );

  out.push(
    panel(
      'note',
      'Known rough edge',
      '<p><code>LIVE_UI_URL</code> is currently <strong>not</strong> read by the ' +
        'e2e runner. It documents intent, but you still have to pass ' +
        '<code>--base-url</code> explicitly - see section 4.</p>'
    )
  );

  /* ---- 4. adapters ---- */

  out.push('<h2>4. Point the adapters at your machine</h2>');

  out.push(
    '<p>This is the step most likely to catch out a new machine. Files under ' +
      '<code>adapters/&lt;id&gt;/adapter.json</code> tell the agents where the ' +
      '<em>other</em> repositories live, and they currently contain ' +
      '<strong>absolute paths from the original author\u2019s laptop</strong>:</p>'
  );

  out.push(
    code(
      '{\n' +
        '  "id": "gm-salesplanning-frontend",\n' +
        '  "targetRepositoryRoot": "/Users/<someone-else>/Documents/ikea work/gm-salesplanning-frontend",\n' +
        '  "e2eRoot": "/Users/<someone-else>/Documents/ikea work/gm-salesplanning-ai-qa/e2e",\n' +
        '  "e2eBaseUrl": "http://localhost:4173",\n' +
        '  ...\n' +
        '}',
      'json'
    )
  );

  out.push(
    '<p>Update <code>targetRepositoryRoot</code>, <code>defaultSourceRoot</code> ' +
      'and <code>e2eRoot</code> in each adapter you intend to use so they point ' +
      'at your own checkouts. There are four adapters: ' +
      '<code>gm-salesplanning-frontend</code>, <code>-backend</code>, ' +
      '<code>-modeling</code> and <code>-dbt</code>. If you only want to run the ' +
      'UI suites, the frontend adapter is the one that matters.</p>'
  );

  out.push(
    panel(
      'warning',
      'The base URL trap',
      '<p><code>e2eBaseUrl</code> is pinned to <code>http://localhost:4173</code>. ' +
        'The runner resolves the target as <code>--base-url</code> &rarr; ' +
        '<code>adapter.e2eBaseUrl</code> &rarr; empty, so <strong>if you forget ' +
        '<code>--base-url</code> it will quietly try localhost</strong>.</p>' +
        '<p>When nothing is listening there the run does not fail loudly - it ' +
        'returns <code>status: blocked</code> and still overwrites ' +
        '<code>latest.json</code>. A blocked run looks a lot like a finished run ' +
        'at a glance. Always pass <code>--base-url</code> for live runs, and ' +
        'always check <code>targetUrl</code> in the result before believing it.</p>'
    )
  );

  /* ---- 5. Verify ---- */

  out.push('<h2>5. Verify the install</h2>');

  out.push(
    '<p>Run the suites in order. Each is independently useful, and if an early ' +
      'one fails the later ones will not be meaningful.</p>'
  );

  out.push('<h3>Suite 1 - Playwright UI</h3>');

  out.push(
    code(
      'node component-poc/qa-agent/scripts/run-e2e.js \\\n' +
        '  --base-url=https://dev.salesplanning.ingka.com',
      'bash'
    )
  );

  out.push(
    '<p>Expect <strong>211 passed</strong> in roughly three minutes. Results are ' +
      'written to ' +
      '<code>component-poc/qa-agent/agents/e2e/results/latest.json</code>. ' +
      'Confirm <code>targetUrl</code> in that file is the live URL and not ' +
      'localhost.</p>'
  );

  out.push('<h3>Suite 2 - API probes</h3>');

  out.push(code('node component-poc/qa-agent/scripts/api-probes.js --help', 'bash'));

  out.push(
    '<p>This suite asserts the API directly. It needs an auth token captured ' +
      'from a logged-in browser session, so in practice it is driven through the ' +
      'desktop app alongside suite 3. Baseline is <strong>29 checks</strong>.</p>'
  );

  out.push('<h3>Suite 3 - UI/API integration</h3>');

  out.push(
    '<p>Asserts that what the UI displays matches what the API returned for the ' +
      'same entity. Driven from the browser canvas in the desktop app. Baseline ' +
      'is <strong>47 checks</strong>.</p>'
  );

  out.push(
    panel(
      'tip',
      'Current healthy baseline',
      '<p>US, dev environment, 2026-08-27:</p>' +
        '<ul>' +
        '<li>Suite 1 - <strong>211 / 211 passed</strong></li>' +
        '<li>Suite 2 - <strong>29 checks: 27 passed, 2 observed</strong></li>' +
        '<li>Suite 3 - <strong>47 checks: 44 passed, 3 observed, 0 failed</strong></li>' +
        '</ul>' +
        '<p><em>Observed</em> is a deliberate third outcome, distinct from ' +
        'failed. It marks real behaviour that is expected or still an open ' +
        'product question, so it neither fails the run nor disappears. If your ' +
        'numbers are close to these, the install is good.</p>'
    )
  );

  /* ---- 6. Publishing ---- */

  out.push('<h2>6. Publishing results</h2>');

  out.push(
    '<p>Each suite has its own publisher. All three are idempotent upserts into ' +
      'their own section of the QA Summary dashboard, so re-running one replaces ' +
      'its section rather than appending a duplicate.</p>'
  );

  out.push(
    code(
      'cd component-poc/qa-agent/scripts\n\n' +
        '# --env is a PATH TO YOUR .env FILE, not an environment name\n' +
        'node publish-e2e-confluence.js         --results=<file> --env=../../../.env\n' +
        'node publish-api-confluence.js         --results=<file> --env=../../../.env\n' +
        'node publish-integration-confluence.js --results=<file> --env=../../../.env\n\n' +
        '# Always dry-run first - writes a preview instead of touching the page\n' +
        'node publish-integration-confluence.js --results=<file> --env=../../../.env --dry-run',
      'bash'
    )
  );

  out.push(
    '<p><code>--env</code> taking a file path rather than an environment name ' +
      '(<code>dev</code>, <code>prod</code>) is a common first mistake; passing ' +
      '<code>--env=dev</code> fails with ' +
      '<code>ENOENT: no such file or directory, open \u2018dev\u2019</code>.</p>'
  );

  out.push(
    '<p>This documentation page and the architecture page are themselves ' +
      'generated, and are refreshed by re-running their scripts rather than by ' +
      'editing the page in Confluence:</p>'
  );

  out.push(
    code(
      'node publish-setup-confluence.js        --env=../../../.env\n' +
        'node publish-architecture-confluence.js --env=../../../.env',
      'bash'
    )
  );

  /* ---- 7. Troubleshooting ---- */

  out.push('<h2>7. Troubleshooting</h2>');

  out.push(
    table(
      ['Symptom', 'Cause and fix'],
      [
        [
          'Run reports <code>status: blocked</code>',
          'Almost always the base URL. You omitted <code>--base-url</code> and it ' +
            'tried <code>localhost:4173</code>. Re-run with the live URL.',
        ],
        [
          '<code>No e2eRoot resolved</code>',
          'The adapter still points at someone else\u2019s paths, or no adapter ' +
            'defines <code>e2eRoot</code>. Fix <code>adapter.json</code> (section 4) ' +
            'or pass <code>--e2e-root</code>.',
        ],
        [
          '<code>Multiple adapters define e2eRoot</code>',
          'More than one adapter is eligible. Pass <code>--adapter ' +
            'gm-salesplanning-frontend</code> to disambiguate.',
        ],
        [
          'Playwright cannot find a browser',
          'The <code>npx playwright install chromium</code> step was skipped.',
        ],
        [
          '<code>Confluence base URL or token missing from env file</code>',
          'The path passed to <code>--env</code> is wrong, or the file lacks ' +
            '<code>CONFLUENCE_BASE_URL</code> / <code>CONFLUENCE_API_TOKEN</code>.',
        ],
        [
          '<code>ENOENT ... open \u2018dev\u2019</code>',
          '<code>--env</code> wants a file path, not an environment name.',
        ],
        [
          'Confluence returns 401 or 403',
          'Token expired, or your account cannot edit the target space. Tokens ' +
            'carry your own permissions.',
        ],
        [
          'Everything fails to reach the app',
          'Check VPN, and load the dev URL in an ordinary browser first.',
        ],
      ]
    )
  );

  /* ---- 8. Where things live ---- */

  out.push('<h2>8. Where things live</h2>');

  out.push(
    table(
      ['Path', 'Contents'],
      [
        ['<code>e2e/</code>', 'Playwright suite (suite 1) and its config.'],
        ['<code>component-poc/qa-agent/agents/</code>', 'The agent definitions - 16 of them, most currently definition-only.'],
        ['<code>component-poc/qa-agent/scripts/</code>', 'The runners and publishers. Five agents have runners: Pablo, Susan, Bob, e2e, guide-sync.'],
        ['<code>adapters/</code>', 'Per-repository configuration, including the machine-specific paths from section 4.'],
        ['<code>QA-Runs/</code>', 'Committed run artifacts and reports.'],
        ['<code>QA-Tests/</code>', 'Test plans and test case definitions.'],
        ['<code>.env.example</code>', 'Credential template. The only env file tracked in git.'],
      ]
    )
  );

  out.push(
    '<p><em>Generated by ' +
      '<code>component-poc/qa-agent/scripts/publish-setup-confluence.js</code>. ' +
      'Re-run that script to refresh this page rather than editing it by ' +
      'hand.</em></p>'
  );

  return out.join('\n');
}

/* ---------- main ---------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = args.env || '.env';
  const { baseUrl, token } = loadEnv(envPath);
  const body = buildBody();

  if (args['dry-run']) {
    console.log('--- DRY RUN ---');
    console.log('parent :', PARENT_ID);
    console.log('title  :', TITLE);
    console.log('bytes  :', body.length);
    const tags = body.match(/<(h2|h3|table|ac:structured-macro)/g) || [];
    const counts = tags.reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {});
    console.log('elements:', JSON.stringify(counts));
    if (args.out) { fs.writeFileSync(args.out, body); console.log('written to', args.out); }
    return;
  }

  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  };

  const searchUrl =
    `${baseUrl}/rest/api/content?spaceKey=${SPACE_KEY}` +
    `&title=${encodeURIComponent(TITLE)}&expand=version,ancestors`;
  const found = await fetch(searchUrl, { headers }).then((r) => r.json());
  const existing = (found.results || [])[0];

  let res;
  if (existing) {
    res = await fetch(`${baseUrl}/rest/api/content/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        id: existing.id,
        type: 'page',
        title: TITLE,
        space: { key: SPACE_KEY },
        ancestors: [{ id: PARENT_ID }],
        body: { storage: { value: body, representation: 'storage' } },
        version: { number: existing.version.number + 1, minorEdit: false },
      }),
    });
  } else {
    res = await fetch(`${baseUrl}/rest/api/content`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'page',
        title: TITLE,
        space: { key: SPACE_KEY },
        ancestors: [{ id: PARENT_ID }],
        body: { storage: { value: body, representation: 'storage' } },
      }),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence ${res.status}: ${text.slice(0, 600)}`);
  }
  const out = await res.json();
  console.log((existing ? 'UPDATED' : 'CREATED') + ' page ' + out.id + ' v' + out.version.number);
  console.log(baseUrl + (out._links && out._links.webui ? out._links.webui : ''));
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
