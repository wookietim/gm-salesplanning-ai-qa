import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api';

const FAILURE_REASON_DESCRIPTIONS = {
  'sad-path-source-signals': 'Components are missing error handling, loading states, or fallback UI — sad-path tests require these signals to validate against.',
  'jira-issue-key-coverage': 'Test plans were generated without this Jira ticket scoped in — plans need to be regenerated with the ticket key to pass this check.',
};

function parseLines(lines) {
  const stages = [
    { key: 'jira', label: 'Fetching Jira context', status: 'pending' },
    { key: 'bob', label: 'Bob generating test plans', status: 'pending' },
    { key: 'susan', label: 'Susan executing tests', status: 'pending' },
    { key: 'confluence', label: 'Writing to Confluence', status: 'pending' },
  ];

  let runId = null;
  let bobTotal = 0;
  let susanTotal = 0;
  let passed = 0;
  let failed = 0;

  for (const line of lines) {
    if (line.includes('Run ID:')) {
      runId = line.split('Run ID:').pop().trim();
      stages[0].status = 'running';
    }
    if (line.includes('Jira issues:') || line.includes('Jira source:')) {
      stages[0].status = 'done';
    }
    if (line.includes('Invoking Bob')) {
      stages[0].status = 'done';
      stages[1].status = 'running';
      const match = line.match(/(\d+) component/);
      if (match) bobTotal = parseInt(match[1], 10);
    }
    if (line.includes('Bob output end') || line.includes('Bob step skipped')) {
      stages[1].status = 'done';
    }
    if (line.includes('Invoking Susan')) {
      stages[1].status = 'done';
      stages[2].status = 'running';
      const match = line.match(/(\d+) selected/);
      if (match) susanTotal = parseInt(match[1], 10);
    }
    if (line.includes('Susan overall:')) {
      stages[2].status = 'done';
    }
    if (line.includes('Confluence') || line.includes('confluence')) {
      if (stages[2].status === 'done') {
        stages[3].status = 'running';
      }
    }
    if (line.includes('updated') && line.includes('version')) {
      stages[3].status = 'done';
    }
    if (line.includes('Overall: pass') || (line.includes('Overall:') && line.includes('pass'))) {
      stages.forEach((stage) => {
        if (stage.status === 'running') stage.status = 'done';
      });
    }
    if (/passed:\s*\d+/.test(line)) {
      const match = line.match(/passed:\s*(\d+)/);
      if (match) passed = parseInt(match[1], 10);
    }
    if (/failed:\s*\d+/.test(line)) {
      const match = line.match(/failed:\s*(\d+)/);
      if (match) failed = parseInt(match[1], 10);
    }
  }

  return { stages, runId, bobTotal, susanTotal, passed, failed };
}

function StageIcon({ status }) {
  if (status === 'done') return <span className="stage-icon done">✓</span>;
  if (status === 'running') return <span className="stage-icon running spin">◌</span>;
  return <span className="stage-icon pending">○</span>;
}

function getTestCounts(tests) {
  return tests.reduce(
    (totals, test) => {
      if (test.status === 'pass') {
        totals.passed += 1;
      } else if (test.status === 'blocked') {
        totals.blocked += 1;
      } else {
        totals.failed += 1;
      }
      return totals;
    },
    { passed: 0, failed: 0, blocked: 0 }
  );
}

function buildFailureSummary(tests) {
  const counts = new Map();

  tests
    .filter((test) => test.status !== 'pass' && test.status !== 'blocked')
    .forEach((test) => {
      (test.reasons || []).forEach((reason) => {
        counts.set(reason, (counts.get(reason) || 0) + 1);
      });
    });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => ({
      reason,
      count,
      description: FAILURE_REASON_DESCRIPTIONS[reason] || reason,
    }));
}

export default function ResultsPanel({ runState }) {
  const bottomRef = useRef(null);
  const [confluenceState, setConfluenceState] = useState({ status: 'idle', message: '' });
  const [suppressingAllFailures, setSuppressingAllFailures] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runState.lines]);

  useEffect(() => {
    if (!runState.ticket) {
      setConfluenceState({ status: 'idle', message: '' });
      setSuppressingAllFailures(false);
      return;
    }

    if (runState.status === 'running' && runState.lines.length === 0) {
      setConfluenceState({ status: 'idle', message: '' });
      setSuppressingAllFailures(false);
    }
  }, [runState.ticket, runState.status, runState.lines.length]);

  useEffect(() => {
    if (runState.tests && runState.tests.length > 0) {
      setConfluenceState({ status: 'idle', message: '' });
    }
  }, [runState.tests]);

  if (!runState.ticket) {
    return (
      <aside className="results-panel empty">
        <p className="results-placeholder">Select a ticket and click ▶ Run Tests to see results here.</p>
      </aside>
    );
  }

  const { stages, runId, bobTotal, susanTotal, passed, failed } = parseLines(runState.lines);
  const overallIcon = runState.status === 'running' ? '🔄' : runState.status === 'done' ? '✅' : '❌';
  const testCounts = getTestCounts(runState.tests || []);
  const failureSummary = buildFailureSummary(runState.tests || []);

  let overallStatusLabel = '✅ All Tests Passed';
  let overallStatusClass = 'pass';

  if (testCounts.failed > 0) {
    overallStatusLabel = `❌ ${testCounts.failed} Tests Failed`;
    overallStatusClass = 'fail';
  } else if (testCounts.blocked > 0) {
    overallStatusLabel = `⛔ ${testCounts.blocked} Tests Blocked`;
    overallStatusClass = 'blocked';
  }

  const handleConfluenceWrite = async (markAsPassed) => {
    setConfluenceState({ status: 'loading', message: 'Writing to Confluence…' });

    try {
      const response = await fetch(`${API_BASE}/api/confluence-write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketKey: runState.ticket.key,
          ticketSummary: runState.ticket.summary,
          tests: runState.tests,
          markAsPassed,
        }),
      });

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw new Error(`Unexpected response (${response.status})`);
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      setConfluenceState({
        status: 'success',
        message: `✅ Written to Confluence (v${payload.version})`,
      });
    } catch (error) {
      setConfluenceState({
        status: 'error',
        message: `❌ Error: ${error.message}`,
      });
    }
  };

  const handleSuppressFailingTests = async () => {
    const failingTests = (runState.tests || []).filter((test) => test.status === 'fail');
    if (!failingTests.length) return;

    setSuppressingAllFailures(true);
    try {
      const responses = await Promise.all(
        failingTests.map((test) =>
          fetch(`${API_BASE}/api/suppress-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketKey: runState.ticket.key,
              component: test.component,
              source: test.source,
              testId: test.testId,
            }),
          }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
              throw new Error(payload.error || `Request failed with status ${response.status}`);
            }
            return payload;
          })
        )
      );
      setConfluenceState({
        status: 'success',
        message: `✅ Removed ${responses.length} failing test${responses.length === 1 ? '' : 's'} from future runs`,
      });
    } catch (error) {
      setConfluenceState({
        status: 'error',
        message: `❌ Error: ${error.message}`,
      });
    } finally {
      setSuppressingAllFailures(false);
    }
  };

  return (
    <aside className="results-panel">
      <div className="results-header">
        <div className="results-header-left">
          <span className="results-ticket-key">{runState.ticket.key}</span>
          <span className="results-ticket-summary">{runState.ticket.summary}</span>
        </div>
        <span className={`results-status ${runState.status}`}>
          {overallIcon} {runState.status}
        </span>
      </div>

      <div className="results-body">
        {runState.tests && runState.tests.length > 0 ? (
          <div className="test-results">
            <div className={`overall-status ${overallStatusClass}`}>{overallStatusLabel}</div>

            {failureSummary.length > 0 && (
              <div className="failure-summary">
                <p className="failure-summary-title">Failure summary</p>
                <ul>
                  {failureSummary.map((item) => (
                    <li key={item.reason}>
                      <strong>{item.count}× {item.reason}</strong> — {item.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="confluence-actions">
              <button
                type="button"
                className={`confluence-btn primary${confluenceState.status === 'success' ? ' success' : ''}`}
                onClick={() => handleConfluenceWrite(false)}
                disabled={confluenceState.status === 'loading'}
              >
                {confluenceState.status === 'loading' ? '⏳ Writing…' : '📤 Write to Confluence'}
              </button>
              <button
                type="button"
                className={`confluence-btn${confluenceState.status === 'success' ? ' success' : ''}`}
                onClick={() => handleConfluenceWrite(true)}
                disabled={confluenceState.status === 'loading'}
              >
                {confluenceState.status === 'loading' ? '⏳ Writing…' : '✅ Mark as Passed & Write'}
              </button>
              {testCounts.failed > 0 && (
                <button
                  type="button"
                  className={`confluence-btn suppress-all${confluenceState.status === 'success' ? ' success' : ''}`}
                  onClick={handleSuppressFailingTests}
                  disabled={suppressingAllFailures}
                >
                  {suppressingAllFailures ? '⏳ Removing failing tests…' : '🗑 Remove all failing tests from future runs'}
                </button>
              )}
            </div>

            {confluenceState.message && (
              <div className={`confluence-feedback ${confluenceState.status}`}>{confluenceState.message}</div>
            )}

            <p className="test-results-heading">
              Test Results&nbsp;
              <span className="tr-pass-count">✅ {testCounts.passed} passed</span>
              &nbsp;
              <span className="tr-fail-count">❌ {testCounts.failed} failed</span>
              {testCounts.blocked > 0 && (
                <>&nbsp;<span className="tr-blocked-count">⛔ {testCounts.blocked} blocked</span></>
              )}
            </p>
            <div className="test-results-list">
              {runState.tests.map((test, index) => {
                const icon = test.status === 'pass' ? '✅' : test.status === 'blocked' ? '⛔' : '❌';
                return (
                  <div key={index} className={`test-result-row ${test.status}`}>
                    <span className="tr-icon">{icon}</span>
                    <span className="tr-component">{test.component}</span>
                    <span className="tr-label">{test.label}</span>
                    {test.reasons && test.reasons.length > 0 && (
                      <span className="tr-reason">{test.reasons.join(', ')}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          runState.status === 'running' && (
            <div className="test-results-pending">Waiting for test results…</div>
          )
        )}

        {runState.tests.length === 0 && (
          <div className="results-stages">
            {stages.map((stage) => (
              <div key={stage.key} className={`results-stage ${stage.status}`}>
                <StageIcon status={stage.status} />
                <span>{stage.label}</span>
                {stage.key === 'bob' && bobTotal > 0 && stage.status !== 'pending' && (
                  <span className="stage-detail">{bobTotal} components</span>
                )}
                {stage.key === 'susan' && susanTotal > 0 && stage.status !== 'pending' && (
                  <span className="stage-detail">{susanTotal} components</span>
                )}
              </div>
            ))}
          </div>
        )}

        {(passed > 0 || failed > 0) && runState.tests.length === 0 && (
          <div className="results-stats">
            <span className="stat pass">✅ {passed} passed</span>
            <span className="stat fail">❌ {failed} failed</span>
          </div>
        )}

        <div className="results-log">
          {runState.lines.map((line, index) => {
            const isPablo = line.startsWith('[Pablo]');
            const isBob = line.startsWith('[Bob]');
            const isSusan = line.startsWith('[Susan]');
            const isError = line.startsWith('[stderr]') || line.startsWith('Error:');
            const cls = isPablo ? 'log-pablo' : isBob ? 'log-bob' : isSusan ? 'log-susan' : isError ? 'log-error' : 'log-plain';
            return <div key={index} className={`log-line ${cls}`}>{line}</div>;
          })}
          {runState.status === 'running' && <div className="log-line log-cursor">▋</div>}
          <div ref={bottomRef} />
        </div>

        {runId && <p className="results-run-id">Run ID: {runId}</p>}
      </div>
    </aside>
  );
}
