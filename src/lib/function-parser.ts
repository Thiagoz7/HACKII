import { create, all } from 'mathjs';
import type { CoordinateSystem } from '../types/graph';

const math = create(all);

/**
 * Compile a mathematical expression string into a callable function.
 * Returns a function that takes a variable value and returns the result,
 * or null if the expression is invalid.
 */
export function compileExpression(
  expr: string,
  variable: string = 'x'
): ((value: number) => number) | null {
  try {
    // Pre-process: handle implicit multiplication (e.g., "2x" → "2*x", "x sin(x)" → "x*sin(x)")
    const processed = preprocessExpression(expr);
    const compiled = math.compile(processed);
    return (value: number): number => {
      try {
        const result = compiled.evaluate({ [variable]: value });
        if (typeof result === 'number') return result;
        if (typeof result === 'object' && result !== null) {
          // Handle complex numbers — return real part if imag is negligible
          const c = result as { re?: number; im?: number };
          if (c.im !== undefined && Math.abs(c.im) < 1e-10) return c.re ?? NaN;
          return NaN;
        }
        return NaN;
      } catch {
        return NaN;
      }
    };
  } catch {
    return null;
  }
}

/**
 * Compile a polar expression r = f(θ).
 */
export function compilePolarExpression(
  expr: string
): ((theta: number) => number) | null {
  return compileExpression(expr, 'theta');
}

/**
 * Preprocess an expression string to handle common notation issues.
 */
function preprocessExpression(expr: string): string {
  let processed = expr.trim();

  // Handle implicit multiplication: number followed by variable
  // e.g., "2x" → "2*x", "3sin(x)" → "3*sin(x)"
  processed = processed.replace(/(\d)([a-zA-Z])/g, '$1*$2');

  // Handle closing paren followed by opening paren: ")(" → ")*("
  processed = processed.replace(/\)\(/g, ')*(');

  // Handle number followed by opening paren: "2(" → "2*("
  processed = processed.replace(/(\d)\(/g, '$1*(');

  // Handle closing paren followed by number: ")2" → ")*2"
  processed = processed.replace(/\)(\d)/g, ')*$1');

  // Handle variable followed by opening paren: "x(" → "x*("
  processed = processed.replace(/([a-zA-Z])\(/g, '$1*(');

  // Replace ^ with proper exponentiation
  // math.js supports ^ natively, but let's ensure consistency

  return processed;
}

/**
 * Get the required variable name for a coordinate system.
 */
export function getVariableForSystem(system: CoordinateSystem): string {
  switch (system) {
    case 'cartesian':
    case 'absolute':
      return 'x';
    case 'polar':
      return 'theta';
    case 'relative':
      return 't'; // parametric
    default:
      return 'x';
  }
}

/**
 * Validate an expression without evaluating it.
 */
export function validateExpression(expr: string): { valid: boolean; error?: string } {
  try {
    const processed = preprocessExpression(expr);
    math.parse(processed);
    return { valid: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { valid: false, error: message };
  }
}

/**
 * Get a list of supported functions for display in the UI.
 */
export function getSupportedFunctions(): string[] {
  return [
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh',
    'log', 'ln', 'log2', 'log10',
    'exp', 'sqrt', 'abs',
    'floor', 'ceil', 'round',
    'sign', 'min', 'max',
    'pi', 'e',
  ];
}