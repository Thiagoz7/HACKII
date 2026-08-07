import { useRef, useEffect, useCallback, useState } from 'react';
import { GraphRenderer } from '../../lib/graph-renderer';
import type { Viewport, FunctionPlot, GraphConfig } from '../../types/graph';
import { DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG } from '../../types/graph';
import type { MechanicalPart } from '../../lib/mechanical-parts';
import type { AnimationState } from '../../lib/animation-engine';
import { generateWaveFrame, generateRotationFrame } from '../../lib/animation-engine';
import { worldToScreen } from '../../lib/coordinate-systems';
import type { CriticalPoint } from '../../lib/critical-points';
import { findVisibleCriticalPoints, findNearestCriticalPoint } from '../../lib/critical-points';

interface GraphCanvasProps {
  viewport: Viewport;
  plots: FunctionPlot[];
  mechanicalParts?: MechanicalPart[];
  animations?: AnimationState[];
  onAnimationsUpdate?: (animations: AnimationState[]) => void;
  config: GraphConfig;
  showCriticalPoints?: boolean;
  onViewportChange: (viewport: Partial<Viewport>) => void;
}

export function GraphCanvas({ viewport, plots, mechanicalParts = [], animations = [], onAnimationsUpdate, config, showCriticalPoints = true, onViewportChange }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const animationsRef = useRef(animations);
  animationsRef.current = animations;

  const [hoveredPoint, setHoveredPoint] = useState<CriticalPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const criticalPointsRef = useRef<CriticalPoint[]>([]);

  // Initialize renderer
  useEffect(() => {
    rendererRef.current = new GraphRenderer(DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Compute critical points when plots or viewport change
  useEffect(() => {
    if (showCriticalPoints) {
      criticalPointsRef.current = findVisibleCriticalPoints(plots, viewport);
    } else {
      criticalPointsRef.current = [];
    }
  }, [plots, viewport, showCriticalPoints]);

  // Animation render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !canvasRef.current) return;

    renderer.setViewport(viewport);
    renderer.setConfig(config);
    renderer.setPlots(plots);
    renderer.setMechanicalParts(mechanicalParts);

    const hasActiveAnimations = animations.some(a => a.playing);

    if (!hasActiveAnimations) {
      // Static render
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        if (canvasRef.current) {
          renderer.render(canvasRef.current);
          drawAnimationFrames(canvasRef.current, animationsRef.current, viewport);
        }
      });
      return;
    }

    // Continuous render loop for animations
    let running = true;
    const loop = () => {
      if (!running || !canvasRef.current) return;

      renderer.setViewport(viewport);
      renderer.setConfig(config);
      renderer.setPlots(plots);
      renderer.setMechanicalParts(mechanicalParts);
      renderer.render(canvasRef.current);

      // Update animation times and draw frames
      const now = performance.now();
      const updated = animationsRef.current.map(a => {
        if (!a.playing) return a;
        const elapsed = (now - a.startTime) / 1000;
        // Check duration limit
        if (a.config.duration > 0 && elapsed >= a.config.duration) {
          return { ...a, playing: false, time: a.config.duration };
        }
        return { ...a, time: elapsed };
      });

      // Push time updates back
      if (onAnimationsUpdate) {
        const changed = updated.some((u, i) => u.time !== animationsRef.current[i]?.time || u.playing !== animationsRef.current[i]?.playing);
        if (changed) onAnimationsUpdate(updated);
      }

      drawAnimationFrames(canvasRef.current, updated, viewport);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [viewport, plots, mechanicalParts, animations, config, onAnimationsUpdate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) {
      // Hover detection for critical points
      if (showCriticalPoints && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const nearest = findNearestCriticalPoint(mx, my, criticalPointsRef.current, viewport);
        setHoveredPoint(nearest);
        if (nearest) {
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }
      return;
    }

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    onViewportChange({
      centerX: viewport.centerX - dx / viewport.scale,
      centerY: viewport.centerY + dy / viewport.scale,
    });
  }, [viewport, onViewportChange, showCriticalPoints]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const zoomFactor = 1.1;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Mouse position in canvas coords
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World coords under mouse
    const worldX = viewport.centerX + (mouseX - viewport.width / 2) / viewport.scale;
    const worldY = viewport.centerY - (mouseY - viewport.height / 2) / viewport.scale;

    const newScale = e.deltaY < 0
      ? viewport.scale * zoomFactor
      : viewport.scale / zoomFactor;

    // Clamp scale
    const clampedScale = Math.max(1, Math.min(10000, newScale));

    // New center such that the world point under the mouse stays fixed
    const newCenterX = worldX - (mouseX - viewport.width / 2) / clampedScale;
    const newCenterY = worldY + (mouseY - viewport.height / 2) / clampedScale;

    onViewportChange({
      scale: clampedScale,
      centerX: newCenterX,
      centerY: newCenterY,
    });
  }, [viewport, onViewportChange]);

  // Touch support
  const touchRef = useRef<{ x: number; y: number; dist: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.sqrt(dx * dx + dy * dy),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastMouse.current.x;
      const dy = e.touches[0].clientY - lastMouse.current.y;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      onViewportChange({
        centerX: viewport.centerX - dx / viewport.scale,
        centerY: viewport.centerY + dy / viewport.scale,
      });
    } else if (e.touches.length === 2 && touchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const scaleChange = newDist / touchRef.current.dist;
      const newScale = Math.max(1, Math.min(10000, viewport.scale * scaleChange));

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = midX - rect.left;
      const mouseY = midY - rect.top;
      const worldX = viewport.centerX + (mouseX - viewport.width / 2) / viewport.scale;
      const worldY = viewport.centerY - (mouseY - viewport.height / 2) / viewport.scale;

      const newCenterX = worldX - (mouseX - viewport.width / 2) / newScale;
      const newCenterY = worldY + (mouseY - viewport.height / 2) / newScale;

      onViewportChange({
        scale: newScale,
        centerX: newCenterX,
        centerY: newCenterY,
      });

      touchRef.current = { x: midX, y: midY, dist: newDist };
    }
  }, [viewport, onViewportChange]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    touchRef.current = null;
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredPoint(null); }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Critical point markers */}
      {showCriticalPoints && criticalPointsRef.current.map((pt, i) => {
        const [sx, sy] = worldToScreen(pt.x, pt.y, viewport);
        if (sx < 0 || sx > viewport.width || sy < 0 || sy > viewport.height) return null;
        const markerColor = pt.type === 'root' ? '#FF6B6B'
          : pt.type === 'y-intercept' ? '#4ECDC4'
          : pt.type === 'maximum' ? '#FFE66D'
          : pt.type === 'minimum' ? '#95E1D3'
          : '#C7CEEA';
        return (
          <div
            key={`cp-${i}`}
            className="absolute w-2.5 h-2.5 rounded-full border-2 pointer-events-none"
            style={{
              left: sx - 5,
              top: sy - 5,
              backgroundColor: markerColor,
              borderColor: pt.color,
              boxShadow: hoveredPoint === pt ? `0 0 8px ${markerColor}` : 'none',
            }}
          />
        );
      })}

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-30 px-3 py-1.5 rounded-lg bg-surface border border-border shadow-xl text-xs font-mono pointer-events-none"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 30,
            maxWidth: 220,
          }}
        >
          <div className="font-semibold text-foreground">{hoveredPoint.label}</div>
          <div className="text-muted text-[10px] mt-0.5">{hoveredPoint.expression} — {hoveredPoint.type}</div>
        </div>
      )}
    </div>
  );
}

// ── Animation Frame Renderer ───────────────────────────────────────

function drawAnimationFrames(canvas: HTMLCanvasElement, animations: AnimationState[], viewport: Viewport): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  for (const anim of animations) {
    const { config, time } = anim;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (config.type === 'wave' && config.expression) {
      // Generate wave frame at current time
      const xMin = viewport.centerX - viewport.width / (2 * viewport.scale);
      const xMax = viewport.centerX + viewport.width / (2 * viewport.scale);
      const points = generateWaveFrame(config.expression, time, config.speed, config.direction, xMin, xMax);

      ctx.beginPath();
      let started = false;
      for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          ctx.stroke();
          ctx.beginPath();
          started = false;
          continue;
        }
        const [sx, sy] = worldToScreen(p.x, p.y, viewport);
        if (sx < -2000 || sx > viewport.width + 2000 || sy < -2000 || sy > viewport.height + 2000) {
          started = false;
          continue;
        }
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    if (config.type === 'rotation' && config.paths && config.rotationCenter) {
      // Generate rotated paths
      const rotatedPaths = generateRotationFrame(config.paths, config.rotationCenter, time, config.speed, config.direction);

      for (const path of rotatedPaths) {
        ctx.beginPath();
        let started = false;
        for (const p of path) {
          const [sx, sy] = worldToScreen(p.x, p.y, viewport);
          if (sx < -5000 || sx > viewport.width + 5000 || sy < -5000 || sy > viewport.height + 5000) {
            started = false;
            continue;
          }
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }
  }
}
