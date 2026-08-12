export default function MessageBubble({ role, text, tickets, onRunTicket, onRunAll }) {
  return (
    <div className={`message-row ${role}`}>
      <div className={`message-bubble ${role}`}>
        {text && <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>}

        {tickets && tickets.length > 0 && (
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
            </div>
            <ul className="ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.key} className="ticket-item">
                  <span className="ticket-key">{ticket.key}</span>
                  <span className="ticket-summary">{ticket.summary}</span>
                  <button
                    type="button"
                    className="run-tests-btn"
                    onClick={() => onRunTicket(ticket.key, ticket.summary)}
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
