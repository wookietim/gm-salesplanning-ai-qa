#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
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

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  function httpGetJson(urlString, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
              return;
            }

            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(new Error(`Failed to parse JSON response: ${error.message}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }

  async function fetchJiraIssueMeta(baseUrl, apiToken, ticketKey) {
    if (!baseUrl || !apiToken || !ticketKey) {
      return null;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${encodeURIComponent(ticketKey)}?fields=updated,issuetype`;
    const issue = await httpGetJson(url, {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    });

    return {
      ticketKey,
      updatedAt: issue?.fields?.updated || null,
      issueType: issue?.fields?.issuetype?.name || null,
    };
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`Warning: could not parse ${filePath}. Recreating state file.`);
    return fallback;
  }
}

function walkFiles(rootDir, output = []) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === 'coverage' ||
        entry.name === '.git'
      ) {
        continue;
      }
      walkFiles(fullPath, output);
      continue;
    }
    output.push(fullPath);
  }
  return output;
}

function isLikelyComponent(filePath, content) {
  if (!/\.(tsx|jsx)$/i.test(filePath)) {
    return false;
  }

  if (/\.(test|spec|stories)\.(tsx|jsx)$/i.test(filePath)) {
    return false;
  }

  const basename = path.basename(filePath, path.extname(filePath));

  const hasComponentExport =
    /export\s+default\s+function\s+[A-Z]/.test(content) ||
    /export\s+function\s+[A-Z]/.test(content) ||
    /export\s+const\s+[A-Z]/.test(content) ||
    /export\s+default\s+[A-Z]/.test(content);

  const hasJsx = /<[A-Za-z][\w:-]*/.test(content);

  if (hasComponentExport && hasJsx) {
    return true;
  }

  if (/^[A-Z]/.test(basename) && hasJsx) {
    return true;
  }

  return false;
}

function deriveComponentName(filePath, content) {
  const exportMatch = content.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/);
  if (exportMatch) {
    return exportMatch[1];
  }

  const namedMatch = content.match(/export\s+(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/);
  if (namedMatch) {
    return namedMatch[1];
  }

  return path.basename(filePath, path.extname(filePath));
}

function escapePipes(value) {
  return String(value).replace(/\|/g, '\\|');
}

function buildCriteriaList(rawCriteriaText, issueKeys) {
  const criteria = [];

  if (rawCriteriaText && rawCriteriaText.trim()) {
    for (const line of rawCriteriaText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        criteria.push(trimmed);
      }
    }
  }

  if (criteria.length === 0 && issueKeys.length > 0) {
    criteria.push(
      `Derive acceptance criteria from Jira issues: ${issueKeys.join(', ')}.`,
      'If criteria are ambiguous, record explicit assumptions before finalizing tests.'
    );
  }

  if (criteria.length === 0) {
    criteria.push(
      'No Jira criteria provided. Use component behavior and explicit assumptions to define acceptance criteria.',
      'Document assumptions and mark for Jira validation.'
    );
  }

  return criteria;
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

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function hasRuntimeContract(planPath) {
  if (!fs.existsSync(planPath)) {
    return false;
  }

  const planText = fs.readFileSync(planPath, 'utf8');
  return (
    /##\s+\d+\.\s+Runtime Execution Profile/i.test(planText) &&
    /- Runtime signal:\s*interaction-handlers=/i.test(planText) &&
    /- Runtime assertion:\s*[a-z0-9-]+/i.test(planText)
  );
}

function generateHumanReadablePlan(params) {
  const {
    componentName,
    sourcePath,
    jiraProject,
    jiraIssueKeys,
    criteria,
    generatedAt,
    runtimeProfile,
  } = params;

  const acRows = criteria
    .map((criterion, index) => {
      const acId = `AC-${index + 1}`;
      return `| ${acId} | ${escapePipes(criterion)} | BOB-HP-001, BOB-SP-001 |`;
    })
    .join('\n');

  const happyTestId = 'BOB-HP-001';
  const sadTestId = 'BOB-SP-001';

  const happyRuntimeAssertions = [
    '- Runtime assertion: interaction-path-covered',
    '- Runtime assertion: state-transition-observed',
  ];

  if (runtimeProfile.hasAsyncDataFlow || runtimeProfile.hasNetworkDependencies) {
    happyRuntimeAssertions.push('- Runtime assertion: async-success-observed');
  }

  const sadRuntimeAssertions = [
    '- Runtime assertion: sad-input-branch-covered',
    '- Runtime assertion: error-or-fallback-observed',
  ];

  if (runtimeProfile.hasLoadingUi) {
    sadRuntimeAssertions.push('- Runtime assertion: loading-to-terminal-state');
  }

  const interactionList =
    runtimeProfile.interactionHandlers.length > 0
      ? runtimeProfile.interactionHandlers.join(', ')
      : 'none';

  return `# Bob QA Test Plan - ${componentName}

- Generated at: ${generatedAt}
- Source component: ${sourcePath}

## 1. Component Overview

- Component: ${componentName}
- Purpose: Verify the component behavior, rendering, state transitions, and integration boundaries.
- Route or usage context: Determine from feature usage and parent container.

## 2. Acceptance Criteria Source

- Jira project: ${jiraProject || 'Not provided'}
- Jira issue keys: ${jiraIssueKeys.length > 0 ? jiraIssueKeys.join(', ') : 'Not provided'}
- Extracted criteria:
${criteria.map((c) => `  - ${c}`).join('\n')}

## 3. Runtime Execution Profile

- Runtime signal: interaction-handlers=${runtimeProfile.interactionHandlers.length}
- Runtime signal: async-data-flow=${yesNo(runtimeProfile.hasAsyncDataFlow)}
- Runtime signal: state-transitions=${yesNo(runtimeProfile.hasStateTransitions)}
- Runtime signal: loading-ui=${yesNo(runtimeProfile.hasLoadingUi)}
- Runtime signal: error-fallback=${yesNo(runtimeProfile.hasErrorFallback)}
- Runtime signal: network-dependencies=${yesNo(runtimeProfile.hasNetworkDependencies)}
- Runtime signal detail: interaction-handler-names=${interactionList}

## 4. Happy Path Tests

### Test ID: ${happyTestId}

- Title: ${componentName} renders and completes primary user flow successfully
- Priority: High
- Preconditions:
  - Component dependencies are available
  - Required API mocks or backend responses are configured
- Test data:
  - Valid representative payload for all required fields
- Runtime assertions:
${happyRuntimeAssertions.join('\n')}
- Steps:
1. Open the page or parent container where ${componentName} is rendered.
2. Provide valid input data and execute the primary interaction.
3. Verify rendered output, state updates, and success messaging.
- Expected result:
  - Component displays expected UI and state.
  - No console errors or failed network calls.
- Failure signals:
  - Missing expected content, broken interaction, incorrect state, or runtime error.

## 5. Sad Path Tests

### Test ID: ${sadTestId}

- Title: ${componentName} handles invalid or missing data and dependency failures
- Priority: High
- Preconditions:
  - Component dependencies can be mocked to return invalid, null, or error responses
- Test data:
  - Missing required fields, inconsistent values, and failed API responses
- Runtime assertions:
${sadRuntimeAssertions.join('\n')}
- Steps:
1. Render ${componentName} with incomplete or invalid input data.
2. Trigger dependent interactions that rely on external state or APIs.
3. Validate visible error handling, fallback UI, and recovery behavior.
- Expected result:
  - Component shows clear error or empty-state behavior.
  - No silent failure, crash, or misleading success state.
- Failure signals:
  - Unhandled exception, contradictory UI values, or inaccessible error messaging.

## 6. Data Self-Consistency Checks

- Check 1: Values shown in labels, totals, and derived fields are mathematically and logically consistent.
- Check 2: Displayed identifiers, names, and linked entities match the same source record.
- Check 3: Aggregates equal the sum of visible breakdown rows where applicable.
- Check 4: Time range, units, and precision are consistent across all displayed metrics.

## 7. Accessibility Checks

- Keyboard-only navigation reaches all interactive controls in logical order.
- Focus is visible and does not move to hidden or disabled elements.
- Screen-reader labels and landmarks are present and meaningful.
- Error and status messages are announced and not color-only.

## 8. Traceability Matrix

| Criterion ID | Criterion | Covered by Tests |
| --- | --- | --- |
${acRows}

## 9. Risks, Assumptions, Out of Scope

- Risks:
  - Jira criteria can be incomplete without direct issue content.
  - Shared component behavior may be influenced by parent context not covered in isolation.
- Assumptions:
  - This plan covers component-level validation; route-level workflows are validated separately.
  - Test environments provide stable mock data and deterministic responses.
- Out of scope:
  - Full end-to-end authentication flows unless explicitly requested.
`;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../../..');
  const args = parseArgs(process.argv.slice(2));

  console.log('[Bob] Starting test generation run.');

  const requestedComponents = args.components
    ? args.components
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const requestedSet = new Set(requestedComponents);

  const targetRoot = path.resolve(repoRoot, args.root || 'sp-monitor-dashboard/frontend/src');
  const outputDir = path.resolve(
    repoRoot,
    args.output || 'component-poc/qa-agent/agents/bob/generated-tests'
  );
  const statePath = path.resolve(outputDir, args.state || '.bob-memory.json');

  console.log(`[Bob] Scanning components under: ${targetRoot}`);

  const jiraProject = args['jira-project'] || '';
  const jiraTicket = (args['jira-ticket'] || '').trim().toUpperCase();
  const jiraIssueKeys = args['jira-issues']
    ? args['jira-issues']
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean)
    : [];

  // Determine the ticket prefix for output filenames.
  // Prefer --jira-ticket; fall back to the first --jira-issues key.
  const ticketPrefix = jiraTicket || (jiraIssueKeys[0] ? jiraIssueKeys[0].toUpperCase() : '');
  const jiraBaseUrl = args['jira-base-url'] || process.env.JIRA_BASE_URL || '';
  const jiraApiToken = args['jira-api-token'] || process.env.JIRA_API_TOKEN || '';
  let jiraIssueMeta = null;
  if (ticketPrefix && jiraBaseUrl && jiraApiToken) {
    try {
      jiraIssueMeta = await fetchJiraIssueMeta(jiraBaseUrl, jiraApiToken, ticketPrefix);
      if (jiraIssueMeta?.updatedAt) {
        console.log(`[Bob] Jira story timestamp: ${jiraIssueMeta.updatedAt}`);
      }
    } catch (error) {
      console.warn(
        `[Bob] Warning: could not fetch Jira story metadata for ${ticketPrefix}: ${error.message}`
      );
    }
  }

  let acceptanceCriteriaText = '';
  if (args['ac-file']) {
    const acFilePath = path.resolve(repoRoot, args['ac-file']);
    if (fs.existsSync(acFilePath)) {
      acceptanceCriteriaText = fs.readFileSync(acFilePath, 'utf8');
    } else {
      console.warn(`Warning: acceptance criteria file not found: ${acFilePath}`);
    }
  }

  const overwrite = String(args.overwrite || 'false').toLowerCase() === 'true';

  if (!fs.existsSync(targetRoot)) {
    console.error(`[Bob] Target root does not exist: ${targetRoot}`);
    process.exit(1);
  }

  ensureDir(outputDir);

  const state = readJson(statePath, {
    version: '1.0.0',
    generatedAt: null,
    targetRoot,
    components: {},
  });

  const now = new Date().toISOString();
  const allFiles = walkFiles(targetRoot);
  const componentFiles = [];

  for (const filePath of allFiles) {
    if (!/\.(tsx|jsx)$/i.test(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (!isLikelyComponent(filePath, content)) {
      continue;
    }

    componentFiles.push({ filePath, content });
  }

  componentFiles.sort((a, b) => a.filePath.localeCompare(b.filePath));

  const targetEntries =
    requestedSet.size === 0
      ? componentFiles
      : componentFiles.filter((entry) => {
          const relativeSource = path.relative(repoRoot, entry.filePath).replace(/\\/g, '/');
          const componentName = deriveComponentName(entry.filePath, entry.content);
          const fileStem = path.basename(relativeSource, path.extname(relativeSource));

          return (
            requestedSet.has(relativeSource.toLowerCase()) ||
            requestedSet.has(componentName.toLowerCase()) ||
            requestedSet.has(fileStem.toLowerCase())
          );
        });

  console.log(
    `[Bob] Discovered ${componentFiles.length} component candidates; targeting ${targetEntries.length} component(s).`
  );

  const criteria = buildCriteriaList(acceptanceCriteriaText, jiraIssueKeys);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const seen = new Set();
  const indexRows = [];

  for (const entry of targetEntries) {
    const absoluteFilePath = entry.filePath;
    const relativeSource = path.relative(repoRoot, absoluteFilePath).replace(/\\/g, '/');
    seen.add(relativeSource);

    const componentName = deriveComponentName(absoluteFilePath, entry.content);
    const runtimeProfile = analyzeRuntimeProfile(entry.content);
    const sourceStat = fs.statSync(absoluteFilePath);
    const sourceMtimeMs = sourceStat.mtimeMs;

    const baseName = `${relativeSource.replace(/[\\/]/g, '__').replace(/\.(tsx|jsx)$/i, '')}.qa.md`;
    const defaultOutputFileName = ticketPrefix ? `${ticketPrefix}__${baseName}` : baseName;
    let outputFileName = defaultOutputFileName;
    let outputFilePath = path.join(outputDir, outputFileName);

    const previous = state.components[relativeSource];
    const previousJiraUpdatedAt =
      previous && previous.jiraTicketKey === ticketPrefix ? previous.jiraStoryUpdatedAt : null;
    const currentJiraUpdatedAt = jiraIssueMeta ? jiraIssueMeta.updatedAt : null;
    const jiraStoryUpdated =
      Boolean(previousJiraUpdatedAt && currentJiraUpdatedAt) &&
      new Date(currentJiraUpdatedAt).getTime() > new Date(previousJiraUpdatedAt).getTime();

    if (jiraStoryUpdated && ticketPrefix) {
      const regenStamp = tsCompact(new Date());
      outputFileName = `${ticketPrefix}__regen-${regenStamp}__${baseName}`;
      outputFilePath = path.join(outputDir, outputFileName);
      console.log(
        `[Bob] Jira story ${ticketPrefix} changed since last generation. Creating new plan file for ${componentName}.`
      );
    }

    const runtimeContractPresent = hasRuntimeContract(outputFilePath);
    const alreadyUpToDate =
      previous &&
      previous.sourceMtimeMs === sourceMtimeMs &&
      previous.outputFile === path.relative(repoRoot, outputFilePath).replace(/\\/g, '/') &&
      fs.existsSync(outputFilePath) &&
      !jiraStoryUpdated &&
      runtimeContractPresent;

    if (alreadyUpToDate && !overwrite) {
      skipped += 1;
      console.log(`[Bob] Reusing existing QA plan for ${componentName}.`);
      indexRows.push(`- ${componentName}: ${path.relative(repoRoot, outputFilePath).replace(/\\/g, '/')}`);
      continue;
    }

    const plan = generateHumanReadablePlan({
      componentName,
      sourcePath: relativeSource,
      jiraProject,
      jiraIssueKeys,
      criteria,
      generatedAt: now,
      runtimeProfile,
    });

    const existed = fs.existsSync(outputFilePath);
    fs.writeFileSync(outputFilePath, plan, 'utf8');

    console.log(
      `[Bob] ${existed ? 'Updated' : 'Created'} runtime-aware QA plan for ${componentName}.`
    );

    const outputRelative = path.relative(repoRoot, outputFilePath).replace(/\\/g, '/');
    state.components[relativeSource] = {
      componentName,
      outputFile: outputRelative,
      sourceMtimeMs,
      generatedAt: now,
      jiraTicketKey: ticketPrefix || null,
      jiraStoryUpdatedAt: currentJiraUpdatedAt || null,
      status: 'written',
    };

    if (existed) {
      updated += 1;
    } else {
      created += 1;
    }

    indexRows.push(`- ${componentName}: ${outputRelative}`);
  }

  if (requestedSet.size === 0) {
    for (const sourcePath of Object.keys(state.components)) {
      if (!seen.has(sourcePath)) {
        state.components[sourcePath].status = 'missing-source';
        state.components[sourcePath].updatedAt = now;
      }
    }
  }

  state.generatedAt = now;
  state.targetRoot = targetRoot;
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const indexPath = path.join(outputDir, 'INDEX.md');
  const indexBody = `# Bob Generated Component QA Plans

- Generated at: ${now}
- Target root: ${path.relative(repoRoot, targetRoot).replace(/\\/g, '/')}
- Total components discovered: ${componentFiles.length}
- Components targeted: ${targetEntries.length}
- Created: ${created}
- Updated: ${updated}
- Skipped (already current): ${skipped}

## Per-component QA files

${indexRows.join('\n')}
`;
  fs.writeFileSync(indexPath, indexBody, 'utf8');

  console.log('[Bob] Generation complete.');
  console.log(`[Bob] Target root: ${targetRoot}`);
  console.log(`[Bob] Output dir: ${outputDir}`);
  console.log(`[Bob] Components discovered: ${componentFiles.length}`);
  console.log(`[Bob] Components targeted: ${targetEntries.length}`);
  console.log(`[Bob] Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`[Bob] State file: ${statePath}`);
  console.log(`[Bob] Index: ${indexPath}`);
}

main().catch((error) => {
  console.error(`[Bob] Fatal error: ${error.message}`);
  process.exit(1);
});
