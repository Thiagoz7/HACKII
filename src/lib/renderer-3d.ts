/**
 * renderer-3d.ts — Software-rendered 3D engine for Andrómeda.
 *
 * Provides: perspective projection, orbital camera, wireframe surface
 * rendering, 3D axes, and support for 3D mechanical part paths.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera3D {
  /** Spherical coordinates: distance from target */
  distance: number;
  /** Azimuth angle (radians, rotation around Y axis) */
  azimuth: number;
  /** Elevation angle (radians, from XZ plane) */
  elevation: number;
  /** Look-at target point */
  target: Vec3;
  /** Field of view in degrees */
  fov: number;
}

export interface Surface3D {
  id: string;
  expression: string;
  label: string;
  color: string;
  gridResolution: number;
  xRange: [number, number];
  yRange: [number, number];
}

export interface Render3DConfig {
  showAxes: boolean;
  showGrid: boolean;
  showLabels: boolean;
  axisLength: number;
}

export const DEFAULT_CAMERA: Camera3D = {
  distance: 15,
  azimuth: Math.PI / 4,
  elevation: Math.PI / 6,
  target: { x: 0, y: 0, z: 0 },
  fov: 60,
};

export const DEFAULT_3D_CONFIG: Render3DConfig = {
  showAxes: true,
  showGrid: true,
  showLabels: true,
  axisLength: 8,
};

// ── Camera Utilities ───────────────────────────────────────────────

export function getCameraPosition(camera: Camera3D): Vec3 {
  const { distance, azimuth, elevation, target } = camera;
  return {
    x: target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    y: target.y + distance * Math.sin(elevation),
    z: target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  };
}

// ── Projection ─────────────────────────────────────────────────────

/**
 * Project a 3D world point to 2D screen coordinates using perspective.
 * Returns [screenX, screenY, depth] or null if behind camera.
 */
export function project(
  point: Vec3,
  camera: Camera3D,
  width: number,
  height: number
): [number, number, number] | null {
  const eye = getCameraPosition(camera);

  // View direction (camera looks at target)
  const forward = normalize(sub(camera.target, eye));
  const worldUp: Vec3 = { x: 0, y: 1, z: 0 };
  const right = normalize(cross(forward, worldUp));
  const up = cross(right, forward);

  // Vector from eye to point
  const v = sub(point, eye);

  // Camera-space coordinates
  const cx = dot(v, right);
  const cy = dot(v, up);
  const cz = dot(v, forward); // depth along view direction

  if (cz <= 0.01) return null; // behind camera

  // Perspective projection
  const fovRad = (camera.fov * Math.PI) / 180;
  const scale = 1 / Math.tan(fovRad / 2);
  const aspect = width / height;

  const sx = (width / 2) + (cx / cz) * scale * (height / 2) / aspect;
  const sy = (height / 2) - (cy / cz) * scale * (height / 2);

  return [sx, sy, cz];
}

// ── Vector Math ────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// ── Surface Evaluation ─────────────────────────────────────────────

/**
 * Evaluate z = f(x, y) for a surface expression.
 */
export function evaluateSurface(
  expression: string,
  xRange: [number, number],
  yRange: [number, number],
  resolution: number
): Vec3[][] {
  const grid: Vec3[][] = [];
  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;

  const fn = buildSurfaceFunction(expression);

  for (let i = 0; i <= resolution; i++) {
    const row: Vec3[] = [];
    const x = xRange[0] + i * xStep;
    for (let j = 0; j <= resolution; j++) {
      const y = yRange[0] + j * yStep;
      const z = fn(x, y);
      row.push({ x, y: z, z: y }); // Map: world X=x, world Y=z(height), world Z=y
    }
    grid.push(row);
  }
  return grid;
}

function buildSurfaceFunction(expression: string): (x: number, y: number) => number {
  const sanitized = expression
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\be\b(?![x])/g, String(Math.E))
    .replace(/\^/g, '**');

  try {
    const fn = new Function('x', 'y', `return (${sanitized})`);
    return (x: number, y: number): number => {
      try {
        const result = fn(x, y);
        return typeof result === 'number' && Number.isFinite(result) ? result : NaN;
      } catch { return NaN; }
    };
  } catch {
    return () => NaN;
  }
}

// ── 3D Rendering ───────────────────────────────────────────────────

/**
 * Render the full 3D scene onto a canvas.
 */
export function render3D(
  canvas: HTMLCanvasElement,
  camera: Camera3D,
  surfaces: Surface3D[],
  config: Render3DConfig,
  paths3D: Vec3[][] = []
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Draw grid on XZ plane (y=0)
  if (config.showGrid) {
    drawGrid3D(ctx, camera, width, height, config.axisLength);
  }

  // Draw axes
  if (config.showAxes) {
    drawAxes3D(ctx, camera, width, height, config);
  }

  // Draw surfaces
  for (const surface of surfaces) {
    drawSurface(ctx, camera, width, height, surface);
  }

  // Draw 3D paths (mechanical parts extruded or wire)
  for (const path of paths3D) {
    draw3DPath(ctx, camera, width, height, path);
  }
}

function drawGrid3D(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  axisLen: number
): void {
  ctx.strokeStyle = 'rgba(128,128,128,0.15)';
  ctx.lineWidth = 0.5;

  const step = 1;
  for (let i = -axisLen; i <= axisLen; i += step) {
    // Lines parallel to Z axis
    drawLine3D(ctx, camera, width, height,
      { x: i, y: 0, z: -axisLen },
      { x: i, y: 0, z: axisLen }
    );
    // Lines parallel to X axis
    drawLine3D(ctx, camera, width, height,
      { x: -axisLen, y: 0, z: i },
      { x: axisLen, y: 0, z: i }
    );
  }
}

function drawAxes3D(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  config: Render3DConfig
): void {
  const len = config.axisLength;

  // X axis — red
  ctx.strokeStyle = '#FF4444';
  ctx.lineWidth = 2;
  drawLine3D(ctx, camera, width, height, { x: -len, y: 0, z: 0 }, { x: len, y: 0, z: 0 });

  // Y axis — green (vertical)
  ctx.strokeStyle = '#44FF44';
  drawLine3D(ctx, camera, width, height, { x: 0, y: -len, z: 0 }, { x: 0, y: len, z: 0 });

  // Z axis — blue
  ctx.strokeStyle = '#4488FF';
  drawLine3D(ctx, camera, width, height, { x: 0, y: 0, z: -len }, { x: 0, y: 0, z: len });

  // Labels
  if (config.showLabels) {
    ctx.font = '12px "JetBrains Mono", monospace';

    const xEnd = project({ x: len + 0.5, y: 0, z: 0 }, camera, width, height);
    if (xEnd) { ctx.fillStyle = '#FF4444'; ctx.fillText('X', xEnd[0], xEnd[1]); }

    const yEnd = project({ x: 0, y: len + 0.5, z: 0 }, camera, width, height);
    if (yEnd) { ctx.fillStyle = '#44FF44'; ctx.fillText('Y', yEnd[0], yEnd[1]); }

    const zEnd = project({ x: 0, y: 0, z: len + 0.5 }, camera, width, height);
    if (zEnd) { ctx.fillStyle = '#4488FF'; ctx.fillText('Z', zEnd[0], zEnd[1]); }
  }
}

function drawSurface(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  surface: Surface3D
): void {
  const grid = evaluateSurface(
    surface.expression,
    surface.xRange,
    surface.yRange,
    surface.gridResolution
  );

  ctx.strokeStyle = surface.color;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.7;

  // Draw wireframe — rows
  for (const row of grid) {
    ctx.beginPath();
    let started = false;
    for (const point of row) {
      if (!Number.isFinite(point.y)) { started = false; continue; }
      const p = project(point, camera, width, height);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  // Draw wireframe — columns
  if (grid.length > 0) {
    for (let j = 0; j < grid[0].length; j++) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < grid.length; i++) {
        const point = grid[i][j];
        if (!Number.isFinite(point.y)) { started = false; continue; }
        const p = project(point, camera, width, height);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  // Label
  const centerP = project({ x: 0, y: 0, z: 0 }, camera, width, height);
  if (centerP) {
    ctx.fillStyle = surface.color;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(surface.label, 10, 20);
  }
}

function draw3DPath(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  path: Vec3[]
): void {
  ctx.strokeStyle = '#00E5FF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;

  for (const point of path) {
    const p = project(point, camera, width, height);
    if (!p) { started = false; continue; }
    if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
}

function drawLine3D(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  from: Vec3,
  to: Vec3
): void {
  const p1 = project(from, camera, width, height);
  const p2 = project(to, camera, width, height);
  if (!p1 || !p2) return;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
}

// ── NL Parser for 3D ───────────────────────────────────────────────

export interface Parsed3DPlot {
  expression: string;
  label: string;
  xRange: [number, number];
  yRange: [number, number];
}

/**
 * Parse a natural language 3D plot request.
 */
export function parse3DPlotQuery(input: string): Parsed3DPlot | null {
  const lower = input.toLowerCase();

  // Extract z = f(x,y) expression
  let expression: string | null = null;

  // Pattern: "z = ..."
  const zMatch = input.match(/z\s*=\s*(.+?)(?:\s+from|\s+for|\s+over|\s*$)/i);
  if (zMatch) expression = zMatch[1].trim();

  // Pattern: "plot <expr> in 3d"
  if (!expression) {
    const plotMatch = input.match(/(?:plot|graph|show|draw)\s+(.+?)\s+(?:in\s+)?3[dD]/i);
    if (plotMatch) expression = plotMatch[1].trim().replace(/^z\s*=\s*/, '');
  }

  // Pattern: "3d plot of <expr>"
  if (!expression) {
    const ofMatch = input.match(/3[dD]\s+(?:plot|graph|surface)\s+(?:of\s+)?(.+?)(?:\s+from|\s*$)/i);
    if (ofMatch) expression = ofMatch[1].trim();
  }

  // Fallback: look for expressions involving both x and y
  if (!expression && /\bx\b/.test(lower) && /\by\b/.test(lower)) {
    const exprMatch = input.match(/(?:plot|graph|show|surface)\s+(.+?)(?:\s*$)/i);
    if (exprMatch) expression = exprMatch[1].trim().replace(/^z\s*=\s*/, '');
  }

  if (!expression) return null;

  // Clean up
  expression = expression.replace(/[?.,;!]+$/, '').replace(/\s+in\s+3d$/i, '');

  // Parse ranges
  let xRange: [number, number] = [-5, 5];
  let yRange: [number, number] = [-5, 5];

  const rangeMatch = input.match(/x\s*(?:from|in|:)\s*\[?\s*(-?[\d.]+)\s*[,to]+\s*(-?[\d.]+)/i);
  if (rangeMatch) xRange = [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];

  const yRangeMatch = input.match(/y\s*(?:from|in|:)\s*\[?\s*(-?[\d.]+)\s*[,to]+\s*(-?[\d.]+)/i);
  if (yRangeMatch) yRange = [parseFloat(yRangeMatch[1]), parseFloat(yRangeMatch[2])];

  return {
    expression,
    label: `z = ${expression}`,
    xRange,
    yRange,
  };
}


// ── Parametric Curve ───────────────────────────────────────────────

export interface ParametricCurve3D {
  id: string;
  label: string;
  xExpr: string;  // x(t)
  yExpr: string;  // y(t)
  zExpr: string;  // z(t)
  tRange: [number, number];
  steps: number;
  color: string;
}

/**
 * Evaluate a parametric curve and return an array of 3D points.
 */
export function evaluateParametricCurve(curve: ParametricCurve3D): Vec3[] {
  const points: Vec3[] = [];
  const dt = (curve.tRange[1] - curve.tRange[0]) / curve.steps;
  const fnX = buildParamFn(curve.xExpr);
  const fnY = buildParamFn(curve.yExpr);
  const fnZ = buildParamFn(curve.zExpr);

  for (let i = 0; i <= curve.steps; i++) {
    const t = curve.tRange[0] + i * dt;
    const x = fnX(t);
    const y = fnY(t);
    const z = fnZ(t);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      points.push({ x, y, z });
    }
  }
  return points;
}

function buildParamFn(expr: string): (t: number) => number {
  const sanitized = expr
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\be\b(?![x])/g, String(Math.E))
    .replace(/\^/g, '**');

  try {
    const fn = new Function('t', `return (${sanitized})`);
    return (t: number) => {
      try { const r = fn(t); return typeof r === 'number' ? r : NaN; }
      catch { return NaN; }
    };
  } catch { return () => NaN; }
}

// ── 3D Mechanical Part Conversion ──────────────────────────────────

/**
 * Extrude a 2D mechanical part into 3D by sweeping along the Y axis.
 * Returns paths in 3D space (XZ plane is the 2D plane, Y is depth).
 */
export function extrude2DPartTo3D(
  paths2D: Array<Array<{ x: number; y: number }>>,
  depth: number = 1,
  yOffset: number = 0
): Vec3[][] {
  const paths3D: Vec3[][] = [];

  // Front face (y = yOffset)
  for (const path of paths2D) {
    paths3D.push(path.map(p => ({ x: p.x, y: yOffset, z: p.y })));
  }

  // Back face (y = yOffset + depth)
  for (const path of paths2D) {
    paths3D.push(path.map(p => ({ x: p.x, y: yOffset + depth, z: p.y })));
  }

  // Connecting edges (every Nth point to avoid clutter)
  for (const path of paths2D) {
    const step = Math.max(1, Math.floor(path.length / 12));
    for (let i = 0; i < path.length; i += step) {
      const p = path[i];
      paths3D.push([
        { x: p.x, y: yOffset, z: p.y },
        { x: p.x, y: yOffset + depth, z: p.y },
      ]);
    }
  }

  return paths3D;
}

// ── Enhanced 3D NL Parser ──────────────────────────────────────────

export interface Parsed3DCommand {
  type: 'surface' | 'parametric' | 'part3d';
  surface?: { expression: string; label: string; xRange: [number, number]; yRange: [number, number] };
  parametric?: { xExpr: string; yExpr: string; zExpr: string; tRange: [number, number]; label: string };
  partType?: string;
}

/**
 * Enhanced NL parser for 3D commands.
 */
export function parse3DCommand(input: string): Parsed3DCommand | null {
  const lower = input.toLowerCase();

  // Parametric curve: "parametric curve x=cos(t), y=sin(t), z=t"
  const paramMatch = input.match(/x\s*[=:]\s*(.+?)\s*[,;]\s*y\s*[=:]\s*(.+?)\s*[,;]\s*z\s*[=:]\s*(.+?)(?:\s|$)/i);
  if (paramMatch) {
    const xExpr = paramMatch[1].trim();
    const yExpr = paramMatch[2].trim();
    const zExpr = paramMatch[3].trim().replace(/[?.,;!]+$/, '');

    let tRange: [number, number] = [0, 2 * Math.PI];
    const tMatch = input.match(/t\s*(?:from|in|:)\s*\[?\s*(-?[\d.]+)\s*[,to]+\s*(-?[\d.]+)/i);
    if (tMatch) tRange = [parseFloat(tMatch[1]), parseFloat(tMatch[2])];

    return {
      type: 'parametric',
      parametric: { xExpr, yExpr, zExpr, tRange, label: `Parametric: (${xExpr}, ${yExpr}, ${zExpr})` },
    };
  }

  // 3D mechanical part
  if (/\b3[dD]\s+(gear|shaft|pulley|bearing|spring|cam)\b/i.test(lower) ||
      /\b(gear|shaft|pulley|bearing|spring|cam)\s+(?:in\s+)?3[dD]\b/i.test(lower)) {
    const partMatch = lower.match(/\b(gear|shaft|pulley|bearing|spring|cam)\b/);
    if (partMatch) return { type: 'part3d', partType: partMatch[1] };
  }

  // Surface z = f(x,y)
  const surfResult = parse3DPlotQuery(input);
  if (surfResult) {
    return {
      type: 'surface',
      surface: { expression: surfResult.expression, label: surfResult.label, xRange: surfResult.xRange, yRange: surfResult.yRange },
    };
  }

  return null;
}

// ── Enhanced Render with Parametric Curves ─────────────────────────

/**
 * Draw a parametric 3D curve.
 */
export function drawParametricCurve(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  curve: ParametricCurve3D
): void {
  const points = evaluateParametricCurve(curve);
  if (points.length < 2) return;

  ctx.strokeStyle = curve.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let started = false;

  for (const point of points) {
    const p = project(point, camera, width, height);
    if (!p) { started = false; continue; }
    if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();

  // Label
  const midPoint = points[Math.floor(points.length / 2)];
  const midP = project(midPoint, camera, width, height);
  if (midP) {
    ctx.fillStyle = curve.color;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(curve.label, midP[0] + 5, midP[1] - 5);
  }
}

/**
 * Draw 3D extruded paths (for mechanical parts).
 */
export function draw3DExtrudedPaths(
  ctx: CanvasRenderingContext2D,
  camera: Camera3D,
  width: number,
  height: number,
  paths: Vec3[][],
  color: string = '#00E5FF'
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';

  for (const path of paths) {
    ctx.beginPath();
    let started = false;
    for (const point of path) {
      const p = project(point, camera, width, height);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
}
