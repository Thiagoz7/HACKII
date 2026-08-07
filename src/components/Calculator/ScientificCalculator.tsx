import { useState, useCallback, useEffect, useRef } from 'react';
import { Delete, CornerDownLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { create, all } from 'mathjs';

const math = create(all);

interface ScientificCalculatorProps {
  onInsertExpression?: (expr: string) => void;
  onEvaluate?: (expr: string) => void;
  onAdvancedCommand?: (command: string) => void;
}

type ButtonDef = {
  label: string;
  value: string;
  type: 'number' | 'operator' | 'function' | 'variable' | 'action' | 'advanced';
  span?: number;
};

// ── Advanced operations row ──
const ADVANCED_BUTTONS: ButtonDef[][] = [
  [
    { label: 'd/dx', value: 'derivative', type: 'advanced' },
    { label: '∫dx', value: 'integral', type: 'advanced' },
    { label: 'lim', value: 'limit', type: 'advanced' },
    { label: 'Σ', value: 'series', type: 'advanced' },
    { label: '∞', value: 'Infinity', type: 'variable' },
  ],
  [
    { label: 'd²/dx²', value: 'second_derivative', type: 'advanced' },
    { label: '∫ₐᵇ', value: 'definite_integral', type: 'advanced' },
    { label: 'solve', value: 'solve', type: 'advanced' },
    { label: 'simplify', value: 'simplify', type: 'advanced' },
    { label: 'expand', value: 'expand', type: 'advanced' },
  ],
];

// ── Standard buttons ──
const STANDARD_BUTTONS: ButtonDef[][] = [
  [
    { label: 'sin', value: 'sin(', type: 'function' },
    { label: 'cos', value: 'cos(', type: 'function' },
    { label: 'tan', value: 'tan(', type: 'function' },
    { label: 'log', value: 'log(', type: 'function' },
    { label: 'ln', value: 'ln(', type: 'function' },
  ],
  [
    { label: 'exp', value: 'exp(', type: 'function' },
    { label: '√', value: 'sqrt(', type: 'function' },
    { label: 'x²', value: '^2', type: 'operator' },
    { label: 'xⁿ', value: '^', type: 'operator' },
    { label: 'π', value: 'pi', type: 'variable' },
  ],
  [
    { label: 'x', value: 'x', type: 'variable' },
    { label: 'y', value: 'y', type: 'variable' },
    { label: '(', value: '(', type: 'operator' },
    { label: ')', value: ')', type: 'operator' },
    { label: 'e', value: 'e', type: 'variable' },
  ],
  [
    { label: '7', value: '7', type: 'number' },
    { label: '8', value: '8', type: 'number' },
    { label: '9', value: '9', type: 'number' },
    { label: '÷', value: '/', type: 'operator' },
    { label: '⌫', value: 'backspace', type: 'action' },
  ],
  [
    { label: '4', value: '4', type: 'number' },
    { label: '5', value: '5', type: 'number' },
    { label: '6', value: '6', type: 'number' },
    { label: '×', value: '*', type: 'operator' },
    { label: 'C', value: 'clear', type: 'action' },
  ],
  [
    { label: '1', value: '1', type: 'number' },
    { label: '2', value: '2', type: 'number' },
    { label: '3', value: '3', type: 'number' },
    { label: '−', value: '-', type: 'operator' },
    { label: '|x|', value: 'abs(', type: 'function' },
  ],
  [
    { label: '0', value: '0', type: 'number' },
    { label: '.', value: '.', type: 'number' },
    { label: '±', value: 'negate', type: 'action' },
    { label: '+', value: '+', type: 'operator' },
    { label: '=', value: 'enter', type: 'action' },
  ],
];

export function ScientificCalculator({ onInsertExpression, onEvaluate, onAdvancedCommand }: ScientificCalculatorProps) {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Advanced operation execution ──
  const executeAdvanced = useCallback((operation: string) => {
    const expr = expression.trim();
    if (!expr && operation !== 'solve') return;

    let command = '';
    switch (operation) {
      case 'derivative':
        command = `differentiate ${expr}`;
        break;
      case 'second_derivative':
        command = `second derivative of ${expr}`;
        break;
      case 'integral':
        command = `integrate ${expr}`;
        break;
      case 'definite_integral':
        command = `integrate ${expr} from 0 to pi`;
        break;
      case 'limit':
        command = `limit of ${expr} as x approaches 0`;
        break;
      case 'series':
        command = `expand ${expr} into Taylor series`;
        break;
      case 'solve':
        command = `solve ${expr} = 0`;
        break;
      case 'simplify':
        // Inline simplification
        try {
          const simplified = math.simplify(expr.replace(/(\d)([a-zA-Z])/g, '$1*$2')).toString();
          setResult(simplified);
          return;
        } catch {
          setResult('Cannot simplify');
          return;
        }
      case 'expand':
        command = `expand ${expr} into Taylor series`;
        break;
      default:
        return;
    }

    // Send to chatbot for processing
    onAdvancedCommand?.(command);
    setResult(`→ ${operation}`);
  }, [expression, onAdvancedCommand]);

  const handleButtonClick = useCallback((btn: ButtonDef) => {
    if (btn.type === 'advanced') {
      executeAdvanced(btn.value);
      return;
    }

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
  }, [expression, onEvaluate, onInsertExpression, executeAdvanced]);

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
    const base = 'flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer select-none';
    switch (btn.type) {
      case 'advanced':
        return `${base} bg-gradient-to-b from-accent/20 to-accent/10 text-accent hover:from-accent/30 hover:to-accent/20 border border-accent/25 font-semibold`;
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
      <div className="p-2 border-b border-border">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={expression}
            onChange={(e) => { setExpression(e.target.value); setResult(null); }}
            placeholder="Enter expression..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            aria-label="Calculator expression"
          />
          {result && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-accent font-mono truncate max-w-[120px]">
              {result}
            </div>
          )}
        </div>
      </div>

      {/* Advanced toggle + buttons */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowAdvanced(prev => !prev)}
          className="w-full flex items-center justify-between px-3 py-1 text-[10px] text-muted hover:text-foreground uppercase tracking-wide font-medium cursor-pointer transition-colors"
        >
          <span>Calculus</span>
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdvanced && (
          <div className="px-2 pb-2 grid gap-1">
            {ADVANCED_BUTTONS.map((row, rowIdx) => (
              <div key={`adv-${rowIdx}`} className="grid grid-cols-5 gap-1">
                {row.map((btn, btnIdx) => (
                  <button
                    key={`adv-${rowIdx}-${btnIdx}`}
                    onClick={() => handleButtonClick(btn)}
                    className={`h-7 ${getButtonClass(btn)}`}
                    aria-label={btn.label}
                    title={getAdvancedTooltip(btn.value)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standard button grid */}
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="grid gap-1">
          {STANDARD_BUTTONS.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-5 gap-1">
              {row.map((btn, btnIdx) => (
                <button
                  key={btnIdx}
                  onClick={() => handleButtonClick(btn)}
                  className={`h-8 ${getButtonClass(btn)}`}
                  style={btn.span ? { gridColumn: `span ${btn.span}` } : undefined}
                  aria-label={btn.label}
                >
                  {btn.value === 'backspace' ? <Delete size={14} /> :
                   btn.value === 'enter' ? <CornerDownLeft size={14} /> :
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

function getAdvancedTooltip(value: string): string {
  switch (value) {
    case 'derivative': return 'First derivative d/dx';
    case 'second_derivative': return 'Second derivative d²/dx²';
    case 'integral': return 'Indefinite integral';
    case 'definite_integral': return 'Definite integral (0 to π)';
    case 'limit': return 'Limit as x→0';
    case 'series': return 'Taylor series expansion';
    case 'solve': return 'Solve equation = 0';
    case 'simplify': return 'Simplify expression';
    case 'expand': return 'Expand/series';
    default: return value;
  }
}
