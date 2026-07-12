import type { Viewport, Point2D, PolarPoint } from '../types/graph';

/**
 * Convert world coordinates to screen (canvas) coordinates.
 * Canvas origin is top-left, but world origin is at viewport center.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport
): [number, number] {
  const screenX = viewport.width / 2 + (worldX - viewport.centerX) * viewport.scale;
  const screenY = viewport.height / 2 - (worldY - viewport.centerY) * viewport.scale;
  return [screenX, screenY];
}

/**
 * Convert screen (canvas) coordinates to world coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport
): [number, number] {
  const worldX = viewport.centerX + (screenX - viewport.width / 2) / viewport.scale;
  const worldY = viewport.centerY - (screenY - viewport.height / 2) / viewport.scale;
  return [worldX, worldY];
}

/**
 * Convert polar coordinates (r, θ) to Cartesian (x, y).
 * θ is in radians.
 */
export function polarToCartesian(r: number, theta: number): Point2D {
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

/**
 * Convert Cartesian (x, y) to polar coordinates (r, θ).
 */
export function cartesianToPolar(x: number, y: number): PolarPoint {
  return {
    r: Math.sqrt(x * x + y * y),
    theta: Math.atan2(y, x),
  };
}

/**
 * Convert a relative offset (dx, dy) from a reference point to absolute coordinates.
 */
export function relativeToAbsolute(
  refX: number,
  refY: number,
  dx: number,
  dy: number
): Point2D {
  return { x: refX + dx, y: refY + dy };
}

/**
 * Compute the component of a relative offset in polar form.
 * (r, θ) relative to a reference point.
 */
export function relativePolarToAbsolute(
  refX: number,
  refY: number,
  r: number,
  theta: number
): Point2D {
  return {
    x: refX + r * Math.cos(theta),
    y: refY + r * Math.sin(theta),
  };
}

/**
 * Generate a grid of sample points for plotting a function in the given viewport.
 * Returns an array of world-coordinate points.
 */
export function sampleFunction(
  expression: (x: number) => number,
  viewport: Viewport,
  samplesPerPixel: number = 1
): Point2D[] {
  const [worldMinX] = screenToWorld(0, 0, viewport);
  const [worldMaxX] = screenToWorld(viewport.width, 0, viewport);
  const pixelWidth = (worldMaxX - worldMinX) / viewport.width;
  const step = pixelWidth / samplesPerPixel;

  const points: Point2D[] = [];
  for (let x = worldMinX; x <= worldMaxX; x += step) {
    const y = expression(x);
    if (isFinite(y)) {
      points.push({ x, y });
    } else {
      // Insert a break point (NaN) to separate discontinuous segments
      if (points.length > 0 && isFinite(points[points.length - 1].y)) {
        points.push({ x: NaN, y: NaN });
      }
    }
  }
  return points;
}

/**
 * Generate sample points for a polar function r = f(θ).
 */
export function samplePolarFunction(
  expression: (theta: number) => number,
  viewport: Viewport,
  samplesPerRadian: number = 200
): Point2D[] {
  // Determine how many radians to sample based on viewport extent
  const [worldMaxX] = screenToWorld(viewport.width, 0, viewport);
  const maxR = Math.abs(worldMaxX) * 2;
  const steps = Math.ceil(2 * Math.PI * samplesPerRadian);

  const points: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const r = expression(theta);
    if (isFinite(r) && r >= 0 && r <= maxR) {
      const { x, y } = polarToCartesian(r, theta);
      points.push({ x, y });
    } else {
      if (points.length > 0 && isFinite(points[points.length - 1].y)) {
        points.push({ x: NaN, y: NaN });
      }
    }
  }
  return points;
}

/**
 * Get a nice grid step size based on the current viewport scale.
 * Returns steps that are "nice" numbers: 1, 2, 5, 10, 20, 50, etc.
 */
export function getNiceGridStep(pixelsPerStep: number): number {
  // We want approximately `pixelsPerStep` pixels between major grid lines
  const roughStep = pixelsPerStep;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  let niceStep: number;
  if (residual < 1.5) niceStep = 1;
  else if (residual < 3.5) niceStep = 2;
  else if (residual < 7.5) niceStep = 5;
  else niceStep = 10;

  return niceStep * magnitude;
}