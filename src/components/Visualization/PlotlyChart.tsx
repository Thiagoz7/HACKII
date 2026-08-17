import { useEffect, useRef } from 'react';
import type { PlotlyConfig } from '../../lib/visualization-engine';

interface PlotlyChartProps {
  config: PlotlyConfig;
  onClose?: () => void;
}

export function PlotlyChart({ config, onClose }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import Plotly to avoid bundling issues
    import('plotly.js-dist-min').then((Plotly) => {
      if (!containerRef.current) return;

      const layout = {
        ...config.layout,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(26,26,46,0.95)',
        font: { color: '#e0e7ff', family: 'Inter, sans-serif' },
        margin: { t: 40, r: 20, b: 40, l: 50 },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight - 40,
      };

      Plotly.newPlot(containerRef.current, config.data, layout, {
        responsive: true,
        displayModeBar: true,
      });
    });

    return () => {
      if (containerRef.current) {
        import('plotly.js-dist-min').then((Plotly) => {
          if (containerRef.current) Plotly.purge(containerRef.current);
        });
      }
    };
  }, [config]);

  return (
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">
          📊 {(config.layout.title as string) ?? 'Plotly Visualization'}
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs rounded bg-surface-elevated text-muted hover:text-foreground border border-border cursor-pointer"
        >
          Close
        </button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
