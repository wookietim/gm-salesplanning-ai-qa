#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    // Support both `--key value` and `--key=value`.
    const body = token.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      args[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    const key = body;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function tsCompact(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

// Playwright colourises error output; raw ANSI makes the report unreadable.
function stripAnsi(text) {
  return String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Some Playwright configs declare a `webServer` block and start the app
 * themselves; others require the app to already be running. Knowing which
 * determines whether an unreachable baseURL is our problem to report.
 */
function configDeclaresWebServer(configFile) {
  try {
    const text = fs.readFileSync(configFile, 'utf8');
    // Ignore commented-out mentions so a "we do NOT auto-start" note isn't a match.
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return /(^|[\s,{])webServer\s*:/.test(stripped);
  } catch (error) {
    return false;
  }
}

/**
 * Synchronous reachability probe. Runs in a child process so the main flow can
 * stay sequential, and avoids depending on curl being installed.
 */
function isUrlReachable(url, timeoutMs = 5000) {
  const script = `
    const url = new URL(${JSON.stringify(url)});
    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(
      { method: 'GET', hostname: url.hostname, port: url.port, path: url.pathname || '/', timeout: ${timeoutMs} },
      (res) => { res.resume(); process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1); }
    );
    req.on('timeout', () => { req.destroy(); process.exit(1); });
    req.on('error', () => process.exit(1));
    req.end();
  `;
  const probe = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    timeout: timeoutMs + 2000,
  });
  return probe.status === 0;
}

/**
 * Resolve e2e configuration: explicit args win, then the adapter, then defaults.
 */
function resolveConfig(args, repoRoot) {
  let adapter = {};
  let adapterPath = '';

  if (args.adapter) {
    adapterPath = path.isAbsolute(args.adapter)
      ? args.adapter
      : path.resolve(repoRoot, 'adapters', args.adapter, 'adapter.json');
    adapter = readJson(adapterPath, {});
  } else {
    const adaptersDir = path.join(repoRoot, 'adapters');
    if (fs.existsSync(adaptersDir)) {
      const candidates = fs
        .readdirSync(adaptersDir)
        .map((name) => path.join(adaptersDir, name, 'adapter.json'))
        .filter((file) => fs.existsSync(file))
        .map((file) => ({ file, json: readJson(file, {}) }))
        .filter((entry) => entry.json && entry.json.e2eRoot);
      if (candidates.length === 1) {
        adapter = candidates[0].json;
        adapterPath = candidates[0].file;
      } else if (candidates.length > 1) {
        return {
          error: `Multiple adapters define e2eRoot (${candidates
            .map((c) => path.basename(path.dirname(c.file)))
            .join(', ')}). Pass --adapter <id> to choose one.`,
        };
      }
    }
  }

  const e2eRoot = args['e2e-root'] || adapter.e2eRoot || '';
  const e2eCommand = args['e2e-command'] || adapter.e2eCommand || 'npm run test:e2e';
  const browsers = args.browsers ? splitList(args.browsers) : adapter.e2eBrowsers || [];
  const baseUrl = args['base-url'] || adapter.e2eBaseUrl || '';
  const startAppHint = adapter.e2eStartAppHint || '';

  return { adapter, adapterPath, e2eRoot, e2eCommand, browsers, baseUrl, startAppHint };
}

/**
 * Turn "npm run test:e2e" into a spawnable command, appending Playwright flags
 * after a `--` separator so npm forwards them rather than consuming them.
 */
function buildCommand(e2eCommand, extraArgs) {
  const parts = e2eCommand.split(/\s+/).filter(Boolean);
  // npm swallows flags unless they follow `--`, for both `npm run x` and `npm test`.
  if (parts[0] === 'npm' && (parts[1] === 'run' || parts[1] === 'test')) {
    const rest = parts.slice(1).filter((p) => p !== '--');
    return { cmd: 'npm', args: [...rest, '--', ...extraArgs] };
  }
  return { cmd: parts[0], args: [...parts.slice(1), ...extraArgs] };
}

/**
 * The Playwright JSON report nests suites (one level per describe block), so
 * specs must be collected recursively rather than from the top level only.
 */
function collectSpecs(suite, filePath, out, ancestry = [], depth = 0) {
  const file = suite.file || filePath || '';
  // Depth 0 is the file-level suite, whose title is a path rather than a
  // describe name, so it is excluded from the ancestry.
  const titlePath = depth > 0 && suite.title ? [...ancestry, suite.title] : ancestry;

  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      out.push({ spec, test, file: spec.file || file, titlePath });
    }
  }
  for (const child of suite.suites || []) {
    collectSpecs(child, file, out, titlePath, depth + 1);
  }
}

function extractFailure(test) {
  const results = test.results || [];
  const last = results[results.length - 1] || {};
  const errors = last.errors && last.errors.length ? last.errors : last.error ? [last.error] : [];

  const messages = errors
    .map((err) => stripAnsi(err.message || err.value || ''))
    .filter(Boolean);

  const snippet = stripAnsi(errors.map((e) => e.snippet).filter(Boolean)[0] || '');
  const location = errors
    .map((e) => e.location)
    .filter(Boolean)
    .map((loc) => `${loc.file}:${loc.line}:${loc.column}`)[0] || '';

  const attachments = last.attachments || [];
  const findAttachment = (name) =>
    (attachments.find((a) => a.name === name) || {}).path || '';

  return {
    message: messages.join('\n\n'),
    snippet,
    location,
    tracePath: findAttachment('trace'),
    screenshotPath: findAttachment('screenshot'),
    videoPath: findAttachment('video'),
  };
}

/**
 * Playwright's per-test `status` is the *outcome* after retries, which is what
 * distinguishes a genuine failure from a flake.
 */
function mapOutcome(test) {
  const outcome = test.status || '';
  const results = test.results || [];
  const last = results[results.length - 1] || {};

  if (outcome === 'expected') return 'passed';
  if (outcome === 'flaky') return 'flaky';
  if (outcome === 'skipped') return 'skipped';
  if (outcome === 'unexpected') {
    return last.status === 'timedOut' ? 'timedOut' : 'failed';
  }
  return last.status || 'failed';
}

/**
 * Tests are attributed to Jira tickets by the ticket key in their describe
 * block title, so one test can legitimately belong to several tickets.
 */
function extractTicketKeys(text) {
  return Array.from(new Set((String(text).match(/SSPLAN-\d+/gi) || []).map((k) => k.toUpperCase())));
}

function severityFor(status) {
  if (status === 'failed' || status === 'timedOut') return 'critical';
  if (status === 'flaky') return 'high';
  if (status === 'skipped') return 'low';
  return 'info';
}

function buildResult(report, meta) {
  const flat = [];
  for (const suite of report.suites || []) {
    collectSpecs(suite, suite.file, flat);
  }

  const specs = [];
  const findings = [];
  const susanHandoff = [];

  for (const { spec, test, file, titlePath } of flat) {
    const status = mapOutcome(test);
    const failure = status === 'passed' || status === 'skipped' ? null : extractFailure(test);
    const results = test.results || [];
    const durationMs = results.reduce((sum, r) => sum + (r.duration || 0), 0);
    const relFile = file ? path.relative(meta.e2eRoot, path.resolve(meta.e2eRoot, file)) : '';

    const entry = {
      title: spec.title,
      suitePath: titlePath || [],
      fullTitle: [...(titlePath || []), spec.title].join(' › '),
      jiraTickets: extractTicketKeys([...(titlePath || []), spec.title].join(' ')),
      file: relFile || file,
      project: test.projectName || '',
      status,
      durationMs,
      retries: Math.max(0, results.length - 1),
    };

    if (failure && failure.message) entry.errorMessage = failure.message;
    if (failure && failure.tracePath) entry.tracePath = failure.tracePath;
    if (failure && failure.screenshotPath) entry.screenshotPath = failure.screenshotPath;
    specs.push(entry);

    if (status !== 'passed') {
      const evidenceParts = [];
      if (failure && failure.location) evidenceParts.push(`at ${failure.location}`);
      if (failure && failure.message) evidenceParts.push(failure.message);
      if (failure && failure.snippet) evidenceParts.push(failure.snippet);
      if (failure && failure.tracePath) evidenceParts.push(`trace: ${failure.tracePath}`);

      findings.push({
        severity: severityFor(status),
        title:
          status === 'flaky'
            ? `Flaky: "${spec.title}" passed only after ${entry.retries} retry(ies) on ${entry.project}`
            : status === 'skipped'
              ? `Skipped: "${spec.title}" on ${entry.project}`
              : `Failed: "${spec.title}" on ${entry.project}`,
        specTitle: spec.title,
        project: entry.project,
        evidence: evidenceParts.join('\n') || '(no error detail reported)',
        recommendedAction:
          status === 'flaky'
            ? 'Investigate non-determinism in the app or the spec; do not treat as passing.'
            : status === 'skipped'
              ? 'Confirm the skip is intentional; otherwise this is a coverage gap.'
              : 'Reproduce locally with the command above and inspect the trace.',
      });
    }

    susanHandoff.push({
      specTitle: spec.title,
      result:
        status === 'passed'
          ? 'PASS'
          : status === 'flaky'
            ? 'PARTIAL'
            : status === 'skipped'
              ? 'MANUAL-ONLY'
              : 'FAIL',
      venue: 'REAL FE',
      evidence: failure && failure.message ? failure.message : '',
    });
  }

  const totals = {
    total: specs.length,
    passed: specs.filter((s) => s.status === 'passed').length,
    failed: specs.filter((s) => s.status === 'failed' || s.status === 'timedOut').length,
    flaky: specs.filter((s) => s.status === 'flaky').length,
    skipped: specs.filter((s) => s.status === 'skipped').length,
  };

  const byTicket = buildTicketRollup(specs);

  return { specs, findings, susanHandoff, totals, byTicket };
}

/**
 * Rolls results up per Jira ticket. Only tests carrying a ticket key are
 * included, because the Confluence QA summary table is ticket-scoped and
 * full-suite totals must never be written as a ticket row.
 */
function buildTicketRollup(specs) {
  const tickets = new Map();

  for (const spec of specs) {
    for (const key of spec.jiraTickets || []) {
      if (!tickets.has(key)) {
        tickets.set(key, { jiraTicket: key, testsPassing: 0, testsFailing: 0, testsBlocked: 0, tests: [] });
      }
      const bucket = tickets.get(key);

      if (spec.status === 'passed') bucket.testsPassing += 1;
      else if (spec.status === 'skipped') bucket.testsBlocked += 1;
      else bucket.testsFailing += 1;

      bucket.tests.push({
        name: spec.title,
        status: spec.status === 'passed' ? 'passed' : spec.status === 'skipped' ? 'blocked' : 'failed',
        errorMessage: spec.errorMessage || '',
      });
    }
  }

  return Array.from(tickets.values()).sort((a, b) =>
    Number(a.jiraTicket.split('-')[1]) - Number(b.jiraTicket.split('-')[1])
  );
}

function toMarkdown(result) {
  const lines = [];
  lines.push(`# E2E Run — ${result.runId}`);
  lines.push('');
  lines.push(`- Status: **${result.status}**`);
  lines.push(`- Started: ${result.startedAt}`);
  lines.push(`- Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push(`- e2eRoot: ${result.e2eRoot}`);
  lines.push(`- Command: \`${result.commandRun}\``);
  lines.push('');

  if (result.blockedReason) {
    lines.push('## Blocked');
    lines.push('');
    lines.push(result.blockedReason);
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Totals');
  lines.push('');
  lines.push('| Total | Passed | Failed | Flaky | Skipped |');
  lines.push('|---|---|---|---|---|');
  lines.push(
    `| ${result.totals.total} | ${result.totals.passed} | ${result.totals.failed} | ${result.totals.flaky} | ${result.totals.skipped} |`
  );
  lines.push('');

  lines.push('## Per-spec results');
  lines.push('');
  lines.push('| Test | Browser | Status | Duration |');
  lines.push('|---|---|---|---|');
  for (const spec of result.specs) {
    lines.push(
      `| ${spec.title} | ${spec.project} | ${spec.status} | ${(spec.durationMs / 1000).toFixed(2)}s |`
    );
  }
  lines.push('');

  const notPassing = result.specs.filter((s) => s.status !== 'passed');
  lines.push('## Why tests did not pass');
  lines.push('');
  if (notPassing.length === 0) {
    lines.push('All tests passed on the first attempt.');
  } else {
    for (const spec of notPassing) {
      lines.push(`### ${spec.title} — ${spec.project} (${spec.status})`);
      lines.push('');
      if (spec.errorMessage) {
        lines.push('```');
        lines.push(spec.errorMessage);
        lines.push('```');
      } else {
        lines.push('_No error detail reported._');
      }
      if (spec.tracePath) lines.push(`- Trace: \`${spec.tracePath}\``);
      if (spec.screenshotPath) lines.push(`- Screenshot: \`${spec.screenshotPath}\``);
      lines.push('');
    }
  }

  if (result.findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    for (const finding of result.findings) {
      lines.push(`- **[${finding.severity}]** ${finding.title}`);
      lines.push(`  - ${finding.recommendedAction}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '../../..');
  const started = new Date();
  const startedAt = started.toISOString();
  const runId = args['run-id'] || `e2e-${tsCompact(started)}`;

  const resultsDir = path.join(__dirname, '../agents/e2e/results');
  const runsDir = path.join(repoRoot, 'QA-Runs');
  ensureDir(resultsDir);
  ensureDir(runsDir);

  const config = resolveConfig(args, repoRoot);

  const finish = (result) => {
    const stamp = tsCompact(started);
    const jsonPath = path.join(resultsDir, `e2e-result-${stamp}.json`);
    const mdPath = path.join(resultsDir, `e2e-result-${stamp}.md`);
    const latestPath = path.join(resultsDir, 'latest.json');
    const runsMdPath = path.join(runsDir, `e2e-${stamp}.md`);
    const markdown = toMarkdown(result);

    fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, markdown, 'utf8');
    fs.writeFileSync(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(runsMdPath, markdown, 'utf8');

    console.log('[E2E] Execution complete.');
    console.log(`[E2E] Status: ${result.status}`);
    if (result.blockedReason) {
      console.log(`[E2E] Blocked: ${result.blockedReason}`);
    } else {
      console.log(`[E2E] Command: ${result.commandRun}`);
      console.log(
        `[E2E] Total: ${result.totals.total}, Passed: ${result.totals.passed}, Failed: ${result.totals.failed}, Flaky: ${result.totals.flaky}, Skipped: ${result.totals.skipped}`
      );
      for (const spec of result.specs) {
        const mark = spec.status === 'passed' ? 'PASS' : spec.status.toUpperCase();
        console.log(`[E2E] ${mark} — "${spec.title}" [${spec.project}]`);
      }
      const notPassing = result.specs.filter((s) => s.status !== 'passed');
      if (notPassing.length > 0) {
        console.log('[E2E] Why tests did not pass:');
        for (const spec of notPassing) {
          console.log(`[E2E] - "${spec.title}" [${spec.project}] (${spec.status})`);
          const detail = (spec.errorMessage || '(no error detail reported)').split('\n');
          for (const line of detail) {
            console.log(`[E2E]     ${line}`);
          }
          if (spec.tracePath) console.log(`[E2E]     trace: ${spec.tracePath}`);
        }
      }
    }
    console.log(`[E2E] JSON result: ${jsonPath}`);
    console.log(`[E2E] Markdown result: ${mdPath}`);
    console.log(`[E2E] Run artifact: ${runsMdPath}`);
  };

  const blocked = (reason, extra = {}) =>
    finish({
      runId,
      agentId: 'e2e',
      startedAt,
      endedAt: new Date().toISOString(),
      status: 'blocked',
      summary: `E2E suite did not run: ${reason}`,
      blockedReason: reason,
      e2eRoot: config.e2eRoot || '',
      commandRun: extra.commandRun || '',
      durationMs: Date.now() - started.getTime(),
      totals: { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 },
      byTicket: [],
      specs: [],
      susanHandoff: [],
      findings: [
        {
          severity: 'critical',
          title: 'E2E suite could not be executed',
          evidence: reason,
          recommendedAction: 'Fix the configuration or environment, then re-run.',
        },
      ],
    });

  if (config.error) {
    blocked(config.error);
    return;
  }
  if (!config.e2eRoot) {
    blocked(
      'No e2eRoot resolved. Set e2eRoot in adapters/<id>/adapter.json or pass --e2e-root <path>.'
    );
    return;
  }
  if (!fs.existsSync(config.e2eRoot)) {
    blocked(`e2eRoot does not exist: ${config.e2eRoot}`);
    return;
  }

  const configFile = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']
    .map((name) => path.join(config.e2eRoot, name))
    .find((file) => fs.existsSync(file));
  if (!configFile) {
    blocked(`No playwright.config.* found in ${config.e2eRoot}`);
    return;
  }

  if (args['install-browsers'] === 'true') {
    console.log('[E2E] Installing Playwright browsers...');
    const install = spawnSync('npx', ['playwright', 'install', '--with-deps'], {
      cwd: config.e2eRoot,
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (install.status !== 0) {
      blocked('Playwright browser installation failed.');
      return;
    }
  }

  // A suite with its own package.json needs its own install; without it every
  // test fails on a missing @playwright/test rather than on real assertions.
  const localPackageJson = path.join(config.e2eRoot, 'package.json');
  const localModules = path.join(config.e2eRoot, 'node_modules');
  if (fs.existsSync(localPackageJson) && !fs.existsSync(localModules)) {
    blocked(
      `Dependencies are not installed in ${config.e2eRoot}. Run: cd '${config.e2eRoot}' && npm install`
    );
    return;
  }

  // When Playwright does not own the app lifecycle, an unreachable baseURL
  // means every test fails on connection errors. That is an environment
  // problem, not a test result, so report it as blocked instead.
  const ownsWebServer = configDeclaresWebServer(configFile);
  if (!ownsWebServer && config.baseUrl && args['skip-health-check'] !== 'true') {
    console.log(`[E2E] Config has no webServer block; checking ${config.baseUrl} is reachable...`);
    if (!isUrlReachable(config.baseUrl)) {
      const hint = config.startAppHint
        ? `\n\nStart the app first:\n  ${config.startAppHint}`
        : '';
      blocked(
        `The application is not reachable at ${config.baseUrl} and this Playwright config does not start it automatically.${hint}`
      );
      return;
    }
    console.log('[E2E] Application is reachable.');
  }

  const reportPath = path.join(resultsDir, `.playwright-report-${tsCompact(started)}.json`);
  const extraArgs = ['--reporter=json'];
  for (const browser of config.browsers) {
    extraArgs.push(`--project=${browser}`);
  }
  if (args.grep) extraArgs.push('--grep', args.grep);
  if (args.workers) extraArgs.push(`--workers=${args.workers}`);
  if (args.retries) extraArgs.push(`--retries=${args.retries}`);
  if (args['update-snapshots'] === 'true') extraArgs.push('--update-snapshots');
  for (const spec of splitList(args.specs)) {
    extraArgs.push(spec);
  }

  const { cmd, args: cmdArgs } = buildCommand(config.e2eCommand, extraArgs);
  const commandRun = `${cmd} ${cmdArgs.join(' ')}`;
  const timeoutSeconds = Number(args['timeout-seconds'] || 1800);

  console.log(`[E2E] e2eRoot: ${config.e2eRoot}`);
  console.log(`[E2E] Running: ${commandRun}`);

  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath };
  if (config.baseUrl && args['base-url']) {
    env.PLAYWRIGHT_TEST_BASE_URL = config.baseUrl;
  }

  const run = spawnSync(cmd, cmdArgs, {
    cwd: config.e2eRoot,
    encoding: 'utf8',
    env,
    timeout: timeoutSeconds * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (run.error && run.error.code === 'ETIMEDOUT') {
    blocked(`Suite exceeded the ${timeoutSeconds}s wall-clock limit and was terminated.`, {
      commandRun,
    });
    return;
  }

  const report = readJson(reportPath, null);

  // A non-zero exit with a parseable report means tests failed, which is a
  // result. A non-zero exit with no report means the suite never ran.
  if (!report) {
    const stderr = stripAnsi(run.stderr || '').trim();
    const stdout = stripAnsi(run.stdout || '').trim();
    const detail = stderr || stdout || 'No output captured.';
    blocked(`Playwright produced no JSON report (exit ${run.status}). Output:\n${detail}`, {
      commandRun,
    });
    return;
  }

  const { specs, findings, susanHandoff, totals, byTicket } = buildResult(report, {
    e2eRoot: config.e2eRoot,
  });

  // Record the target the suite actually ran against. Read it back out of
  // Playwright's own report rather than re-deriving it from the environment, so
  // the artifact is evidence of what was tested rather than an assumption. A
  // result that does not say where it ran cannot be trusted after the fact.
  // NOTE: the JSON reporter does not serialise `config.use`, so baseURL is not
  // readable from the report directly. The Playwright config publishes it via
  // `metadata.targetUrl` instead, which does survive into the report.
  const targetUrl =
    (report.config && report.config.metadata && report.config.metadata.targetUrl) ||
    process.env.E2E_BASE_URL ||
    null;

  const globalErrors = (report.errors || [])
    .map((e) => stripAnsi(e.message || ''))
    .filter(Boolean);

  if (totals.total === 0 && globalErrors.length > 0) {
    blocked(`Playwright reported errors before any test ran:\n${globalErrors.join('\n')}`, {
      commandRun,
    });
    return;
  }

  // Pass criteria (AGENT.md): every test passed on its first attempt and zero
  // flaky tests. A flake must not hide behind an overall green result.
  const status = totals.failed > 0 || totals.flaky > 0 ? 'fail' : 'pass';
  const summary =
    `${totals.passed}/${totals.total} passed` +
    (totals.failed ? `, ${totals.failed} failed` : '') +
    (totals.flaky ? `, ${totals.flaky} flaky (flaky counts as a failure)` : '') +
    (totals.skipped ? `, ${totals.skipped} skipped` : '');

  finish({
    runId,
    agentId: 'e2e',
    startedAt,
    endedAt: new Date().toISOString(),
    status,
    summary,
    commandRun,
    targetUrl,
    e2eRoot: config.e2eRoot,
    durationMs: Date.now() - started.getTime(),
    totals,
    byTicket,
    specs,
    susanHandoff,
    findings,
  });

  try {
    fs.unlinkSync(reportPath);
  } catch (error) {
    /* leaving the raw report behind is harmless */
  }
}

main();
