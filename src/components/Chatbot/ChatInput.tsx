import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export function ChatInput({ onSend, disabled, prefill, onPrefillConsumed }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle prefill from quick-access buttons
  useEffect(() => {
    if (prefill) {
      setValue(prev => prev + prefill);
      onPrefillConsumed?.();
      inputRef.current?.focus();
    }
  }, [prefill, onPrefillConsumed]);

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
        placeholder="Ask ∇ — calculate, plot, analyze..."
        className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-md text-foreground placeholder:text-muted font-sans focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors duration-150 disabled:opacity-50"
        autoComplete="off"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-accent text-background hover:bg-accent/90 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
