const { test, expect } = require('@playwright/test');

const IN_REVIEW_TICKETS = [
  {
    key: 'SSPLAN-101',
    summary: 'Pricing summary cards',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
  {
    key: 'SSPLAN-111',
    summary: 'Validate empty states',
    status: 'In Review',
    issueType: 'Sub-task',
    isSubtask: true,
    parentKey: 'SSPLAN-101',
  },
  {
    key: 'SSPLAN-102',
    summary: 'Margin review drawer',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
  {
    key: 'SSPLAN-112',
    summary: 'Standalone notes validation',
    status: 'In Review',
    issueType: 'Sub-task',
    isSubtask: true,
    parentKey: null,
  },
];

const DONE_TICKETS = [
  {
    key: 'SSPLAN-201',
    summary: 'Approved pricing workflow',
    status: 'Done',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
  {
    key: 'SSPLAN-202',
    summary: 'Blocked follow-up checks',
    status: 'Done',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
];

const STAGE_DEMO_TICKETS = [
  {
    key: 'SSPLAN-910',
    summary: 'Streaming stage demo',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
];

const COMPLETE_STAGE_TICKETS = [
  {
    key: 'SSPLAN-911',
    summary: 'Completed stage demo',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
];

const WRITE_ERROR_TICKETS = [
  {
    key: 'SSPLAN-913',
    summary: 'Confluence error demo',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
];

const WRITE_DELAY_TICKETS = [
  {
    key: 'SSPLAN-914',
    summary: 'Confluence loading demo',
    status: 'In Review',
    issueType: 'Story',
    isSubtask: false,
    parentKey: null,
  },
];

const MIXED_TESTS = [
  {
    component: 'PricingSummaryCard',
    source: 'ui/src/components/PricingSummaryCard.jsx',
    testId: 'HP-1',
    label: 'Happy Path',
    status: 'pass',
    reasons: [],
  },
  {
    component: 'PricingSummaryCard',
    source: 'ui/src/components/PricingSummaryCard.jsx',
    testId: 'SP-1',
    label: 'Sad Path',
    status: 'fail',
    reasons: ['sad-path-source-signals'],
  },
  {
    component: 'MarginReviewDrawer',
    source: 'ui/src/components/MarginReviewDrawer.jsx',
    testId: 'SP-2',
    label: 'Sad Path',
    status: 'fail',
    reasons: ['jira-issue-key-coverage'],
  },
  {
    component: 'NotesEditor',
    source: 'ui/src/components/NotesEditor.jsx',
    testId: 'BL-1',
    label: 'Blocked Path',
    status: 'blocked',
    reasons: ['fixture-missing'],
  },
];

const PASS_TESTS = [
  {
    component: 'ApprovalDrawer',
    source: 'ui/src/components/ApprovalDrawer.jsx',
    testId: 'HP-2',
    label: 'Happy Path',
    status: 'pass',
    reasons: [],
  },
  {
    component: 'ApprovalDrawer',
    source: 'ui/src/components/ApprovalDrawer.jsx',
    testId: 'SP-3',
    label: 'Sad Path',
    status: 'pass',
    reasons: [],
  },
];

const BLOCKED_TESTS = [
  {
    component: 'BlockedPanel',
    source: 'ui/src/components/BlockedPanel.jsx',
    testId: 'BL-2',
    label: 'Blocked Path',
    status: 'blocked',
    reasons: ['environment-offline'],
  },
];

const SUBTASK_PASS_TESTS = [
  {
    component: 'EmptyStateCard',
    source: 'ui/src/components/EmptyStateCard.jsx',
    testId: 'HP-3',
    label: 'Happy Path',
    status: 'pass',
    reasons: [],
  },
];

const ORPHAN_FAIL_TESTS = [
  {
    component: 'NotesPanel',
    source: 'ui/src/components/NotesPanel.jsx',
    testId: 'SP-4',
    label: 'Sad Path',
    status: 'fail',
    reasons: ['sad-path-source-signals'],
  },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

function createRunEvents(ticketKey) {
  const plans = {
    'SSPLAN-101': {
      delayMs: 180,
      events: [
        { type: 'line', text: 'Run ID: RUN-101' },
        { type: 'line', text: 'Jira issues: SSPLAN-101' },
        { type: 'line', text: 'Invoking Bob for 3 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 4 selected components' },
        { type: 'line', text: 'Susan overall: passed: 1 failed: 2 blocked: 1' },
        { type: 'tests', tests: MIXED_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-111': {
      delayMs: 60,
      events: [
        { type: 'line', text: 'Run ID: RUN-111' },
        { type: 'line', text: 'Jira issues: SSPLAN-111' },
        { type: 'line', text: 'Invoking Bob for 1 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 1 selected components' },
        { type: 'line', text: 'Susan overall: passed: 1 failed: 0 blocked: 0' },
        { type: 'tests', tests: SUBTASK_PASS_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-102': {
      delayMs: 90,
      events: [
        { type: 'line', text: 'Run ID: RUN-102' },
        { type: 'line', text: 'Jira issues: SSPLAN-102' },
        { type: 'line', text: 'Invoking Bob for 2 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 2 selected components' },
        { type: 'line', text: 'Susan overall: passed: 2 failed: 0 blocked: 0' },
        { type: 'tests', tests: PASS_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-112': {
      delayMs: 70,
      events: [
        { type: 'line', text: 'Run ID: RUN-112' },
        { type: 'line', text: 'Jira issues: SSPLAN-112' },
        { type: 'line', text: 'Invoking Bob for 1 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 1 selected components' },
        { type: 'line', text: 'Susan overall: passed: 0 failed: 1 blocked: 0' },
        { type: 'tests', tests: ORPHAN_FAIL_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-201': {
      delayMs: 50,
      events: [
        { type: 'line', text: 'Run ID: RUN-201' },
        { type: 'line', text: 'Jira source: SSPLAN-201' },
        { type: 'line', text: 'Invoking Bob for 2 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 2 selected components' },
        { type: 'line', text: 'Susan overall: passed: 2 failed: 0 blocked: 0' },
        { type: 'tests', tests: PASS_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-202': {
      delayMs: 50,
      events: [
        { type: 'line', text: 'Run ID: RUN-202' },
        { type: 'line', text: 'Jira source: SSPLAN-202' },
        { type: 'line', text: 'Invoking Bob for 1 component(s)' },
        { type: 'line', text: 'Bob step skipped' },
        { type: 'line', text: 'Invoking Susan for 1 selected components' },
        { type: 'line', text: 'Susan overall: passed: 0 failed: 0 blocked: 1' },
        { type: 'tests', tests: BLOCKED_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-910': {
      delayMs: 40,
      events: [
        { type: 'line', text: 'Run ID: RUN-910' },
        { type: 'line', text: 'Jira issues: SSPLAN-910' },
        { type: 'line', text: 'Invoking Bob for 2 component(s)' },
      ],
    },
    'SSPLAN-911': {
      delayMs: 40,
      events: [
        { type: 'line', text: 'Run ID: RUN-911' },
        { type: 'line', text: 'Jira source: SSPLAN-911' },
        { type: 'line', text: 'Invoking Bob for 1 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 1 selected components' },
        { type: 'line', text: 'Susan overall: passed: 1 failed: 0 blocked: 0' },
        { type: 'line', text: 'Confluence page updated to version 12' },
        { type: 'line', text: 'Overall: pass' },
        { type: 'done', text: 'Complete.' },
      ],
    },
    'SSPLAN-913': {
      delayMs: 50,
      events: [
        { type: 'line', text: 'Run ID: RUN-913' },
        { type: 'line', text: 'Jira issues: SSPLAN-913' },
        { type: 'line', text: 'Invoking Bob for 2 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 2 selected components' },
        { type: 'line', text: 'Susan overall: passed: 2 failed: 0 blocked: 0' },
        { type: 'tests', tests: PASS_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
    'SSPLAN-914': {
      delayMs: 50,
      events: [
        { type: 'line', text: 'Run ID: RUN-914' },
        { type: 'line', text: 'Jira issues: SSPLAN-914' },
        { type: 'line', text: 'Invoking Bob for 2 component(s)' },
        { type: 'line', text: 'Bob output end' },
        { type: 'line', text: 'Invoking Susan for 2 selected components' },
        { type: 'line', text: 'Susan overall: passed: 2 failed: 0 blocked: 0' },
        { type: 'tests', tests: PASS_TESTS },
        { type: 'done', text: 'Pablo run complete.' },
      ],
    },
  };

  return plans[ticketKey] || {
    delayMs: 25,
    events: [
      { type: 'line', text: `Run ID: RUN-${ticketKey}` },
      { type: 'done', text: 'Done.' },
    ],
  };
}

function createCommandResponse(text) {
  if (text === 'List In Review tickets') {
    return {
      delayMs: 80,
      events: [
        { type: 'line', text: 'Fetching Jira tickets with status "In Review"...' },
        { type: 'tickets', tickets: IN_REVIEW_TICKETS },
        { type: 'done', text: 'Returned 4 In Review ticket(s).' },
      ],
    };
  }

  if (text === 'List Done tickets') {
    return {
      delayMs: 80,
      events: [
        { type: 'line', text: 'Fetching Jira tickets with status "Done"...' },
        { type: 'tickets', tickets: DONE_TICKETS },
        { type: 'done', text: 'Returned 2 Done ticket(s).' },
      ],
    };
  }

  if (text === 'Load stage demo tickets') {
    return {
      delayMs: 40,
      events: [
        { type: 'tickets', tickets: STAGE_DEMO_TICKETS },
        { type: 'done', text: 'Loaded stage demo tickets.' },
      ],
    };
  }

  if (text === 'Load completed stage demo tickets') {
    return {
      delayMs: 40,
      events: [
        { type: 'tickets', tickets: COMPLETE_STAGE_TICKETS },
        { type: 'done', text: 'Loaded completed stage demo tickets.' },
      ],
    };
  }

  if (text === 'Load write error demo tickets') {
    return {
      delayMs: 40,
      events: [
        { type: 'tickets', tickets: WRITE_ERROR_TICKETS },
        { type: 'done', text: 'Loaded error demo tickets.' },
      ],
    };
  }

  if (text === 'Load write delay demo tickets') {
    return {
      delayMs: 40,
      events: [
        { type: 'tickets', tickets: WRITE_DELAY_TICKETS },
        { type: 'done', text: 'Loaded delay demo tickets.' },
      ],
    };
  }

  if (text === 'Slow streaming request') {
    return {
      delayMs: 300,
      events: [
        { type: 'line', text: 'Working through the request...' },
        { type: 'done', text: 'Finished slow request.' },
      ],
    };
  }

  if (text.startsWith('Run tests for ')) {
    return createRunEvents(text.replace('Run tests for ', '').trim());
  }

  return {
    delayMs: 40,
    events: [
      { type: 'line', text: `Echo: ${text}` },
      { type: 'done', text: `Done: ${text}` },
    ],
  };
}

async function installScrollSpy(page) {
  await page.addInitScript(() => {
    window.__scrollIntoViewCalls = 0;
    Element.prototype.scrollIntoView = function scrollIntoView() {
      window.__scrollIntoViewCalls += 1;
      this.setAttribute('data-scroll-spy', 'true');
    };
  });
}

async function sendPrompt(page, text, submitWith = 'enter') {
  const input = page.locator('.input-bar input');
  await input.fill(text);
  if (submitWith === 'click') {
    await page.getByRole('button', { name: 'Send' }).click();
  } else {
    await input.press('Enter');
  }
}

async function loadTicketList(page, command, expectedTicketKey) {
  await sendPrompt(page, command, 'enter');
  await expect(page.locator('.chat-ticket-list-panel .ticket-key').first()).toContainText(expectedTicketKey);
}

let mockState;

test.beforeEach(async ({ page }) => {
  mockState = {
    commandRequests: [],
    confluenceRequests: [],
    suppressRequests: [],
  };

  await installScrollSpy(page);

  await page.route('**/api/command', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const text = String(payload.text || '');
    mockState.commandRequests.push(text);

    const response = createCommandResponse(text);
    if (response.delayMs) {
      await delay(response.delayMs);
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
      },
      body: sse(response.events),
    });
  });

  await page.route('**/api/confluence-write', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    mockState.confluenceRequests.push(payload);

    if (payload.ticketKey === 'SSPLAN-913') {
      await route.fulfill({
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:5173',
        },
        body: JSON.stringify({ ok: false, error: 'Confluence unavailable' }),
      });
      return;
    }

    if (payload.ticketKey === 'SSPLAN-914') {
      await delay(2000);
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({ ok: true, version: payload.markAsPassed ? 42 : 41 }),
    });
  });

  await page.route('**/api/suppress-test', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    mockState.suppressRequests.push(payload);
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:5173',
      },
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/');
});

test.describe('Page load', () => {
  test('renders the default shell state', async ({ page }) => {
    await expect(page).toHaveTitle(/GM Sales Planning QA/);
    await expect(page.locator('h1')).toHaveText('GM Sales Planning QA');
    await expect(page.locator('.eyebrow')).toHaveText('IKEA QA Agent');
    await expect(page.locator('.chat-conversation-panel')).toContainText(
      'Ask me to list Jira tickets, run Pablo for SSPLAN keys, or write results to Confluence.'
    );
    await expect(page.locator('.chip')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'List In Review tickets' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'List Done tickets' })).toBeEnabled();
    await expect(page.locator('.input-bar')).toBeVisible();
    await expect(page.locator('.input-bar input')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(page.locator('.results-placeholder')).toHaveText(
      'Select a ticket and click ▶ Run Tests to see results here.'
    );
    await expect(page.locator('.ticket-list-placeholder')).toHaveText('No ticket list loaded yet.');
  });
});

test.describe('InputBar interactions', () => {
  test.describe('Typing and value state', () => {
    test('accepts typed input and reflects value', async ({ page }) => {
      const input = page.locator('.input-bar input');
      await input.fill('Hello QA agent');
      await expect(input).toHaveValue('Hello QA agent');
    });

    test('disables Send when input is blank or whitespace-only', async ({ page }) => {
      const input = page.locator('.input-bar input');
      const sendButton = page.getByRole('button', { name: 'Send' });
      await input.fill('   ');
      await expect(sendButton).toBeDisabled();
      expect(mockState.commandRequests).toHaveLength(0);
    });
  });

  test.describe('Submission', () => {
    test('submits via Enter and clears the input', async ({ page }) => {
      const input = page.locator('.input-bar input');
      await sendPrompt(page, 'Check command by enter', 'enter');
      await expect.poll(() => mockState.commandRequests.at(-1)).toBe('Check command by enter');
      await expect(input).toHaveValue('');
    });

    test('submits via Send button click and clears the input', async ({ page }) => {
      const input = page.locator('.input-bar input');
      await sendPrompt(page, 'Check command by click', 'click');
      await expect.poll(() => mockState.commandRequests.at(-1)).toBe('Check command by click');
      await expect(input).toHaveValue('');
    });
  });

  test.describe('Streaming disabled state', () => {
    test('disables input, Send, and chips while a response is streaming', async ({ page }) => {
      const input = page.locator('.input-bar input');
      const sendButton = page.getByRole('button', { name: 'Send' });
      await sendPrompt(page, 'Slow streaming request', 'enter');
      await expect(input).toHaveValue('');
      await expect(input).toBeDisabled();
      await expect(sendButton).toBeDisabled();
      await expect(page.getByRole('button', { name: 'List In Review tickets' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'List Done tickets' })).toBeDisabled();
    });

    test('shows typing indicator and conversation rows while streaming', async ({ page }) => {
      await sendPrompt(page, 'Slow streaming request', 'enter');
      await expect(page.locator('.typing-indicator')).toBeVisible();
      await expect(page.locator('.typing-indicator')).toHaveAttribute('aria-label', 'Agent is typing');
      await expect(page.locator('.chat-conversation-panel .message-row.user').last()).toContainText('Slow streaming request');
      await expect(page.locator('.chat-conversation-panel .message-row.agent').last()).toContainText('Working through the request...');
    });

    test('re-enables input and chips after streaming completes', async ({ page }) => {
      const input = page.locator('.input-bar input');
      await sendPrompt(page, 'Slow streaming request', 'enter');
      await expect(page.locator('.typing-indicator')).toBeHidden();
      await expect(input).toBeEnabled();
      await expect(page.getByRole('button', { name: 'List In Review tickets' })).toBeEnabled();
    });
  });
});

test.describe('Suggestion chips', () => {
  test('submit the canned commands', async ({ page }) => {
    await page.getByRole('button', { name: 'List In Review tickets' }).click();
    await expect.poll(() => mockState.commandRequests.at(-1)).toBe('List In Review tickets');
    await expect(page.locator('.chat-ticket-list-panel .ticket-key').first()).toHaveText('SSPLAN-101');

    await page.getByRole('button', { name: 'List Done tickets' }).click();
    await expect.poll(() => mockState.commandRequests.at(-1)).toBe('List Done tickets');
    await expect(page.locator('.chat-ticket-list-panel .ticket-key').first()).toHaveText('SSPLAN-201');
  });
});

test.describe('ChatWindow', () => {
  test('renders and replaces ticket lists in the left panel', async ({ page }) => {
    await page.getByRole('button', { name: 'List In Review tickets' }).click();

    const ticketList = page.locator('.chat-ticket-list-panel .ticket-list');
    await expect(ticketList).toBeVisible();
    await expect(ticketList.locator('.ticket-item.story')).toHaveCount(2);
    await expect(ticketList.locator('.ticket-item.story').first()).toContainText('SSPLAN-101');
    await expect(ticketList.locator('.ticket-item.story').first()).toContainText('Pricing summary cards');
    await expect(ticketList.locator('.ticket-item.story').first().locator('.run-tests-btn')).toHaveText('▶ Run Tests');
    await expect(ticketList.locator('.ticket-group').first().locator('.ticket-item.subtask')).toHaveCount(1);
    await expect(ticketList.locator('.ticket-group').first().locator('.ticket-item.subtask')).toContainText('SSPLAN-111');
    await expect(ticketList.locator('.orphan-subtask')).toContainText('SSPLAN-112');
    await expect(page.locator('.run-all-btn').first()).toHaveText('▶ Run All 4 Tests');
    await expect(page.locator('.regenerate-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: '▶ Run Tests' })).toHaveCount(4);

    await page.getByRole('button', { name: 'List Done tickets' }).click();
    await expect(page.locator('.chat-ticket-list-panel')).toContainText('SSPLAN-201');
    await expect(page.locator('.chat-ticket-list-panel')).not.toContainText('SSPLAN-101');
    await expect(page.locator('.regenerate-btn')).toHaveCount(0);
    await expect(page.locator('.run-all-btn').first()).toHaveText('▶ Run All 2 Tests');
  });

  test('renders user and agent conversation rows and auto-scrolls on updates', async ({ page }) => {
    const beforeScrolls = await page.evaluate(() => window.__scrollIntoViewCalls);

    await sendPrompt(page, 'Show me status', 'enter');
    await expect(page.locator('.chat-conversation-panel .message-row.user').last()).toContainText('Show me status');
    await expect(page.locator('.chat-conversation-panel .message-row.agent').last()).toContainText('Echo: Show me status');
    await expect.poll(async () => page.evaluate(() => window.__scrollIntoViewCalls)).toBeGreaterThan(beforeScrolls);
  });
});

test.describe('Single-ticket run (ResultsPanel)', () => {
  test.describe('Run output and test results display', () => {
    test('shows ticket header, stage indicators, log, and test result rows', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await expect(page.locator('.chat-ticket-list-panel .ticket-key').first()).toHaveText('SSPLAN-101');

      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();

      await expect(page.locator('.results-ticket-key')).toHaveText('SSPLAN-101');
      await expect(page.locator('.results-ticket-summary')).toHaveText('Pricing summary cards');
      await expect(page.locator('.results-stage.pending')).toHaveCount(4);
      await expect(page.locator('.results-log')).toContainText('Run ID: RUN-101');
      await expect(page.locator('.test-results')).toBeVisible();
      await expect(page.locator('.overall-status')).toHaveText('❌ 2 Tests Failed');
      await expect(page.locator('.failure-summary')).toContainText('sad-path-source-signals');
      await expect(page.locator('.failure-summary')).toContainText('jira-issue-key-coverage');
      await expect(page.locator('.test-result-row')).toHaveCount(4);
      await expect(page.locator('.test-result-row.pass').first()).toContainText('✅');
      await expect(page.locator('.test-result-row.fail').first()).toContainText('PricingSummaryCard');
      await expect(page.locator('.test-result-row.fail').nth(1)).toContainText('MarginReviewDrawer');
      await expect(page.locator('.test-result-row.blocked')).toContainText('⛔');
    });

    test('shows pipeline stage transitions (running → done) mid-stream', async ({ page }) => {
      await loadTicketList(page, 'Load stage demo tickets', 'SSPLAN-910');
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-910' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.locator('.results-stage.done').filter({ hasText: 'Fetching Jira context' })).toBeVisible();
      await expect(page.locator('.results-stage.running').filter({ hasText: 'Bob generating test plans' })).toBeVisible();
      await expect(page.locator('.results-stage.pending').filter({ hasText: 'Susan executing tests' })).toBeVisible();
    });

    test('shows all stages as done and run ID when run is complete', async ({ page }) => {
      await loadTicketList(page, 'Load completed stage demo tickets', 'SSPLAN-911');
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-911' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.locator('.results-stage.done')).toHaveCount(4);
      await expect(page.locator('.results-run-id')).toContainText('RUN-911');
    });

    test('replaces results panel and clears old log when switching tickets', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.locator('.results-ticket-key')).toHaveText('SSPLAN-101');

      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-102' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.locator('.results-ticket-key')).toHaveText('SSPLAN-102');
      await expect(page.locator('.results-ticket-summary')).toHaveText('Margin review drawer');
      await expect(page.locator('.overall-status')).toHaveText('✅ All Tests Passed');
      await expect(page.locator('.results-log')).not.toContainText('RUN-101');
      await expect(page.getByRole('button', { name: '🗑 Remove all failing tests from future runs' })).toHaveCount(0);
    });
  });

  test.describe('Confluence write actions', () => {
    test('shows write action buttons after a run with failures', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.getByRole('button', { name: '📤 Write to Confluence' })).toBeVisible();
      await expect(page.getByRole('button', { name: '✅ Mark as Passed & Write' })).toBeVisible();
      await expect(page.getByRole('button', { name: '🗑 Remove all failing tests from future runs' })).toBeVisible();
    });

    test('Write to Confluence sends the correct payload and shows success feedback', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await page.getByRole('button', { name: '📤 Write to Confluence' }).click();
      await expect.poll(() => mockState.confluenceRequests.length).toBe(1);
      expect(mockState.confluenceRequests[0]).toMatchObject({
        ticketKey: 'SSPLAN-101',
        ticketSummary: 'Pricing summary cards',
        markAsPassed: false,
      });
      await expect(page.locator('.confluence-feedback.success')).toContainText('v41');
    });

    test('Mark as Passed & Write sends markAsPassed:true and shows success feedback', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await page.getByRole('button', { name: '✅ Mark as Passed & Write' }).click();
      await expect.poll(() => mockState.confluenceRequests.length).toBe(1);
      expect(mockState.confluenceRequests[0]).toMatchObject({
        ticketKey: 'SSPLAN-101',
        ticketSummary: 'Pricing summary cards',
        markAsPassed: true,
      });
      await expect(page.locator('.confluence-feedback.success')).toContainText('v42');
    });

    test('shows an error state when the Confluence write API returns 500', async ({ page }) => {
      await sendPrompt(page, 'Load write error demo tickets', 'enter');
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-913' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await page.getByRole('button', { name: '📤 Write to Confluence' }).click();
      await expect(page.locator('.confluence-feedback.error')).toContainText('Confluence unavailable');
    });

    test('disables write buttons and shows loading feedback while write is in flight', async ({ page }) => {
      await sendPrompt(page, 'Load write delay demo tickets', 'enter');
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-914' }).getByRole('button', { name: '▶ Run Tests' }).click();
      // Use class-based locators — the button text changes to "⏳ Writing…" during loading,
      // so role+name locators can't find them mid-flight.
      const writeButton = page.locator('.confluence-actions .confluence-btn.primary');
      const markPassedButton = page.locator('.confluence-actions .confluence-btn:not(.primary):not(.suppress-all)');
      await writeButton.click();
      // Assert loading state while the 2s mock delay is in flight
      await expect(writeButton).toHaveText('⏳ Writing…');
      await expect(writeButton).toBeDisabled();
      await expect(markPassedButton).toBeDisabled();
      await expect(page.locator('.confluence-feedback')).toContainText('Writing to Confluence…');
      await expect(page.locator('.confluence-feedback.success')).toContainText('v41');
    });
  });

  test.describe('Suppression', () => {
    test('shows blocked overall status for a ticket with only blocked tests', async ({ page }) => {
      await page.getByRole('button', { name: 'List Done tickets' }).click();
      await expect(page.locator('.chat-ticket-list-panel .ticket-key').first()).toHaveText('SSPLAN-201');
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-202' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await expect(page.locator('.overall-status')).toHaveText('⛔ 1 Tests Blocked');
    });

    test('sends suppress requests for each failing test', async ({ page }) => {
      await page.getByRole('button', { name: 'List In Review tickets' }).click();
      await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
      await page.getByRole('button', { name: '🗑 Remove all failing tests from future runs' }).click();
      await expect.poll(() => mockState.suppressRequests.length).toBe(2);
      expect(mockState.suppressRequests).toEqual([
        {
          ticketKey: 'SSPLAN-101',
          component: 'PricingSummaryCard',
          source: 'ui/src/components/PricingSummaryCard.jsx',
          testId: 'SP-1',
        },
        {
          ticketKey: 'SSPLAN-101',
          component: 'MarginReviewDrawer',
          source: 'ui/src/components/MarginReviewDrawer.jsx',
          testId: 'SP-2',
        },
      ]);
    });
  });
});

test.describe('Batch run (BatchResultsPanel)', () => {
  test('handles batch progress, status icons, detail expansion, write actions, and completion state', async ({ page }) => {
    await page.getByRole('button', { name: 'List In Review tickets' }).click();
    await page.getByRole('button', { name: '▶ Run All 4 Tests' }).click();

    await expect(page.locator('.results-ticket-key')).toHaveText('Batch Run');
    await expect(page.locator('.results-ticket-summary')).toHaveText('0/4 tickets complete');
    await expect(page.locator('.batch-ticket-row')).toHaveCount(4);
    await expect(page.locator('.batch-ticket-row').first()).toContainText('🔄');
    await expect(page.locator('.batch-ticket-row').first()).toContainText('SSPLAN-101');
    await expect(page.locator('.batch-ticket-row').nth(1)).toContainText('○');
    await expect(page.locator('.batch-ticket-row').nth(2)).toContainText('○');
    await expect(page.locator('.batch-ticket-row').nth(3)).toContainText('○');

    await expect(page.locator('.results-ticket-summary')).toHaveText('4/4 tickets complete');
    await expect(page.locator('.results-status')).toHaveText('✅ done');
    await expect(page.locator('.batch-ticket-row.pass').filter({ hasText: 'SSPLAN-102' })).toContainText('✅');
    await expect(page.locator('.batch-ticket-row.fail').filter({ hasText: 'SSPLAN-101' })).toContainText('❌');
    await expect(page.locator('.batch-ticket-row.pass').filter({ hasText: 'SSPLAN-102' })).toContainText('2✓');
    await expect(page.locator('.batch-ticket-row.fail').filter({ hasText: 'SSPLAN-101' })).toContainText('2✗');

    const failingRow = page.locator('.batch-ticket-row', { hasText: 'SSPLAN-101' });
    await failingRow.click();
    await expect(page.locator('.batch-detail')).toBeVisible();
    await expect(page.locator('.batch-detail')).toContainText('Why tests failed');
    await expect(page.locator('.batch-detail')).toContainText('sad-path-source-signals');
    await expect(page.getByRole('button', { name: '📤 Write to Confluence' })).toBeVisible();
    await expect(page.getByRole('button', { name: '✅ Mark as Passed & Write' })).toBeVisible();
    await page.getByRole('button', { name: '📤 Write to Confluence' }).click();
    await expect.poll(() => mockState.confluenceRequests.some((request) => request.ticketKey === 'SSPLAN-101')).toBeTruthy();

    await failingRow.click();
    await expect(page.locator('.batch-detail')).toHaveCount(0);

    const passingRow = page.locator('.batch-ticket-row', { hasText: 'SSPLAN-102' });
    await passingRow.click();
    await expect(page.locator('.batch-detail')).toContainText('All 2 tests passed.');
  });
});

test.describe('Abort / replace behaviour', () => {
  test('switches from batch to single-ticket mode', async ({ page }) => {
    await page.getByRole('button', { name: 'List In Review tickets' }).click();
    await page.getByRole('button', { name: '▶ Run All 4 Tests' }).click();
    await expect(page.locator('.results-ticket-key')).toHaveText('Batch Run');

    await page.locator('.ticket-item.story', { hasText: 'SSPLAN-101' }).getByRole('button', { name: '▶ Run Tests' }).click();
    await expect(page.locator('.results-ticket-key')).toHaveText('SSPLAN-101');
    await expect(page.locator('.batch-ticket-row')).toHaveCount(0);
    await expect(page.locator('.test-results')).toBeVisible();
  });

  test('switches from single-ticket mode to batch mode', async ({ page }) => {
    await loadTicketList(page, 'Load stage demo tickets', 'SSPLAN-910');
    await page.locator('.ticket-item.story', { hasText: 'SSPLAN-910' }).getByRole('button', { name: '▶ Run Tests' }).click();
    await expect(page.locator('.results-ticket-key')).toHaveText('SSPLAN-910');

    await page.getByRole('button', { name: 'List In Review tickets' }).click();
    await page.getByRole('button', { name: '▶ Run All 4 Tests' }).click();
    await expect(page.locator('.results-ticket-key')).toHaveText('Batch Run');
    await expect(page.locator('.batch-ticket-row')).toHaveCount(4);
  });
});

test.describe('Accessibility basics', () => {
  test('keeps primary affordances accessible', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'GM Sales Planning QA' })).toBeVisible();
    await expect(page.locator('.input-bar input')).toHaveAttribute('placeholder', /Try:/);

    await page.getByRole('button', { name: 'List In Review tickets' }).click();
    await expect(page.getByRole('button', { name: '▶ Run Tests' }).first()).toBeVisible();

    await sendPrompt(page, 'Slow streaming request', 'enter');
    await expect(page.locator('.typing-indicator')).toHaveAttribute('aria-label', 'Agent is typing');
    await expect(page.locator('.typing-indicator')).toBeHidden();
  });
});
