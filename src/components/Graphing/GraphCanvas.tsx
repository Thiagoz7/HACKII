import { useRef, useEffect, useCallback } from 'react';
import { GraphRenderer } from '../../lib/graph-renderer';
import type { Viewport, FunctionPlot, GraphConfig } from '../../types/graph';
import { DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG } from '../../types/graph';
import type { MechanicalPart } from '../../lib/mechanical-parts';

interface GraphCanvasProps {
  viewport: Viewport;
  plots: FunctionPlot[];
  mechanicalParts?: MechanicalPart[];
  config: GraphConfig;
  onViewportChange: (viewport: Partial<Viewport>) => void;
}

export function GraphCanvas({ viewport, plots, mechanicalParts = [], config, onViewportChange }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  // Initialize renderer
  useEffect(() => {
    rendererRef.current = new GraphRenderer(DEFAULT_VIEWPORT, DEFAULT_GRAPH_CONFIG);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Update renderer state and redraw
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !canvasRef.current) return;

    renderer.setViewport(viewport);
    renderer.setConfig(config);
    renderer.setPlots(plots);
    renderer.setMechanicalParts(mechanicalParts);

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      if (canvasRef.current) {
        renderer.render(canvasRef.current);
      }
    });
  }, [viewport, plots, mechanicalParts, config]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    onViewportChange({
      centerX: viewport.centerX - dx / viewport.scale,
      centerY: viewport.centerY + dy / viewport.scale,
    });
  }, [viewport, onViewportChange]);

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
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}