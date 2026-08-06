import { useState, useCallback, useEffect, useRef } from "react";
import type { FunctionPlot, Viewport, GraphConfig, CoordinateSystem } from "./types/graph";
import { DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG, DEFAULT_COLORS } from "./types/graph";
import type { MechanicalPart } from "./lib/mechanical-parts";
import { editPart, resetPartParams } from "./lib/mechanical-parts";
import type { AnimationConfig, AnimationState } from "./lib/animation-engine";
import { generateRotationFrame } from "./lib/animation-engine";
import type { Surface3D } from "./lib/renderer-3d";
import { GraphCanvas } from "./components/Graphing/GraphCanvas";
import { GraphCanvas3D } from "./components/Graphing/GraphCanvas3D";
import { FunctionPanel } from "./components/Graphing/FunctionPanel";
import { GraphToolbar } from "./components/Graphing/GraphToolbar";
import { ChatPanel } from "./components/Chatbot/ChatPanel";
import { ScientificCalculator } from "./components/Calculator/ScientificCalculator";
import { ThemeToggleButton } from "./components/ThemeToggle";
import { AnimationControls } from "./components/Animation/AnimationControls";

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
  const [animations, setAnimations] = useState<AnimationState[]>([]);
  const [surfaces3D, setSurfaces3D] = useState<Surface3D[]>([]);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
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

  // ── Animation management ─────────────────────────────────────

  const handleAddAnimation = useCallback((config: AnimationConfig) => {
    // For rotation animations, grab paths from the latest matching mechanical part
    let finalConfig = config;
    if (config.type === 'rotation' && !config.paths) {
      // Try to find an existing part that matches
      const target = mechanicalParts.length > 0 ? mechanicalParts[mechanicalParts.length - 1] : null;
      if (target) {
        finalConfig = { ...config, paths: target.paths, rotationCenter: { x: target.centerX, y: target.centerY } };
      }
    } else if (config.type === 'rotation' && config.paths) {
      // Already has paths (auto-created), use as-is
      finalConfig = config;
    }

    const state: AnimationState = {
      config: finalConfig,
      playing: true,
      time: 0,
      startTime: performance.now(),
    };
    setAnimations(prev => [...prev, state]);
  }, [mechanicalParts]);

  const handleAddSurface3D = useCallback((surface: Surface3D) => {
    setSurfaces3D(prev => [...prev, surface]);
    setViewMode('3d'); // auto-switch to 3D mode
  }, []);

  const handlePlayAnimation = useCallback((id: string) => {
    setAnimations(prev => prev.map(a =>
      a.config.id === id ? { ...a, playing: true, startTime: performance.now() - a.time * 1000 } : a
    ));
  }, []);

  const handlePauseAnimation = useCallback((id: string) => {
    setAnimations(prev => prev.map(a =>
      a.config.id === id ? { ...a, playing: false } : a
    ));
  }, []);

  const handleStopAnimation = useCallback((id: string) => {
    setAnimations(prev => prev.filter(a => a.config.id !== id));
  }, []);

  const handleResetAnimation = useCallback((id: string) => {
    setAnimations(prev => prev.map(a =>
      a.config.id === id ? { ...a, time: 0, startTime: performance.now() } : a
    ));
  }, []);

  const handleSpeedChange = useCallback((id: string, speed: number) => {
    setAnimations(prev => prev.map(a =>
      a.config.id === id ? { ...a, config: { ...a.config, speed } } : a
    ));
  }, []);

  const handlePlayAll = useCallback(() => {
    setAnimations(prev => prev.map(a => ({ ...a, playing: true, startTime: performance.now() - a.time * 1000 })));
  }, []);

  const handlePauseAll = useCallback(() => {
    setAnimations(prev => prev.map(a => ({ ...a, playing: false })));
  }, []);

  const handleStopAll = useCallback(() => {
    setAnimations([]);
  }, []);

  const handleFinalizeAnimation = useCallback((id: string) => {
    setAnimations(prev => {
      const anim = prev.find(a => a.config.id === id);
      if (anim && anim.config.type === 'rotation' && anim.config.paths && anim.config.rotationCenter) {
        // Keep the part as a static mechanical drawing at its final rotated position
        const finalPaths = generateRotationFrame(
          anim.config.paths,
          anim.config.rotationCenter,
          anim.time,
          anim.config.speed,
          anim.config.direction
        );
        // Add as a static mechanical part
        setMechanicalParts(parts => [...parts, {
          id: `finalized-${id}`,
          name: anim.config.label,
          partType: 'assembly' as const,
          label: `${anim.config.label} (static)`,
          paths: finalPaths,
          centerX: anim.config.rotationCenter!.x,
          centerY: anim.config.rotationCenter!.y,
          params: {},
        }]);
      }
      return prev.filter(a => a.config.id !== id);
    });
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left sidebar — function management + calculator */}
      <div className="flex flex-col w-72 border-r border-border bg-surface">
        {/* Function panel */}
        <div className="flex-1 overflow-hidden">
          <FunctionPanel
            plots={plots}
            onAdd={handleAddPlot}
            onRemove={handleRemovePlot}
            onToggle={handleTogglePlot}
            onChangeColor={handleChangeColor}
            onChangeSystem={handleChangeSystem}
          />
        </div>

        {/* Scientific calculator panel */}
        <div className="border-t border-border h-[360px] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Calculator</span>
            <ThemeToggleButton />
          </div>
          <ScientificCalculator
            onInsertExpression={(expr) => {
              const color = DEFAULT_COLORS[plots.length % DEFAULT_COLORS.length];
              handleAddPlot({
                id: `calc-${Math.random().toString(36).slice(2, 10)}`,
                expression: expr,
                color,
                coordinateSystem: 'cartesian',
                visible: true,
                lineWidth: 2.5,
              });
            }}
          />
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative">
        {/* 2D/3D mode toggle */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-surface/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-lg">
          <button
            onClick={() => setViewMode('2d')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '2d' ? 'bg-primary text-white' : 'text-muted hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '3d' ? 'bg-primary text-white' : 'text-muted hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            3D
          </button>
        </div>

        {viewMode === '2d' ? (
          <GraphCanvas
            viewport={viewport}
            plots={plots}
            mechanicalParts={mechanicalParts}
            animations={animations}
            onAnimationsUpdate={setAnimations}
            config={config}
            onViewportChange={handleViewportChange}
          />
        ) : (
          <GraphCanvas3D
            surfaces={surfaces3D}
          />
        )}

        {/* Animation controls overlay */}
        <AnimationControls
          animations={animations}
          onPlay={handlePlayAnimation}
          onPause={handlePauseAnimation}
          onStop={handleStopAnimation}
          onReset={handleResetAnimation}
          onFinalize={handleFinalizeAnimation}
          onSpeedChange={handleSpeedChange}
          onPlayAll={handlePlayAll}
          onPauseAll={handlePauseAll}
          onStopAll={handleStopAll}
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
          onAddAnimation={handleAddAnimation}
          onAddSurface3D={handleAddSurface3D}
          onViewportChange={handleViewportChange}
        />
      </div>
    </div>
  );
}