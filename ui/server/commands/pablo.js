const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PABLO_SCRIPT = path.join(REPO_ROOT, 'component-poc/qa-agent/scripts/run-pablo.js');
const FRONTEND_ROOT = '/Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend/src';

function extractResultPath(output) {
  const match = output.match(/\[Pablo\] JSON result:\s+(.+)/);
  return match ? match[1].trim() : path.join(REPO_ROOT, 'component-poc/qa-agent/agents/pablo/results/latest.json');
}

function buildArgs(ticketKeys, env) {
  const args = [
    PABLO_SCRIPT,
    '--jira-issues',
    ticketKeys.join(','),
    '--jira-base-url',
    env.JIRA_BASE_URL || '',
    '--jira-api-token',
    env.JIRA_API_TOKEN || '',
    '--root',
    FRONTEND_ROOT,
    '--mode',
    'full',
  ];

  if (env.JIRA_USER_EMAIL) {
    args.push('--jira-user-email', env.JIRA_USER_EMAIL);
  }

  return args;
}

function runPabloStream({ ticketKeys, env, onLine, onDone, onError }) {
  if (!ticketKeys.length) {
    onError(new Error('No ticket keys were provided.'));
    return null;
  }

  if (!fs.existsSync(PABLO_SCRIPT)) {
    onError(new Error(`Pablo script not found at ${PABLO_SCRIPT}`));
    return null;
  }

  const child = spawn(process.execPath, buildArgs(ticketKeys, env), {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ...env,
    },
  });

  let combinedOutput = '';

  const pipeStream = (stream, prefix = '') => {
    const rl = readline.createInterface({ input: stream });
    rl.on('line', (line) => {
      const formatted = prefix ? `${prefix}${line}` : line;
      combinedOutput += `${formatted}\n`;
      onLine(formatted);
    });
  };

  pipeStream(child.stdout);
  pipeStream(child.stderr, '[stderr] ');

  child.on('error', (error) => onError(error));
  child.on('close', (code) => {
    if (code === 0) {
      const resultPath = extractResultPath(combinedOutput);
      onDone({ code, resultPath, output: combinedOutput });
      return;
    }

    onError(new Error(`Pablo exited with code ${code}`));
  });

  return child;
}

module.exports = {
  runPabloStream,
};
