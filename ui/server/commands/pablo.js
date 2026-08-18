const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PABLO_SCRIPT = path.join(REPO_ROOT, 'component-poc/qa-agent/scripts/run-pablo.js');
const FRONTEND_ROOT = '/Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend/src';
const FALLBACK_FRONTEND_ROOT = path.resolve(REPO_ROOT, '../gm-salesplanning-frontend/src');
const QA_TESTS_ROOT = path.join(REPO_ROOT, 'QA-Tests');

function extractResultPath(output) {
  const match = output.match(/\[Pablo\] JSON result:\s+(.+)/);
  return match ? match[1].trim() : path.join(REPO_ROOT, 'component-poc/qa-agent/agents/pablo/results/latest.json');
}

function buildArgs(ticketKeys, env, { forceBobRegenerate = false, skipBob = false, mode = 'full' } = {}) {
  const args = [
    PABLO_SCRIPT,
    '--jira-issues',
    ticketKeys.join(','),
    '--jira-base-url',
    env.JIRA_BASE_URL || '',
    '--jira-api-token',
    env.JIRA_API_TOKEN || '',
    '--root',
    fs.existsSync(FRONTEND_ROOT) ? FRONTEND_ROOT : FALLBACK_FRONTEND_ROOT,
    '--mode',
    mode,
  ];

  if (env.JIRA_USER_EMAIL) {
    args.push('--jira-user-email', env.JIRA_USER_EMAIL);
  }

  if (forceBobRegenerate) {
    args.push('--overwrite', 'true');
  }

  if (skipBob) {
    args.push('--skip-bob', 'true');
  }

  if (ticketKeys.length) {
    args.push('--ticket-keys', ticketKeys.join(','));
  }

  if (fs.existsSync(QA_TESTS_ROOT)) {
    args.push('--qa-tests-root', QA_TESTS_ROOT);
  }

  return args;
}

function runPabloStream({
  ticketKeys,
  env,
  forceBobRegenerate = false,
  skipBob = false,
  mode = 'full',
  onLine,
  onDone,
  onError,
}) {
  if (!ticketKeys.length) {
    onError(new Error('No ticket keys were provided.'));
    return null;
  }

  if (!fs.existsSync(PABLO_SCRIPT)) {
    onError(new Error(`Pablo script not found at ${PABLO_SCRIPT}`));
    return null;
  }

  const child = spawn(
    process.execPath,
    buildArgs(ticketKeys, env, { forceBobRegenerate, skipBob, mode }),
    {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],  // close stdin so child never blocks waiting for input
    env: {
      ...process.env,
      ...env,
    },
    }
  );

  let combinedOutput = '';
  let stdoutBuffer = '';
  let stderrBuffer = '';

  function processBuffer(buf, prefix, onFlushLine) {
    const parts = buf.split('\n');
    for (let i = 0; i < parts.length - 1; i++) {
      const line = parts[i];
      if (line.trim()) {
        const formatted = prefix ? `${prefix}${line}` : line;
        combinedOutput += `${formatted}\n`;
        onFlushLine(formatted);
      }
    }
    return parts[parts.length - 1];
  }

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    stdoutBuffer = processBuffer(stdoutBuffer, '', onLine);
  });

  child.stdout.on('end', () => {
    if (stdoutBuffer.trim()) {
      combinedOutput += `${stdoutBuffer}\n`;
      onLine(stdoutBuffer);
    }
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    stderrBuffer = processBuffer(stderrBuffer, '[stderr] ', onLine);
  });

  child.on('error', (error) => {
    onError(error);
  });
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
