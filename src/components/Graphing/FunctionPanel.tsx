import { useState, useCallback, useRef, useEffect } from 'react';
import type { FunctionPlot, CoordinateSystem } from '../../types/graph';
import { DEFAULT_COLORS } from '../../types/graph';
import { validateExpression } from '../../lib/function-parser';
import { Plus, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface FunctionPanelProps {
  plots: FunctionPlot[];
  onAdd: (plot: FunctionPlot) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onChangeSystem: (id: string, system: CoordinateSystem) => void;
}

const COORDINATE_SYSTEMS: { value: CoordinateSystem; label: string }[] = [
  { value: 'cartesian', label: 'y = f(x)' },
  { value: 'polar', label: 'r = f(θ)' },
  { value: 'absolute', label: 'Absolute' },
  { value: 'relative', label: 'Relative' },
];

export function FunctionPanel({
  plots,
  onAdd,
  onRemove,
  onToggle,
  onChangeColor,
  onChangeSystem,
}: FunctionPanelProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [colorIndex, setColorIndex] = useState(0);
  const [system] = useState<CoordinateSystem>('cartesian');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [showSystemDropdown, setShowSystemDropdown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const validation = validateExpression(trimmed);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid expression');
      return;
    }

    const color = DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length];
    const newPlot: FunctionPlot = {
      id: crypto.randomUUID(),
      expression: trimmed,
      color,
      coordinateSystem: system,
      visible: true,
      lineWidth: 2.5,
    };

    onAdd(newPlot);
    setInput('');
    setError(null);
    setColorIndex((prev) => (prev + 1) % DEFAULT_COLORS.length);
    inputRef.current?.focus();
  }, [input, colorIndex, system, onAdd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = () => {
      setShowColorPicker(null);
      setShowSystemDropdown(null);
    };
    if (showColorPicker || showSystemDropdown) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showColorPicker, showSystemDropdown]);

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="p-3 border-b border-white/10">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="f(x) = ..."
              className={`
                w-full bg-white/5 border rounded-lg px-3 py-2 text-sm
                text-text-primary placeholder:text-text-muted
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                ${error ? 'border-red-500/50' : 'border-white/10'}
              `}
              aria-label="Function expression"
              aria-invalid={!!error}
              aria-describedby={error ? 'fn-error' : undefined}
            />
            {error && (
              <p id="fn-error" className="text-xs text-red-400 mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="
              flex items-center justify-center w-9 h-9 rounded-lg
              bg-primary text-white
              transition-all duration-150 ease-out
              hover:bg-primary-hover active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-2 focus-visible:outline-primary
            "
            aria-label="Add function"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Function list */}
      <div className="flex-1 overflow-y-auto">
        {plots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Plus size={24} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary font-medium mb-1">No functions yet</p>
            <p className="text-xs text-text-muted max-w-[200px]">
              Type an expression above and press Enter to plot it on the graph
            </p>
          </div>
        ) : (
          <ul className="p-2 space-y-1" role="list">
            {plots.map((plot) => (
              <li
                key={plot.id}
                className={`
                  group flex items-center gap-2 px-3 py-2 rounded-lg
                  transition-colors duration-150
                  hover:bg-white/5
                  ${!plot.visible ? 'opacity-50' : ''}
                `}
              >
                {/* Color dot */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(showColorPicker === plot.id ? null : plot.id);
                      setShowSystemDropdown(null);
                    }}
                    className="w-4 h-4 rounded-full border-2 border-white/20 transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: plot.color }}
                    aria-label="Change color"
                  />
                  {showColorPicker === plot.id && (
                    <div
                      className="absolute top-6 left-0 z-20 bg-surface border border-white/10 rounded-lg p-2 shadow-xl grid grid-cols-4 gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {DEFAULT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => { onChangeColor(plot.id, c); setShowColorPicker(null); }}
                          className={`
                            w-6 h-6 rounded-full transition-transform hover:scale-110 active:scale-95
                            ${c === plot.color ? 'ring-2 ring-white ring-offset-1 ring-offset-surface' : ''}
                          `}
                          style={{ backgroundColor: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Expression */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-mono truncate">
                    {plot.expression}
                  </p>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSystemDropdown(showSystemDropdown === plot.id ? null : plot.id);
                        setShowColorPicker(null);
                      }}
                      className="text-[10px] text-text-muted flex items-center gap-0.5 hover:text-text-secondary transition-colors"
                    >
                      {COORDINATE_SYSTEMS.find((s) => s.value === plot.coordinateSystem)?.label}
                      <ChevronDown size={10} />
                    </button>
                    {showSystemDropdown === plot.id && (
                      <div
                        className="absolute top-5 left-0 z-20 bg-surface border border-white/10 rounded-lg py-1 shadow-xl min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {COORDINATE_SYSTEMS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => { onChangeSystem(plot.id, s.value); setShowSystemDropdown(null); }}
                            className={`
                              w-full text-left px-3 py-1.5 text-xs transition-colors
                              hover:bg-white/10
                              ${s.value === plot.coordinateSystem ? 'text-primary' : 'text-text-secondary'}
                            `}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => onToggle(plot.id)}
                  className="
                    p-1.5 rounded-lg text-text-muted
                    transition-all duration-150
                    hover:text-text-primary hover:bg-white/10
                    active:scale-95
                    focus-visible:outline-2 focus-visible:outline-primary
                  "
                  aria-label={plot.visible ? 'Hide function' : 'Show function'}
                >
                  {plot.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Remove */}
                <button
                  onClick={() => onRemove(plot.id)}
                  className="
                    p-1.5 rounded-lg text-text-muted
                    opacity-0 group-hover:opacity-100
                    transition-all duration-150
                    hover:text-red-400 hover:bg-red-400/10
                    active:scale-95
                    focus-visible:outline-2 focus-visible:outline-primary focus-visible:opacity-100
                  "
                  aria-label="Remove function"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}