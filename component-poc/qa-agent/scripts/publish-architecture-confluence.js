#!/usr/bin/env node
/**
 * publish-architecture-confluence.js
 *
 * Creates or updates the "QA Agent System - Architecture & Reference" page as a
 * CHILD of the QA Summary results dashboard (page 1353804850).
 *
 * This is documentation, not a run report, which is why it is a separate page
 * rather than another section appended to QA Summary. QA Summary is overwritten
 * section-by-section on every run; this page changes only when the system does.
 *
 * The single most important editorial rule enforced here: agents that have a
 * runner script under scripts/ are marked IMPLEMENTED, and agents that exist
 * only as AGENT.md + prompt.md + schemas are marked DEFINITION-ONLY. Eleven of
 * the sixteen are definition-only. Documenting them as working software would
 * be actively misleading to anyone trying to use this system.
 *
 * Usage:
 *   node publish-architecture-confluence.js --env=<path> [--dry-run]
 */

const fs = require('fs');

const PARENT_ID = '1353804850';
const TITLE = 'QA Agent System - Architecture & Reference';
const SPACE_KEY = 'SSP';

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

function esc(value) {
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

/* ---------- storage-format helpers ---------- */

function h(level, text) { return `<h${level}>${esc(text)}</h${level}>`; }
function p(html) { return `<p>${html}</p>`; }
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
    '<tr>' + headers.map((c) => `<th><p><strong>${esc(c)}</strong></p></th>`).join('') + '</tr>';
  const body = rows
    .map(
      (r) =>
        '<tr>' +
        r
          .map((cell) => {
            if (cell && typeof cell === 'object' && cell.html) {
              return `<td>${cell.html}</td>`;
            }
            return `<td><p>${esc(cell)}</p></td>`;
          })
          .join('') +
        '</tr>'
    )
    .join('');
  return `<table><tbody>${head}${body}</tbody></table>`;
}
function status(text, colour) {
  return (
    '<ac:structured-macro ac:name="status">' +
    `<ac:parameter ac:name="colour">${colour}</ac:parameter>` +
    `<ac:parameter ac:name="title">${esc(text)}</ac:parameter>` +
    '</ac:structured-macro>'
  );
}
const IMPL = () => ({ html: status('Implemented', 'Green') });
const DEF = () => ({ html: status('Definition only', 'Grey') });

/* ---------- content ---------- */

const SCHEMATIC = `
                                  ┌───────────┐
                                  │    YOU    │
                                  └─────┬─────┘
                                        │  node run-pablo.js
                                        ▼
                            ┌───────────────────────┐
                            │        PABLO          │  [IMPLEMENTED]
                            │  orchestration mgr    │
                            └───────────┬───────────┘
                                        │
   ┌─────────────┬─────────────┬────────┼─────────┬──────────────┬─────────────┐
   ▼             ▼             ▼        ▼         ▼              ▼             ▼
┌───────┐  ┌──────────┐  ┌──────────┐ ┌─────┐ ┌────────┐  ┌────────────┐ ┌───────────┐
│ SMOKE │  │SECURITY  │  │  JIRA    │ │ API │ │  UNIT  │  │    BOB     │ │  GUIDE-   │
│ step0 │  │   -QA    │  │  -AGENT  │ │AGENT│ │TEST-QA │  │ test author│ │   SYNC    │
│ [def] │  │  [def]   │  │  [def]   │ │[def]│ │ [def]  │  │   [IMPL]   │ │  [IMPL]   │
└───┬───┘  └────┬─────┘  └────┬─────┘ └──┬──┘ └────────┘  └─────┬──────┘ └───────────┘
    │abort      │              │          │                     │
    │on fail    │securityTests │ticket    │bobHandoff           │ test plans
    │           └──────────────┴──────────┴─────────────────────▶│  QA-Tests/*.qa.md
    │                                                            │
    ▼                                                            ▼
  (gate)                                             ┌───────────────────────┐
                                                     │        SUSAN          │ [IMPLEMENTED]
                                                     │    test executor      │
                                                     └───────────┬───────────┘
                                                                 │ delegates
                        ┌────────────┬───────────────┬───────────┴───┬──────────────┐
                        ▼            ▼               ▼               ▼              ▼
                 ┌────────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌─────────────┐
                 │ REGRESSION │ │ACCESSIB- │ │ API-CONTRACT│ │VISUAL-DIFF │ │     E2E     │
                 │   [def]    │ │ILITY[def]│ │    [def]    │ │   [def]    │ │  [IMPL]     │
                 └────────────┘ └──────────┘ └─────────────┘ └────────────┘ └──────┬──────┘
                                                                                    │
                                                                                    ▼
                                                                     ┌──────────────────────────┐
                                                                     │   THE THREE TEST SUITES  │
                                                                     ├──────────────────────────┤
                                                                     │ 1  Playwright  (mocked)  │
                                                                     │ 2  API probes  (no UI)   │
                                                                     │ 3  UI <-> API integration│
                                                                     └────────────┬─────────────┘
                                                                                  │
                                              results ──────────────────────────▶ │
                                                                                  ▼
                                                        ┌─────────────────────────────────────┐
                                                        │  QA-Runs/*.md + agents/*/results/    │
                                                        └──────────────────┬──────────────────┘
                                                                           │ publish-*.js
                                                                           ▼
                                                        ┌─────────────────────────────────────┐
                                                        │  CONFLUENCE - QA Summary (1353804850)│
                                                        └─────────────────────────────────────┘

  [IMPLEMENTED] = has a runner script under component-poc/qa-agent/scripts/
  [def]         = AGENT.md + prompt.md + schemas only; no runner exists yet
`.trim();

const SUITE_SEAM = `
   Suite 1: Playwright                    Suite 2: API probes
   ┌────────────┐   mocked                ┌────────────┐
   │     UI     │◀─────────  /metrics     │    API     │
   └────────────┘   fixture               └────────────┘
        ▲                                       ▲
        │ asserts UI renders                    │ asserts API is
        │ the FIXTURE correctly                 │ internally sane
        │                                       │
   Each side is only ever checked against ITSELF.
   A wrong field mapping - the UI reading netSalesIndexToGoal
   where it should read netQuantityIndexToGoal - PASSES BOTH.

   Suite 3 closes that seam:
   ┌────────────┐   real request   ┌────────────┐
   │  REAL UI   │─────────────────▶│  REAL API  │
   └─────┬──────┘                  └──────┬─────┘
         │ scrape rendered numbers        │ capture JSON
         └───────────────┬────────────────┘
                         ▼
                 assert they MATCH
`.trim();

function buildBody() {
  const out = [];

  out.push(
    panel(
      'info',
      'What this page is',
      p(
        'Reference documentation for the QA agent system in <code>gm-salesplanning-ai-qa</code> - ' +
          'its repository layout, the sixteen agent definitions, how they fit together, and the three ' +
          'test suites that exercise the Sales Planning frontend.'
      ) +
        p(
          'This page describes the <strong>system</strong>. The parent page, <strong>QA Summary</strong>, ' +
            'holds the <strong>results</strong> of individual runs and is rewritten every time a suite executes.'
        )
    )
  );

  /* -- reality check -- */
  out.push(h(2, 'Read this first: what is built vs what is designed'));
  out.push(
    p(
      'The system defines <strong>sixteen</strong> agents. <strong>Five</strong> of them have runner ' +
        'scripts and actually execute. The other <strong>eleven</strong> exist as an <code>AGENT.md</code>, ' +
        'a <code>prompt.md</code> and input/output JSON schemas, but have no runner - they are contracts ' +
        'for behaviour that an AI agent performs by reading the prompt, or that is not yet wired up.'
    )
  );
  out.push(
    panel(
      'note',
      'Why this distinction is called out so prominently',
      p(
        'The orchestration diagram in <code>AGENTS_GUIDE.md</code> shows all sixteen agents connected, ' +
          'which reads as though the whole pipeline is operational. It is a design document. If you invoke ' +
          'Pablo expecting a security audit and an accessibility scan to run, you will not get them. ' +
          'Everything below is marked so you can tell the difference at a glance.'
      )
    )
  );

  /* -- schematic -- */
  out.push(h(2, 'Schematic: how the agents fit together'));
  out.push(code(SCHEMATIC, 'text'));
  out.push(
    p(
      'Verified in source: <code>run-pablo.js</code> resolves and spawns <code>run-bob.js</code>, ' +
        '<code>run-susan.js</code> and <code>run-e2e.js</code> via <code>execFileSync</code> ' +
        '(<code>run-pablo.js</code> lines 691-692 and 946). That branch of the diagram is real executable ' +
        'code. The delegations drawn from Susan to Regression, Accessibility, API-Contract and Visual-Diff ' +
        'are declared in the agent definitions but have no runners behind them.'
    )
  );

  /* -- repo layout -- */
  out.push(h(2, 'Repository layout'));
  out.push(
    table(
      ['Path', 'Contains'],
      [
        ['component-poc/qa-agent/agents/', '16 agent definitions - AGENT.md, prompt.md, input/output schemas, results/'],
        ['component-poc/qa-agent/scripts/', 'Runner scripts, the three test suites, and the Confluence publishers'],
        ['component-poc/qa-agent/configs/', 'qa-agent.config.json - agent registry, run order, timeouts, severity levels'],
        ['component-poc/qa-agent/shared/', 'command-catalog.md - shared command vocabulary'],
        ['component-poc/qa-agent/AGENTS_GUIDE.md', 'The 996-line design guide: roster, per-agent detail, 18 worked examples'],
        ['adapters/', 'Per-repository configuration (frontend, backend, dbt, modeling)'],
        ['e2e/', 'Playwright project - config, the 211-test spec, reports'],
        ['QA-Tests/', 'Generated test plans (*.qa.md), authored by Bob'],
        ['QA-Runs/', 'Run reports, one per execution'],
        ['ui/', 'A local dashboard UI for browsing results'],
      ]
    )
  );

  /* -- agent roster -- */
  out.push(h(2, 'Agent roster'));
  out.push(h(3, 'Implemented - these run'));
  out.push(
    table(
      ['Agent', 'Status', 'Runner', 'Role', 'Invoked by'],
      [
        ['Pablo', IMPL(), 'run-pablo.js', 'Orchestration manager - the entry point you normally talk to', 'You'],
        ['Bob', IMPL(), 'run-bob.js', 'Test author - scans components, writes test plans into QA-Tests/', 'Pablo'],
        ['Susan', IMPL(), 'run-susan.js', 'Test executor - runs the plans Bob produced, reports pass/fail', 'Pablo'],
        ['E2E', IMPL(), 'run-e2e.js', "Runs the project's real Playwright browser suite", 'Susan, Pablo, or you'],
        ['Guide-Sync', IMPL(), 'run-guide-sync.js', 'Keeps AGENTS_GUIDE.md and README links consistent with agent changes', 'Pablo, after agent edits'],
      ]
    )
  );

  out.push(h(3, 'Definition-only - schemas and prompts exist, no runner'));
  out.push(
    table(
      ['Agent', 'Status', 'Intended role', 'Intended caller'],
      [
        ['Smoke', DEF(), 'Pre-flight build/lint/test gate; aborts the run if the build is broken', 'Pablo (step 0)'],
        ['Security-QA', DEF(), 'Full-stack security audit - XSS, token storage, CORS, auth, CVEs', 'Pablo (step 0b)'],
        ['Jira-Agent', DEF(), 'Fetches ticket data and acceptance criteria from Jira', 'Bob, Pablo'],
        ['API-Agent', DEF(), 'Discovers API contracts from source; hands field mappings to Bob/Susan', 'Pablo'],
        ['Unit-Test-QA', DEF(), 'Writes and runs ephemeral unit tests for transformations and utilities', 'Pablo'],
        ['Regression', DEF(), 'Historical defect replay and baseline snapshot comparison', 'Susan'],
        ['Accessibility', DEF(), 'WCAG 2.1 AA scanning', 'Susan'],
        ['API-Contract', DEF(), 'Live request/response schema drift detection', 'Susan'],
        ['Visual-Diff', DEF(), 'Screenshot-based visual regression', 'Susan'],
        ['Confluence-Agent', DEF(), 'Generic Confluence page create/update', 'Confluence-Writer'],
        ['Confluence-Writer', DEF(), 'Upserts the per-ticket QA summary metrics table', 'Pablo'],
      ]
    )
  );
  out.push(
    p(
      'Note: Confluence publishing <em>does</em> happen today, but through the ' +
        '<code>publish-*-confluence.js</code> scripts listed further down - not through the ' +
        'Confluence-Agent / Confluence-Writer agent definitions.'
    )
  );

  /* -- the three suites -- */
  out.push(h(2, 'The three test suites'));
  out.push(
    p(
      'A request to "run the e2e tests" means <strong>all three</strong> of these. They are ' +
        'complementary, and the third exists specifically because the first two share a blind spot.'
    )
  );
  out.push(
    table(
      ['#', 'Suite', 'File', 'Size', 'API', 'UI'],
      [
        ['1', 'Playwright functional', 'e2e/salesplanning-frontend.spec.js', '211 tests', 'Mocked', 'Real browser'],
        ['2', 'API probes', 'component-poc/qa-agent/scripts/api-probes.js', '25 probes', 'Real', 'Not opened'],
        ['3', 'UI - API integration', 'component-poc/qa-agent/scripts/ui-api-integration.js', '36 checks', 'Real', 'Real browser'],
      ]
    )
  );

  out.push(h(3, 'Why the third suite exists'));
  out.push(code(SUITE_SEAM, 'text'));

  out.push(h(3, 'Suite 3 coverage'));
  out.push(
    table(
      ['Group', 'What is asserted'],
      [
        ['Row metrics', 'vs goal, vs demand plan, vs last year, To-go, and the Gap pair - on country cards and PA rows'],
        ['Hero metrics', 'All five hero figures, including vs latest forecast'],
        ['Metric toggle', 'Switching Qty/Value re-reads the correct netQuantity* / netSales* field family'],
        ['Weekly sales trend chart', 'Bar count matches API weeks; LY series spans all weeks; CY series stops at the current IKEA week'],
        ['Rolling trends chart', 'Five points match ytd/r13/r8/r4/r1 NetSalesIndex at full two-decimal precision'],
        ['Hierarchy boundary', 'PRA level is correctly rejected (HTTP 400, no mart at that grain); PA confirmed a leaf'],
        ['Cache staleness', 'Switching HFB re-renders rather than carrying the previous values over'],
      ]
    )
  );

  out.push(h(3, '"Harness" is a first-class outcome'));
  out.push(
    p(
      'Suite 3 reports four outcomes, not two: <strong>passed</strong>, <strong>failed</strong>, ' +
        '<strong>harness</strong>, and <strong>observed</strong>. A DOM scraper that latches onto a shared ' +
        'ancestor reports every row as wrong; a renamed CSS class reports zero rows parsed. Both are defects ' +
        'in the tooling, not the product, and reporting them as failures manufactures fake bugs. This ' +
        'happened twice for real while the suite was being written. <strong>Observed</strong> is for ' +
        'behaviour that is measurably odd but may well be intended - it is raised as a question, never ' +
        'filed as a defect.'
    )
  );

  /* -- asking the agent -- */
  out.push(h(2, 'How to ask for tests to be run'));
  out.push(
    p(
      'There are two ways in: ask the agent in plain English, or invoke the runners directly. ' +
        'Most people want the first. Suites 2 and 3 can <em>only</em> be driven by an agent, for ' +
        'reasons explained under "The emit model" below.'
    )
  );

  out.push(h(3, 'Asking Pablo to do things'));
  out.push(
    p(
      'Pablo is the orchestration manager and the agent you normally talk to. He decides what is in ' +
        'scope, has Bob write the test plans, has Susan execute them, and folds the E2E result into ' +
        'one report. You do not need to name Bob or Susan - asking Pablo is enough.'
    )
  );
  out.push(
    table(
      ['Ask Pablo', 'What he does'],
      [
        [
          'Pablo, run QA on what I just changed',
          'Default changed mode: diffs the working tree, selects changed components, regenerates only stale plans, then executes.',
        ],
        [
          'Pablo, run a full QA pass',
          'mode=full - every discoverable component, not just changed ones. The long one.',
        ],
        [
          'Pablo, run QA on the User component',
          'mode=components with an explicit list, so nothing else is touched.',
        ],
        [
          'Pablo, run QA for SSPLAN-623',
          'Pulls the ticket\u2019s acceptance criteria from Jira and hands them to Bob as authoring context.',
        ],
        [
          'Pablo, run QA for SSPLAN-623 and SSPLAN-708 together',
          'Multiple tickets in one pass; acceptance criteria from both are combined.',
        ],
        [
          'Pablo, reuse the existing test plans - do not regenerate',
          'skip-bob=true. Useful when plans are hand-tuned and you only want execution.',
        ],
        [
          'Pablo, skip the browser suite this time',
          'skip-e2e=true - component-level work only, much faster.',
        ],
        [
          'Pablo, regenerate the stale plans for this ticket',
          'Bob re-checks each plan against the ticket\u2019s Jira updated timestamp and rewrites only those now out of date.',
        ],
        [
          'Pablo, here are the acceptance criteria in a file - use these instead of Jira',
          'ac-file=<path>. The offline path when Jira is unreachable or the criteria are not yet written up.',
        ],
        [
          'Pablo, run QA against the live environment',
          'Passes the live base URL through to the browser suite instead of a local build.',
        ],
      ]
    )
  );
  out.push(
    panel(
      'note',
      'What Pablo does not do',
      p(
        'Pablo does <strong>not</strong> publish to Confluence - there is no Confluence code in ' +
          '<code>run-pablo.js</code> at all. Publishing is a separate, deliberate step. He also does ' +
          'not run the API probes or the UI-API integration checks, because those need an ' +
          'authenticated browser session that a command-line process does not have. Ask the agent for ' +
          'those, not Pablo.'
      )
    )
  );

  out.push(h(3, 'Asking for the test suites'));
  out.push(
    table(
      ['Say this', 'What happens'],
      [
        [
          'Run the e2e tests',
          'All three suites: the 211 Playwright tests, the 25 API probes, and the 36 UI-API integration checks. Results are published to QA Summary.',
        ],
        [
          'Run the e2e tests against the live environment',
          'Same, but suite 1 is pointed at the live URL instead of a local build (see --base-url below).',
        ],
        [
          'Just run the Playwright suite',
          'Suite 1 only. No sign-in needed. Say this when nobody is available to authenticate.',
        ],
        [
          'Run the API probes',
          'Suite 2 only. Requires a signed-in browser session.',
        ],
        [
          'Run the integration checks for HFB 08',
          'Suite 3, scoped to one home furnishing business.',
        ],
        [
          'Run QA on the components I changed',
          'Pablo in changed mode - Bob writes plans for changed components, Susan executes them.',
        ],
        [
          'Run QA for SSPLAN-623',
          'Pablo scoped to a Jira ticket; acceptance criteria are pulled into the test plans.',
        ],
        [
          'Publish the last run to Confluence',
          'Re-publishes existing results without re-running anything.',
        ],
        [
          'Re-run just the failures',
          'Narrows the Playwright run with --grep to the failing test names.',
        ],
      ]
    )
  );
  out.push(
    panel(
      'info',
      'Two things worth saying explicitly when you ask',
      p(
        '<strong>Which environment.</strong> "Live" means the deployed dev environment; the default ' +
          'for suite 1 is currently a local build. They can disagree.'
      ) +
        p(
          '<strong>Whether you can sign in.</strong> Suites 2 and 3 stop dead without an authenticated ' +
            'session. If you cannot sign in right now, say so and ask for suite 1 only - that is a ' +
            'legitimate partial run, but it should be reported as a partial run, not as a clean pass.'
        )
    )
  );

  /* -- running -- */
  out.push(h(2, 'Direct invocation'));
  out.push(h(3, 'Suite 1 and the orchestrator'));
  out.push(
    code(
      [
        '# Playwright functional suite, as the adapter configures it',
        'node component-poc/qa-agent/scripts/run-e2e.js --adapter=gm-salesplanning-frontend',
        '',
        '# ...pointed at the live environment instead of a local build',
        'node component-poc/qa-agent/scripts/run-e2e.js \\',
        '  --adapter=gm-salesplanning-frontend \\',
        '  --base-url=https://dev.salesplanning.ingka.com',
        '',
        '# ...only tests whose name matches a pattern',
        'node component-poc/qa-agent/scripts/run-e2e.js \\',
        '  --adapter=gm-salesplanning-frontend --grep="gap to close"',
        '',
        '# Or run Playwright straight from the e2e project',
        'cd e2e && npm test',
        '',
        '# --- Pablo, the orchestrator ---',
        '',
        '# Default: only components changed in the working tree',
        'node component-poc/qa-agent/scripts/run-pablo.js --adapter=gm-salesplanning-frontend',
        '',
        '# Everything',
        'node component-poc/qa-agent/scripts/run-pablo.js \\',
        '  --adapter=gm-salesplanning-frontend --mode=full',
        '',
        '# A named component list',
        'node component-poc/qa-agent/scripts/run-pablo.js \\',
        '  --adapter=gm-salesplanning-frontend --mode=components \\',
        '  --components=src/components/User/user.tsx',
        '',
        '# Scoped to Jira tickets',
        'node component-poc/qa-agent/scripts/run-pablo.js \\',
        '  --adapter=gm-salesplanning-frontend --jira-issues=SSPLAN-623,SSPLAN-708',
        '',
        '# Skip stages',
        'node component-poc/qa-agent/scripts/run-pablo.js --skip-bob=true   # reuse existing plans',
        'node component-poc/qa-agent/scripts/run-pablo.js --skip-e2e=true   # unit/component only',
        '',
        '# --- Bob and Susan directly ---',
        'node component-poc/qa-agent/scripts/run-bob.js   --components=<paths> --output=QA-Tests',
        'node component-poc/qa-agent/scripts/run-susan.js --plan-file=QA-Tests/<plan>.qa.md',
        '',
        '# --- Publish to Confluence ---',
        'node component-poc/qa-agent/scripts/publish-e2e-confluence.js         --results=<json> --env=.env',
        'node component-poc/qa-agent/scripts/publish-api-confluence.js         --results=<json> --env=.env',
        'node component-poc/qa-agent/scripts/publish-integration-confluence.js --results=<json> --env=.env',
        'node component-poc/qa-agent/scripts/publish-architecture-confluence.js --env=.env   # this page',
      ].join('\n'),
      'bash'
    )
  );
  out.push(
    p(
      'Pablo modes are <code>changed</code> (default), <code>full</code> and <code>components</code>. ' +
        'Every flag above was read out of the runner sources, not from the guide.'
    )
  );

  out.push(h(3, 'The emit model - suites 2 and 3'));
  out.push(
    panel(
      'warning',
      'These scripts do not run tests',
      p(
        'Running <code>node api-probes.js --emit=probe</code> prints roughly 15KB of JavaScript to ' +
          'stdout. It does not execute a single probe. The script is <strong>generated</strong> to be ' +
          'evaluated inside an already-authenticated browser page.'
      ) +
        p(
          'This is deliberate. The bearer token is never extracted: the emitted harness lifts the ' +
            '<code>Authorization</code> header off a genuine in-flight request into a page-scoped ' +
            'variable, uses it inside the page, and returns only status codes and short response ' +
            'previews. No secret ever crosses back into the agent transcript.'
        )
    )
  );
  out.push(
    code(
      [
        '# Suite 2 - API probes. Each step is evaluated in the signed-in page.',
        'node component-poc/qa-agent/scripts/api-probes.js --emit=capture   # install the fetch hook',
        '#   ...then navigate so the app issues a real, uncached request',
        'node component-poc/qa-agent/scripts/api-probes.js --emit=probe     # run 25 probes, return JSON',
        'node component-poc/qa-agent/scripts/api-probes.js --emit=cleanup   # ALWAYS - restore fetch',
        '',
        '# Suite 3 - UI <-> API integration. Emitters run in order.',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=capture',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=country   --ru=US',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=toggle',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=hfb       --ru=US --hfb=05',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=drilldown --ru=US --hfb=05',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=charts    --ru=US --hfb=05',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=stale     --ru=US',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=leaf      --ru=US',
        'node component-poc/qa-agent/scripts/ui-api-integration.js --emit=cleanup   # ALWAYS',
      ].join('\n'),
      'bash'
    )
  );
  out.push(
    panel(
      'note',
      'Always run cleanup',
      p(
        'Both suites monkey-patch <code>window.fetch</code>. The <code>cleanup</code> emitter restores ' +
          'the native function and deletes the captured header. Skipping it leaves a hooked page and a ' +
          'token in page scope. Note also that a <strong>full page reload destroys the captured ' +
          'token</strong> - navigate with in-app clicks or history, never by setting ' +
          '<code>location.href</code>.'
      )
    )
  );

  /* -- integrations -- */
  out.push(h(2, 'Jira and Confluence integration'));
  out.push(
    p(
      'Both integrations are real and both are used routinely, but they work differently from one ' +
        'another, and neither is quite "automatic". The distinction matters if you are relying on them.'
    )
  );

  out.push(h(3, 'Jira - automatic, read-only, opt-in'));
  out.push(
    p(
      'When you name a ticket, Jira is called for you. Two separate calls happen, for two different ' +
        'purposes:'
    )
  );
  out.push(
    table(
      ['Caller', 'What it fetches', 'What it is used for'],
      [
        [
          'Pablo - fetchJiraAcceptanceCriteria',
          "The ticket's acceptance criteria, via REST API v2 (with a v3 field lookup to locate the custom AC field)",
          'Handed to Bob as authoring context so generated tests reflect what the ticket actually asked for',
        ],
        [
          'Bob - fetchJiraIssueMeta',
          "The ticket's updated timestamp and issue type, via REST API v2",
          'Staleness detection - if the ticket changed after a plan was written, that plan is regenerated; otherwise it is reused',
        ],
      ]
    )
  );
  out.push(
    panel(
      'note',
      'Three things to be clear about',
      p(
        '<strong>It is opt-in, not always-on.</strong> The Jira call only fires when issue keys are ' +
          'supplied. A plain changed-mode run never contacts Jira.'
      ) +
        p(
          '<strong>It is strictly read-only.</strong> There is no POST or PUT to Jira anywhere in the ' +
            'runners. Results are never written back to the ticket - no comment, no status transition, ' +
            'no attachment. If you want QA results on the ticket, someone puts them there by hand.'
        ) +
        p(
          '<strong>It degrades rather than fails.</strong> If the custom-field lookup is blocked by ' +
            'permissions or the Jira version differs, it falls back to standard fields and records a ' +
            'warning instead of aborting the run. Check the warnings in the run report before trusting ' +
            'that acceptance criteria were actually found.'
        )
    )
  );
  out.push(
    p(
      'Offline alternative: <code>--ac-file=&lt;path&gt;</code> supplies acceptance criteria from a ' +
        'local file and skips Jira entirely. Requires <code>JIRA_BASE_URL</code>, ' +
        '<code>JIRA_USER_EMAIL</code>, <code>JIRA_API_TOKEN</code> and <code>JIRA_PROJECT</code> in ' +
        '<code>.env</code> otherwise.'
    )
  );

  out.push(h(3, 'Confluence - explicit, not part of a run'));
  out.push(
    p(
      'Confluence publishing is genuinely useful and fully automated <em>once invoked</em>, but it is ' +
        'not triggered by a test run. <code>run-pablo.js</code> contains no Confluence code. You ' +
        'publish by running a publisher, or by asking the agent to.'
    )
  );
  out.push(
    table(
      ['Publisher', 'Publishes'],
      [
        ['publish-e2e-confluence.js', 'Playwright functional results - the 211-test table'],
        ['publish-api-confluence.js', 'API probe results'],
        ['publish-integration-confluence.js', 'UI-API integration results, rendering harness and observation outcomes distinctly'],
        ['publish-architecture-confluence.js', 'This documentation page'],
      ]
    )
  );
  out.push(
    p(
      'All four are <strong>upsert-style and idempotent</strong>. They locate their own section on the ' +
        'target page by heading, replace it in place, and bump the page version. ' +
        '<code>publish-e2e-confluence.js</code> additionally carries a ' +
        '<code>removeStandaloneSection()</code> guard so results cannot end up rendered twice - once ' +
        'in the table and again as loose text below it. Re-running a publisher updates; it does not ' +
        'append.'
    )
  );
  out.push(
    panel(
      'warning',
      'Do not hand-edit generated pages',
      p(
        'Anything a publisher owns is overwritten on the next run, including this page. Change the ' +
          'generator instead. Credentials come from a git-ignored <code>.env</code> ' +
          '(<code>CONFLUENCE_BASE_URL</code>, <code>CONFLUENCE_API_TOKEN</code>, ' +
          '<code>CONFLUENCE_SPACE_KEY</code>, <code>CONFLUENCE_PAGE_ID</code>) and are never committed.'
      )
    )
  );
  out.push(
    p(
      'Note that the <strong>Confluence-Agent</strong> and <strong>Confluence-Writer</strong> agent ' +
        'definitions are definition-only and play no part in this. Publishing works today because of ' +
        'the four scripts above, not because those agents run.'
    )
  );

  /* -- config -- */
  out.push(h(2, 'Configuration'));
  out.push(h(3, 'qa-agent.config.json'));
  out.push(
    p(
      'Registers all 16 agents with a path, an <code>enabled</code> flag and a timeout, and defines ' +
        'the canonical <code>runOrder</code> and the five severity levels (critical, high, medium, low, info).'
    )
  );
  out.push(
    code(
      'runOrder: pablo -> api-agent -> unit-test-qa -> bob -> susan -> smoke ->\n' +
        '          security-qa -> regression -> accessibility -> api-contract ->\n' +
        '          visual-diff -> e2e -> guide-sync',
      'text'
    )
  );

  out.push(h(3, 'Adapters'));
  out.push(
    p(
      'Adapters hold the per-repository specifics so the core stays generic. The repo rule is ' +
        '"centralise by default; only add behaviour under <code>adapters/</code> when a repository ' +
        'requires a specific conditional." Four exist: frontend, backend, dbt, modeling.'
    )
  );

  out.push(h(3, 'Environment'));
  out.push(
    p(
      'Credentials live in a git-ignored <code>.env</code> at the repo root. Required keys: ' +
        '<code>JIRA_BASE_URL</code>, <code>JIRA_USER_EMAIL</code>, <code>JIRA_API_TOKEN</code>, ' +
        '<code>JIRA_PROJECT</code>, <code>CONFLUENCE_BASE_URL</code>, <code>CONFLUENCE_SPACE_KEY</code>, ' +
        '<code>CONFLUENCE_PAGE_ID</code>, <code>CONFLUENCE_API_TOKEN</code>, <code>LIVE_UI_URL</code>.'
    )
  );

  /* -- outputs -- */
  out.push(h(2, 'Output artifacts'));
  out.push(
    table(
      ['Location', 'What lands there'],
      [
        ['QA-Runs/', 'One report per run, timestamped'],
        ['component-poc/qa-agent/agents/<agent>/results/', 'Per-agent JSON + Markdown results, plus latest.json'],
        ['QA-Tests/', 'Generated test plans (*.qa.md) authored by Bob'],
        ['e2e/playwright-report/', 'Playwright HTML report'],
        ['Confluence QA Summary (1353804850)', 'Published run sections - functional, API, and integration'],
      ]
    )
  );
  out.push(
    p(
      '<code>latest.json</code> is a pointer to the most recent run; the individual ' +
        '<code>*-result-&lt;timestamp&gt;.json</code> files are the durable record.'
    )
  );

  /* -- gaps -- */
  out.push(h(2, 'Known gaps and caveats'));
  out.push(
    table(
      ['Gap', 'Detail'],
      [
        [
          'LIVE_UI_URL is not wired',
          'The key is set in .env, but no script reads it. The frontend adapter still pins e2eBaseUrl to http://localhost:4173, so a default Playwright run targets a local build, not the live environment.',
        ],
        [
          '11 of 16 agents are not implemented',
          'Smoke, Security-QA, Jira-Agent, API-Agent, Unit-Test-QA, Regression, Accessibility, API-Contract, Visual-Diff, Confluence-Agent, Confluence-Writer have no runner.',
        ],
        [
          'Suites 2 and 3 cannot run unattended',
          'Neither is a self-contained runner. Both emit a browser script that must be evaluated inside a signed-in page to capture a bearer token, so they cannot run in CI as written.',
        ],
        [
          'Integration coverage is US only',
          'Suite 3 has only been exercised against retail unit US on the dev environment.',
        ],
        [
          'Adapter paths are absolute and user-specific',
          'adapter.json hardcodes /Users/timothy.collins/... paths, so the adapters are not portable to another machine or to CI as written.',
        ],
      ]
    )
  );

  /* -- open questions -- */
  out.push(h(2, 'Open product questions'));
  out.push(
    p(
      'Two behaviours are measured precisely by suite 3 but cannot be judged correct or incorrect ' +
        'without product input. Both are recorded as <strong>observations</strong>, deliberately not as defects.'
    )
  );
  out.push(
    table(
      ['#', 'Observation', 'Evidence'],
      [
        [
          '1',
          'Gap sign inversion',
          'API returns netQuantityGap = +163834; the UI displays -164K. The UI appears to deliberately re-sign the value as an "amount to close".',
        ],
        [
          '2',
          'Trends chart second series',
          'The line labelled "vs goal" is exactly 10000 divided by the "vs last year" line - verified on 15 of 15 points across HFB 08, PA 0811 and PA 0822. Real goal indices exist at HFB level (ytdNetSalesGoalIndex = 89.24) and are not what is plotted; at PA level they are null. Possibly an intentional "index needed to catch up".',
        ],
      ]
    )
  );

  out.push(h(2, 'Source'));
  out.push(
    p(
      'Repository: <a href="https://github.com/wookietim/gm-salesplanning-ai-qa">' +
        'github.com/wookietim/gm-salesplanning-ai-qa</a>'
    )
  );
  out.push(
    p(
      '<em>This page is generated by <code>component-poc/qa-agent/scripts/publish-architecture-confluence.js</code>. ' +
        'Re-run that script to refresh it rather than editing the page by hand.</em>'
    )
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

  // Does the page already exist under this parent?
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
