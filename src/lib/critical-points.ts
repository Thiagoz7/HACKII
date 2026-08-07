/**
 * critical-points.ts — Detects critical points on plotted functions
 * for interactive highlighting and tooltips.
 */

import type { FunctionPlot, Viewport } from '../types/graph';
import { compileExpression } from './function-parser';
import { screenToWorld } from './coordinate-systems';

export interface CriticalPoint {
  x: number;
  y: number;
  type: 'root' | 'y-intercept' | 'maximum' | 'minimum' | 'inflection';
  label: string;
  expression: string;
  color: string;
}

/**
 * Find critical points for all visible plots in the current viewport.
 */
export function findVisibleCriticalPoints(plots: FunctionPlot[], viewport: Viewport): CriticalPoint[] {
  const points: CriticalPoint[] = [];
  const xMin = viewport.centerX - viewport.width / (2 * viewport.scale);
  const xMax = viewport.centerX + viewport.width / (2 * viewport.scale);

  for (const plot of plots) {
    if (!plot.visible || plot.coordinateSystem !== 'cartesian') continue;
    const fn = compileExpression(plot.expression);
    if (!fn) continue;

    const color = plot.color;
    const expr = plot.expression;

    // Sample function densely
    const steps = 500;
    const dx = (xMax - xMin) / steps;
    const samples: Array<{ x: number; y: number }> = [];

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * dx;
      const y = fn(x);
      if (Number.isFinite(y)) {
        samples.push({ x, y });
      }
    }

    if (samples.length < 3) continue;

    // ── Roots (sign changes) ──
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1].y * samples[i].y < 0) {
        // Bisect to find root
        let lo = samples[i - 1].x;
        let hi = samples[i].x;
        for (let j = 0; j < 30; j++) {
          const mid = (lo + hi) / 2;
          const fMid = fn(mid);
          if (!Number.isFinite(fMid)) break;
          if (fn(lo) * fMid < 0) hi = mid;
          else lo = mid;
        }
        const rootX = (lo + hi) / 2;
        points.push({ x: rootX, y: 0, type: 'root', label: `Root: (${rootX.toFixed(4)}, 0)`, expression: expr, color });
      }
    }

    // ── Y-intercept ──
    if (xMin <= 0 && xMax >= 0) {
      const y0 = fn(0);
      if (Number.isFinite(y0)) {
        points.push({ x: 0, y: y0, type: 'y-intercept', label: `Y-int: (0, ${y0.toFixed(4)})`, expression: expr, color });
      }
    }

    // ── Local maxima and minima (derivative sign changes) ──
    for (let i = 1; i < samples.length - 1; i++) {
      const dy1 = samples[i].y - samples[i - 1].y;
      const dy2 = samples[i + 1].y - samples[i].y;

      if (dy1 > 0 && dy2 < 0) {
        // Local maximum
        points.push({
          x: samples[i].x, y: samples[i].y,
          type: 'maximum',
          label: `Max: (${samples[i].x.toFixed(4)}, ${samples[i].y.toFixed(4)})`,
          expression: expr, color,
        });
      } else if (dy1 < 0 && dy2 > 0) {
        // Local minimum
        points.push({
          x: samples[i].x, y: samples[i].y,
          type: 'minimum',
          label: `Min: (${samples[i].x.toFixed(4)}, ${samples[i].y.toFixed(4)})`,
          expression: expr, color,
        });
      }
    }

    // ── Inflection points (second derivative sign changes) ──
    for (let i = 2; i < samples.length - 2; i++) {
      const d2a = (samples[i].y - 2 * samples[i - 1].y + samples[i - 2].y);
      const d2b = (samples[i + 2].y - 2 * samples[i + 1].y + samples[i].y);
      if (d2a * d2b < 0 && Math.abs(d2a) > 1e-8 && Math.abs(d2b) > 1e-8) {
        points.push({
          x: samples[i].x, y: samples[i].y,
          type: 'inflection',
          label: `Inflection: (${samples[i].x.toFixed(4)}, ${samples[i].y.toFixed(4)})`,
          expression: expr, color,
        });
      }
    }
  }

  // Deduplicate nearby points
  return deduplicatePoints(points);
}

function deduplicatePoints(points: CriticalPoint[]): CriticalPoint[] {
  const result: CriticalPoint[] = [];
  for (const p of points) {
    const isDuplicate = result.some(
      existing => Math.abs(existing.x - p.x) < 0.05 && Math.abs(existing.y - p.y) < 0.05 && existing.type === p.type
    );
    if (!isDuplicate) result.push(p);
  }
  return result;
}

/**
 * Find the closest critical point to a screen position (for hover detection).
 */
export function findNearestCriticalPoint(
  screenX: number,
  screenY: number,
  criticalPoints: CriticalPoint[],
  viewport: Viewport,
  threshold = 15 // pixels
): CriticalPoint | null {
  const [worldX, worldY] = screenToWorld(screenX, screenY, viewport);
  let nearest: CriticalPoint | null = null;
  let minDist = Infinity;

  for (const pt of criticalPoints) {
    // Calculate screen-space distance
    const dx = (pt.x - worldX) * viewport.scale;
    const dy = (pt.y - worldY) * viewport.scale;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist && dist < threshold) {
      minDist = dist;
      nearest = pt;
    }
  }

  return nearest;
}
