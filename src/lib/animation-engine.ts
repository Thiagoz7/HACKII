/**
 * animation-engine.ts — Animation system for Andrómeda.
 *
 * Supports: wave animations (parametric time-based), rotation of
 * mechanical parts, custom function animations, and playback control.
 */

import type { Point2D } from '../types/graph';

// ── Types ──────────────────────────────────────────────────────────

export type AnimationType = 'wave' | 'rotation' | 'parametric';
export type AnimationDirection = 'clockwise' | 'counterclockwise' | 'forward' | 'backward';

export interface AnimationConfig {
  id: string;
  type: AnimationType;
  label: string;
  expression?: string;          // for wave: the function expression
  speed: number;                // multiplier (1 = normal)
  direction: AnimationDirection;
  duration: number;             // seconds, 0 = infinite
  color: string;
  /** For rotation: the paths to rotate */
  paths?: Point2D[][];
  /** For rotation: center of rotation */
  rotationCenter?: Point2D;
}

export interface AnimationState {
  config: AnimationConfig;
  playing: boolean;
  time: number;      // current time in seconds
  startTime: number; // when play started (performance.now)
}

// ── Animation Generators ───────────────────────────────────────────

/**
 * Generate wave animation points for a given time value.
 * The wave moves by shifting the phase based on time.
 */
export function generateWaveFrame(
  expression: string,
  time: number,
  speed: number,
  direction: AnimationDirection,
  xMin: number,
  xMax: number,
  steps = 400
): Point2D[] {
  const points: Point2D[] = [];
  const phase = direction === 'backward' ? -time * speed : time * speed;
  const step = (xMax - xMin) / steps;

  // Build a simple evaluator for common wave functions
  const fn = buildWaveFunction(expression, phase);

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * step;
    const y = fn(x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    } else {
      points.push({ x: NaN, y: NaN });
    }
  }
  return points;
}

/**
 * Rotate a set of paths around a center point by a given angle.
 */
export function generateRotationFrame(
  paths: Point2D[][],
  center: Point2D,
  time: number,
  speed: number,
  direction: AnimationDirection
): Point2D[][] {
  const sign = direction === 'clockwise' ? -1 : 1;
  const angle = sign * time * speed;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return paths.map(path =>
    path.map(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      };
    })
  );
}

// ── Wave Function Builder ──────────────────────────────────────────

function buildWaveFunction(expression: string, phase: number): (x: number) => number {
  // Replace common patterns to inject phase
  // sin(x) → sin(x + phase), cos(x) → cos(x + phase), etc.
  const expr = expression.trim().toLowerCase();

  return (x: number): number => {
    try {
      // Simple evaluation for common wave patterns
      const xp = x + phase;
      if (expr === 'sin(x)' || expr === 'sin x') return Math.sin(xp);
      if (expr === 'cos(x)' || expr === 'cos x') return Math.cos(xp);
      if (expr === 'tan(x)') return Math.tan(xp);
      if (expr === 'sin(2x)' || expr === 'sin(2*x)') return Math.sin(2 * xp);
      if (expr === 'cos(2x)' || expr === 'cos(2*x)') return Math.cos(2 * xp);
      if (expr === 'sin(x)^2') return Math.sin(xp) ** 2;
      if (expr === 'cos(x)^2') return Math.cos(xp) ** 2;

      // Generic: try to evaluate with phase-shifted x
      // Support patterns like A*sin(B*x + C) by shifting x
      const processed = expression
        .replace(/\bx\b/gi, `(${xp})`)
        .replace(/(\d)([a-zA-Z])/g, '$1*$2');

      // Simple safe eval for math expressions
      return evalMathExpr(processed);
    } catch {
      return NaN;
    }
  };
}

function evalMathExpr(expr: string): number {
  // Safe math expression evaluator using Function constructor
  // Only allows math operations and functions
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
    .replace(/\be\b/g, String(Math.E))
    .replace(/\^/g, '**');

  try {
    const fn = new Function(`return (${sanitized})`);
    const result = fn();
    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedAnimationRequest {
  type: AnimationType;
  expression?: string;
  label: string;
  speed: number;
  direction: AnimationDirection;
  duration: number;
  targetPart?: string; // for rotation: which part to rotate
}

/**
 * Parse a natural language animation request.
 */
export function parseAnimationQuery(input: string): ParsedAnimationRequest | null {
  const lower = input.toLowerCase();

  // Default values
  let speed = 1;
  let direction: AnimationDirection = 'forward';
  let duration = 0; // infinite

  // Parse speed
  const speedMatch = lower.match(/speed\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
  if (speedMatch) speed = parseFloat(speedMatch[1]);
  if (/\bfast\b/.test(lower)) speed = 2;
  if (/\bslow\b/.test(lower)) speed = 0.5;
  if (/\bvery\s+fast\b/.test(lower)) speed = 3;
  if (/\bvery\s+slow\b/.test(lower)) speed = 0.25;

  // Parse direction
  if (/\bclock\s*wise\b/.test(lower)) direction = 'clockwise';
  if (/\bcounter\s*-?\s*clock\s*wise\b/.test(lower) || /\banticlock\b/.test(lower)) direction = 'counterclockwise';
  if (/\bbackward\b/.test(lower) || /\breverse\b/.test(lower)) direction = 'backward';

  // Parse duration
  const durMatch = lower.match(/(?:for|duration)\s*(?:of\s*)?(\d+\.?\d*)\s*(?:s|sec|seconds?)/);
  if (durMatch) duration = parseFloat(durMatch[1]);

  // ── Rotation animation ──
  if (/\brotat(?:e|ing|ion)\b/.test(lower) || /\bspin(?:ning)?\b/.test(lower)) {
    let targetPart: string | undefined;
    if (/\bgear\b/.test(lower)) targetPart = 'gear';
    else if (/\bshaft\b/.test(lower)) targetPart = 'shaft';
    else if (/\bpulley\b/.test(lower)) targetPart = 'pulley';
    else if (/\bcam\b/.test(lower)) targetPart = 'cam';
    else if (/\bbearing\b/.test(lower)) targetPart = 'bearing';

    if (direction === 'forward') direction = 'counterclockwise';

    return {
      type: 'rotation',
      label: `Rotating ${targetPart ?? 'Part'}`,
      speed,
      direction,
      duration,
      targetPart,
    };
  }

  // ── Wave animation ──
  if (/\b(wave|animat|oscillat|mov(?:e|ing)|propagat)\b/.test(lower)) {
    // Try to extract the function expression
    let expression = 'sin(x)';

    // Check for specific functions
    if (/\bcos\b/.test(lower)) expression = 'cos(x)';
    if (/\btan\b/.test(lower)) expression = 'tan(x)';
    if (/\bsin\s*\(\s*2\s*\*?\s*x\s*\)/.test(lower)) expression = 'sin(2*x)';
    if (/\bcos\s*\(\s*2\s*\*?\s*x\s*\)/.test(lower)) expression = 'cos(2*x)';

    // Try generic extraction
    const exprMatch = lower.match(/(?:animate|wave|show)\s+(?:a\s+)?(.+?)(?:\s+wave|\s+animation|\s+moving|\s*$)/);
    if (exprMatch) {
      const extracted = exprMatch[1].trim();
      if (/^(sin|cos|tan|sqrt|exp|log|ln|x)/.test(extracted) || /\bx\b/.test(extracted)) {
        expression = extracted;
      }
    }

    return {
      type: 'wave',
      expression,
      label: `Wave: ${expression}`,
      speed,
      direction,
      duration,
    };
  }

  // ── Parametric animation (fallback) ──
  if (/\banimat\b/.test(lower)) {
    let expression = 'sin(x)';
    const exprMatch = lower.match(/animate\s+(.+?)(?:\s+at|\s+with|\s*$)/);
    if (exprMatch) {
      const extracted = exprMatch[1].trim().replace(/^(a|an|the)\s+/i, '');
      if (/\bx\b/.test(extracted) || /^(sin|cos|tan)/.test(extracted)) {
        expression = extracted;
      }
    }

    return {
      type: 'wave',
      expression,
      label: `Animation: ${expression}`,
      speed,
      direction,
      duration,
    };
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────

let idCounter = 0;
export function createAnimationId(): string {
  return `anim-${++idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

const ANIM_COLORS = ['#00E5FF', '#76FF03', '#FF6D00', '#D500F9', '#FFEA00', '#FF1744'];

export function getAnimationColor(index: number): string {
  return ANIM_COLORS[index % ANIM_COLORS.length];
}
