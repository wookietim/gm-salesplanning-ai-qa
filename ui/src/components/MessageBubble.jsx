function groupTickets(tickets) {
  const stories = [];
  const storyKeySet = new Set();
  const subtasksByParent = new Map();
  const orphanSubtasks = [];

  for (const ticket of tickets) {
    if (ticket.isSubtask) {
      if (ticket.parentKey) {
        if (!subtasksByParent.has(ticket.parentKey)) {
          subtasksByParent.set(ticket.parentKey, []);
        }
        subtasksByParent.get(ticket.parentKey).push(ticket);
      } else {
        orphanSubtasks.push(ticket);
      }
      continue;
    }

    stories.push(ticket);
    storyKeySet.add(ticket.key);
  }

  // If parent story is not in the filtered list, still group subtasks under a synthetic parent row.
  for (const parentKey of subtasksByParent.keys()) {
    if (!storyKeySet.has(parentKey)) {
      stories.push({
        key: parentKey,
        summary: '(Parent story not in current status list)',
        status: '',
        issueType: 'Story',
        isSubtask: false,
        parentKey: null,
        syntheticParent: true,
      });
    }
  }

  stories.sort((a, b) => a.key.localeCompare(b.key));

  return { stories, subtasksByParent, orphanSubtasks };
}

export default function MessageBubble({ role, text, tickets, onRunTicket, onRunAll, onRegenerateAll }) {
  const grouped = tickets ? groupTickets(tickets) : null;
  const isInReviewList = Boolean(tickets?.length && tickets.every((ticket) => /in review/i.test(ticket.status || '')));

  return (
    <div className={`message-row ${role}`}>
      <div className={`message-bubble ${role}`}>
        {text && <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>}

        {tickets && tickets.length > 0 && grouped && (
          <>
            <div className="run-all-bar">
              <button
                type="button"
                className="run-all-btn"
                onClick={() => onRunAll(tickets)}
                disabled={!onRunAll}
              >
                ▶ Run All {tickets.length} Tests
              </button>
              {isInReviewList && onRegenerateAll && (
                <button
                  type="button"
                  className="run-all-btn regenerate-btn"
                  onClick={() => onRegenerateAll(tickets)}
                >
                  ↻ Regenerate All Tests
                </button>
              )}
            </div>
            <ul className="ticket-list">
              {grouped.stories.map((story) => (
                <li key={story.key} className="ticket-group">
                  <div className={`ticket-item story ${story.syntheticParent ? 'synthetic-parent' : ''}`}>
                    <span className="ticket-icon" aria-hidden="true">📘</span>
                    <span className="ticket-key">{story.key}</span>
                    <span className="ticket-summary">{story.summary}</span>
                    {!story.syntheticParent && (
                      <button
                        type="button"
                        className="run-tests-btn"
                        onClick={() => onRunTicket(story.key, story.summary)}
                      >
                        ▶ Run Tests
                      </button>
                    )}
                  </div>

                  {(grouped.subtasksByParent.get(story.key) || []).map((subtask) => (
                    <div key={subtask.key} className="ticket-item subtask">
                      <span className="ticket-icon" aria-hidden="true">↳</span>
                      <span className="ticket-key">{subtask.key}</span>
                      <span className="ticket-summary">{subtask.summary}</span>
                      <button
                        type="button"
                        className="run-tests-btn"
                        onClick={() => onRunTicket(subtask.key, subtask.summary)}
                      >
                        ▶ Run Tests
                      </button>
                    </div>
                  ))}
                </li>
              ))}

              {grouped.orphanSubtasks.map((subtask) => (
                <li key={subtask.key} className="ticket-item subtask orphan-subtask">
                  <span className="ticket-icon" aria-hidden="true">↳</span>
                  <span className="ticket-key">{subtask.key}</span>
                  <span className="ticket-summary">{subtask.summary}</span>
                  <button
                    type="button"
                    className="run-tests-btn"
                    onClick={() => onRunTicket(subtask.key, subtask.summary)}
                  >
                    ▶ Run Tests
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!text && !tickets && '...'}
      </div>
    </div>
  );
}
