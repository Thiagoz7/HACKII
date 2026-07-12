import { useCallback } from 'react';
import type { Viewport } from '../../types/graph';
import { ZoomIn, ZoomOut, Maximize, Grid3X3, Crosshair, Baseline } from 'lucide-react';

interface GraphToolbarProps {
  viewport: Viewport;
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  onViewportChange: (v: Partial<Viewport>) => void;
  onToggleGrid: () => void;
  onToggleAxes: () => void;
  onToggleLabels: () => void;
}

export function GraphToolbar({
  viewport,
  showGrid,
  showAxes,
  showLabels,
  onViewportChange,
  onToggleGrid,
  onToggleAxes,
  onToggleLabels,
}: GraphToolbarProps) {
  const handleZoomIn = useCallback(() => {
    onViewportChange({ scale: viewport.scale * 1.5 });
  }, [viewport.scale, onViewportChange]);

  const handleZoomOut = useCallback(() => {
    onViewportChange({ scale: Math.max(1, viewport.scale / 1.5) });
  }, [viewport.scale, onViewportChange]);

  const handleReset = useCallback(() => {
    onViewportChange({ centerX: 0, centerY: 0, scale: 50 });
  }, [onViewportChange]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface/90 backdrop-blur-md border border-white/10 rounded-xl px-2 py-1.5 shadow-lg">
      <ToolbarButton onClick={handleZoomOut} label="Zoom out" shortcut="−">
        <ZoomOut size={16} />
      </ToolbarButton>

      <span className="text-xs text-text-secondary font-mono px-2 min-w-[60px] text-center select-none">
        {viewport.scale.toFixed(0)}%
      </span>

      <ToolbarButton onClick={handleZoomIn} label="Zoom in" shortcut="+">
        <ZoomIn size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 mx-1" />

      <ToolbarButton onClick={handleReset} label="Reset view" active={false}>
        <Maximize size={14} />
      </ToolbarButton>

      <div className="w-px h-5 bg-white/10 mx-1" />

      <ToolbarButton onClick={onToggleGrid} label="Toggle grid" active={showGrid}>
        <Grid3X3 size={14} />
      </ToolbarButton>

      <ToolbarButton onClick={onToggleAxes} label="Toggle axes" active={showAxes}>
        <Crosshair size={14} />
      </ToolbarButton>

      <ToolbarButton onClick={onToggleLabels} label="Toggle axis labels" active={showLabels}>
        <Baseline size={14} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
  active,
  shortcut,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        relative flex items-center justify-center w-8 h-8 rounded-lg
        transition-all duration-150 ease-out
        hover:bg-white/10 active:scale-95
        focus-visible:outline-2 focus-visible:outline-primary
        ${active ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text-primary'}
      `}
    >
      {children}
      {shortcut && (
        <span className="absolute -top-1 -right-1 text-[9px] text-text-muted bg-surface px-1 rounded">
          {shortcut}
        </span>
      )}
    </button>
  );
}