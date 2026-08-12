import { useState } from 'react';

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setValue('');
  };

  return (
    <div className="input-bar">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Try: Run tests for SSPLAN-714 and write to Confluence"
        disabled={disabled}
      />
      <button type="button" onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  );
}
