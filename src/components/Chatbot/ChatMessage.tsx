import type { ChatMessage as ChatMessageType } from '../../types/chatbot';
import { User, Sigma } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-primary/20 text-primary'
            : 'bg-accent/20 text-accent'
        }`}
      >
        {isUser ? <User size={14} /> : <Sigma size={14} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary/15 text-foreground rounded-tr-sm'
            : 'bg-surface-elevated text-foreground border border-border rounded-tl-sm'
        }`}
      >
        <div
          className="whitespace-pre-wrap [&_strong]:text-accent [&_code]:font-mono [&_code]:text-accent [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
          dangerouslySetInnerHTML={{
            __html: formatContent(message.content),
          }}
        />
      </div>
    </div>
  );
}

function formatContent(content: string): string {
  // Bold: **text**
  let html = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Inline code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}