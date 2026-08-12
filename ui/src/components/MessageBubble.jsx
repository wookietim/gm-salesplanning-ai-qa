export default function MessageBubble({ role, text }) {
  return (
    <div className={`message-row ${role}`}>
      <div className={`message-bubble ${role}`}>{text || '...'}</div>
    </div>
  );
}
