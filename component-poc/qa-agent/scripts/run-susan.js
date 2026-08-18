#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
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

function listBobPlans(bobDir, ticketPrefixes = []) {
  if (!fs.existsSync(bobDir)) {
    return [];
  }
  const prefixes = ticketPrefixes.map((prefix) => String(prefix || '').trim().toUpperCase()).filter(Boolean);
  return fs
    .readdirSync(bobDir)
    .filter((file) => file.endsWith('.qa.md'))
    .filter((file) => {
      if (prefixes.length === 0) {
        return true;
      }
      const upper = file.toUpperCase();
      return prefixes.some((prefix) => upper.startsWith(`${prefix}__`));
    })
    .sort()
    .map((file) => path.join(bobDir, file));
}

function parseRuntimeSignalBoolean(planText, signalKey) {
  const match = planText.match(
    new RegExp(`- Runtime signal:\\s*${signalKey}=\\s*(yes|no)`, 'i')
  );
  if (!match) {
    return null;
  }
  return match[1].toLowerCase() === 'yes';
}

function parseRuntimeSignalNumber(planText, signalKey) {
  const match = planText.match(
    new RegExp(`- Runtime signal:\\s*${signalKey}=\\s*(\\d+)`, 'i')
  );
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function extractRuntimeAssertionIds(planText) {
  const ids = [];
  const regex = /- Runtime assertion:\s*([a-z0-9-]+)/gi;
  let match = regex.exec(planText);
  while (match) {
    ids.push(match[1].trim().toLowerCase());
    match = regex.exec(planText);
  }
  return Array.from(new Set(ids));
}

function uniqueMatches(content, regex) {
  return Array.from(new Set((content.match(regex) || []).map((item) => item.trim())));
}

function analyzeRuntimeProfile(sourceText) {
  const interactionHandlers = uniqueMatches(
    sourceText,
    /\b(onClick|onChange|onSubmit|onKeyDown|onKeyUp|onBlur|onFocus|onSelect|onInput)\b/g
  );

  const hasAsyncDataFlow =
    /\b(useEffect|fetch\(|axios\.|await\s|Promise\.|then\(|useQuery\(|useMutation\()/.test(
      sourceText
    );

  const hasStateTransitions =
    /\b(useState\(|useReducer\(|set[A-Z][A-Za-z0-9_]*\s*\()/.test(sourceText);

  const hasLoadingUi = /\b(loading|isLoading|spinner|skeleton|pending)\b/i.test(sourceText);

  const hasErrorFallback =
    /\b(error|catch\s*\(|failed|fallback|empty\s*state|unavailable|null|undefined)\b/i.test(
      sourceText
    );

  const hasNetworkDependencies =
    /\b(fetch\(|axios\.|graphql|apollo|swr|react-query|useQuery\(|useMutation\()/.test(sourceText);

  return {
    interactionHandlers,
    hasAsyncDataFlow,
    hasStateTransitions,
    hasLoadingUi,
    hasErrorFallback,
    hasNetworkDependencies,
  };
}

function getRequiredRuntimeAssertions(testId, runtimeProfile) {
  const required = [];
  if (/^BOB-HP-/i.test(testId)) {
    required.push('interaction-path-covered', 'state-transition-observed');
    if (runtimeProfile.hasAsyncDataFlow || runtimeProfile.hasNetworkDependencies) {
      required.push('async-success-observed');
    }
  }

  if (/^BOB-SP-/i.test(testId)) {
    required.push('sad-input-branch-covered', 'error-or-fallback-observed');
    if (runtimeProfile.hasLoadingUi) {
      required.push('loading-to-terminal-state');
    }
  }

  return required;
}

function parsePlan(planText) {
  const sourceMatch = planText.match(/- Source component:\s*(.+)/);
  let sourcePath = sourceMatch ? sourceMatch[1].trim() : '';

  const jiraIssueLineMatch = planText.match(/- Jira issue keys:\s*(.+)/);
  const jiraIssueKeys = jiraIssueLineMatch
    ? jiraIssueLineMatch[1]
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key && key.toLowerCase() !== 'not provided')
    : [];

  if (jiraIssueKeys.length === 0) {
    const ticketMatch = planText.match(/Ticket:\s*\*?\*?([A-Z]+-\d+)/i);
    if (ticketMatch) {
      jiraIssueKeys.push(ticketMatch[1].toUpperCase());
    }
  }

  const testIdRegex = /^###\s+Test ID:\s*(.+)$/gm;
  const testIds = [];
  let match = testIdRegex.exec(planText);
  while (match) {
    testIds.push(match[1].trim());
    match = testIdRegex.exec(planText);
  }

  const matrixTestIds = Array.from(
    new Set(
      Array.from(planText.matchAll(/^\|\s*([A-Z0-9]{1,10}-\d+)\s*\|/gm)).map((m) => m[1].trim())
    )
  );

  if (testIds.length === 0 && matrixTestIds.length > 0) {
    testIds.push(...matrixTestIds);
  }

  if (!sourcePath) {
    const featureMatch = planText.match(/-\s*Feature under test:\s*`?([^`\n]+)`?/i);
    if (featureMatch) {
      sourcePath = `__feature__:${featureMatch[1].trim()}`;
    }
  }

  const hasHappySection = /##\s+\d+\.\s+Happy Path Tests/i.test(planText);
  const hasSadSection = /##\s+\d+\.\s+Sad Path Tests/i.test(planText);
  const dataCheckCount = (planText.match(/- Check\s+\d+:/g) || []).length;
  const hasA11ySection = /##\s+\d+\.\s+Accessibility Checks/i.test(planText);
  const hasAssumedCriteria = /No Jira criteria provided\./i.test(planText);
  const hasRuntimeProfile = /##\s+\d+\.\s+Runtime Execution Profile/i.test(planText);

  const runtimeSignals = {
    interactionHandlers: parseRuntimeSignalNumber(planText, 'interaction-handlers'),
    asyncDataFlow: parseRuntimeSignalBoolean(planText, 'async-data-flow'),
    stateTransitions: parseRuntimeSignalBoolean(planText, 'state-transitions'),
    loadingUi: parseRuntimeSignalBoolean(planText, 'loading-ui'),
    errorFallback: parseRuntimeSignalBoolean(planText, 'error-fallback'),
    networkDependencies: parseRuntimeSignalBoolean(planText, 'network-dependencies'),
  };

  const runtimeAssertionIds = extractRuntimeAssertionIds(planText);
  const planFormat = matrixTestIds.length > 0 ? 'manual-matrix' : 'bob-runtime';

  return {
    sourcePath,
    jiraIssueKeys,
    testIds,
    hasHappySection,
    hasSadSection,
    dataCheckCount,
    hasA11ySection,
    hasAssumedCriteria,
    hasRuntimeProfile,
    runtimeSignals,
    runtimeAssertionIds,
    planFormat,
  };
}

function isComponentSourceLikelyValid(sourceText) {
  const hasExport =
    /export\s+default\s+function\s+[A-Z]/.test(sourceText) ||
    /export\s+function\s+[A-Z]/.test(sourceText) ||
    /export\s+const\s+[A-Z]/.test(sourceText) ||
    /export\s+default\s+[A-Z]/.test(sourceText);
  const hasJsx = /<[A-Za-z][\w:-]*/.test(sourceText);
  return hasExport || hasJsx;
}

function runChecksForTest(testId, context) {
  if (context.planFormat === 'manual-matrix') {
    return runChecksForManualTest(testId, context);
  }

  const checks = [];
  const reasons = [];

  const addCheck = (name, status, details) => {
    checks.push({ name, status, details });
    if (status === 'fail') {
      reasons.push(`${testId}: ${name} failed - ${details}`);
    }
  };

  addCheck(
    'source-file-exists',
    context.sourceExists ? 'pass' : 'fail',
    context.sourceExists ? 'Source component file found' : 'Source component file missing'
  );

  addCheck(
    'source-shape-valid',
    context.sourceShapeValid ? 'pass' : 'fail',
    context.sourceShapeValid
      ? 'Source appears to contain component export or JSX structure'
      : 'Source does not appear to be a valid component structure'
  );

  addCheck(
    'happy-and-sad-sections-present',
    context.hasHappyAndSad ? 'pass' : 'fail',
    context.hasHappyAndSad
      ? 'Both happy and sad path sections present'
      : 'Missing happy or sad path section in Bob plan'
  );

  addCheck(
    'data-consistency-coverage',
    context.hasDataConsistency ? 'pass' : 'fail',
    context.hasDataConsistency
      ? 'At least three data consistency checks present'
      : 'Insufficient data consistency checks in plan'
  );

  addCheck(
    'accessibility-coverage',
    context.hasA11y ? 'pass' : 'fail',
    context.hasA11y
      ? 'Accessibility section present'
      : 'Accessibility section missing'
  );

  addCheck(
    'runtime-profile-present',
    context.hasRuntimeProfile ? 'pass' : 'fail',
    context.hasRuntimeProfile
      ? 'Runtime execution profile section present'
      : 'Runtime execution profile section missing from Bob plan'
  );

  const runtimeMismatchDetails = [];
  if (context.planRuntimeSignals.interactionHandlers === null) {
    runtimeMismatchDetails.push('missing interaction-handlers signal');
  } else if (
    context.planRuntimeSignals.interactionHandlers > 0 !==
    (context.sourceRuntimeProfile.interactionHandlers.length > 0)
  ) {
    runtimeMismatchDetails.push('interaction-handlers signal does not match source');
  }

  const booleanSignalChecks = [
    {
      key: 'asyncDataFlow',
      label: 'async-data-flow',
      source: context.sourceRuntimeProfile.hasAsyncDataFlow,
    },
    {
      key: 'stateTransitions',
      label: 'state-transitions',
      source: context.sourceRuntimeProfile.hasStateTransitions,
    },
    {
      key: 'loadingUi',
      label: 'loading-ui',
      source: context.sourceRuntimeProfile.hasLoadingUi,
    },
    {
      key: 'errorFallback',
      label: 'error-fallback',
      source: context.sourceRuntimeProfile.hasErrorFallback,
    },
    {
      key: 'networkDependencies',
      label: 'network-dependencies',
      source: context.sourceRuntimeProfile.hasNetworkDependencies,
    },
  ];

  for (const signal of booleanSignalChecks) {
    const planned = context.planRuntimeSignals[signal.key];
    if (planned === null) {
      runtimeMismatchDetails.push(`missing ${signal.label} signal`);
      continue;
    }
    if (planned !== signal.source) {
      runtimeMismatchDetails.push(`${signal.label} signal does not match source`);
    }
  }

  addCheck(
    'runtime-signal-alignment',
    runtimeMismatchDetails.length === 0 ? 'pass' : 'fail',
    runtimeMismatchDetails.length === 0
      ? 'Runtime signals in Bob plan align with source component behavior'
      : runtimeMismatchDetails.join('; ')
  );

  const requiredRuntimeAssertions = getRequiredRuntimeAssertions(
    testId,
    context.sourceRuntimeProfile
  );
  const missingRuntimeAssertions = requiredRuntimeAssertions.filter(
    (assertion) => !context.runtimeAssertionIds.includes(assertion)
  );

  addCheck(
    'runtime-assertion-coverage',
    missingRuntimeAssertions.length === 0 ? 'pass' : 'fail',
    missingRuntimeAssertions.length === 0
      ? `Required runtime assertions present: ${requiredRuntimeAssertions.join(', ') || 'none'}`
      : `Missing runtime assertions: ${missingRuntimeAssertions.join(', ')}`
  );

  if (/^BOB-SP-/i.test(testId)) {
    addCheck(
      'sad-path-source-signals',
      context.hasSadSourceSignals ? 'pass' : 'fail',
      context.hasSadSourceSignals
        ? 'Source includes error or fallback signals'
        : 'Source lacks obvious error, loading, or fallback handling signals'
    );
  }

  if (context.expectedJiraIssues.length > 0) {
    const planIssueSet = new Set(context.planJiraIssues.map((item) => item.toLowerCase()));
    const missingIssues = context.expectedJiraIssues.filter(
      (issue) => !planIssueSet.has(issue.toLowerCase())
    );

    addCheck(
      'jira-issue-key-coverage',
      missingIssues.length === 0 ? 'pass' : 'fail',
      missingIssues.length === 0
        ? 'Plan includes requested Jira issue keys'
        : `Plan missing Jira issue keys: ${missingIssues.join(', ')}`
    );

    addCheck(
      'jira-criteria-not-assumed',
      context.hasAssumedCriteria ? 'fail' : 'pass',
      context.hasAssumedCriteria
        ? 'Plan still shows assumed criteria instead of Jira-derived criteria'
        : 'Plan includes Jira-derived criteria text'
    );
  }

  const status = reasons.length === 0 ? 'pass' : 'fail';
  return { testId, status, checks, reasons };
}

function runChecksForManualTest(testId, context) {
  const checks = [];
  const reasons = [];

  const addCheck = (name, status, details) => {
    checks.push({ name, status, details });
    if (status === 'fail') {
      reasons.push(`${testId}: ${name} failed - ${details}`);
    }
  };

  addCheck(
    'source-file-exists',
    context.sourceExists ? 'pass' : 'fail',
    context.sourceExists ? 'Source component file found' : 'Source component file missing'
  );

  addCheck(
    'source-shape-valid',
    context.sourceShapeValid ? 'pass' : 'fail',
    context.sourceShapeValid
      ? 'Source appears to contain component export or JSX structure'
      : 'Source does not appear to be a valid component structure'
  );

  if (/^SP-/i.test(testId)) {
    addCheck(
      'sad-path-source-signals',
      context.hasSadSourceSignals ? 'pass' : 'fail',
      context.hasSadSourceSignals
        ? 'Source includes error or fallback signals'
        : 'Source lacks obvious error, loading, or fallback handling signals'
    );
  }

  if (context.expectedJiraIssues.length > 0) {
    const planIssueSet = new Set(context.planJiraIssues.map((item) => item.toLowerCase()));
    const missingIssues = context.expectedJiraIssues.filter(
      (issue) => !planIssueSet.has(issue.toLowerCase())
    );

    addCheck(
      'jira-issue-key-coverage',
      missingIssues.length === 0 ? 'pass' : 'fail',
      missingIssues.length === 0
        ? 'Plan includes requested Jira issue keys'
        : `Plan missing Jira issue keys: ${missingIssues.join(', ')}`
    );
  }

  const status = reasons.length === 0 ? 'pass' : 'fail';
  return { testId, status, checks, reasons };
}

function deriveComponentName(planPath) {
  const base = path.basename(planPath).replace('.qa.md', '');
  const parts = base.split('__');
  return parts[parts.length - 1] || base;
}

function shouldRunForComponent(requestedSet, componentName, sourceRelative) {
  if (requestedSet.size === 0) {
    return true;
  }

  const stem = sourceRelative
    ? path.basename(sourceRelative, path.extname(sourceRelative)).toLowerCase()
    : '';

  return (
    requestedSet.has(componentName.toLowerCase()) ||
    (sourceRelative && requestedSet.has(sourceRelative.toLowerCase())) ||
    (stem && requestedSet.has(stem))
  );
}

function toMarkdown(result) {
  const componentBlocks = result.componentResults
    .map((component) => {
      const rows = component.tests
        .map((test) => {
          const reasonText = test.reasons.length > 0 ? test.reasons.join('; ') : '-';
          return `| ${test.testId} | ${test.status} | ${reasonText} |`;
        })
        .join('\n');

      return `### ${component.component}

- source: ${component.source}
- status: ${component.status}

| testId | status | reasons |
| --- | --- | --- |
${rows}
`;
    })
    .join('\n');

  const failureReasons =
    result.failureReasons.length > 0
      ? result.failureReasons.map((reason) => `- ${reason}`).join('\n')
      : '- None';

  return `# Susan QA Execution Result

## Run Metadata

- runId: ${result.runId}
- startedAt: ${result.startedAt}
- endedAt: ${result.endedAt}
- overallStatus: ${result.overallStatus}

## Totals

- components: ${result.totals.components}
- tests: ${result.totals.tests}
- passed: ${result.totals.passed}
- failed: ${result.totals.failed}

## Per Component

${componentBlocks}

## Failure Reasons

${failureReasons}
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '../../..');

  console.log('[Susan] Starting QA execution run.');

  const requestedComponents = args.components
    ? args.components
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const requestedSet = new Set(requestedComponents);

  const expectedJiraIssues = args['jira-issues']
    ? args['jira-issues']
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const planFileArg = args['plan-file'] ? path.resolve(repoRoot, args['plan-file']) : '';
  const componentSourceArg = String(args['component-source'] || '').trim();
  const componentNameArg = String(args['component-name'] || '').trim();

  const bobDir = path.resolve(
    repoRoot,
    args['bob-dir'] || 'component-poc/qa-agent/agents/bob/generated-tests'
  );
  const ticketPrefixes = args['ticket-prefixes']
    ? args['ticket-prefixes']
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const resultsDir = path.resolve(
    repoRoot,
    args['results-dir'] || 'component-poc/qa-agent/agents/susan/results'
  );

  ensureDir(resultsDir);

  if (planFileArg) {
    console.log(`[Susan] Reading explicit plan file: ${planFileArg}`);
  } else {
    console.log(`[Susan] Reading Bob plans from: ${bobDir}`);
  }

  const started = new Date();
  const startedAt = started.toISOString();
  const runId = args['run-id'] || `susan-${tsCompact(started)}`;

  const planFiles = planFileArg ? [planFileArg] : listBobPlans(bobDir, ticketPrefixes);

  console.log(`[Susan] Found ${planFiles.length} plan file(s) to evaluate before scope filtering.`);

  const componentResults = [];
  const allFailureReasons = new Set();
  let testCount = 0;
  let passed = 0;
  let failed = 0;

  for (const planPath of planFiles) {
    if (!fs.existsSync(planPath)) {
      continue;
    }
    const planText = fs.readFileSync(planPath, 'utf8');
    const parsed = parsePlan(planText);
    const componentName = componentNameArg || deriveComponentName(planPath);
    if (componentSourceArg) {
      parsed.sourcePath = componentSourceArg;
    }

    if (!shouldRunForComponent(requestedSet, componentName, parsed.sourcePath)) {
      continue;
    }

    console.log(
      `[Susan] Running tests for ${componentName} (${parsed.sourcePath || 'unknown source'}).`
    );

    const sourceRelative = parsed.sourcePath;
    const sourceAbsolute = sourceRelative ? path.resolve(repoRoot, sourceRelative) : '';
    const sourceExists = sourceAbsolute && fs.existsSync(sourceAbsolute);
    const sourceText = sourceExists ? fs.readFileSync(sourceAbsolute, 'utf8') : '';

    const sourceShapeValid = sourceExists ? isComponentSourceLikelyValid(sourceText) : false;
    const sourceRuntimeProfile = analyzeRuntimeProfile(sourceText);
    const hasSadSourceSignals =
      sourceRuntimeProfile.hasErrorFallback || sourceRuntimeProfile.hasLoadingUi;

    const context = {
      sourceExists,
      sourceShapeValid,
      hasHappyAndSad: parsed.hasHappySection && parsed.hasSadSection,
      hasDataConsistency: parsed.dataCheckCount >= 3,
      hasA11y: parsed.hasA11ySection,
      hasSadSourceSignals,
      hasRuntimeProfile: parsed.hasRuntimeProfile,
      planRuntimeSignals: parsed.runtimeSignals,
      runtimeAssertionIds: parsed.runtimeAssertionIds,
      sourceRuntimeProfile,
      expectedJiraIssues,
      planJiraIssues: parsed.jiraIssueKeys,
      hasAssumedCriteria: parsed.hasAssumedCriteria,
      planFormat: parsed.planFormat,
    };

    const testIds = parsed.testIds.length > 0 ? parsed.testIds : ['UNSPECIFIED-TEST-ID'];
    const testResults = testIds.map((testId) => runChecksForTest(testId, context));

    for (const tr of testResults) {
      testCount += 1;
      if (tr.status === 'pass') {
        passed += 1;
      } else {
        failed += 1;
        for (const reason of tr.reasons) {
          allFailureReasons.add(
            `${componentName} (${sourceRelative || 'unknown'}): ${reason}`
          );
        }
      }
    }

    componentResults.push({
      component: componentName,
      source: sourceRelative || 'unknown',
      status: testResults.every((t) => t.status === 'pass') ? 'pass' : 'fail',
      tests: testResults,
    });
  }

  const endedAt = new Date().toISOString();
  const overallStatus = failed === 0 ? 'pass' : 'fail';

  const result = {
    runId,
    agentId: 'susan',
    startedAt,
    endedAt,
    overallStatus,
    totals: {
      components: componentResults.length,
      tests: testCount,
      passed,
      failed,
    },
    componentResults,
    failureReasons: Array.from(allFailureReasons).sort(),
  };

  const stamp = tsCompact(started);
  const jsonPath = path.join(resultsDir, `susan-result-${stamp}.json`);
  const mdPath = path.join(resultsDir, `susan-result-${stamp}.md`);
  const latestPath = path.join(resultsDir, 'latest.json');

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(result), 'utf8');
  fs.writeFileSync(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log('[Susan] Execution complete.');
  console.log(`[Susan] Bob plans directory: ${bobDir}`);
  console.log(`[Susan] Components checked: ${result.totals.components}`);
  console.log(`[Susan] Tests executed: ${result.totals.tests}`);
  console.log(`[Susan] Passed: ${result.totals.passed}, Failed: ${result.totals.failed}`);
  console.log(`[Susan] Overall: ${result.overallStatus}`);
  console.log(`[Susan] JSON result: ${jsonPath}`);
  console.log(`[Susan] Markdown result: ${mdPath}`);
  if (result.failureReasons.length > 0) {
    console.log('[Susan] Failure reasons:');
    for (const reason of result.failureReasons) {
      console.log(`[Susan] - ${reason}`);
    }
  }
}

main();
