import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Minimize2, Maximize2, X } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chatbot';
import { processMessage } from '../../lib/chatbot-engine';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { FunctionPlot, CoordinateSystem } from '../../types/graph';
import { DEFAULT_COLORS } from '../../types/graph';
import type { MechanicalPart } from '../../lib/mechanical-parts';

interface ChatPanelProps {
  onAddPlot?: (plot: FunctionPlot) => void;
  onAddMechanicalPart?: (part: MechanicalPart) => void;
  onViewportChange?: (changes: { centerX?: number; centerY?: number; scale?: number }) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ChatPanel({ onAddPlot, onAddMechanicalPart, onViewportChange }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const colorIndexRef = useRef(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    (content: string) => {
      const userMsg: ChatMessageType = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // Simulate a tiny delay for natural feel
      setTimeout(() => {
        const response = processMessage(content);

        // Handle actions
        if (response.action.type === 'plot' && response.action.expression && onAddPlot) {
          const color = DEFAULT_COLORS[colorIndexRef.current % DEFAULT_COLORS.length];
          colorIndexRef.current += 1;
          onAddPlot({
            id: `chatbot-${generateId()}`,
            expression: response.action.expression,
            color,
            coordinateSystem: (response.action.system ?? 'cartesian') as CoordinateSystem,
            visible: true,
            lineWidth: 2,
          });
        }

        if (response.action.type === 'multi_plot' && response.action.expressions && onAddPlot) {
          const expressions = response.action.expressions;
          const system = (response.action.system ?? 'cartesian') as CoordinateSystem;
          expressions.forEach((expr) => {
            const color = DEFAULT_COLORS[colorIndexRef.current % DEFAULT_COLORS.length];
            colorIndexRef.current += 1;
            onAddPlot({
              id: `chatbot-${generateId()}`,
              expression: expr,
              color,
              coordinateSystem: system,
              visible: true,
              lineWidth: 2,
            });
          });
        }

        if (response.action.type === 'draw' && response.action.drawing) {
          // Drawing plans are currently informational — could be extended to render shapes
          // For now, they're handled entirely in the message text
        }

        if (response.action.type === 'mechanical_draw' && response.action.mechanicalPart && onAddMechanicalPart) {
          onAddMechanicalPart(response.action.mechanicalPart);
        }

        if (response.action.type === 'viewport' && onViewportChange) {
          onViewportChange({
            centerX: response.action.centerX,
            centerY: response.action.centerY,
            scale: response.action.scale,
          });
        }

        const botMsg: ChatMessageType = {
          id: generateId(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          action: response.action,
        };

        setMessages((prev) => [...prev, botMsg]);
        setIsProcessing(false);
      }, 300 + Math.random() * 400);
    },
    [onAddPlot, onAddMechanicalPart, onViewportChange]
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen]);

  const handleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <>
      {/* Toggle button — always visible when closed */}
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-elevated border border-border text-foreground hover:border-primary hover:text-primary shadow-lg transition-all duration-200 cursor-pointer active:scale-95"
          aria-label="Open chat assistant"
        >
          <MessageSquare size={16} />
          <span className="text-sm font-medium">Assistant</span>
        </button>
      )}

      {/* Chat panel */}
      <div
        className={`absolute right-0 z-20 flex flex-col bg-surface border-l border-t border-border shadow-xl transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        } ${
          isExpanded
            ? 'bottom-0 top-0 w-96'
            : 'bottom-0 h-[420px] w-80'
        }`}
        style={{ borderTopLeftRadius: '12px' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border"
          style={{ borderTopLeftRadius: '12px' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <MessageSquare size={12} className="text-accent" />
            </div>
            <span className="text-sm font-medium text-foreground">Andrómeda Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExpand}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-elevated text-muted hover:text-foreground transition-colors duration-150 cursor-pointer"
              aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleToggle}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-elevated text-muted hover:text-foreground transition-colors duration-150 cursor-pointer"
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <MessageSquare size={22} className="text-accent" />
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Hi! I'm your Andrómeda assistant. I can plot functions, calculate expressions, find derivatives &amp; integrals, analyze functions, find intersections, solve equations, and draw shapes.
              </p>
              <p className="text-xs text-muted/70 mt-2">
                Try "plot sin(x)" or "analyze x^2" or "intersect x^2 and x+1"
              </p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {/* Typing indicator */}
          {isProcessing && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <MessageSquare size={14} className="text-accent" />
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg rounded-tl-sm px-3 py-2">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isProcessing} />
      </div>
    </>
  );
}