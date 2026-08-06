/**
 * math-analysis.ts — Numerical analysis engine for the Andrómeda chatbot.
 *
 * Provides: root finding, critical/inflection points, asymptotes,
 * domain/range estimation, numerical integration, intersection finding,
 * and full function analysis.
 *
 * All methods are numerical — no external API required.
 */

import { create, all } from 'mathjs';

const math = create(all);

// ── Types ──────────────────────────────────────────────────────────

export interface AnalysisResult {
  expression: string;
  domain: string;
  range: string;
  intercepts: { x: number[]; y: number | null };
  symmetry: string;
  asymptotes: { vertical: number[]; horizontal: number | null; slant: string | null };
  firstDerivative: string;
  criticalPoints: number[];
  intervalsIncrease: string[];
  intervalsDecrease: string[];
  secondDerivative: string;
  inflectionPoints: number[];
  concavityUp: string[];
  concavityDown: string[];
  endBehavior: string;
}

export interface IntersectionPoints {
  points: Array<{ x: number; y: number }>;
  f1: string;
  f2: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function preprocess(expr: string): string {
  let s = expr.trim();
  s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2');
  s = s.replace(/\)\(/g, ')*(');
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/\)(\d)/g, ')*$1');
  s = s.replace(/([a-zA-Z])\(/g, '$1*(');
  return s;
}

function compileFn(expr: string): (x: number) => number {
  const processed = preprocess(expr);
  try {
    const node = math.parse(processed);
    const code = node.compile();
    return (x: number) => {
      try {
        const val = code.evaluate({ x });
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && val !== null) {
          const c = val as { re: number; im: number };
          if (c.im !== undefined && c.im !== 0) return NaN;
          return c.re ?? NaN;
        }
        return NaN;
      } catch {
        return NaN;
      }
    };
  } catch {
    return () => NaN;
  }
}

/** Sample the function at n points across [a,b] */
function sample(fn: (x: number) => number, a: number, b: number, n = 1000): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = a + i * step;
    const y = fn(x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

// ── Root Finding ───────────────────────────────────────────────────

/** Find roots of f(x) = 0 in [a, b] using scanning + bisection */
export function findRoots(expr: string, a: number, b: number, tolerance = 1e-7): number[] {
  const fn = compileFn(expr);
  const roots: number[] = [];
  const n = 1000;
  const step = (b - a) / n;

  for (let i = 0; i < n; i++) {
    const x0 = a + i * step;
    const x1 = x0 + step;
    const y0 = fn(x0);
    const y1 = fn(x1);

    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (Math.abs(y0) < tolerance) {
      if (!roots.some(r => Math.abs(r - x0) < tolerance * 10)) {
        roots.push(x0);
      }
      continue;
    }
    if (y0 * y1 < 0) {
      // Bisection
      let lo = x0, hi = x1;
      for (let j = 0; j < 50; j++) {
        const mid = (lo + hi) / 2;
        const yMid = fn(mid);
        if (Math.abs(yMid) < tolerance) {
          if (!roots.some(r => Math.abs(r - mid) < tolerance * 10)) {
            roots.push(mid);
          }
          break;
        }
        if (fn(lo) * yMid < 0) hi = mid;
        else lo = mid;
      }
    }
  }
  return roots.map(r => parseFloat(r.toFixed(7)));
}

// ── Critical Points ────────────────────────────────────────────────

export function findCriticalPoints(expr: string, a: number, b: number): number[] {
  try {
    const processed = preprocess(expr);
    const deriv = math.derivative(processed, 'x');
    const derivStr = deriv.toString();
    return findRoots(derivStr, a, b);
  } catch {
    return [];
  }
}

// ── Inflection Points ──────────────────────────────────────────────

export function findInflectionPoints(expr: string, a: number, b: number): number[] {
  try {
    const processed = preprocess(expr);
    const deriv1 = math.derivative(processed, 'x');
    const deriv2 = math.derivative(deriv1, 'x');
    const deriv2Str = deriv2.toString();
    return findRoots(deriv2Str, a, b);
  } catch {
    return [];
  }
}

// ── Vertical Asymptotes ────────────────────────────────────────────

export function findVerticalAsymptotes(expr: string, a: number, b: number): number[] {
  const fn = compileFn(expr);
  const candidates: number[] = [];
  const n = 2000;
  const step = (b - a) / n;

  for (let i = 0; i < n; i++) {
    const x0 = a + i * step;
    const x1 = x0 + step;
    const y0 = fn(x0);
    const y1 = fn(x1);

    if (!Number.isFinite(y0) || !Number.isFinite(y1)) {
      // Check if there's a discontinuity here
      const mid = (x0 + x1) / 2;
      const yMid = fn(mid);
      if (!Number.isFinite(yMid)) {
        // Narrow down
        let lo = x0, hi = x1;
        for (let j = 0; j < 40; j++) {
          const m = (lo + hi) / 2;
          const ym = fn(m);
          if (!Number.isFinite(ym)) {
            // Check if sign changes on either side
            const left = fn(m - 0.001);
            const right = fn(m + 0.001);
            if (Number.isFinite(left) && Number.isFinite(right) && Math.abs(left) > 1000 || Math.abs(right) > 1000) {
              if (!candidates.some(c => Math.abs(c - m) < 0.001)) {
                candidates.push(m);
              }
              break;
            }
            hi = m;
          } else {
            lo = m;
          }
        }
      }
    }
    // Also check for sign crossing at infinity
    if (Number.isFinite(y0) && Number.isFinite(y1) && Math.abs(y0) > 1e6 && Math.abs(y1) > 1e6 && y0 * y1 < 0) {
      const mid = (x0 + x1) / 2;
      if (!candidates.some(c => Math.abs(c - mid) < 0.001)) {
        candidates.push(mid);
      }
    }
  }

  return candidates.map(c => parseFloat(c.toFixed(5)));
}

// ── Horizontal Asymptotes ──────────────────────────────────────────

export function findHorizontalAsymptote(expr: string): number | null {
  const fn = compileFn(expr);
  const large = 1e8;
  const pos = fn(large);
  const neg = fn(-large);
  if (Number.isFinite(pos) && Number.isFinite(neg) && Math.abs(pos - neg) < 1e-3) {
    return parseFloat(pos.toFixed(7));
  }
  return null;
}

// ── Domain Analysis ─────────────────────────────────────────────────

export function analyzeDomain(expr: string): string {
  const fn = compileFn(expr);
  const issues: string[] = [];

  // Check for sqrt of negative
  if (expr.includes('sqrt') || expr.includes('√')) {
    issues.push('x values where the radicand is negative');
  }
  // Check for division by x
  if (/\/\s*x\b/.test(expr) || /\/\s*\(.*x/.test(expr)) {
    issues.push('x ≠ 0 (division by zero)');
  }
  // Check for log/ln
  if (expr.includes('log') || expr.includes('ln')) {
    issues.push('x > 0 (logarithm domain)');
  }
  // Check for tan, sec, csc, cot
  if (/\btan\b/.test(expr) || /\bsec\b/.test(expr) || /\bcsc\b/.test(expr) || /\bcot\b/.test(expr)) {
    issues.push('x ≠ π/2 + nπ (trigonometric singularities)');
  }
  // Check for arcsin, arccos
  if (/\barcsin\b/.test(expr) || /\barccos\b/.test(expr) || /\basin\b/.test(expr) || /\bacos\b/.test(expr)) {
    issues.push('x ∈ [-1, 1] (inverse trig domain)');
  }

  // Test numerically
  const testPoints = [-100, -10, -1, -0.5, 0, 0.5, 1, 10, 100];
  const badPoints = testPoints.filter(x => !Number.isFinite(fn(x)));

  if (badPoints.length === 0 && issues.length === 0) {
    return 'ℝ (all real numbers)';
  }

  if (issues.length > 0) {
    return issues.join('; ');
  }

  return 'ℝ except at singularities';
}

// ── Range Estimation ───────────────────────────────────────────────

export function estimateRange(expr: string): string {
  const fn = compileFn(expr);
  const samples = sample(fn, -100, 100, 2000);
  if (samples.length === 0) return 'Cannot determine';

  const values = samples.map(s => s.y);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Check if function seems unbounded
  const fnLarge = fn(1e6);
  const fnLargeNeg = fn(-1e6);

  if (!Number.isFinite(fnLarge) || Math.abs(fnLarge) > 1e10) {
    if (!Number.isFinite(fnLargeNeg) || Math.abs(fnLargeNeg) > 1e10) {
      return 'ℝ (all real numbers)';
    }
    return `[${min.toFixed(4)}, ∞)`;
  }
  if (!Number.isFinite(fnLargeNeg) || Math.abs(fnLargeNeg) > 1e10) {
    return `(-∞, ${max.toFixed(4)}]`;
  }

  if (Math.abs(min - max) < 1e-6) {
    return `{${min.toFixed(4)}}`;
  }

  return `[${min.toFixed(4)}, ${max.toFixed(4)}]`;
}

// ── Symmetry ───────────────────────────────────────────────────────

export function checkSymmetry(expr: string): string {
  const fn = compileFn(expr);
  const testPoints = [1, 2, 3, 5, 10];
  let even = true;
  let odd = true;

  for (const x of testPoints) {
    const yPos = fn(x);
    const yNeg = fn(-x);
    if (!Number.isFinite(yPos) || !Number.isFinite(yNeg)) {
      even = false;
      odd = false;
      break;
    }
    if (Math.abs(yPos - yNeg) > 1e-6) even = false;
    if (Math.abs(yPos + yNeg) > 1e-6) odd = false;
  }

  if (even) return 'Even: f(-x) = f(x) — symmetric about y-axis';
  if (odd) return 'Odd: f(-x) = -f(x) — symmetric about origin';
  return 'Neither even nor odd';
}

// ── Numerical Integration (Simpson's Rule) ─────────────────────────

export function numericalIntegrate(expr: string, a: number, b: number, n = 1000): number {
  const fn = compileFn(expr);
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = fn(a) + fn(b);

  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    const y = fn(x);
    if (!Number.isFinite(y)) return NaN;
    sum += y * (i % 2 === 0 ? 2 : 4);
  }

  return (h / 3) * sum;
}

// ── Intersection Finding ────────────────────────────────────────────

export function findIntersections(expr1: string, expr2: string, a = -10, b = 10): IntersectionPoints {
  const diffExpr = `(${preprocess(expr1)}) - (${preprocess(expr2)})`;
  const roots = findRoots(diffExpr, a, b);
  const fn1 = compileFn(expr1);

  const points = roots.map(x => ({
    x: parseFloat(x.toFixed(7)),
    y: parseFloat(fn1(x).toFixed(7)),
  })).filter(p => Number.isFinite(p.y));

  return { points, f1: expr1, f2: expr2 };
}

// ── Full Function Analysis ─────────────────────────────────────────

export function fullAnalysis(expr: string, a = -10, b = 10): AnalysisResult {
  const processed = preprocess(expr);
  const fn = compileFn(expr);

  // Domain
  const domain = analyzeDomain(expr);

  // Range
  const range = estimateRange(expr);

  // Intercepts
  const xIntercepts = findRoots(expr, a, b);
  const yIntercept = Number.isFinite(fn(0)) ? parseFloat(fn(0).toFixed(7)) : null;

  // Symmetry
  const symmetry = checkSymmetry(expr);

  // Asymptotes
  const vertical = findVerticalAsymptotes(expr, a, b);
  const horizontal = findHorizontalAsymptote(expr);
  const slant: string | null = null; // Slant asymptotes require polynomial division

  // Derivatives
  let firstDerivative = 'N/A';
  let secondDerivative = 'N/A';
  try {
    const d1 = math.derivative(processed, 'x');
    firstDerivative = d1.toString();
    const d2 = math.derivative(d1, 'x');
    secondDerivative = d2.toString();
  } catch { /* keep N/A */ }

  // Critical points
  const criticalPoints = findCriticalPoints(expr, a, b);

  // Inflection points
  const inflectionPoints = findInflectionPoints(expr, a, b);

  // Intervals of increase/decrease
  const intervalsIncrease: string[] = [];
  const intervalsDecrease: string[] = [];
  const sortedCrits = [...criticalPoints].sort((x, y) => x - y);
  const allBounds = [a, ...sortedCrits, b];

  for (let i = 0; i < allBounds.length - 1; i++) {
    const mid = (allBounds[i] + allBounds[i + 1]) / 2;
    try {
      const derivVal = math.evaluate(firstDerivative, { x: mid });
      if (typeof derivVal === 'number' && derivVal > 0.01) {
        intervalsIncrease.push(`(${allBounds[i].toFixed(2)}, ${allBounds[i + 1].toFixed(2)})`);
      } else if (typeof derivVal === 'number' && derivVal < -0.01) {
        intervalsDecrease.push(`(${allBounds[i].toFixed(2)}, ${allBounds[i + 1].toFixed(2)})`);
      }
    } catch { /* skip */ }
  }

  // Concavity
  const concavityUp: string[] = [];
  const concavityDown: string[] = [];
  const sortedInfl = [...inflectionPoints].sort((x, y) => x - y);
  const allBounds2 = [a, ...sortedInfl, b];

  for (let i = 0; i < allBounds2.length - 1; i++) {
    const mid = (allBounds2[i] + allBounds2[i + 1]) / 2;
    try {
      const d2val = math.evaluate(secondDerivative, { x: mid });
      if (typeof d2val === 'number' && d2val > 0.01) {
        concavityUp.push(`(${allBounds2[i].toFixed(2)}, ${allBounds2[i + 1].toFixed(2)})`);
      } else if (typeof d2val === 'number' && d2val < -0.01) {
        concavityDown.push(`(${allBounds2[i].toFixed(2)}, ${allBounds2[i + 1].toFixed(2)})`);
      }
    } catch { /* skip */ }
  }

  // End behavior
  const fnPosBig = fn(1e6);
  const fnNegBig = fn(-1e6);
  let endBehavior = '';
  if (!Number.isFinite(fnPosBig)) endBehavior += 'As x → +∞, f(x) → ±∞ ';
  else endBehavior += `As x → +∞, f(x) → ${fnPosBig.toFixed(4)} `;
  if (!Number.isFinite(fnNegBig)) endBehavior += 'As x → -∞, f(x) → ±∞';
  else endBehavior += `As x → -∞, f(x) → ${fnNegBig.toFixed(4)}`;

  return {
    expression: expr,
    domain,
    range,
    intercepts: { x: xIntercepts.map(x => parseFloat(x.toFixed(7))), y: yIntercept },
    symmetry,
    asymptotes: { vertical, horizontal, slant },
    firstDerivative,
    criticalPoints: criticalPoints.map(c => parseFloat(c.toFixed(7))),
    intervalsIncrease,
    intervalsDecrease,
    secondDerivative,
    inflectionPoints: inflectionPoints.map(p => parseFloat(p.toFixed(7))),
    concavityUp,
    concavityDown,
    endBehavior,
  };
}

// ── Trig Function Analysis ─────────────────────────────────────────

export interface TrigProperties {
  expression: string;
  amplitude: number | null;
  period: number | null;
  frequency: number | null;
  phaseShift: number | null;
  verticalShift: number | null;
  functionType: string;
}

/**
 * Analyze a trigonometric function for its key properties.
 * Works for sin, cos, tan, and their variants.
 * Format: a * f(b * (x - c)) + d
 */
export function analyzeTrig(expr: string): TrigProperties {
  const fn = compileFn(expr);

  // Detect function type
  let funcType = 'unknown';
  if (/\bsin\b/.test(expr) && !/\barcsin\b/.test(expr) && !/\bsinh\b/.test(expr)) funcType = 'sin';
  else if (/\bcos\b/.test(expr) && !/\barccos\b/.test(expr) && !/\bcosh\b/.test(expr)) funcType = 'cos';
  else if (/\btan\b/.test(expr) && !/\barctan\b/.test(expr) && !/\btanh\b/.test(expr)) funcType = 'tan';
  else if (/\bcot\b/.test(expr) && !/\barccot\b/.test(expr)) funcType = 'cot';
  else if (/\bsec\b/.test(expr) && !/\barcsec\b/.test(expr)) funcType = 'sec';
  else if (/\bcsc\b/.test(expr) && !/\barccsc\b/.test(expr)) funcType = 'csc';

  const tanFamily = new Set(['tan', 'cot', 'sec', 'csc']);
  const hasPeriod = !tanFamily.has(funcType);

  // Estimate vertical shift (d) by averaging function values
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const x = i * 0.5;
    const y = fn(x);
    if (Number.isFinite(y)) samples.push(y);
  }
  let verticalShift: number | null = null;
  if (samples.length >= 5) {
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    verticalShift = parseFloat(((min + max) / 2).toFixed(6));
  }

  // Estimate amplitude (a) as half the range of variation
  let amplitude: number | null = null;
  if (samples.length >= 5) {
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    amplitude = parseFloat(((max - min) / 2).toFixed(6));
  }

  // Period estimation for sin/cos
  let period: number | null = null;
  let frequency: number | null = null;
  if (hasPeriod && samples.length >= 10) {
    // Find approximate period by looking for sign changes and peaks
    // Try to detect coefficient b from the expression pattern
    const bMatch = expr.match(new RegExp(`${funcType}\\s*\\(\\s*([\\d.]+)\\s*\\*\\s*x`));
    const bMatch2 = expr.match(new RegExp(`${funcType}\\s*\\(\\s*([\\d.]+)x`));
    const bVal = bMatch ? parseFloat(bMatch[1]) : (bMatch2 ? parseFloat(bMatch2[1]) : null);

    if (bVal && bVal !== 0) {
      period = parseFloat(((2 * Math.PI) / Math.abs(bVal)).toFixed(6));
      frequency = parseFloat((Math.abs(bVal) / (2 * Math.PI)).toFixed(6));
    } else if (funcType === 'sin' || funcType === 'cos') {
      // Default: find period by zero-crossing
      period = parseFloat((2 * Math.PI).toFixed(6));
      frequency = parseFloat((1 / (2 * Math.PI)).toFixed(6));
    }
  }

  // Phase shift estimation
  let phaseShift: number | null = null;
  if (funcType !== 'unknown') {
    // Try to extract (x - c) pattern
    const psMatch = expr.match(new RegExp(`${funcType}\\s*\\(\\s*(?:[\\d.]+\\s*\\*\\s*)?\\(?x\\s*([+-])\\s*([\\d.]+)`));
    const psMatch2 = expr.match(new RegExp(`${funcType}\\s*\\(\\s*(?:[\\d.]+\\s*\\*\\s*)?x\\s*([+-])\\s*([\\d.]+)`));
    if (psMatch) {
      const sign = psMatch[1] === '-' ? 1 : -1;
      phaseShift = parseFloat((sign * parseFloat(psMatch[2])).toFixed(6));
    } else if (psMatch2) {
      const sign = psMatch2[1] === '-' ? 1 : -1;
      phaseShift = parseFloat((sign * parseFloat(psMatch2[2])).toFixed(6));
    } else {
      // Evaluate at x=0: for sin(b*(x-c)), f(0) = sin(-b*c)
      // For standard phase: phase shift is where the function crosses upward
      if (funcType === 'sin') {
        // For sin: find where it crosses 0 going up near origin
        const y0 = fn(0);
        if (Number.isFinite(y0) && verticalShift !== null) {
          // Normalize: sin(b*(x-c))+d, at x=0: sin(-b*c)+d = y0
          // Simple approximation
          phaseShift = 0;
        }
      } else {
        phaseShift = 0;
      }
    }
  }

  return { expression: expr, amplitude, period, frequency, phaseShift, verticalShift, functionType: funcType };
}

/**
 * Generate a step-by-step explanation of a trig function's properties.
 */
export function explainTrigProperties(expr: string): string {
  const props = analyzeTrig(expr);
  const parts: string[] = [`**Analysis of:** \`${expr}\``, ''];

  parts.push(`**Function Type:** ${props.functionType}`);

  if (props.amplitude !== null && props.amplitude > 0.001) {
    parts.push(`**Amplitude:** ${props.amplitude} — this is the vertical stretch factor`);
  }

  if (props.period !== null) {
    parts.push(`**Period:** ${props.period} — one full cycle repeats every ${props.period} units`);
  }

  if (props.frequency !== null) {
    parts.push(`**Frequency:** ${props.frequency} — cycles per unit x`);
  }

  if (props.phaseShift !== null && Math.abs(props.phaseShift) > 0.001) {
    const dir = props.phaseShift > 0 ? 'right' : 'left';
    parts.push(`**Phase Shift:** ${Math.abs(props.phaseShift)} units to the ${dir}`);
  }

  if (props.verticalShift !== null && Math.abs(props.verticalShift) > 0.001) {
    const dir = props.verticalShift > 0 ? 'up' : 'down';
    parts.push(`**Vertical Shift:** ${Math.abs(props.verticalShift)} units ${dir}`);
  }

  if (props.functionType === 'tan' || props.functionType === 'cot') {
    parts.push('');
    parts.push('⚠️ **Note:** Tangent and cotangent have vertical asymptotes where the function is undefined.');
  }

  return parts.join('\n');
}

// ── Logarithmic Function Analysis ──────────────────────────────────

export interface LogProperties {
  expression: string;
  base: number | null;
  verticalAsymptote: number | null;
  horizontalShift: number | null;
  verticalShift: number | null;
  domain: string;
  range: string;
}

/**
 * Analyze a logarithmic function for its key properties.
 * Format: a * log_base(x - h) + k
 */
export function analyzeLog(expr: string): LogProperties {
  // Detect base: log(x) = log10, ln(x) = natural log, log2(x), logN(x)
  let base: number | null = null;

  if (/\bln\b/.test(expr)) base = Math.E;
  else if (/\blog2\b/.test(expr)) base = 2;
  else if (/\blog10\b/.test(expr)) base = 10;
  else if (/\blog\s*\(/.test(expr)) {
    // Try to extract base from log(base, x) or log(x) format
    const baseMatch = expr.match(/log\s*\(\s*([\d.]+)\s*,/);
    if (baseMatch) base = parseFloat(baseMatch[1]);
    else base = 10; // Default: log() means log10
  }

  // Detect horizontal shift: log(x - h) or ln(x - h)
  let horizontalShift: number | null = null;
  let verticalAsymptote: number | null = null;

  const hsMatch = expr.match(/\b(?:log|ln|log2|log10)\s*\(\s*x\s*([+-])\s*([\d.]+)/);
  if (hsMatch) {
    const sign = hsMatch[1] === '-' ? 1 : -1;
    horizontalShift = parseFloat((sign * parseFloat(hsMatch[2])).toFixed(6));
    verticalAsymptote = parseFloat((-1 * horizontalShift).toFixed(6));
  } else {
    verticalAsymptote = 0;
    horizontalShift = 0;
  }

  // Vertical shift: try to estimate from the expression
  let verticalShift: number | null = null;
  const vsMatch = expr.match(/\)\s*([+-])\s*([\d.]+)\s*$/);
  if (vsMatch) {
    const sign = vsMatch[1] === '+' ? 1 : -1;
    verticalShift = parseFloat((sign * parseFloat(vsMatch[2])).toFixed(6));
  }

  // Domain
  let domain = 'x > 0';
  if (verticalAsymptote !== null && verticalAsymptote !== 0) {
    domain = `x > ${verticalAsymptote.toFixed(4)}`;
  }

  return {
    expression: expr,
    base,
    verticalAsymptote,
    horizontalShift,
    verticalShift,
    domain,
    range: 'ℝ (all real numbers)',
  };
}

/**
 * Generate a step-by-step explanation of a log function's properties.
 */
export function explainLogProperties(expr: string): string {
  const props = analyzeLog(expr);
  const parts: string[] = [`**Analysis of:** \`${expr}\``, ''];

  if (props.base !== null) {
    const baseLabel = props.base === Math.E ? 'e (natural log)' : `${props.base}`;
    parts.push(`**Base:** ${baseLabel}`);
  }

  parts.push(`**Domain:** ${props.domain}`);
  parts.push(`**Range:** ${props.range}`);

  if (props.verticalAsymptote !== null) {
    parts.push(`**Vertical Asymptote:** x = ${props.verticalAsymptote}`);
  }

  if (props.horizontalShift !== null && Math.abs(props.horizontalShift) > 0.001) {
    const dir = props.horizontalShift > 0 ? 'right' : 'left';
    parts.push(`**Horizontal Shift:** ${Math.abs(props.horizontalShift)} units to the ${dir}`);
  }

  if (props.verticalShift !== null && Math.abs(props.verticalShift) > 0.001) {
    const dir = props.verticalShift > 0 ? 'up' : 'down';
    parts.push(`**Vertical Shift:** ${Math.abs(props.verticalShift)} units ${dir}`);
  }

  // Base > 1: increasing; 0 < base < 1: decreasing
  if (props.base !== null) {
    if (props.base > 1) {
      parts.push('');
      parts.push('📈 The function is **increasing** (base > 1).');
    } else if (props.base > 0 && props.base < 1) {
      parts.push('');
      parts.push('📉 The function is **decreasing** (0 < base < 1).');
    }
  }

  // Key points
  parts.push('');
  parts.push('**Key points:**');
  if (props.verticalAsymptote !== null) {
    const x0 = props.verticalAsymptote + 1;
    parts.push(`• At x = ${x0.toFixed(2)}: f(x) = 0 (x-intercept)`);
  }
  if (props.base !== null && props.base > 0 && props.verticalAsymptote !== null) {
    const x1 = props.verticalAsymptote + props.base;
    parts.push(`• At x = ${x1.toFixed(2)}: f(x) = 1 (base point)`);
  }

  return parts.join('\n');
}

// ── Comparative Analysis ───────────────────────────────────────────

export interface ComparisonResult {
  f1: string;
  f2: string;
  intersections: IntersectionPoints;
  f1Analysis: AnalysisResult;
  f2Analysis: AnalysisResult;
  similarities: string[];
  differences: string[];
}

export function compareFunctions(expr1: string, expr2: string, a = -10, b = 10): ComparisonResult {
  const f1a = fullAnalysis(expr1, a, b);
  const f2a = fullAnalysis(expr2, a, b);
  const intersections = findIntersections(expr1, expr2, a, b);

  const similarities: string[] = [];
  const differences: string[] = [];

  // Compare symmetries
  if (f1a.symmetry === f2a.symmetry) {
    similarities.push(`Both have the same symmetry: ${f1a.symmetry}`);
  } else {
    differences.push(`Symmetry differs: f₁ is ${f1a.symmetry}, f₂ is ${f2a.symmetry}`);
  }

  // Compare end behavior
  if (f1a.endBehavior === f2a.endBehavior) {
    similarities.push('Both have the same end behavior');
  } else {
    differences.push(`End behavior differs: f₁ — ${f1a.endBehavior}; f₂ — ${f2a.endBehavior}`);
  }

  // Compare number of critical points
  if (f1a.criticalPoints.length === f2a.criticalPoints.length) {
    similarities.push(`Both have ${f1a.criticalPoints.length} critical point(s) in [-10, 10]`);
  } else {
    differences.push(`f₁ has ${f1a.criticalPoints.length} critical point(s), f₂ has ${f2a.criticalPoints.length}`);
  }

  // Intersections
  if (intersections.points.length > 0) {
    similarities.push(`They intersect at ${intersections.points.length} point(s)`);
  } else {
    differences.push('They do not intersect in the analyzed range');
  }

  return { f1: expr1, f2: expr2, intersections, f1Analysis: f1a, f2Analysis: f2a, similarities, differences };
}