import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ messages, isStreaming, onRunTicket, onRunAll }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <section className="chat-window">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          role={message.role}
          text={message.text}
          tickets={message.tickets}
          onRunTicket={onRunTicket}
          onRunAll={onRunAll}
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
    </section>
  );
}
