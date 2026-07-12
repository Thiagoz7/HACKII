import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background">
      <label htmlFor="chat-input" className="sr-only">
        Type a message
      </label>
      <input
        ref={inputRef}
        id="chat-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask me anything — calculate, plot, explain..."
        className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-md text-foreground placeholder:text-muted font-sans focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors duration-150 disabled:opacity-50"
        autoComplete="off"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-primary text-on-primary hover:bg-primary/90 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        aria-label="Send message"
      >
        {disabled ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Send size={14} />
        )}
      </button>
    </div>
  );
}