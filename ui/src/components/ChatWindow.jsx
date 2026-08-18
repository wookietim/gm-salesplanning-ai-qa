import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ messages, isStreaming, onRunTicket, onRunAll, onRegenerateAll }) {
  const bottomRef = useRef(null);
  const latestTicketMessage = [...messages].reverse().find((message) => message.tickets?.length);
  const conversationMessages = messages.filter((message) => !message.tickets?.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages, isStreaming]);

  return (
    <section className="chat-window">
      <div className="chat-ticket-list-panel">
        {latestTicketMessage ? (
          <MessageBubble
            key={latestTicketMessage.id}
            role={latestTicketMessage.role}
            text={latestTicketMessage.text}
            tickets={latestTicketMessage.tickets}
            onRunTicket={onRunTicket}
            onRunAll={onRunAll}
            onRegenerateAll={onRegenerateAll}
          />
        ) : (
          <div className="ticket-list-placeholder">No ticket list loaded yet.</div>
        )}
      </div>

      <div className="chat-conversation-panel">
        {conversationMessages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            text={message.text}
            tickets={message.tickets}
            onRunTicket={onRunTicket}
            onRunAll={onRunAll}
            onRegenerateAll={onRegenerateAll}
          />
        ))}

        {isStreaming && (
          <div className="message-row agent">
            <div className="message-bubble agent typing-indicator" aria-label="Agent is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
