const fs = require('fs');
const path = require('path');

const BOB_PLANS_DIR = path.resolve(__dirname, '../../../component-poc/qa-agent/agents/bob/generated-tests');
const BOB_STATE_PATH = path.join(BOB_PLANS_DIR, '.bob-memory.json');

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Find the Bob plan file for a given ticketKey + component name.
 * Bob plan filenames look like:
 *   SSPLAN-714__..__gm-salesplanning-frontend__src__components__AcceptLogin__accept-login.qa.md
 * The component name from Susan is the stem, e.g. "accept-login".
 */
function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function findPlanFiles(ticketKey, { component, source } = {}) {
  if (!fs.existsSync(BOB_PLANS_DIR)) {
    throw new Error(`Bob plans directory not found: ${BOB_PLANS_DIR}`);
  }

  const files = fs.readdirSync(BOB_PLANS_DIR).filter((f) => f.endsWith('.qa.md'));
  const prefix = ticketKey.toUpperCase() + '__';
  const normalizedComponent = normalizeToken(component);
  const normalizedSource = normalizeToken(source);

  const candidates = files.filter((file) => {
    if (!file.toLowerCase().startsWith(prefix.toLowerCase())) {
      return false;
    }

    const normalizedFileName = normalizeToken(file);
    if (normalizedSource) {
      const filePath = path.join(BOB_PLANS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(`Source component: ${source}`)) {
        return true;
      }
      if (normalizeToken(content).includes(normalizedSource)) {
        return true;
      }
      if (normalizedFileName.includes(normalizedSource) || normalizedSource.includes(normalizedFileName)) {
        return true;
      }
    }

    if (normalizedComponent) {
      return normalizedFileName.includes(normalizedComponent) || normalizedComponent.includes(normalizedFileName);
    }

    return false;
  });

  if (!candidates.length) {
    throw new Error(
      `No Bob plan found for ticket ${ticketKey} / component "${component}"${source ? ` / source "${source}"` : ''}. Searched in ${BOB_PLANS_DIR}`
    );
  }

  // If multiple matches (unlikely), prefer the most specific one.
  candidates.sort((a, b) => a.length - b.length);
  return candidates.map((file) => path.join(BOB_PLANS_DIR, file));
}

/**
 * Replace a test section with a suppression note while keeping the parent section heading.
 */
function suppressTestInPlan(filePath, testId) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find the heading line for this test ID (case-insensitive).
  const escapedId = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`(\\n|^)(###\\s+Test ID:\\s*${escapedId}[^\\n]*)`, 'im');
  const match = headingPattern.exec(content);

  if (!match) {
    return { removed: false, filePath };
  }

  const startIdx = match.index + (match[1] === '\n' ? 1 : 0);

  // Find the next ### or ## heading after the matched one.
  const afterMatch = content.indexOf('\n', startIdx) + 1;
  const nextHeadingPattern = /\n(##+ )/g;
  nextHeadingPattern.lastIndex = afterMatch;
  const nextMatch = nextHeadingPattern.exec(content);

  const endIdx = nextMatch ? nextMatch.index : content.length;

  const leading = match[1] === '\n' ? '\n' : '';
  const note = `${leading}- Suppressed by user action: ${testId} removed from future runs.\n`;
  const updated = content.slice(0, startIdx) + note + content.slice(endIdx).replace(/^\n/, '');

  fs.writeFileSync(filePath, updated, 'utf8');
  return { removed: true, filePath };
}

function updateStateSuppression(ticketKey, source, testId) {
  const state = loadJson(BOB_STATE_PATH, { version: '1.0.0', generatedAt: null, targetRoot: null, components: {} });
  const sourceKey = source ? String(source).replace(/\\/g, '/') : null;

  if (!sourceKey) {
    return;
  }

  for (const [key, componentState] of Object.entries(state.components || {})) {
    if (key !== sourceKey && componentState?.outputFile && componentState.outputFile.indexOf(sourceKey) === -1) {
      continue;
    }

    const existing = Array.isArray(componentState.suppressedTestIds) ? componentState.suppressedTestIds : [];
    componentState.suppressedTestIds = Array.from(new Set([...existing, testId]));
    componentState.updatedAt = new Date().toISOString();
    componentState.suppressionSource = ticketKey;
  }

  saveJson(BOB_STATE_PATH, state);
}

/**
 * Main entry point. Finds the plan file and removes the test section.
 */
function suppressTest({ ticketKey, component, source, testId }) {
  if (!ticketKey || !component || !testId) {
    throw new Error('ticketKey, component, and testId are all required');
  }

  const filePaths = findPlanFiles(ticketKey, { component, source });
  const results = filePaths.map((filePath) => suppressTestInPlan(filePath, testId));
  updateStateSuppression(ticketKey, source, testId);

  return {
    removed: results.some((item) => item.removed),
    filePath: results[0]?.filePath || '',
    ticketKey,
    component,
    source,
    testId,
    planFiles: results.map((result) => path.relative(path.resolve(__dirname, '../../..'), result.filePath)),
  };
}

module.exports = { suppressTest };
