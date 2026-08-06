import { useState, useCallback, useEffect, useRef } from "react";
import type { FunctionPlot, Viewport, GraphConfig, CoordinateSystem } from "./types/graph";
import { DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG, DEFAULT_COLORS } from "./types/graph";
import type { MechanicalPart } from "./lib/mechanical-parts";
import { editPart, resetPartParams } from "./lib/mechanical-parts";
import { GraphCanvas } from "./components/Graphing/GraphCanvas";
import { FunctionPanel } from "./components/Graphing/FunctionPanel";
import { GraphToolbar } from "./components/Graphing/GraphToolbar";
import { ChatPanel } from "./components/Chatbot/ChatPanel";

// Default mathematical functions to plot on load
const DEFAULT_PLOTS: FunctionPlot[] = [
  {
    id: 'default-sin',
    expression: 'sin(x)',
    color: DEFAULT_COLORS[0],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-x2',
    expression: 'x^2',
    color: DEFAULT_COLORS[1],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-cos',
    expression: 'cos(x)',
    color: DEFAULT_COLORS[2],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-x3',
    expression: 'x^3 / 4',
    color: DEFAULT_COLORS[3],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-sqrt',
    expression: 'sqrt(x)',
    color: DEFAULT_COLORS[4],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-tan',
    expression: 'tan(x)',
    color: DEFAULT_COLORS[5],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-log',
    expression: 'log(x)',
    color: DEFAULT_COLORS[6],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-exp',
    expression: 'exp(x) / 10',
    color: DEFAULT_COLORS[7],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-abs',
    expression: 'abs(x)',
    color: DEFAULT_COLORS[0],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-1overx',
    expression: '1/x',
    color: DEFAULT_COLORS[1],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-sin2x',
    expression: 'sin(2*x)',
    color: DEFAULT_COLORS[2],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
  {
    id: 'default-x2minus4',
    expression: 'x^2 - 4',
    color: DEFAULT_COLORS[3],
    coordinateSystem: 'cartesian',
    visible: true,
    lineWidth: 2.5,
  },
];

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plots, setPlots] = useState<FunctionPlot[]>(DEFAULT_PLOTS);
  const [mechanicalParts, setMechanicalParts] = useState<MechanicalPart[]>([]);
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

  const handleAddMechanicalPart = useCallback((part: MechanicalPart) => {
    setMechanicalParts((prev) => [...prev, part]);
  }, []);

  const handleEditMechanicalPart = useCallback((targetType: string | undefined, updates: Record<string, number>) => {
    setMechanicalParts((prev) => {
      // Find the most recent part matching the target type (or the last part if no type specified)
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (!targetType || prev[i].partType === targetType) { idx = i; break; }
      }
      if (idx < 0) return prev;

      const updated = [...prev];
      updated[idx] = editPart(prev[idx], updates);
      return updated;
    });
  }, []);

  const handleDeleteMechanicalPart = useCallback((targetType: string | undefined, deleteWhole: boolean, resetParams: string[]) => {
    if (deleteWhole) {
      setMechanicalParts((prev) => {
        if (targetType) {
          let idx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].partType === targetType) { idx = i; break; }
          }
          if (idx < 0) return prev;
          return prev.filter((_, i) => i !== idx);
        }
        // Remove the last part
        return prev.slice(0, -1);
      });
    } else {
      // Reset params
      setMechanicalParts((prev) => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (!targetType || prev[i].partType === targetType) { idx = i; break; }
        }
        if (idx < 0) return prev;

        const updated = [...prev];
        updated[idx] = resetPartParams(prev[idx], resetParams);
        return updated;
      });
    }
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
          mechanicalParts={mechanicalParts}
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
          onAddMechanicalPart={handleAddMechanicalPart}
          onEditMechanicalPart={handleEditMechanicalPart}
          onDeleteMechanicalPart={handleDeleteMechanicalPart}
          onViewportChange={handleViewportChange}
        />
      </div>
    </div>
  );
}