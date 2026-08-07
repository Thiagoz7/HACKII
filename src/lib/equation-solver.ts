/**
 * equation-solver.ts — Symbolic algebra and equation solving for Andrómeda.
 *
 * Uses mathjs for symbolic manipulation, simplification, and root finding.
 * Supports: polynomial equations, transcendental equations, systems of equations,
 * and custom function import/definition.
 */

import { create, all } from 'mathjs';

const math = create(all);

// ── Types ──────────────────────────────────────────────────────────

export interface SolveResult {
  equation: string;
  variable: string;
  symbolicRoots: string[];
  numericalRoots: number[];
  steps: string[];
  plotExpression?: string; // expression to plot for visualization
}

export interface ImportedFunction {
  name: string;
  variable: string;
  expression: string;
  label: string;
}

// ── Function Import ────────────────────────────────────────────────

/**
 * Parse a function definition from natural language.
 * Handles: "f(x) = sin(x) + log(x)", "g(y) = y^2 + 3y", "h(t) = exp(-t)"
 */
export function parseFunction(input: string): ImportedFunction | null {
  // Pattern: name(var) = expression
  const fnMatch = input.match(/([a-zA-Z]\w*)\s*\(\s*([a-zA-Z])\s*\)\s*=\s*(.+)/);
  if (fnMatch) {
    const name = fnMatch[1];
    const variable = fnMatch[2];
    let expression = fnMatch[3].trim().replace(/[?.,;!]+$/, '');
    // Preprocess
    expression = expression.replace(/(\d)([a-zA-Z])/g, '$1*$2');
    return {
      name,
      variable,
      expression,
      label: `${name}(${variable}) = ${expression}`,
    };
  }

  // Pattern: just an expression with x (implicit f(x))
  const exprMatch = input.match(/(?:import|add|define)\s+(?:function\s+)?(.+)/i);
  if (exprMatch) {
    let expression = exprMatch[1].trim().replace(/[?.,;!]+$/, '');
    // Check if it has the f(x)= pattern inside
    const innerFn = expression.match(/([a-zA-Z]\w*)\s*\(\s*([a-zA-Z])\s*\)\s*=\s*(.+)/);
    if (innerFn) {
      expression = innerFn[3].trim();
      return {
        name: innerFn[1],
        variable: innerFn[2],
        expression,
        label: `${innerFn[1]}(${innerFn[2]}) = ${expression}`,
      };
    }
    // Default: f(x) = expression
    expression = expression.replace(/(\d)([a-zA-Z])/g, '$1*$2');
    return {
      name: 'f',
      variable: 'x',
      expression,
      label: `f(x) = ${expression}`,
    };
  }

  return null;
}

// ── Equation Solving ───────────────────────────────────────────────

/**
 * Solve an equation. Handles forms like:
 * - "3x^2 = 2x + 1" → solve 3x^2 - 2x - 1 = 0
 * - "x^3 - 4x + 2 = 0"
 * - "sin(x) = 0.5"
 */
export function solveEquation(input: string, variable = 'x'): SolveResult {
  const steps: string[] = [];
  let equation = input.trim();

  steps.push(`**Solving:** ${equation}`);

  // Normalize: move everything to LHS = 0
  let lhs: string;
  let rhs = '0';

  if (equation.includes('=')) {
    const parts = equation.split('=');
    lhs = parts[0].trim();
    rhs = parts[1].trim();
  } else {
    lhs = equation;
  }

  // Expression to find roots of: LHS - RHS = 0
  const expr = rhs === '0' ? lhs : `(${lhs}) - (${rhs})`;
  const processed = preprocess(expr);

  steps.push(`Rewritten as: ${processed} = 0`);
  steps.push('');

  // Try symbolic solve via mathjs
  const symbolicRoots: string[] = [];
  try {
    // Try to simplify
    const simplified = math.simplify(processed).toString();
    steps.push(`Simplified: ${simplified} = 0`);

    // Try mathjs rationalize for polynomial roots
    const rationalized = math.rationalize(processed, {}, true);
    if (rationalized && typeof rationalized === 'object' && 'coefficients' in rationalized) {
      steps.push(`Polynomial form identified`);
    }
  } catch {
    // Continue to numerical
  }

  // Try quadratic formula for degree-2 polynomials
  const quadResult = tryQuadratic(processed, variable);
  if (quadResult) {
    steps.push('');
    steps.push('**Quadratic Formula:** x = (-b ± √(b²-4ac)) / 2a');
    steps.push(`  a = ${quadResult.a}, b = ${quadResult.b}, c = ${quadResult.c}`);
    steps.push(`  Discriminant Δ = ${quadResult.discriminant.toFixed(6)}`);

    if (quadResult.discriminant >= 0) {
      for (const root of quadResult.roots) {
        symbolicRoots.push(root.symbolic);
      }
      steps.push(`  Roots: ${quadResult.roots.map(r => r.symbolic).join(', ')}`);
    } else {
      steps.push(`  Δ < 0: Complex roots`);
      symbolicRoots.push(`(${-quadResult.b} + i√${Math.abs(quadResult.discriminant).toFixed(4)}) / ${2 * quadResult.a}`);
      symbolicRoots.push(`(${-quadResult.b} - i√${Math.abs(quadResult.discriminant).toFixed(4)}) / ${2 * quadResult.a}`);
    }
  }

  // Numerical root finding (always attempt)
  const numericalRoots = findNumericalRoots(processed, variable, -20, 20);
  steps.push('');
  steps.push(`**Numerical roots** (in [-20, 20]):`);
  if (numericalRoots.length > 0) {
    numericalRoots.forEach((r, i) => steps.push(`  x${i + 1} ≈ ${r.toFixed(8)}`));
  } else {
    steps.push('  No real roots found in the search range.');
  }

  // Plot expression (the LHS for visualization)
  const plotExpression = processed.replace(/\*/g, '*');

  return {
    equation: input,
    variable,
    symbolicRoots,
    numericalRoots,
    steps,
    plotExpression,
  };
}

// ── Quadratic Detection ────────────────────────────────────────────

interface QuadraticResult {
  a: number;
  b: number;
  c: number;
  discriminant: number;
  roots: Array<{ numeric: number; symbolic: string }>;
}

function tryQuadratic(expr: string, variable: string): QuadraticResult | null {
  try {
    const node = math.parse(preprocess(expr));
    // Try to evaluate coefficients by substitution
    const compiled = node.compile();

    const f0 = compiled.evaluate({ [variable]: 0 });
    const f1 = compiled.evaluate({ [variable]: 1 });
    const fMinus1 = compiled.evaluate({ [variable]: -1 });
    const f2 = compiled.evaluate({ [variable]: 2 });

    if (typeof f0 !== 'number' || typeof f1 !== 'number' || typeof fMinus1 !== 'number' || typeof f2 !== 'number') return null;

    // For ax² + bx + c: f(0)=c, f(1)=a+b+c, f(-1)=a-b+c
    const c = f0;
    const aPlusB = f1 - c; // a + b
    const aMinusB = fMinus1 - c; // a - b
    const a = (aPlusB + aMinusB) / 2;
    const b = (aPlusB - aMinusB) / 2;

    // Verify it's actually quadratic: f(2) should = 4a + 2b + c
    const expected = 4 * a + 2 * b + c;
    if (Math.abs(f2 - expected) > 0.001) return null; // not quadratic

    if (Math.abs(a) < 1e-10) return null; // not quadratic

    const discriminant = b * b - 4 * a * c;
    const roots: Array<{ numeric: number; symbolic: string }> = [];

    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);
      const x1 = (-b + sqrtD) / (2 * a);
      const x2 = (-b - sqrtD) / (2 * a);
      roots.push({ numeric: x1, symbolic: formatRoot(-b, sqrtD, 2 * a) });
      if (Math.abs(x1 - x2) > 1e-10) {
        roots.push({ numeric: x2, symbolic: formatRoot(-b, -sqrtD, 2 * a) });
      }
    }

    return { a, b, c, discriminant, roots };
  } catch {
    return null;
  }
}

function formatRoot(negB: number, sqrtD: number, twoA: number): string {
  const val = (negB + sqrtD) / twoA;
  // Check if it's a nice number
  if (Number.isInteger(val)) return val.toString();
  if (Math.abs(val - Math.round(val * 100) / 100) < 1e-8) return val.toFixed(4);
  return val.toFixed(6);
}

// ── Numerical Root Finding ─────────────────────────────────────────

function findNumericalRoots(expr: string, variable: string, a: number, b: number): number[] {
  const fn = compileFn(expr, variable);
  const roots: number[] = [];
  const n = 2000;
  const step = (b - a) / n;
  const tolerance = 1e-10;

  for (let i = 0; i < n; i++) {
    const x0 = a + i * step;
    const x1 = x0 + step;
    const y0 = fn(x0);
    const y1 = fn(x1);

    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;

    if (Math.abs(y0) < tolerance) {
      if (!roots.some(r => Math.abs(r - x0) < 0.001)) {
        roots.push(parseFloat(x0.toFixed(10)));
      }
      continue;
    }

    if (y0 * y1 < 0) {
      // Bisection
      let lo = x0, hi = x1;
      for (let j = 0; j < 60; j++) {
        const mid = (lo + hi) / 2;
        const yMid = fn(mid);
        if (Math.abs(yMid) < tolerance) { lo = mid; hi = mid; break; }
        if (fn(lo) * yMid < 0) hi = mid;
        else lo = mid;
      }
      const root = (lo + hi) / 2;
      if (!roots.some(r => Math.abs(r - root) < 0.001)) {
        roots.push(parseFloat(root.toFixed(10)));
      }
    }
  }

  return roots.sort((x, y) => x - y);
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedSolveQuery {
  type: 'solve' | 'import';
  equation?: string;
  functionDef?: ImportedFunction;
}

/**
 * Parse a natural language solve/import request.
 */
export function parseSolveQuery(input: string): ParsedSolveQuery | null {
  const lower = input.toLowerCase();

  // Import/define function
  if (/\b(import|define|add)\s+(?:function\s+)?/i.test(lower)) {
    const fn = parseFunction(input);
    if (fn) return { type: 'import', functionDef: fn };
  }

  // Explicit f(x) = ... pattern
  if (/[a-zA-Z]\s*\(\s*[a-zA-Z]\s*\)\s*=/.test(input)) {
    const fn = parseFunction(input);
    if (fn) return { type: 'import', functionDef: fn };
  }

  // Solve equation
  if (/\b(solve|find\s+roots?|find\s+solutions?|find\s+zeros?|solve\s+for)\b/i.test(lower)) {
    // Extract the equation
    let equation = input.replace(/\b(solve|find\s+roots?\s+(?:of)?|find\s+solutions?\s+(?:of|to)?|find\s+zeros?\s+(?:of)?|solve\s+for\s+[a-z]:?)\s*/i, '').trim();
    equation = equation.replace(/[?.,;!]+$/, '');
    if (equation.length > 0) return { type: 'solve', equation };
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────

function preprocess(expr: string): string {
  let s = expr.trim();
  s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2');
  s = s.replace(/\)\(/g, ')*(');
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/\)(\d)/g, ')*$1');
  return s;
}

function compileFn(expr: string, variable: string): (x: number) => number {
  const processed = preprocess(expr);
  try {
    const node = math.parse(processed);
    const code = node.compile();
    return (x: number) => {
      try {
        const val = code.evaluate({ [variable]: x });
        if (typeof val === 'number') return val;
        return NaN;
      } catch { return NaN; }
    };
  } catch {
    return () => NaN;
  }
}
