import type { ChatMessage as ChatMessageType } from '../../types/chatbot';
import { User } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  nablaTheme?: boolean;
}

export function ChatMessage({ message, nablaTheme = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-200 relative z-10`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-primary/20 text-primary'
            : 'bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/10'
        }`}
      >
        {isUser ? <User size={14} /> : <span className="text-xs font-bold font-mono text-accent">∇</span>}
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
            __html: formatContent(message.content, nablaTheme),
          }}
        />
      </div>
    </div>
  );
}

function formatContent(content: string, nablaTheme: boolean): string {
  // Bold: **text**
  let html = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Inline code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  if (nablaTheme) {
    // Highlight vector calculus terms with accent color
    html = html.replace(
      /\b(∇f|∇·F|∇×F|gradient|divergence|curl|nabla|laplacian|∇²|∇)\b/gi,
      '<span class="text-accent font-semibold font-mono">$1</span>'
    );
    // Highlight partial derivative symbols
    html = html.replace(
      /(∂\/∂[a-z]|∂[a-z]\/∂[a-z])/g,
      '<span class="text-accent font-mono">$1</span>'
    );
    // Highlight integral symbols
    html = html.replace(
      /(∫[^∫]{0,30}d[a-z])/g,
      '<span class="text-primary font-mono">$1</span>'
    );
  }

  return html;
}
