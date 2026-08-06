import { useState, useCallback, useEffect, useRef } from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';

interface ScientificCalculatorProps {
  onInsertExpression?: (expr: string) => void;
  onEvaluate?: (expr: string) => void;
}

type ButtonDef = {
  label: string;
  value: string;
  type: 'number' | 'operator' | 'function' | 'variable' | 'action';
  span?: number;
};

const BUTTONS: ButtonDef[][] = [
  // Row 1: Scientific functions
  [
    { label: 'sin', value: 'sin(', type: 'function' },
    { label: 'cos', value: 'cos(', type: 'function' },
    { label: 'tan', value: 'tan(', type: 'function' },
    { label: 'log', value: 'log(', type: 'function' },
    { label: 'ln', value: 'ln(', type: 'function' },
  ],
  // Row 2: More functions
  [
    { label: 'exp', value: 'exp(', type: 'function' },
    { label: '√', value: 'sqrt(', type: 'function' },
    { label: 'x²', value: '^2', type: 'operator' },
    { label: 'xⁿ', value: '^', type: 'operator' },
    { label: 'π', value: 'pi', type: 'variable' },
  ],
  // Row 3: Variables and parens
  [
    { label: 'x', value: 'x', type: 'variable' },
    { label: 'y', value: 'y', type: 'variable' },
    { label: '(', value: '(', type: 'operator' },
    { label: ')', value: ')', type: 'operator' },
    { label: 'e', value: 'e', type: 'variable' },
  ],
  // Row 4: Numbers top
  [
    { label: '7', value: '7', type: 'number' },
    { label: '8', value: '8', type: 'number' },
    { label: '9', value: '9', type: 'number' },
    { label: '÷', value: '/', type: 'operator' },
    { label: '⌫', value: 'backspace', type: 'action' },
  ],
  // Row 5: Numbers mid
  [
    { label: '4', value: '4', type: 'number' },
    { label: '5', value: '5', type: 'number' },
    { label: '6', value: '6', type: 'number' },
    { label: '×', value: '*', type: 'operator' },
    { label: 'C', value: 'clear', type: 'action' },
  ],
  // Row 6: Numbers low
  [
    { label: '1', value: '1', type: 'number' },
    { label: '2', value: '2', type: 'number' },
    { label: '3', value: '3', type: 'number' },
    { label: '−', value: '-', type: 'operator' },
    { label: '|x|', value: 'abs(', type: 'function' },
  ],
  // Row 7: Zero and enter
  [
    { label: '0', value: '0', type: 'number' },
    { label: '.', value: '.', type: 'number' },
    { label: '±', value: 'negate', type: 'action' },
    { label: '+', value: '+', type: 'operator' },
    { label: '=', value: 'enter', type: 'action' },
  ],
];

export function ScientificCalculator({ onInsertExpression, onEvaluate }: ScientificCalculatorProps) {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = useCallback((btn: ButtonDef) => {
    if (btn.type === 'action') {
      switch (btn.value) {
        case 'clear':
          setExpression('');
          setResult(null);
          break;
        case 'backspace':
          setExpression(prev => prev.slice(0, -1));
          setResult(null);
          break;
        case 'negate':
          setExpression(prev => {
            if (prev.startsWith('-')) return prev.slice(1);
            return '-' + prev;
          });
          break;
        case 'enter':
          if (expression.trim()) {
            onEvaluate?.(expression);
            onInsertExpression?.(expression);
          }
          break;
      }
    } else {
      setExpression(prev => prev + btn.value);
      setResult(null);
    }
  }, [expression, onEvaluate, onInsertExpression]);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement !== inputRef.current) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (expression.trim()) {
          onEvaluate?.(expression);
          onInsertExpression?.(expression);
        }
      } else if (e.key === 'Escape') {
        setExpression('');
        setResult(null);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expression, onEvaluate, onInsertExpression]);

  const getButtonClass = (btn: ButtonDef): string => {
    const base = 'flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer select-none';
    switch (btn.type) {
      case 'function':
        return `${base} bg-accent/15 text-accent hover:bg-accent/25 border border-accent/20`;
      case 'variable':
        return `${base} bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20`;
      case 'operator':
        return `${base} bg-surface-elevated text-foreground hover:bg-white/10 border border-border`;
      case 'action':
        if (btn.value === 'enter') return `${base} bg-primary text-white hover:bg-primary-hover`;
        if (btn.value === 'clear') return `${base} bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20`;
        return `${base} bg-surface-elevated text-foreground hover:bg-white/10 border border-border`;
      default:
        return `${base} bg-surface text-foreground hover:bg-white/10 border border-border`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Display */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={expression}
            onChange={(e) => { setExpression(e.target.value); setResult(null); }}
            placeholder="Enter expression..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            aria-label="Calculator expression"
          />
          {result && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent font-mono">
              = {result}
            </div>
          )}
        </div>
      </div>

      {/* Button grid */}
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="grid gap-1.5">
          {BUTTONS.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-5 gap-1.5">
              {row.map((btn, btnIdx) => (
                <button
                  key={btnIdx}
                  onClick={() => handleButtonClick(btn)}
                  className={`h-9 ${getButtonClass(btn)}`}
                  style={btn.span ? { gridColumn: `span ${btn.span}` } : undefined}
                  aria-label={btn.label}
                >
                  {btn.value === 'backspace' ? <Delete size={16} /> :
                   btn.value === 'enter' ? <CornerDownLeft size={16} /> :
                   btn.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
