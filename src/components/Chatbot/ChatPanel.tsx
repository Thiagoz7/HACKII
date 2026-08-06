import { useState, useCallback, useRef, useEffect } from 'react';
import { Minimize2, Maximize2, X, Sparkles } from 'lucide-react';
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
  onEditMechanicalPart?: (targetType: string | undefined, updates: Record<string, number>) => void;
  onDeleteMechanicalPart?: (targetType: string | undefined, deleteWhole: boolean, resetParams: string[]) => void;
  onViewportChange?: (changes: { centerX?: number; centerY?: number; scale?: number }) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Quick-access nabla operation buttons
const NABLA_BUTTONS = [
  { label: '∇f', value: 'gradient of ', tooltip: 'Gradient' },
  { label: '∇·F', value: 'divergence of ', tooltip: 'Divergence' },
  { label: '∇×F', value: 'curl of ', tooltip: 'Curl' },
  { label: '∂/∂x', value: 'partial derivative with respect to x of ', tooltip: 'Partial ∂x' },
  { label: '∫dx', value: 'integrate ', tooltip: 'Integrate' },
  { label: 'lim', value: 'limit of ', tooltip: 'Limit' },
];

export function ChatPanel({ onAddPlot, onAddMechanicalPart, onEditMechanicalPart, onDeleteMechanicalPart, onViewportChange }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nablaTheme, setNablaTheme] = useState(true);
  const [quickInput, setQuickInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const colorIndexRef = useRef(0);

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
      setQuickInput('');

      setTimeout(() => {
        const response = processMessage(content);

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
          // handled in message
        }

        if (response.action.type === 'mechanical_draw' && response.action.mechanicalPart && onAddMechanicalPart) {
          onAddMechanicalPart(response.action.mechanicalPart);
        }

        if (response.action.type === 'edit_part' && response.action.editUpdates && onEditMechanicalPart) {
          onEditMechanicalPart(response.action.targetPartType, response.action.editUpdates);
        }

        if (response.action.type === 'delete_part' && onDeleteMechanicalPart) {
          onDeleteMechanicalPart(
            response.action.targetPartType,
            response.action.deleteWholePart ?? false,
            response.action.resetParams ?? []
          );
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
    [onAddPlot, onAddMechanicalPart, onEditMechanicalPart, onDeleteMechanicalPart, onViewportChange]
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  const handleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleNablaButton = useCallback((value: string) => {
    setQuickInput(prev => prev + value);
  }, []);

  return (
    <>
      {/* Toggle button — nabla themed */}
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-elevated border border-border text-foreground hover:border-accent hover:text-accent shadow-lg transition-all duration-200 cursor-pointer active:scale-95 group"
          aria-label="Open chat assistant"
        >
          <span className="text-lg font-bold font-mono group-hover:scale-110 transition-transform">∇</span>
          <span className="text-sm font-medium">Andrómeda</span>
        </button>
      )}

      {/* Chat panel */}
      <div
        className={`absolute right-0 z-20 flex flex-col bg-surface border-l border-t border-border shadow-xl transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        } ${
          isExpanded ? 'bottom-0 top-0 w-96' : 'bottom-0 h-[520px] w-80'
        }`}
        style={{ borderTopLeftRadius: '12px' }}
      >
        {/* Header — nabla themed */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border relative overflow-hidden"
          style={{ borderTopLeftRadius: '12px' }}
        >
          {/* Subtle grid background for header */}
          {nablaTheme && (
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '12px 12px',
              }}
            />
          )}

          <div className="flex items-center gap-2 relative z-10">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center border border-accent/20">
              <span className="text-sm font-bold font-mono text-accent">∇</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">Andrómeda</span>
              <span className="text-[10px] text-muted leading-tight">Vector Calculus Engine</span>
            </div>
          </div>
          <div className="flex items-center gap-1 relative z-10">
            {/* Nabla theme toggle */}
            <button
              onClick={() => setNablaTheme(prev => !prev)}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs font-mono transition-colors duration-150 cursor-pointer ${
                nablaTheme ? 'bg-accent/20 text-accent' : 'text-muted hover:text-foreground hover:bg-surface-elevated'
              }`}
              aria-label={nablaTheme ? 'Disable nabla theme' : 'Enable nabla theme'}
              title={nablaTheme ? 'Disable math styling' : 'Enable math styling'}
            >
              ∇
            </button>
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

        {/* Quick-access nabla operation buttons */}
        {nablaTheme && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background/50 overflow-x-auto">
            {NABLA_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleNablaButton(btn.value)}
                className="flex-shrink-0 px-2 py-1 rounded text-[11px] font-mono font-medium bg-accent/10 text-accent hover:bg-accent/20 border border-accent/15 transition-colors duration-150 cursor-pointer active:scale-95"
                title={btn.tooltip}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 relative">
          {/* Nabla watermark background */}
          {nablaTheme && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03]">
              <span className="text-[200px] font-mono font-bold select-none">∇</span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/15 to-primary/15 flex items-center justify-center mb-3 border border-accent/10">
                <span className="text-2xl font-bold font-mono text-accent">∇</span>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Andrómeda Assistant</p>
              <p className="text-xs text-muted leading-relaxed max-w-[240px]">
                Your vector calculus &amp; engineering companion. Plot functions, compute derivatives, integrals, limits, and draw mechanical parts.
              </p>
              {nablaTheme && (
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-accent/10 text-accent border border-accent/10">∇f gradient</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-primary/10 text-primary border border-primary/10">∇·F divergence</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-accent/10 text-accent border border-accent/10">∇×F curl</span>
                </div>
              )}
              <p className="text-[10px] text-muted/60 mt-3">
                Try "plot sin(x)" · "derivative of x^3" · "draw a gear"
              </p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} nablaTheme={nablaTheme} />)
          )}

          {/* Typing indicator */}
          {isProcessing && (
            <div className="flex gap-3 relative z-10">
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center border border-accent/10">
                <span className="text-xs font-bold font-mono text-accent">∇</span>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg rounded-tl-sm px-3 py-2">
                <div className="flex gap-1.5 items-center">
                  <Sparkles size={10} className="text-accent animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input with quick-input preview */}
        <ChatInput
          onSend={handleSend}
          disabled={isProcessing}
          prefill={quickInput}
          onPrefillConsumed={() => setQuickInput('')}
        />
      </div>
    </>
  );
}
