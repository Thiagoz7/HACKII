import { useState, useCallback, useEffect, useRef } from "react";
import type { FunctionPlot, Viewport, GraphConfig, CoordinateSystem } from "./types/graph";
import { DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG } from "./types/graph";
import { GraphCanvas } from "./components/Graphing/GraphCanvas";
import { FunctionPanel } from "./components/Graphing/FunctionPanel";
import { GraphToolbar } from "./components/Graphing/GraphToolbar";
import { ChatPanel } from "./components/Chatbot/ChatPanel";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plots, setPlots] = useState<FunctionPlot[]>([]);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);

  // Keep viewport dimensions in sync with the canvas container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewport((prev) => ({
            ...prev,
            width: Math.round(width),
            height: Math.round(height),
          }));
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Plot management ──────────────────────────────────────────

  const handleAddPlot = useCallback((plot: FunctionPlot) => {
    setPlots((prev) => [...prev, plot]);
  }, []);

  const handleRemovePlot = useCallback((id: string) => {
    setPlots((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleTogglePlot = useCallback((id: string) => {
    setPlots((prev) =>
      prev.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p))
    );
  }, []);

  const handleChangeColor = useCallback((id: string, color: string) => {
    setPlots((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color } : p))
    );
  }, []);

  const handleChangeSystem = useCallback(
    (id: string, system: CoordinateSystem) => {
      setPlots((prev) =>
        prev.map((p) => (p.id === id ? { ...p, coordinateSystem: system } : p))
      );
    },
    []
  );

  // ── Viewport ─────────────────────────────────────────────────

  const handleViewportChange = useCallback((changes: Partial<Viewport>) => {
    setViewport((prev) => ({ ...prev, ...changes }));
  }, []);

  // ── Config toggles ───────────────────────────────────────────

  const handleToggleGrid = useCallback(() => {
    setConfig((prev) => ({ ...prev, showGrid: !prev.showGrid }));
  }, []);

  const handleToggleAxes = useCallback(() => {
    setConfig((prev) => ({ ...prev, showAxes: !prev.showAxes }));
  }, []);

  const handleToggleLabels = useCallback(() => {
    setConfig((prev) => ({ ...prev, showLabels: !prev.showLabels }));
  }, []);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left sidebar — function management */}
      <FunctionPanel
        plots={plots}
        onAdd={handleAddPlot}
        onRemove={handleRemovePlot}
        onToggle={handleTogglePlot}
        onChangeColor={handleChangeColor}
        onChangeSystem={handleChangeSystem}
      />

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative">
        <GraphCanvas
          viewport={viewport}
          plots={plots}
          config={config}
          onViewportChange={handleViewportChange}
        />

        {/* Floating toolbar */}
        <GraphToolbar
          viewport={viewport}
          showGrid={config.showGrid}
          showAxes={config.showAxes}
          showLabels={config.showLabels}
          onViewportChange={handleViewportChange}
          onToggleGrid={handleToggleGrid}
          onToggleAxes={handleToggleAxes}
          onToggleLabels={handleToggleLabels}
        />

        {/* Chatbot assistant */}
        <ChatPanel
          onAddPlot={handleAddPlot}
          onViewportChange={handleViewportChange}
        />
      </div>
    </div>
  );
}