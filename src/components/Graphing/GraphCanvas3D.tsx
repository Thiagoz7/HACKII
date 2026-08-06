import { useRef, useEffect, useCallback, useState } from 'react';
import type { Camera3D, Surface3D, Render3DConfig, Vec3 } from '../../lib/renderer-3d';
import { DEFAULT_CAMERA, DEFAULT_3D_CONFIG, render3D } from '../../lib/renderer-3d';

interface GraphCanvas3DProps {
  surfaces: Surface3D[];
  paths3D?: Vec3[][];
  config?: Partial<Render3DConfig>;
}

export function GraphCanvas3D({ surfaces, paths3D = [], config }: GraphCanvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<Camera3D>({ ...DEFAULT_CAMERA });
  const isDragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  const fullConfig: Render3DConfig = { ...DEFAULT_3D_CONFIG, ...config };

  // Render on state change
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      if (canvasRef.current) {
        render3D(canvasRef.current, camera, surfaces, fullConfig, paths3D);
      }
    });
  }, [camera, surfaces, paths3D, fullConfig]);

  // Mouse orbit
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    setCamera(prev => ({
      ...prev,
      azimuth: prev.azimuth - dx * 0.008,
      elevation: Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, prev.elevation + dy * 0.008)),
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Mouse zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera(prev => ({
      ...prev,
      distance: Math.max(2, Math.min(100, prev.distance * (e.deltaY > 0 ? 1.08 : 0.92))),
    }));
  }, []);

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
      setCamera(prev => ({
        ...prev,
        azimuth: prev.azimuth - dx * 0.008,
        elevation: Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, prev.elevation + dy * 0.008)),
      }));
    } else if (e.touches.length === 2 && touchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const scale = touchRef.current.dist / newDist;
      setCamera(prev => ({
        ...prev,
        distance: Math.max(2, Math.min(100, prev.distance * scale)),
      }));
      touchRef.current.dist = newDist;
    }
  }, []);

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
