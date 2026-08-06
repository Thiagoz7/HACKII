/**
 * calculus-engine.ts — Advanced calculus engine for Andrómeda.
 *
 * Provides: limits, higher-order derivatives, partial derivatives,
 * definite/indefinite integrals with step-by-step explanations,
 * and symbolic + numerical results.
 */

import { create, all } from 'mathjs';

const math = create(all);

// ── Types ──────────────────────────────────────────────────────────

export interface LimitResult {
  expression: string;
  variable: string;
  approaching: string;
  direction: 'left' | 'right' | 'both';
  symbolicResult: string | null;
  numericalResult: number | null;
  exists: boolean;
  explanation: string;
}

export interface DerivativeResult {
  expression: string;
  variable: string;
  order: number;
  symbolicResult: string;
  simplified: string;
  steps: string[];
  numericalAt?: { x: number; value: number };
}

export interface IntegralResult {
  expression: string;
  variable: string;
  type: 'definite' | 'indefinite';
  symbolicResult: string;
  numericalResult: number | null;
  lowerBound?: number;
  upperBound?: number;
  steps: string[];
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

// ── Limits ─────────────────────────────────────────────────────────

/**
 * Compute the limit of an expression as variable approaches a value.
 * Supports: finite values, +Infinity, -Infinity, left/right limits.
 */
export function computeLimit(
  expr: string,
  approaching: number | '+Infinity' | '-Infinity',
  direction: 'left' | 'right' | 'both' = 'both'
): LimitResult {
  const fn = compileFn(expr);
  const approachStr = approaching === '+Infinity' ? '+∞'
    : approaching === '-Infinity' ? '-∞'
    : approaching.toString();

  let numericalResult: number | null = null;
  let exists = true;
  const explanation: string[] = [];

  explanation.push(`Computing lim[x→${approachStr}${direction === 'left' ? '⁻' : direction === 'right' ? '⁺' : ''}] ${expr}`);

  if (approaching === '+Infinity') {
    // Evaluate at increasingly large values
    const samples = [1e2, 1e4, 1e6, 1e8, 1e10];
    const values = samples.map(s => fn(s));
    numericalResult = estimateLimit(values);
    explanation.push(`Evaluating at large x: ${samples.slice(0, 3).map((s, i) => `f(${s}) ≈ ${values[i]?.toFixed(6)}`).join(', ')}`);
  } else if (approaching === '-Infinity') {
    const samples = [-1e2, -1e4, -1e6, -1e8, -1e10];
    const values = samples.map(s => fn(s));
    numericalResult = estimateLimit(values);
    explanation.push(`Evaluating at large negative x: ${samples.slice(0, 3).map((s, i) => `f(${s}) ≈ ${values[i]?.toFixed(6)}`).join(', ')}`);
  } else {
    // Finite limit
    const a = approaching as number;
    if (direction === 'both' || direction === 'left') {
      const leftSamples = [a - 0.1, a - 0.01, a - 0.001, a - 0.0001, a - 0.00001];
      const leftVals = leftSamples.map(s => fn(s));
      const leftLimit = estimateLimit(leftVals);
      explanation.push(`From the left: ${leftSamples.slice(0, 3).map((s, i) => `f(${s.toFixed(5)}) ≈ ${leftVals[i]?.toFixed(6)}`).join(', ')}`);

      if (direction === 'left') {
        numericalResult = leftLimit;
      } else {
        const rightSamples = [a + 0.1, a + 0.01, a + 0.001, a + 0.0001, a + 0.00001];
        const rightVals = rightSamples.map(s => fn(s));
        const rightLimit = estimateLimit(rightVals);
        explanation.push(`From the right: ${rightSamples.slice(0, 3).map((s, i) => `f(${s.toFixed(5)}) ≈ ${rightVals[i]?.toFixed(6)}`).join(', ')}`);

        if (leftLimit !== null && rightLimit !== null && Math.abs(leftLimit - rightLimit) < 1e-4) {
          numericalResult = (leftLimit + rightLimit) / 2;
          explanation.push(`Left and right limits agree → limit exists`);
        } else if (leftLimit !== null && rightLimit !== null) {
          exists = false;
          explanation.push(`Left limit (${leftLimit.toFixed(6)}) ≠ Right limit (${rightLimit.toFixed(6)}) → limit does not exist`);
        } else {
          exists = false;
          explanation.push(`One or both one-sided limits diverge → limit does not exist`);
        }
      }
    } else {
      const rightSamples = [a + 0.1, a + 0.01, a + 0.001, a + 0.0001, a + 0.00001];
      const rightVals = rightSamples.map(s => fn(s));
      numericalResult = estimateLimit(rightVals);
      explanation.push(`From the right: ${rightSamples.slice(0, 3).map((s, i) => `f(${s.toFixed(5)}) ≈ ${rightVals[i]?.toFixed(6)}`).join(', ')}`);
    }
  }

  if (numericalResult !== null && Number.isFinite(numericalResult)) {
    explanation.push(`**Result:** ${numericalResult.toFixed(8)}`);
  } else if (!exists) {
    explanation.push(`**Result:** Limit does not exist`);
  } else {
    exists = false;
    explanation.push(`**Result:** Limit diverges (±∞ or undefined)`);
  }

  // Try symbolic evaluation
  let symbolicResult: string | null = null;
  try {
    if (approaching !== '+Infinity' && approaching !== '-Infinity') {
      const directVal = fn(approaching as number);
      if (Number.isFinite(directVal)) {
        symbolicResult = directVal.toString();
      }
    }
  } catch { /* ignore */ }

  return {
    expression: expr,
    variable: 'x',
    approaching: approachStr,
    direction,
    symbolicResult,
    numericalResult,
    exists,
    explanation: explanation.join('\n'),
  };
}

function estimateLimit(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 3) return null;
  // Check if converging
  const last3 = finite.slice(-3);
  const spread = Math.abs(last3[2] - last3[0]);
  if (spread < 1e-3) {
    return last3[2];
  }
  // Check if diverging to infinity
  if (finite.every((v, i) => i === 0 || Math.abs(v) >= Math.abs(finite[i - 1])) && Math.abs(finite[finite.length - 1]) > 1e8) {
    return null; // diverges
  }
  // Best estimate is the last finite value if things are still converging
  if (spread < 1) return last3[2];
  return null;
}

// ── Derivatives ────────────────────────────────────────────────────

/**
 * Compute the nth-order derivative of an expression with step-by-step.
 */
export function computeDerivative(
  expr: string,
  variable: string = 'x',
  order: number = 1,
  evaluateAt?: number
): DerivativeResult {
  const steps: string[] = [];
  let current = preprocess(expr);
  let simplified = current;

  steps.push(`**Finding the ${orderLabel(order)} derivative of:** ${expr}`);
  steps.push('');

  try {
    for (let i = 1; i <= order; i++) {
      const deriv = math.derivative(current, variable);
      const derivStr = deriv.toString();
      steps.push(`**Step ${i}:** d/d${variable} [${current}]`);

      // Try to simplify
      try {
        const simp = math.simplify(derivStr);
        simplified = simp.toString();
        steps.push(`  = ${derivStr}`);
        if (simplified !== derivStr) {
          steps.push(`  = ${simplified} (simplified)`);
        }
      } catch {
        simplified = derivStr;
        steps.push(`  = ${derivStr}`);
      }
      steps.push('');
      current = simplified;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    steps.push(`**Error:** Could not compute derivative — ${msg}`);
    return {
      expression: expr,
      variable,
      order,
      symbolicResult: 'N/A',
      simplified: 'N/A',
      steps,
    };
  }

  const result: DerivativeResult = {
    expression: expr,
    variable,
    order,
    symbolicResult: current,
    simplified,
    steps,
  };

  // Evaluate at a specific point if requested
  if (evaluateAt !== undefined) {
    try {
      const val = math.evaluate(preprocess(simplified), { [variable]: evaluateAt });
      if (typeof val === 'number' && Number.isFinite(val)) {
        result.numericalAt = { x: evaluateAt, value: val };
        steps.push(`**At ${variable} = ${evaluateAt}:** f${"'".repeat(order)}(${evaluateAt}) = **${val.toFixed(6)}**`);
      }
    } catch { /* ignore */ }
  }

  return result;
}

function orderLabel(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/**
 * Compute a partial derivative with respect to a given variable.
 * Treats all other variables as constants.
 */
export function computePartialDerivative(
  expr: string,
  withRespectTo: string,
  variables: string[] = ['x', 'y']
): DerivativeResult {
  const steps: string[] = [];
  const processed = preprocess(expr);

  steps.push(`**Partial derivative ∂/∂${withRespectTo} of:** ${expr}`);
  steps.push(`Treating ${variables.filter(v => v !== withRespectTo).join(', ')} as constant(s)`);
  steps.push('');

  try {
    const deriv = math.derivative(processed, withRespectTo);
    const derivStr = deriv.toString();

    let simplified = derivStr;
    try {
      simplified = math.simplify(derivStr).toString();
    } catch { /* keep original */ }

    steps.push(`∂/∂${withRespectTo} [${expr}] = ${derivStr}`);
    if (simplified !== derivStr) {
      steps.push(`= ${simplified} (simplified)`);
    }

    return {
      expression: expr,
      variable: withRespectTo,
      order: 1,
      symbolicResult: derivStr,
      simplified,
      steps,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    steps.push(`**Error:** ${msg}`);
    return {
      expression: expr,
      variable: withRespectTo,
      order: 1,
      symbolicResult: 'N/A',
      simplified: 'N/A',
      steps,
    };
  }
}

// ── Integration ────────────────────────────────────────────────────

/**
 * Compute an integral (definite or indefinite) with step-by-step explanations.
 * Uses symbolic rules where possible, falls back to numerical for definite integrals.
 */
export function computeIntegral(
  expr: string,
  variable: string = 'x',
  lowerBound?: number,
  upperBound?: number
): IntegralResult {
  const steps: string[] = [];
  const isDefinite = lowerBound !== undefined && upperBound !== undefined;

  if (isDefinite) {
    steps.push(`**Computing:** ∫ from ${lowerBound} to ${upperBound} of ${expr} d${variable}`);
  } else {
    steps.push(`**Computing:** ∫ ${expr} d${variable}`);
  }
  steps.push('');

  // Try symbolic antiderivative via known rules
  const symbolicResult = findAntiderivative(expr, variable, steps);

  let numericalResult: number | null = null;

  if (isDefinite) {
    // Numerical integration using Simpson's rule
    numericalResult = simpsonsRule(expr, lowerBound!, upperBound!);
    steps.push(`**Numerical evaluation (Simpson's rule):**`);
    steps.push(`  ∫ from ${lowerBound} to ${upperBound} ≈ **${numericalResult.toFixed(8)}**`);

    // If we have a symbolic result, try to evaluate at bounds
    if (symbolicResult !== `∫ ${expr} d${variable} + C`) {
      steps.push('');
      steps.push(`**Verification via Fundamental Theorem:**`);
      try {
        const F = preprocess(symbolicResult.replace(' + C', ''));
        const Fb = math.evaluate(F, { [variable]: upperBound! });
        const Fa = math.evaluate(F, { [variable]: lowerBound! });
        if (typeof Fb === 'number' && typeof Fa === 'number' && Number.isFinite(Fb) && Number.isFinite(Fa)) {
          const ftcResult = Fb - Fa;
          steps.push(`  F(${upperBound}) - F(${lowerBound}) = ${Fb.toFixed(6)} - ${Fa.toFixed(6)} = **${ftcResult.toFixed(8)}**`);
        }
      } catch { /* ignore */ }
    }
  }

  return {
    expression: expr,
    variable,
    type: isDefinite ? 'definite' : 'indefinite',
    symbolicResult,
    numericalResult,
    lowerBound,
    upperBound,
    steps,
  };
}

/**
 * Attempt to find the symbolic antiderivative using pattern matching.
 */
function findAntiderivative(expr: string, variable: string, steps: string[]): string {
  const x = variable;
  const trimmed = expr.trim();

  // Power rule: x^n → x^(n+1)/(n+1)
  const powerMatch = trimmed.match(new RegExp(`^${x}\\^(\\d+\\.?\\d*)$`));
  if (powerMatch) {
    const n = parseFloat(powerMatch[1]);
    const newExp = n + 1;
    const result = `${x}^${newExp} / ${newExp}`;
    steps.push(`**Power Rule:** ∫ ${x}^${n} d${x} = ${x}^${newExp}/${newExp} + C`);
    steps.push(`  Since ∫ ${x}^n d${x} = ${x}^(n+1)/(n+1) + C for n ≠ -1`);
    return result + ' + C';
  }

  // Constant times x: ax → ax^2/2
  const constTimesX = trimmed.match(new RegExp(`^(\\d+\\.?\\d*)\\*?${x}$`));
  if (constTimesX) {
    const a = parseFloat(constTimesX[1]);
    steps.push(`**Power Rule:** ∫ ${a}${x} d${x} = ${a} * ${x}^2/2 + C`);
    return `${a} * ${x}^2 / 2 + C`;
  }

  // Just x → x^2/2
  if (trimmed === x) {
    steps.push(`**Power Rule:** ∫ ${x} d${x} = ${x}^2/2 + C`);
    return `${x}^2 / 2 + C`;
  }

  // Constant
  if (/^[\d.]+$/.test(trimmed)) {
    const c = parseFloat(trimmed);
    steps.push(`**Constant Rule:** ∫ ${c} d${x} = ${c}${x} + C`);
    return `${c} * ${x} + C`;
  }

  // sin(x) → -cos(x)
  if (trimmed === `sin(${x})`) {
    steps.push(`**Trig Rule:** ∫ sin(${x}) d${x} = -cos(${x}) + C`);
    return `-cos(${x}) + C`;
  }

  // cos(x) → sin(x)
  if (trimmed === `cos(${x})`) {
    steps.push(`**Trig Rule:** ∫ cos(${x}) d${x} = sin(${x}) + C`);
    return `sin(${x}) + C`;
  }

  // sec(x)^2 → tan(x)
  if (trimmed === `sec(${x})^2`) {
    steps.push(`**Trig Rule:** ∫ sec²(${x}) d${x} = tan(${x}) + C`);
    return `tan(${x}) + C`;
  }

  // e^x → e^x
  if (trimmed === `exp(${x})` || trimmed === `e^${x}`) {
    steps.push(`**Exponential Rule:** ∫ e^${x} d${x} = e^${x} + C`);
    return `exp(${x}) + C`;
  }

  // 1/x → ln|x|
  if (trimmed === `1/${x}` || trimmed === `${x}^(-1)`) {
    steps.push(`**Log Rule:** ∫ 1/${x} d${x} = ln|${x}| + C`);
    return `log(abs(${x})) + C`;
  }

  // a*x^n pattern via simplification
  try {
    const simplified = math.simplify(preprocess(trimmed)).toString();
    const polyMatch = simplified.match(new RegExp(`^([\\d.]+)\\s*\\*\\s*${x}\\s*\\^\\s*([\\d.]+)$`));
    if (polyMatch) {
      const a = parseFloat(polyMatch[1]);
      const n = parseFloat(polyMatch[2]);
      const newExp = n + 1;
      const coeff = a / newExp;
      steps.push(`**Power Rule:** ∫ ${a}*${x}^${n} d${x} = ${coeff.toFixed(4)}*${x}^${newExp} + C`);
      return `${coeff} * ${x}^${newExp} + C`;
    }
  } catch { /* ignore */ }

  // Fallback: express symbolically
  steps.push(`**Symbolic antiderivative:** No closed-form rule matched.`);
  steps.push(`  Expressing as: ∫ ${expr} d${x} + C`);
  return `∫ ${expr} d${x} + C`;
}

/**
 * Simpson's rule for numerical integration.
 */
function simpsonsRule(expr: string, a: number, b: number, n = 1000): number {
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

// ── Formatting Helpers ─────────────────────────────────────────────

/**
 * Format a limit result as a readable string for the chatbot.
 */
export function formatLimitResult(result: LimitResult): string {
  const parts: string[] = [];
  const dirStr = result.direction === 'left' ? '⁻' : result.direction === 'right' ? '⁺' : '';
  parts.push(`**lim[x→${result.approaching}${dirStr}] ${result.expression}**`);
  parts.push('');

  if (result.exists && result.numericalResult !== null) {
    parts.push(`**= ${result.numericalResult.toFixed(6)}**`);
  } else if (!result.exists) {
    parts.push(`**= Does Not Exist (DNE)**`);
  } else {
    parts.push(`**= ±∞ (diverges)**`);
  }

  parts.push('');
  parts.push('**Step-by-step:**');
  parts.push(result.explanation);
  return parts.join('\n');
}

/**
 * Format a derivative result as a readable string.
 */
export function formatDerivativeResult(result: DerivativeResult): string {
  const parts: string[] = [];
  const primeNotation = result.order === 1 ? "'" : result.order === 2 ? "''" : `⁽${result.order}⁾`;
  parts.push(`**f${primeNotation}(${result.variable}) where f(${result.variable}) = ${result.expression}**`);
  parts.push('');
  parts.push(`**= ${result.simplified}**`);

  if (result.numericalAt) {
    parts.push('');
    parts.push(`**At ${result.variable} = ${result.numericalAt.x}:** ${result.numericalAt.value.toFixed(6)}`);
  }

  parts.push('');
  parts.push('**Step-by-step:**');
  parts.push(result.steps.join('\n'));
  return parts.join('\n');
}

/**
 * Format an integral result as a readable string.
 */
export function formatIntegralResult(result: IntegralResult): string {
  const parts: string[] = [];

  if (result.type === 'definite') {
    parts.push(`**∫ from ${result.lowerBound} to ${result.upperBound} of ${result.expression} d${result.variable}**`);
  } else {
    parts.push(`**∫ ${result.expression} d${result.variable}**`);
  }
  parts.push('');
  parts.push(`**= ${result.symbolicResult}**`);

  if (result.numericalResult !== null && Number.isFinite(result.numericalResult)) {
    parts.push('');
    parts.push(`**Numerical value: ${result.numericalResult.toFixed(8)}**`);
  }

  parts.push('');
  parts.push('**Step-by-step:**');
  parts.push(result.steps.join('\n'));
  return parts.join('\n');
}
