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

    // Support both `--key value` and `--key=value`; the latter was previously
    // parsed as part of the key and silently ignored.
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

/**
 * Adapters describe the repository under test. Pablo only needs the source root
 * from it; the e2e fields are read by run-e2e.js, which receives --adapter.
 */
function loadAdapterConfig(repoRoot, adapterId) {
  if (!adapterId || adapterId === 'true') {
    return {};
  }
  const adapterFile = path.resolve(repoRoot, 'adapters', adapterId, 'adapter.json');
  if (!fs.existsSync(adapterFile)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(adapterFile, 'utf8'));
  } catch (error) {
    console.warn(`[Pablo] Ignoring unreadable adapter ${adapterId}: ${error.message}`);
    return {};
  }
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

function extractSourceFromPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    return '';
  }

  const text = fs.readFileSync(planPath, 'utf8');
  const match = text.match(/^- Source component:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

function normalizeMatchToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getQaPlanStem(planPath) {
  const base = path.basename(planPath, '.qa.md');
  const parts = base.split('__');
  if (parts.length < 2) {
    return '';
  }
  return parts.slice(1).join('__').trim();
}

function findComponentForQaPlan(components, qaPlanPath) {
  const stem = getQaPlanStem(qaPlanPath);
  if (!stem) {
    return null;
  }

  const normalizedStem = normalizeMatchToken(stem);
  return (
    components.find((component) => normalizeMatchToken(component.stem) === normalizedStem) ||
    components.find((component) => normalizeMatchToken(component.componentName) === normalizedStem) ||
    null
  );
}

function inferComponentsFromJiraText(components, jiraText) {
  const normalizedText = normalizeMatchToken(jiraText);
  if (!normalizedText) {
    return [];
  }

  return components.filter((component) => {
    const candidates = [
      component.componentName,
      path.basename(component.relativePath, path.extname(component.relativePath)),
      component.stem,
    ]
      .map(normalizeMatchToken)
      .filter(Boolean);

    return candidates.some((candidate) => normalizedText.includes(candidate));
  });
}

function isStorybookTarget(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalizedPath);
  return (
    normalizedPath.includes('/.storybook/') ||
    /\.stories\.(tsx|ts|jsx|js)$/.test(base) ||
    base === 'mock-store.ts'
  );
}

function discoverStorybookTargets(repoRoot, targetRoot) {
  const absoluteRoot = path.resolve(repoRoot, targetRoot);
  const allFiles = walkFiles(absoluteRoot);
  const targets = [];

  for (const filePath of allFiles) {
    if (!isStorybookTarget(filePath)) {
      continue;
    }

    const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    targets.push({
      relativePath,
      absolutePath: filePath,
      componentName: deriveComponentName(filePath, content),
      stem: path.basename(filePath, path.extname(filePath)),
      mtimeMs: fs.statSync(filePath).mtimeMs,
    });
  }

  targets.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return targets;
}

function inferTicketTargetEntries({ components, storybookTargets, jiraContext }) {
  const jiraText = [
    ...(jiraContext?.issues || []).map((issue) => `${issue.key || ''} ${issue.summary || ''}`),
    jiraContext?.text || '',
  ]
    .filter(Boolean)
    .join('\n');

  const normalizedText = normalizeMatchToken(jiraText);
  if (!normalizedText) {
    return [];
  }

  if (normalizedText.includes('storybook')) {
    return { targets: storybookTargets, isStorybook: true };
  }

  const matched = inferComponentsFromJiraText(components, jiraText);
  return { targets: matched, isStorybook: false };
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
    Authorization: `Bearer ${apiToken}`,
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
        `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${encodeURIComponent(
          issueKey
        )}?fields=summary,description,updated`,
        headers
      );
      const summary = issue?.fields?.summary || '';
      const description = toAdfText(issue?.fields?.description || '').trim();
      const updatedAt = issue?.fields?.updated || null;

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
        updatedAt,
        hasAcceptanceCriteria: Boolean(acceptanceCriteriaText || description),
      });
    } catch (error) {
      warnings.push(`Failed to fetch Jira issue ${issueKey}: ${error.message}`);
      issues.push({
        key: issueKey,
        summary: '',
        updatedAt: null,
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

function isLikelyComponent(filePath, content, includeStorybook = false) {
  if (!/\.(tsx|jsx)$/i.test(filePath)) {
    return false;
  }

  if (!includeStorybook && /\.(test|spec|stories)\.(tsx|jsx)$/i.test(filePath)) {
    return false;
  }

  if (includeStorybook && /\.(test|spec)\.(tsx|jsx)$/i.test(filePath)) {
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

function discoverComponents(repoRoot, targetRoot, includeStorybook = false) {
  const absoluteRoot = path.resolve(repoRoot, targetRoot);
  const allFiles = walkFiles(absoluteRoot);
  const components = [];

  for (const filePath of allFiles) {
    if (!/\.(tsx|jsx)$/i.test(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (!isLikelyComponent(filePath, content, includeStorybook)) {
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

function e2eSection(report) {
  const e2e = report.e2e || { status: 'skipped' };
  if (e2e.status === 'skipped') {
    return '_E2E was skipped for this run._';
  }
  if (e2e.status === 'blocked') {
    return `**BLOCKED** — the suite did not run.\n\n\`\`\`\n${e2e.blockedReason || 'No reason recorded.'}\n\`\`\``;
  }

  const lines = [];
  lines.push(`- status: **${e2e.status}**`);
  lines.push(`- command: \`${e2e.commandRun || ''}\``);
  lines.push(
    `- totals: ${e2e.passed}/${e2e.total} passed, ${e2e.failed} failed, ${e2e.flaky} flaky, ${e2e.skipped} skipped`
  );
  lines.push('');
  lines.push('| Test | Browser | Status |');
  lines.push('|---|---|---|');
  for (const spec of e2e.specs || []) {
    lines.push(`| ${spec.title} | ${spec.project} | ${spec.status} |`);
  }
  lines.push('');

  const notPassing = (e2e.specs || []).filter((s) => s.status !== 'passed');
  lines.push('### Why tests did not pass');
  lines.push('');
  if (notPassing.length === 0) {
    lines.push('All tests passed on the first attempt.');
  } else {
    for (const spec of notPassing) {
      lines.push(`#### ${spec.title} — ${spec.project} (${spec.status})`);
      lines.push('');
      lines.push('```');
      lines.push(spec.errorMessage || '(no error detail reported)');
      lines.push('```');
      if (spec.tracePath) lines.push(`- Trace: \`${spec.tracePath}\``);
      lines.push('');
    }
  }
  return lines.join('\n');
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

## E2E Results (real Playwright suite)

${e2eSection(report)}

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

  const adapterConfig = loadAdapterConfig(repoRoot, args.adapter);
  const targetRoot =
    args.root || adapterConfig.defaultSourceRoot || 'sp-monitor-dashboard/frontend/src';
  const qaTestsRoot = String(args['qa-tests-root'] || '').trim();
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

  let qaTestPlanPath = '';
  let qaMappedComponent = null;

  if (qaTestsRoot && jiraIssueKeys.length === 1) {
    const preferredPlan = path.resolve(qaTestsRoot, `${jiraIssueKeys[0].toUpperCase()}__sales-by-week.qa.md`);
    if (fs.existsSync(preferredPlan)) {
      qaTestPlanPath = preferredPlan;
      console.log(`[Pablo] Using existing QA test plan for ${jiraIssueKeys[0]} from ${preferredPlan}.`);
    }
  }

  const components = discoverComponents(repoRoot, targetRoot);
  const storybookTargets = discoverStorybookTargets(repoRoot, targetRoot);
  const changedFiles = getChangedFiles(repoRoot);
  let selected = selectTargetComponents(mode, components, explicitComponents, changedFiles);
  let storybookMode = false;

  if (qaTestPlanPath) {
    const mappedComponent = findComponentForQaPlan(components, qaTestPlanPath);
    if (mappedComponent) {
      qaMappedComponent = mappedComponent;
      selected = [mappedComponent];
      storybookMode = false;
      console.log(
        `[Pablo] QA-Tests plan mapped ${jiraIssueKeys[0]} to ${mappedComponent.relativePath}.`
      );
    } else {
      console.log(
        `[Pablo] Warning: could not map QA-Tests plan to a component for ${jiraIssueKeys[0]}; falling back to Jira inference.`
      );
      qaTestPlanPath = '';
    }
  }

  if (!qaTestPlanPath && jiraIssueKeys.length === 1 && jiraContext.text) {
    const inferredTargets = inferTicketTargetEntries({
      components,
      storybookTargets,
      jiraContext,
    });
    if (inferredTargets.targets.length > 0) {
      selected = inferredTargets.targets;
      storybookMode = inferredTargets.isStorybook;
      console.log(`[Pablo] Inferred ${selected.length} target file(s) from Jira text for ${jiraIssueKeys[0]}.`);
    }
  }

  const bobMemory = readJson(bobMemoryPath, { components: {} });
  const bobMemoryComponents = bobMemory && bobMemory.components ? bobMemory.components : {};
  const scopedSelected = selected;

  console.log(
    `[Pablo] Component discovery complete: ${components.length} found, ${scopedSelected.length} selected for this run.`
  );

  const toRegenerate = [];
  const reused = [];
  const jiraIssueUpdatedAtByKey = Object.fromEntries(
    ((jiraContext && jiraContext.issues) || [])
      .filter((issue) => issue && issue.key)
      .map((issue) => [issue.key, issue.updatedAt || null])
  );
  const hasJiraScope = jiraIssueKeys.length > 0;

  for (const component of scopedSelected) {
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
    const scopedTicketKey =
      jiraIssueKeys.length === 1
        ? jiraIssueKeys[0]
        : memoryEntry && memoryEntry.jiraTicketKey
          ? memoryEntry.jiraTicketKey
          : null;
    const previousJiraUpdatedAt = memoryEntry ? memoryEntry.jiraStoryUpdatedAt : null;
    const currentJiraUpdatedAt = scopedTicketKey ? jiraIssueUpdatedAtByKey[scopedTicketKey] : null;
    const jiraStoryUpdated =
      Boolean(currentJiraUpdatedAt) &&
      (!previousJiraUpdatedAt ||
        new Date(currentJiraUpdatedAt).getTime() > new Date(previousJiraUpdatedAt).getTime());
    const jiraTicketMismatch =
      Boolean(
        hasJiraScope &&
          jiraIssueKeys.length === 1 &&
          memoryEntry &&
          memoryEntry.jiraTicketKey &&
          memoryEntry.jiraTicketKey !== jiraIssueKeys[0]
      );
    const jiraNeedsRegeneration =
      hasJiraScope &&
      (!memoryEntry ||
        jiraTicketMismatch ||
        jiraStoryUpdated ||
        (jiraIssueKeys.length === 1 && !currentJiraUpdatedAt));

    if (
      jiraNeedsRegeneration ||
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

  const useQaPlanExecution = Boolean(qaTestPlanPath && qaMappedComponent);
  const skipBob = String(args['skip-bob'] || 'false').toLowerCase() === 'true' || useQaPlanExecution;

  let bobStdout = '';
  if (!skipBob && toRegenerate.length > 0) {
    console.log(`[Pablo] Invoking Bob for ${toRegenerate.length} component(s) to regenerate plans.`);
    const bobArgs = ['--components', toRegenerate.join(',')];
    if (jiraProject) {
      bobArgs.push('--jira-project', jiraProject);
    }
    if (jiraIssueKeys.length > 0) {
      bobArgs.push('--jira-issues', jiraIssueKeys.join(','));
    }
    if (jiraBaseUrl) {
      bobArgs.push('--jira-base-url', jiraBaseUrl);
    }
    if (jiraApiToken) {
      bobArgs.push('--jira-api-token', jiraApiToken);
    }
    if (jiraAcFilePath) {
      bobArgs.push('--ac-file', jiraAcFilePath);
    }
    if (args.root) {
      bobArgs.push('--root', args.root);
    }
    if (storybookMode) {
      bobArgs.push('--include-storybook', 'true');
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
    console.log(skipBob ? '[Pablo] Bob step skipped by request.' : '[Pablo] Bob step skipped; all selected plans are current.');
  }

  let susanStdout = '';
  let susanResult = {
    overallStatus: 'pass',
    totals: { components: 0, tests: 0, passed: 0, failed: 0 },
    failureReasons: [],
  };

  let susanComponents = scopedSelected.map((c) => c.relativePath);

  if (susanComponents.length > 0) {
    console.log(`[Pablo] Invoking Susan for ${susanComponents.length} selected component(s).`);
    const susanArgs = ['--components', susanComponents.join(','), '--run-id', `susan-for-${runId}`];
    if (useQaPlanExecution) {
      susanArgs.push('--plan-file', qaTestPlanPath);
      susanArgs.push('--component-source', qaMappedComponent.relativePath);
      susanArgs.push('--component-name', qaMappedComponent.componentName);
    }
    if (jiraIssueKeys.length > 0) {
      susanArgs.push('--ticket-prefixes', jiraIssueKeys.join(','));
    }
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

  const e2eScript = path.resolve(repoRoot, 'component-poc/qa-agent/scripts/run-e2e.js');
  const e2eLatestPath = path.resolve(
    repoRoot,
    'component-poc/qa-agent/agents/e2e/results/latest.json'
  );

  let e2eResult = null;
  const skipE2e = args['skip-e2e'] === 'true';

  if (skipE2e) {
    console.log('[Pablo] Skipping E2E (--skip-e2e).');
  } else if (!fs.existsSync(e2eScript)) {
    console.log('[Pablo] E2E runner not found; skipping.');
  } else {
    console.log('[Pablo] Invoking E2E (real Playwright suite).');
    const e2eArgs = ['--run-id', `e2e-for-${runId}`];
    if (args['e2e-root']) e2eArgs.push('--e2e-root', args['e2e-root']);
    if (args['e2e-command']) e2eArgs.push('--e2e-command', args['e2e-command']);
    if (args.browsers) e2eArgs.push('--browsers', args.browsers);
    if (args.adapter) e2eArgs.push('--adapter', args.adapter);
    if (args['e2e-grep']) e2eArgs.push('--grep', args['e2e-grep']);
    if (args.retries) e2eArgs.push('--retries', args.retries);

    try {
      const e2eStdout = runCommandNode(e2eScript, e2eArgs, repoRoot);
      if (e2eStdout && e2eStdout.trim()) {
        process.stdout.write(e2eStdout.endsWith('\n') ? e2eStdout : `${e2eStdout}\n`);
      }
    } catch (error) {
      console.log(`[Pablo] E2E runner error: ${error.message}`);
    }

    e2eResult = readJson(e2eLatestPath, null);
  }

  const e2eFailed = Boolean(e2eResult && e2eResult.status === 'fail');
  const overallStatus =
    susanResult.overallStatus === 'fail' || e2eFailed ? 'fail' : 'pass';
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
      componentResults: susanResult.componentResults || [],
    },
    jira: {
      project: jiraProject || '',
      issueKeys: jiraIssueKeys,
      source: jiraContext.source,
      warnings: jiraContext.warnings || [],
      issues: jiraContext.issues || [],
      acFilePath: jiraAcFilePath || '',
    },
    e2e: e2eResult
      ? {
          status: e2eResult.status,
          commandRun: e2eResult.commandRun || '',
          total: e2eResult.totals ? e2eResult.totals.total : 0,
          passed: e2eResult.totals ? e2eResult.totals.passed : 0,
          failed: e2eResult.totals ? e2eResult.totals.failed : 0,
          flaky: e2eResult.totals ? e2eResult.totals.flaky : 0,
          skipped: e2eResult.totals ? e2eResult.totals.skipped : 0,
          blockedReason: e2eResult.blockedReason || '',
          specs: e2eResult.specs || [],
        }
      : { status: 'skipped', total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 },
    overallStatus,
    failureReasons: [
      ...(susanResult.failureReasons || []),
      ...(e2eResult && e2eResult.specs
        ? e2eResult.specs
            .filter((s) => s.status !== 'passed' && s.status !== 'skipped')
            .map(
              (s) =>
                `E2E ${s.status}: "${s.title}" [${s.project}] — ${
                  (s.errorMessage || '(no error detail reported)').split('\n')[0]
                }`
            )
        : []),
    ],
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
  console.log(`[Pablo] Target components: ${scopedSelected.length}`);
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
  if (report.e2e.status === 'skipped') {
    console.log('[Pablo] E2E: skipped');
  } else if (report.e2e.status === 'blocked') {
    console.log(`[Pablo] E2E: BLOCKED — ${report.e2e.blockedReason}`);
  } else {
    console.log(
      `[Pablo] E2E: ${report.e2e.status} — ${report.e2e.passed}/${report.e2e.total} passed, ${report.e2e.failed} failed, ${report.e2e.flaky} flaky, ${report.e2e.skipped} skipped`
    );
    for (const spec of report.e2e.specs || []) {
      const mark = spec.status === 'passed' ? 'PASS' : spec.status.toUpperCase();
      console.log(`[Pablo]   ${mark} — "${spec.title}" [${spec.project}]`);
    }
    const notPassing = (report.e2e.specs || []).filter((s) => s.status !== 'passed');
    if (notPassing.length > 0) {
      console.log('[Pablo]   Why they did not pass:');
      for (const spec of notPassing) {
        console.log(`[Pablo]   - "${spec.title}" [${spec.project}] (${spec.status})`);
        for (const line of (spec.errorMessage || '(no error detail reported)').split('\n')) {
          console.log(`[Pablo]       ${line}`);
        }
        if (spec.tracePath) console.log(`[Pablo]       trace: ${spec.tracePath}`);
      }
    }
  }
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
