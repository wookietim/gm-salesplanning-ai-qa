#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const scriptDir = __dirname;
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const qaAgentRoot = path.resolve(scriptDir, '..');

const guidePath = path.join(qaAgentRoot, 'AGENTS_GUIDE.md');
const rootReadmePath = path.join(repoRoot, 'README.md');
const qaReadmePath = path.join(qaAgentRoot, 'README.md');
const configPath = path.join(qaAgentRoot, 'configs', 'qa-agent.config.json');

const changedFromArg = process.argv.includes('--all')
    ? null
    : cp
          .execSync('git diff --cached --name-only', { cwd: repoRoot, encoding: 'utf8' })
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

const agentDefPattern =
    /^component-poc\/qa-agent\/agents\/[^/]+\/(AGENT\.md|prompt\.md|input\.schema\.json|output\.schema\.json)$/;
const configPattern = /^component-poc\/qa-agent\/configs\/qa-agent\.config\.json$/;

const shouldRun =
    changedFromArg === null ||
    changedFromArg.some((file) => agentDefPattern.test(file) || configPattern.test(file));

if (!shouldRun) {
    console.log('guide-sync: no agent definition changes detected, skipping.');
    process.exit(0);
}

const read = (p) => fs.readFileSync(p, 'utf8');
const writeIfChanged = (p, next) => {
    const prev = read(p);
    if (prev !== next) {
        fs.writeFileSync(p, next, 'utf8');
        return true;
    }
    return false;
};

const updatedFiles = [];
const mismatches = [];

const config = JSON.parse(read(configPath));
const enabledAgents = (config.agents || []).filter((a) => a.enabled).map((a) => a.id);

const displayName = {
    pablo: 'Pablo',
    'api-agent': 'API-Agent',
    bob: 'Bob',
    susan: 'Susan',
    smoke: 'Smoke',
    regression: 'Regression',
    accessibility: 'Accessibility',
    'api-contract': 'API Contract',
    'visual-diff': 'Visual Diff',
    'guide-sync': 'Guide-Sync',
    'unit-test-qa': 'Unit-Test-QA',
    'security-qa': 'Security-QA',
    'confluence-agent': 'Confluence-Agent',
    'confluence-writer': 'Confluence-Writer',
    'jira-agent': 'Jira-Agent',
};

let guide = read(guidePath);
const today = new Date().toISOString().slice(0, 10);
guide = guide.replace(/> \*\*Last updated:\*\* .*/g, `> **Last updated:** ${today}`);

for (const id of enabledAgents) {
    const name = displayName[id] || id;
    if (!guide.includes(`**${name}**`)) {
        mismatches.push(`AGENTS_GUIDE missing agent mention for enabled agent: ${id}`);
    }
}

if (writeIfChanged(guidePath, guide)) updatedFiles.push(path.relative(repoRoot, guidePath));

let rootReadme = read(rootReadmePath);
if (!rootReadme.includes('component-poc/qa-agent/AGENTS_GUIDE.md')) {
    rootReadme += '\n\n## QA Agent Documentation\n\n- [QA Agent System Guide](component-poc/qa-agent/AGENTS_GUIDE.md)\n';
}
if (writeIfChanged(rootReadmePath, rootReadme))
    updatedFiles.push(path.relative(repoRoot, rootReadmePath));

let qaReadme = read(qaReadmePath);
if (!qaReadme.includes('`AGENTS_GUIDE.md`') && !qaReadme.includes('(AGENTS_GUIDE.md)')) {
    qaReadme += '\n\n- Full guide: [`AGENTS_GUIDE.md`](AGENTS_GUIDE.md)\n';
}
if (writeIfChanged(qaReadmePath, qaReadme))
    updatedFiles.push(path.relative(repoRoot, qaReadmePath));

if (mismatches.length > 0) {
    console.error('guide-sync: mismatches found:');
    for (const m of mismatches) console.error(`- ${m}`);
    console.error('guide-sync: update AGENTS_GUIDE.md to match current enabled agents.');
    process.exit(1);
}

if (updatedFiles.length > 0) {
    console.log('guide-sync: updated files:');
    for (const f of updatedFiles) console.log(`- ${f}`);
} else {
    console.log('guide-sync: no documentation changes needed.');
}

process.exit(0);
