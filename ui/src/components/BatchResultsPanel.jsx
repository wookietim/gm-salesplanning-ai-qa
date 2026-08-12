import { useState } from 'react';
import { API_BASE } from '../api';

export default function BatchResultsPanel({ batchState }) {
  const [expanded, setExpanded] = useState(null);

  const { tickets } = batchState;
  const done = tickets.filter((t) => t.status === 'done' || t.status === 'error').length;
  const total = tickets.length;

  if (!tickets.length) return null;

  return (
    <aside className="results-panel">
      <div className="results-header">
        <div className="results-header-left">
          <span className="results-ticket-key">Batch Run</span>
          <span className="results-ticket-summary">{done}/{total} tickets complete</span>
        </div>
        <span className={`results-status ${done === total ? 'done' : 'running'}`}>
          {done === total ? '✅ done' : '🔄 running'}
        </span>
      </div>
      <div className="results-body">
        <div className="batch-list">
          {tickets.map((ticket) => {
            const isExpanded = expanded === ticket.key;
            const statusIcon =
              ticket.status === 'done' && ticket.failed === 0 ? '✅' :
              ticket.status === 'done' && ticket.failed > 0 ? '❌' :
              ticket.status === 'running' ? '🔄' :
              ticket.status === 'error' ? '❌' : '○';
            const rowClass = `batch-ticket-row ${ticket.status} ${ticket.failed === 0 && ticket.status === 'done' ? 'pass' : ticket.status === 'done' ? 'fail' : ''}`;

            return (
              <div key={ticket.key} className="batch-ticket">
                <div
                  className={rowClass}
                  onClick={() => setExpanded(isExpanded ? null : ticket.key)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="batch-icon">{statusIcon}</span>
                  <span className="batch-key">{ticket.key}</span>
                  <span className="batch-summary">{ticket.summary}</span>
                  {ticket.status === 'done' && (
                    <span className="batch-counts">
                      <span className="bc-pass">{ticket.passed}✓</span>
                      {ticket.failed > 0 && <span className="bc-fail">{ticket.failed}✗</span>}
                    </span>
                  )}
                  <span className="batch-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && <BatchTicketDetail ticket={ticket} />}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function BatchTicketDetail({ ticket }) {
  const [writeStatus, setWriteStatus] = useState(null);

  const FAILURE_DESCRIPTIONS = {
    'sad-path-source-signals': 'Components are missing error handling, loading states, or fallback UI.',
    'jira-issue-key-coverage': 'Test plans were generated without this Jira ticket scoped in.',
    'source-file-exists': 'Source component file could not be found at the expected path.',
    'source-shape-valid': 'Source file does not export a valid React component.',
  };

  const failureReasons = {};
  for (const t of ticket.tests || []) {
    for (const r of t.reasons || []) {
      failureReasons[r] = (failureReasons[r] || 0) + 1;
    }
  }

  const writeToConfluence = async (markAsPassed) => {
    setWriteStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/confluence-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketKey: ticket.key,
          ticketSummary: ticket.summary,
          tests: ticket.tests,
          markAsPassed,
        }),
      });
      const data = await res.json();
      setWriteStatus({ ok: data.ok, msg: data.ok ? `Written (v${data.version})` : data.error });
    } catch (e) {
      setWriteStatus({ ok: false, msg: e.message });
    }
  };

  return (
    <div className="batch-detail">
      {Object.keys(failureReasons).length > 0 && (
        <div className="batch-failure-summary">
          <p className="batch-failure-heading">⚠️ Why tests failed:</p>
          <ul className="batch-failure-list">
            {Object.entries(failureReasons).map(([check, count]) => (
              <li key={check}>
                <strong>{count}× {check}:</strong>{' '}
                {FAILURE_DESCRIPTIONS[check] || check}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ticket.status === 'done' && ticket.failed === 0 && ticket.tests.length > 0 && (
        <p className="batch-all-passed">All {ticket.passed} tests passed.</p>
      )}

      {ticket.tests && ticket.tests.length > 0 && (
        <div className="confluence-actions">
          <button
            className="confluence-btn"
            onClick={() => writeToConfluence(false)}
            disabled={writeStatus === 'loading'}
          >
            📤 Write to Confluence
          </button>
          <button
            className="confluence-btn primary"
            onClick={() => writeToConfluence(true)}
            disabled={writeStatus === 'loading'}
          >
            ✅ Mark as Passed & Write
          </button>
        </div>
      )}

      {writeStatus && writeStatus !== 'loading' && (
        <p className={`confluence-feedback ${writeStatus.ok ? 'success' : 'error'}`}>
          {writeStatus.ok ? '✅' : '❌'} {writeStatus.msg}
        </p>
      )}
      {writeStatus === 'loading' && <p className="confluence-feedback">Writing to Confluence…</p>}
    </div>
  );
}
