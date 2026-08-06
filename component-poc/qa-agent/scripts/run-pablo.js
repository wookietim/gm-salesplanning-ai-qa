#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync, execFileSync } = require('child_process');

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

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function hasRuntimeContract(planAbsolutePath) {
  if (!planAbsolutePath || !fs.existsSync(planAbsolutePath)) {
    return false;
  }

  const planText = fs.readFileSync(planAbsolutePath, 'utf8');
  return (
    /##\s+\d+\.\s+Runtime Execution Profile/i.test(planText) &&
    /- Runtime signal:\s*interaction-handlers=/i.test(planText) &&
    /- Runtime assertion:\s*[a-z0-9-]+/i.test(planText)
  );
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(values) {
  return Array.from(new Set(values));
}

function toAdfText(node) {
  if (!node) {
    return '';
  }
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => toAdfText(item)).join('\n');
  }

  const pieces = [];
  if (node.text) {
    pieces.push(String(node.text));
  }
  if (Array.isArray(node.content)) {
    pieces.push(node.content.map((item) => toAdfText(item)).join(''));
  }

  const combined = pieces.join('');
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
    return combined ? `${combined}\n` : '';
  }
  return combined;
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

async function fetchJiraAcceptanceCriteria(params) {
  const { baseUrl, userEmail, apiToken, issueKeys } = params;
  const issues = [];

  if (!baseUrl || !userEmail || !apiToken || issueKeys.length === 0) {
    return {
      enabled: false,
      source: 'none',
      text: '',
      issues,
      warnings: ['Jira credentials and issue keys are required for live Jira fetch.'],
    };
  }

  const auth = Buffer.from(`${userEmail}:${apiToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  };

  let acceptanceFieldIds = [];
  try {
    const fields = await httpGetJson(`${baseUrl.replace(/\/$/, '')}/rest/api/3/field`, headers);
    acceptanceFieldIds = fields
      .filter((field) => /acceptance\s*criteria/i.test(String(field.name || '')))
      .map((field) => field.id);
  } catch (error) {
    // Field lookup may fail due to permissions or Jira version; proceed with standard fields.
    acceptanceFieldIds = [];
  }

  const lines = [];
  const warnings = [];

  for (const issueKey of issueKeys) {
    try {
      const issue = await httpGetJson(
        `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${encodeURIComponent(
          issueKey
        )}?fields=summary,description`,
        headers
      );
      const summary = issue?.fields?.summary || '';
      const description = toAdfText(issue?.fields?.description || '').trim();

      const acCandidates = acceptanceFieldIds
        .map((fieldId) => issue?.fields?.[fieldId])
        .filter(Boolean)
        .map((value) => toAdfText(value).trim())
        .filter(Boolean);

      const acceptanceCriteriaText = acCandidates.join('\n\n').trim();

      lines.push(`Issue ${issueKey}: ${summary || 'No summary provided'}`);
      if (acceptanceCriteriaText) {
        lines.push('Acceptance Criteria:');
        lines.push(acceptanceCriteriaText);
      } else if (description) {
        lines.push('Acceptance Criteria (derived from description):');
        lines.push(description);
      } else {
        lines.push('Acceptance Criteria: Not found in Jira fields or description.');
      }
      lines.push('');

      issues.push({
        key: issueKey,
        summary,
        hasAcceptanceCriteria: Boolean(acceptanceCriteriaText || description),
      });
    } catch (error) {
      warnings.push(`Failed to fetch Jira issue ${issueKey}: ${error.message}`);
      issues.push({
        key: issueKey,
        summary: '',
        hasAcceptanceCriteria: false,
        error: error.message,
      });
    }
  }

  return {
    enabled: true,
    source: 'jira-api',
    text: lines.join('\n').trim(),
    issues,
    warnings,
  };
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

function discoverComponents(repoRoot, targetRoot) {
  const absoluteRoot = path.resolve(repoRoot, targetRoot);
  const allFiles = walkFiles(absoluteRoot);
  const components = [];

  for (const filePath of allFiles) {
    if (!/\.(tsx|jsx)$/i.test(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (!isLikelyComponent(filePath, content)) {
      continue;
    }

    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    const componentName = deriveComponentName(filePath, content);
    const mtimeMs = fs.statSync(filePath).mtimeMs;

    components.push({
      relativePath,
      absolutePath: filePath,
      componentName,
      stem: path.basename(filePath, path.extname(filePath)),
      mtimeMs,
    });
  }

  components.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return components;
}

function getChangedFiles(repoRoot) {
  try {
    const raw = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
    return raw
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const payload = line.slice(3).trim();
        if (payload.includes(' -> ')) {
          return payload.split(' -> ').pop().replace(/\\/g, '/');
        }
        return payload.replace(/\\/g, '/');
      });
  } catch (error) {
    return [];
  }
}

function matchByToken(component, token) {
  const lower = token.toLowerCase();
  return (
    component.relativePath.toLowerCase() === lower ||
    component.componentName.toLowerCase() === lower ||
    component.stem.toLowerCase() === lower
  );
}

function selectTargetComponents(mode, components, explicitTokens, changedFiles) {
  if (mode === 'full') {
    return components;
  }

  if (mode === 'components') {
    const set = new Set(explicitTokens.map((t) => t.toLowerCase()));
    return components.filter((component) => {
      for (const token of set) {
        if (matchByToken(component, token)) {
          return true;
        }
      }
      return false;
    });
  }

  const changedSet = new Set(changedFiles.map((file) => file.toLowerCase()));
  return components.filter((component) => changedSet.has(component.relativePath.toLowerCase()));
}

function runCommandNode(scriptPath, args, repoRoot) {
  return execFileSync('node', [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function toMarkdown(report) {
  const targets =
    report.targetComponents.length > 0
      ? report.targetComponents.map((item) => `- ${item}`).join('\n')
      : '- None';

  const regen =
    report.bob.regeneratedComponents.length > 0
      ? report.bob.regeneratedComponents.map((item) => `- ${item}`).join('\n')
      : '- None';

  const failures =
    report.failureReasons.length > 0
      ? report.failureReasons.map((item) => `- ${item}`).join('\n')
      : '- None';

  const jiraIssues =
    report.jira && report.jira.issueKeys && report.jira.issueKeys.length > 0
      ? report.jira.issueKeys.map((item) => `- ${item}`).join('\n')
      : '- None';

  const jiraWarnings =
    report.jira && report.jira.warnings && report.jira.warnings.length > 0
      ? report.jira.warnings.map((item) => `- ${item}`).join('\n')
      : '- None';

  return `# Pablo Orchestration Result

## Metadata

- runId: ${report.runId}
- startedAt: ${report.startedAt}
- endedAt: ${report.endedAt}
- mode: ${report.mode}
- overallStatus: ${report.overallStatus}

## Jira Context

- project: ${(report.jira && report.jira.project) || 'Not provided'}
- source: ${(report.jira && report.jira.source) || 'none'}

### Jira Issue Keys

${jiraIssues}

### Jira Warnings

${jiraWarnings}

## Target Components

${targets}

## Bob Actions

- checked: ${report.bob.checked}
- regenerated: ${report.bob.regenerated}
- reused: ${report.bob.reused}

### Regenerated Components

${regen}

## Susan Results

- overallStatus: ${report.susan.overallStatus}
- components: ${report.susan.components}
- tests: ${report.susan.tests}
- passed: ${report.susan.passed}
- failed: ${report.susan.failed}

## Failure Reasons

${failures}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '../../..');

  console.log('[Pablo] Starting orchestration run.');

  const mode = (args.mode || 'changed').toLowerCase();
  const explicitComponents = args.components
    ? args.components
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    : [];

  console.log(`[Pablo] Mode selected: ${mode}`);

  const jiraTicket = String(args['jira-ticket'] || '').trim();
  const jiraIssueKeys = dedupe([
    ...parseCsv(args['jira-issues']),
    ...(jiraTicket ? [jiraTicket] : []),
  ]);
  const inferredProject = jiraIssueKeys.length > 0 && jiraIssueKeys[0].includes('-')
    ? jiraIssueKeys[0].split('-')[0]
    : '';
  const jiraProject = String(args['jira-project'] || inferredProject || '').trim();

  const jiraBaseUrl = String(args['jira-base-url'] || process.env.JIRA_BASE_URL || '').trim();
  const jiraUserEmail = String(args['jira-user-email'] || process.env.JIRA_USER_EMAIL || '').trim();
  const jiraApiToken = String(args['jira-api-token'] || process.env.JIRA_API_TOKEN || '').trim();
  const jiraAcFileArg = String(args['jira-ac-file'] || '').trim();

  const targetRoot = args.root || 'sp-monitor-dashboard/frontend/src';
  const bobMemoryPath = path.resolve(
    repoRoot,
    args['bob-memory'] || 'component-poc/qa-agent/agents/bob/generated-tests/.bob-memory.json'
  );

  const bobScript = path.resolve(repoRoot, 'component-poc/qa-agent/scripts/run-bob.js');
  const susanScript = path.resolve(repoRoot, 'component-poc/qa-agent/scripts/run-susan.js');

  const pabloResultsDir = path.resolve(
    repoRoot,
    args['results-dir'] || 'component-poc/qa-agent/agents/pablo/results'
  );
  const susanLatestPath = path.resolve(
    repoRoot,
    'component-poc/qa-agent/agents/susan/results/latest.json'
  );

  ensureDir(pabloResultsDir);

  const started = new Date();
  const startedAt = started.toISOString();
  const runId = args['run-id'] || `pablo-${tsCompact(started)}`;

  console.log(`[Pablo] Run ID: ${runId}`);

  let jiraContext = {
    enabled: false,
    source: 'none',
    text: '',
    issues: [],
    warnings: [],
  };
  let jiraAcFilePath = '';

  if (jiraAcFileArg) {
    jiraAcFilePath = path.resolve(repoRoot, jiraAcFileArg);
    if (fs.existsSync(jiraAcFilePath)) {
      jiraContext = {
        enabled: true,
        source: 'file',
        text: fs.readFileSync(jiraAcFilePath, 'utf8').trim(),
        issues: jiraIssueKeys.map((key) => ({ key, summary: '', hasAcceptanceCriteria: true })),
        warnings: [],
      };
    } else {
      jiraContext.warnings.push(`Provided jira-ac-file not found: ${jiraAcFilePath}`);
    }
  } else if (jiraIssueKeys.length > 0) {
    jiraContext = await fetchJiraAcceptanceCriteria({
      baseUrl: jiraBaseUrl,
      userEmail: jiraUserEmail,
      apiToken: jiraApiToken,
      issueKeys: jiraIssueKeys,
    });

    if (jiraContext.text) {
      jiraAcFilePath = path.join(pabloResultsDir, `.pablo-jira-ac-${tsCompact(started)}.txt`);
      fs.writeFileSync(jiraAcFilePath, `${jiraContext.text}\n`, 'utf8');
    }
  }

  const components = discoverComponents(repoRoot, targetRoot);
  const changedFiles = getChangedFiles(repoRoot);
  const selected = selectTargetComponents(mode, components, explicitComponents, changedFiles);

  console.log(
    `[Pablo] Component discovery complete: ${components.length} found, ${selected.length} selected for this run.`
  );

  const bobMemory = readJson(bobMemoryPath, { components: {} });
  const bobMemoryComponents = bobMemory && bobMemory.components ? bobMemory.components : {};

  const toRegenerate = [];
  const reused = [];
  const shouldForceRegenerateForJira = jiraIssueKeys.length > 0;

  for (const component of selected) {
    const memoryEntry = bobMemoryComponents[component.relativePath];
    const outputAbsolutePath =
      memoryEntry && memoryEntry.outputFile
        ? path.resolve(repoRoot, memoryEntry.outputFile)
        : '';
    const hasOutput =
      memoryEntry &&
      memoryEntry.outputFile &&
      fs.existsSync(outputAbsolutePath);
    const hasRuntimePlanContract = hasRuntimeContract(outputAbsolutePath);

    if (
      shouldForceRegenerateForJira ||
      !memoryEntry ||
      !hasOutput ||
      !hasRuntimePlanContract ||
      memoryEntry.sourceMtimeMs !== component.mtimeMs
    ) {
      toRegenerate.push(component.relativePath);
    } else {
      reused.push(component.relativePath);
    }
  }

  let bobStdout = '';
  if (toRegenerate.length > 0) {
    console.log(`[Pablo] Invoking Bob for ${toRegenerate.length} component(s) to regenerate plans.`);
    const bobArgs = ['--components', toRegenerate.join(',')];
    if (shouldForceRegenerateForJira) {
      bobArgs.push('--overwrite', 'true');
    }
    if (jiraProject) {
      bobArgs.push('--jira-project', jiraProject);
    }
    if (jiraIssueKeys.length > 0) {
      bobArgs.push('--jira-issues', jiraIssueKeys.join(','));
    }
    if (jiraAcFilePath) {
      bobArgs.push('--ac-file', jiraAcFilePath, '--overwrite', 'true');
    }

    bobStdout = runCommandNode(
      bobScript,
      bobArgs,
      repoRoot
    );
    if (bobStdout && bobStdout.trim()) {
      console.log('[Pablo] Bob output start');
      process.stdout.write(bobStdout.endsWith('\n') ? bobStdout : `${bobStdout}\n`);
      console.log('[Pablo] Bob output end');
    }
  } else {
    console.log('[Pablo] Bob step skipped; all selected plans are current.');
  }

  let susanStdout = '';
  let susanResult = {
    overallStatus: 'pass',
    totals: { components: 0, tests: 0, passed: 0, failed: 0 },
    failureReasons: [],
  };

  if (selected.length > 0) {
    console.log(`[Pablo] Invoking Susan for ${selected.length} selected component(s).`);
    const susanArgs = ['--components', selected.map((c) => c.relativePath).join(','), '--run-id', `susan-for-${runId}`];
    if (jiraIssueKeys.length > 0) {
      susanArgs.push('--jira-issues', jiraIssueKeys.join(','));
    }

    susanStdout = runCommandNode(
      susanScript,
      susanArgs,
      repoRoot
    );
    if (susanStdout && susanStdout.trim()) {
      console.log('[Pablo] Susan output start');
      process.stdout.write(susanStdout.endsWith('\n') ? susanStdout : `${susanStdout}\n`);
      console.log('[Pablo] Susan output end');
    }

    const latestSusan = readJson(susanLatestPath, null);
    if (latestSusan) {
      susanResult = latestSusan;
    }
  }

  const overallStatus = susanResult.overallStatus === 'fail' ? 'fail' : 'pass';
  const endedAt = new Date().toISOString();

  const report = {
    runId,
    agentId: 'pablo',
    startedAt,
    endedAt,
    mode,
    targetComponents: selected.map((c) => c.relativePath),
    bob: {
      checked: selected.length,
      regenerated: toRegenerate.length,
      reused: reused.length,
      regeneratedComponents: toRegenerate,
      stdout: bobStdout,
    },
    susan: {
      overallStatus: susanResult.overallStatus,
      components: susanResult.totals ? susanResult.totals.components : 0,
      tests: susanResult.totals ? susanResult.totals.tests : 0,
      passed: susanResult.totals ? susanResult.totals.passed : 0,
      failed: susanResult.totals ? susanResult.totals.failed : 0,
      stdout: susanStdout,
    },
    jira: {
      project: jiraProject || '',
      issueKeys: jiraIssueKeys,
      source: jiraContext.source,
      warnings: jiraContext.warnings || [],
      issues: jiraContext.issues || [],
      acFilePath: jiraAcFilePath || '',
    },
    overallStatus,
    failureReasons: susanResult.failureReasons || [],
  };

  const stamp = tsCompact(started);
  const jsonPath = path.join(pabloResultsDir, `pablo-result-${stamp}.json`);
  const mdPath = path.join(pabloResultsDir, `pablo-result-${stamp}.md`);
  const latestPath = path.join(pabloResultsDir, 'latest.json');

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(report), 'utf8');
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[Pablo] Orchestration complete.');
  console.log(`[Pablo] Mode: ${mode}`);
  console.log(`[Pablo] Target components: ${selected.length}`);
  if (jiraIssueKeys.length > 0) {
    console.log(`[Pablo] Jira project: ${jiraProject || 'not provided'}`);
    console.log(`[Pablo] Jira issues: ${jiraIssueKeys.join(', ')}`);
    console.log(`[Pablo] Jira source: ${jiraContext.source}`);
    if (jiraContext.warnings && jiraContext.warnings.length > 0) {
      console.log('[Pablo] Jira warnings:');
      for (const warning of jiraContext.warnings) {
        console.log(`[Pablo] - ${warning}`);
      }
    }
  }
  console.log(`[Pablo] Bob regenerated: ${toRegenerate.length}, reused: ${reused.length}`);
  console.log(`[Pablo] Susan overall: ${report.susan.overallStatus}`);
  console.log(`[Pablo] Overall: ${overallStatus}`);
  console.log(`[Pablo] JSON result: ${jsonPath}`);
  console.log(`[Pablo] Markdown result: ${mdPath}`);
  if (report.failureReasons.length > 0) {
    console.log('[Pablo] Failure reasons:');
    for (const reason of report.failureReasons) {
      console.log(`[Pablo] - ${reason}`);
    }
  }
}

main().catch((error) => {
  console.error(`[Pablo] Run failed: ${error.message}`);
  process.exit(1);
});
