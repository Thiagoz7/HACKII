import { create, all } from 'mathjs';
import type { ChatIntent, ChatAction, IntentType } from '../types/chatbot';
import type { CoordinateSystem, DrawingPlan } from '../types/graph';
import {
  fullAnalysis, findIntersections, compareFunctions,
  analyzeTrig, explainTrigProperties,
  analyzeLog, explainLogProperties,
  findRoots, findCriticalPoints, findInflectionPoints,
  findVerticalAsymptotes, findHorizontalAsymptote,
  analyzeDomain, estimateRange, numericalIntegrate,
} from './math-analysis';
import { generateDrawingPlan } from './drawing-engine';

const math = create(all);

// ── Helpers ──────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function extractExpression(input: string): string | null {
  // Try to extract a math expression from the input
  // Match patterns like: calculate X, evaluate X, what is X, compute X, plot X, graph X, etc.
  const patterns = [
    /(?:calculate|compute|evaluate|what\s+is|what's|find|solve\s+for)\s+(.+?)(?:\?|$)/i,
    /(?:plot|graph|draw|show\s+me)\s+(.+?)(?:\s+from\s|$)/i,
    /(?:derivative|differentiate)\s+(?:of\s+)?(.+?)(?:\?|$)/i,
    /(?:integral|integrate|antiderivative)\s+(?:of\s+)?(.+?)(?:\?|$)/i,
    /(.+?)\s+(?:derivative|differentiate)/i,
    /d\/dx\s*(?:of\s+)?(.+)/i,
    /∫\s*(.+?)\s*d[a-z]/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[?.,;!]$/, '');
    }
  }

  // If input looks like a pure math expression, use it directly
  const pureMath = /^[\d\s+\-*/^().,x\s]+$/i;
  if (pureMath.test(input.trim())) {
    return input.trim();
  }

  return null;
}

function detectSystem(input: string): CoordinateSystem {
  if (/\bpolar\b/i.test(input) || /\br\s*=/i.test(input) || /\btheta\b/i.test(input)) {
    return 'polar';
  }
  if (/\bparametric\b/i.test(input) || /\bt\s*=/i.test(input) || /\brelative\b/i.test(input)) {
    return 'relative';
  }
  return 'cartesian';
}

// ── Intent Classification ────────────────────────────────────────

function extractMultiExpressions(input: string): string[] {
  // Split by " and ", " with ", " vs ", " together with ", "," between function-like patterns
  const cleaned = input.replace(/\b(plot|graph|draw|show\s+me|visualize|chart)\s+/gi, '');
  // Try splitting on " and " between function expressions
  const andParts = cleaned.split(/\s+and\s+(?=(?:[a-z]+\s*)?(?:sin|cos|tan|cot|sec|csc|log|ln|sqrt|abs|x\^|x\s*[\+\-\*\/]|\d))/i);
  if (andParts.length >= 2) {
    return andParts.map(p => p.trim()).filter(Boolean);
  }
  return [cleaned.trim()];
}

function classifyIntent(input: string): ChatIntent {
  const lower = input.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|yo|sup)\b/i.test(lower)) {
    return { type: 'greeting', confidence: 0.95 };
  }

  // Help
  if (/^(help|what\s+can\s+you\s+do|commands|how\s+to\s+use|capabilities)/i.test(lower)) {
    return { type: 'help', confidence: 0.95 };
  }

  // ── Technical Drawing (more specific than "draw" → plot) ──
  if (/\bdraw\s+(a\s+|an\s+)?(circle|rectangle|square|polygon|arc|plate|disk|bar|beam|gear|shaft|bolt|plate|flange)\b/i.test(lower) ||
      /\bdesign\s+(a\s+|an\s+)?(mechanical|part|piece|component|plate|disk|bar|beam)\b/i.test(lower) ||
      /\btechnical\s+drawing\b/i.test(lower)) {
    return { type: 'draw_shape', query: input, confidence: 0.90 };
  }

  // ── Multi-Plot / Comparison (more specific than "plot") ──
  if (/\b(compare|multi.?plot|both|together|vs\.?|versus)\b/i.test(lower) &&
      /\b(plot|graph|draw|show)\b/i.test(lower)) {
    const exprs = extractMultiExpressions(input);
    return {
      type: 'multi_plot',
      expressions: exprs.length >= 2 ? exprs : undefined,
      query: input,
      system: detectSystem(input),
      confidence: 0.88,
    };
  }

  // ── Intersections ──
  if (/\b(intersect|intersection|where\s+do\s+they\s+(meet|cross|intersect)|cross(?:ing)?\s+point|meet(?:ing)?\s+point)\b/i.test(lower)) {
    return { type: 'intersect', query: input, confidence: 0.90 };
  }

  // ── Comparative Analysis ──
  if (/\b(compare\s+(the\s+)?(functions?|graphs?|plots?|curves?)|comparison|similarities|differences?\s+between)\b/i.test(lower) &&
      !/\b(plot|graph|draw)\b/i.test(lower)) {
    return { type: 'compare', query: input, confidence: 0.88 };
  }

  // ── Full Function Analysis ──
  if (/\b(analyze|analyse|analysis\s+of|full\s+analysis|complete\s+analysis)\b/i.test(lower) &&
      /\b(function|expression|graph|curve|plot|equation)\b/i.test(lower)) {
    return {
      type: 'analyze',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Trig Function Analysis ──
  if (/\b(analyze|analyse|analysis|properties|characteristics)\b/i.test(lower) &&
      /\b(sin|cos|tan|cot|sec|csc|sine|cosine|tangent|cotangent|secant|cosecant)\b/i.test(lower)) {
    return {
      type: 'trig_analyze',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Log Function Analysis ──
  if (/\b(analyze|analyse|analysis|properties|characteristics)\b/i.test(lower) &&
      /\b(log|ln|logarithm|log2|log10|natural\s+log)\b/i.test(lower)) {
    return {
      type: 'log_analyze',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Domain ──
  if (/\b(domain\s+of|what\s+is\s+the\s+domain|find\s+the\s+domain)\b/i.test(lower)) {
    return {
      type: 'domain',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Range ──
  if (/\b(range\s+of|what\s+is\s+the\s+range|find\s+the\s+range)\b/i.test(lower)) {
    return {
      type: 'range',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Critical Points (Maxima/Minima) ──
  if (/\b(critical\s+points?|maxima|minima|maximum|minimum|extrema|stationary\s+points?)\b/i.test(lower)) {
    return {
      type: 'critical_points',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Inflection Points ──
  if (/\b(inflection|concavity|concave\s+(up|down))\b/i.test(lower)) {
    return {
      type: 'inflection',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Asymptotes ──
  if (/\b(asymptote|asymptotic)\b/i.test(lower)) {
    return {
      type: 'asymptotes',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.90,
    };
  }

  // ── Area (definite integral / area between curves) ──
  if (/\b(area\s+between|area\s+under\s+the\s+curve|area\s+enclosed|compute\s+the\s+area|calculate\s+the\s+area)\b/i.test(lower)) {
    return { type: 'area', query: input, confidence: 0.88 };
  }

  // ── Volume of Revolution ──
  if (/\b(volume\s+of\s+revolution|volume\s+of\s+solid|solid\s+of\s+revolution|compute\s+the\s+volume)\b/i.test(lower)) {
    return { type: 'volume', query: input, confidence: 0.88 };
  }

  // ── Rate of Change (engineering) ──
  if (/\b(rate\s+of\s+change|instantaneous\s+rate|average\s+rate|how\s+fast\s+does|how\s+quickly)\b/i.test(lower)) {
    return {
      type: 'rate_of_change',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.88,
    };
  }

  // Plot / Graph
  if (/\b(plot|graph|draw|show\s+me|visualize|chart)\b/i.test(lower)) {
    return {
      type: 'plot',
      expression: extractExpression(input) ?? undefined,
      system: detectSystem(input),
      confidence: 0.85,
    };
  }

  // Differentiate
  if (/\b(differentiate|derivative|d\/dx)\b/i.test(lower)) {
    return {
      type: 'differentiate',
      expression: extractExpression(input) ?? undefined,
      confidence: 0.85,
    };
  }

  // Integrate
  if (/\b(integrate|integral|antiderivative|∫)\b/i.test(lower)) {
    return {
      type: 'integrate',
      expression: extractExpression(input) ?? undefined,
      confidence: 0.85,
    };
  }

  // Solve
  if (/\b(solve|find\s+(roots|zeros|solutions|the\s+value)|what\s+is\s+x)\b/i.test(lower)) {
    return {
      type: 'solve',
      expression: extractExpression(input) ?? undefined,
      confidence: 0.80,
    };
  }

  // Convert
  if (/\b(convert|change|transform|how\s+many|in\s+(radians|degrees|meters|feet|km|miles|mph|km\/h))\b/i.test(lower)) {
    return {
      type: 'convert',
      query: input,
      confidence: 0.80,
    };
  }

  // Explain
  if (/\b(explain|what\s+is|what\s+are|how\s+does|tell\s+me\s+about|describe|define|meaning\s+of)\b/i.test(lower)) {
    return {
      type: 'explain',
      query: input,
      confidence: 0.75,
    };
  }

  // Calculate / Evaluate (catch-all for math)
  if (/\b(calculate|compute|evaluate|what\s+is|what's|how\s+much|value\s+of)\b/i.test(lower)) {
    return {
      type: 'calculate',
      expression: extractExpression(input) ?? undefined,
      confidence: 0.80,
    };
  }

  // If it looks like a math expression
  const expr = extractExpression(input);
  if (expr) {
    return {
      type: 'calculate',
      expression: expr,
      confidence: 0.70,
    };
  }

  return { type: 'general', confidence: 0.5, query: input };
}

// ── Calculation ──────────────────────────────────────────────────

function safeEvaluate(expr: string): { result: string | null; error?: string } {
  try {
    // Preprocess implicit multiplication
    let processed = expr.trim();
    processed = processed.replace(/(\d)([a-zA-Z])/g, '$1*$2');
    processed = processed.replace(/\)\(/g, ')*(');
    processed = processed.replace(/(\d)\(/g, '$1*(');
    processed = processed.replace(/\)(\d)/g, ')*$1');
    processed = processed.replace(/([a-zA-Z])\(/g, '$1*(');

    const result = math.evaluate(processed);
    if (typeof result === 'number') {
      if (Number.isNaN(result)) return { error: 'Result is undefined (NaN).' };
      if (!Number.isFinite(result)) return { error: 'Result is infinite.' };
      // Format nicely
      if (Number.isInteger(result)) return { result: result.toString() };
      // Show up to 10 significant digits
      return { result: parseFloat(result.toPrecision(10)).toString() };
    }
    if (typeof result === 'object' && result !== null) {
      const c = result as { re?: number; im?: number; toString?: () => string };
      if (c.toString) return { result: c.toString() };
      if (c.re !== undefined && c.im !== undefined) {
        return { result: `${c.re} + ${c.im}i` };
      }
    }
    return { result: String(result) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Couldn't evaluate that: ${msg}` };
  }
}

function differentiate(expr: string): string | null {
  try {
    let processed = expr.trim();
    processed = processed.replace(/(\d)([a-zA-Z])/g, '$1*$2');
    const deriv = math.derivative(processed, 'x');
    return deriv.toString();
  } catch {
    return null;
  }
}

function integrateExpr(expr: string): string | null {
  // mathjs doesn't have built-in symbolic integration, so we approximate
  // by returning the antiderivative notation
  try {
    let processed = expr.trim();
    processed = processed.replace(/(\d)([a-zA-Z])/g, '$1*$2');
    // Try to use mathjs simplify
    const simplified = math.simplify(processed);
    return `∫ ${simplified.toString()} dx`;
  } catch {
    return `∫ ${expr} dx`;
  }
}

// ── Knowledge Base ───────────────────────────────────────────────

const KNOWLEDGE: Record<string, string> = {
  derivative: `**Derivatives** measure how a function changes as its input changes — the rate of change or slope at any point.

  • **Definition:** f'(x) = lim[h→0] (f(x+h) − f(x)) / h
  • **Power Rule:** d/dx [xⁿ] = n·xⁿ⁻¹
  • **Chain Rule:** d/dx [f(g(x))] = f'(g(x)) · g'(x)
  • **Product Rule:** d/dx [u·v] = u'·v + u·v'
  • **Quotient Rule:** d/dx [u/v] = (u'·v − u·v') / v²

  Try asking me to differentiate a specific function like "differentiate x³ + 2x".`,

  integral: `**Integrals** represent the accumulation of quantities — area under a curve, total change, or net effect.

  • **Definite Integral:** ∫ₐᵇ f(x) dx = area under the curve from a to b
  • **Indefinite Integral:** ∫ f(x) dx = F(x) + C (antiderivative)
  • **Power Rule:** ∫ xⁿ dx = xⁿ⁺¹/(n+1) + C (n ≠ −1)
  • **Fundamental Theorem:** ∫ₐᵇ f(x) dx = F(b) − F(a)

  Try asking me to integrate a function like "integrate 3x² + 2x".`,

  limit: `**Limits** describe the behavior of a function as it approaches a specific point.

  • **Notation:** lim[x→a] f(x) = L
  • **Key Idea:** As x gets arbitrarily close to a, f(x) gets arbitrarily close to L
  • **One-Sided Limits:** lim[x→a⁺] (from right) and lim[x→a⁻] (from left)
  • **L'Hôpital's Rule:** For 0/0 or ∞/∞ forms, lim f/g = lim f'/g'

  Limits are the foundation of calculus — derivatives and integrals are both defined as limits.`,

  trigonometry: `**Trigonometry** studies relationships between angles and sides of triangles.

  Key Functions:
  • **sin(θ)** = opposite / hypotenuse
  • **cos(θ)** = adjacent / hypotenuse
  • **tan(θ)** = opposite / adjacent = sin(θ)/cos(θ)

  Identities:
  • sin²θ + cos²θ = 1
  • sin(2θ) = 2 sin θ cos θ
  • cos(2θ) = cos²θ − sin²θ`,

  'fourier transform': `**Fourier Transforms** decompose a function into its constituent frequencies.

  • **Continuous:** F(ω) = ∫ f(t) · e^(-iωt) dt
  • **Discrete (DFT):** X[k] = Σ x[n] · e^(-i2πkn/N)
  • **FFT:** Fast Fourier Transform — O(n log n) algorithm for DFT

  Applications: signal processing, image compression, solving differential equations, spectral analysis.`,

  'differential equation': `**Differential Equations** relate a function to its derivatives.

  • **ODE:** Ordinary Differential Equation — involves one independent variable
  • **PDE:** Partial Differential Equation — involves multiple independent variables
  • **Linear 1st Order:** dy/dx + P(x)y = Q(x)

  Common in engineering: Newton's cooling law, RC circuits, spring-mass systems, beam deflection, heat transfer.`,

  vector: `**Vectors** represent quantities with both magnitude and direction.

  • **Notation:** v = (v₁, v₂, v₃) or v = v₁i + v₂j + v₃k
  • **Dot Product:** u·v = |u||v| cos θ = u₁v₁ + u₂v₂ + u₃v₃
  • **Cross Product:** u×v = |u||v| sin θ n (perpendicular to both)
  • **Magnitude:** |v| = √(v₁² + v₂² + v₃²)

  Essential for: mechanics, EM fields, computer graphics, fluid dynamics.`,

  matrix: `**Matrices** are rectangular arrays of numbers used to represent linear transformations.

  • **Multiplication:** (AB)ᵢⱼ = Σ Aᵢₖ Bₖⱼ
  • **Determinant:** scalar value encoding volume scaling factor
  • **Inverse:** A⁻¹ exists iff det(A) ≠ 0
  • **Eigenvalues:** Av = λv

  Applications: solving linear systems, transformations, principal component analysis, quantum mechanics.`,

  taylor: `**Taylor Series** approximates functions as infinite sums of polynomial terms.

  • **Formula:** f(x) = Σ [f⁽ⁿ⁾(a) / n!] · (x−a)ⁿ
  • **Maclaurin Series:** Taylor series at a = 0
  • **Common expansions:**
    - eˣ = 1 + x + x²/2! + x³/3! + ...
    - sin x = x − x³/3! + x⁵/5! − ...
    - cos x = 1 − x²/2! + x⁴/4! − ...

  Used in: numerical analysis, physics approximations, engineering tolerances.`,
};

function searchKnowledge(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [key, content] of Object.entries(KNOWLEDGE)) {
    if (lower.includes(key)) return content;
  }
  return null;
}

// ── Unit Conversions ─────────────────────────────────────────────

const CONVERSIONS: Record<string, number> = {
  'degrees to radians': Math.PI / 180,
  'radians to degrees': 180 / Math.PI,
  'miles to km': 1.60934,
  'km to miles': 0.621371,
  'feet to meters': 0.3048,
  'meters to feet': 3.28084,
  'inches to cm': 2.54,
  'cm to inches': 0.393701,
  'mph to km/h': 1.60934,
  'km/h to mph': 0.621371,
  'mph to m/s': 0.44704,
  'm/s to mph': 2.23694,
  'kg to lbs': 2.20462,
  'lbs to kg': 0.453592,
  'celsius to fahrenheit': 1, // special handling
  'fahrenheit to celsius': 1, // special handling
};

function parseConversion(query: string): string | null {
  const lower = query.toLowerCase();

  // Temperature special cases
  const tempCtoF = /(-?[\d.]+)\s*(?:°|degrees?\s*)?c(?:elsius)?\s*(?:to|in|as)\s*(?:°|degrees?\s*)?f(?:ahrenheit)?/i;
  const tempFtoC = /(-?[\d.]+)\s*(?:°|degrees?\s*)?f(?:ahrenheit)?\s*(?:to|in|as)\s*(?:°|degrees?\s*)?c(?:elsius)?/i;

  const cMatch = lower.match(tempCtoF);
  if (cMatch) {
    const val = parseFloat(cMatch[1]);
    return `${val}°C = ${(val * 9/5 + 32).toFixed(1)}°F`;
  }
  const fMatch = lower.match(tempFtoC);
  if (fMatch) {
    const val = parseFloat(fMatch[1]);
    return `${val}°F = ${((val - 32) * 5/9).toFixed(1)}°C`;
  }

  // Generic conversion
  const numMatch = lower.match(/(-?[\d.]+)\s*(.+)/);
  if (!numMatch) return null;

  const value = parseFloat(numMatch[1]);
  const rest = numMatch[2].trim();

  for (const [key, factor] of Object.entries(CONVERSIONS)) {
    if (rest.includes(key)) {
      return `${value} ${key.split(' to ')[0]} = ${(value * factor).toFixed(4)} ${key.split(' to ')[1]}`;
    }
  }

  return null;
}

// ── Main Engine ──────────────────────────────────────────────────

export interface BotResponse {
  message: string;
  action: ChatAction;
}

export function processMessage(input: string): BotResponse {
  const intent = classifyIntent(input);

  switch (intent.type) {
    case 'greeting':
      return {
        message: `Hello! I'm **Andrómeda's assistant** — your mathematical analyst and engineering companion. I can help you with:

  • **Calculations** — try "calculate sin(pi/4) + 2"
  • **Plotting** — try "plot x^2 + 3x - 5" or "graph sin(x) and cos(x) together"
  • **Function Analysis** — try "analyze f(x) = x^3 - 3x"
  • **Derivatives & Integrals** — try "differentiate x^3 + 2x" or "integrate sin(x)"
  • **Trig & Log Analysis** — try "analyze sin(x)" or "analyze log(x)"
  • **Engineering Tools** — try "find critical points of x^3 - 3x" or "area between sin(x) and cos(x)"
  • **Technical Drawing** — try "draw a circle with radius 50"

  What would you like to explore?`,
        action: { type: 'none' },
      };

    case 'help':
      return {
        message: `**🧭 Andrómeda — Full Command Reference**

  🔢 **Calculate** — "calculate sin(pi/4)", "evaluate 2^10 + 5"
  📈 **Plot** — "plot sin(x)", "graph r=sin(2θ) in polar"
  📊 **Multi-Plot** — "graph sin(x) and cos(x) together", "plot x^2 vs x^3"
  🔬 **Analyze** — "analyze x^3 - 3x + 2" (domain, range, asymptotes, critical points, inflection, concavity)
  📐 **Differentiate** — "derivative of x^3 + 2x", "d/dx of sin(x)"
  ∫ **Integrate** — "integrate x^2", "integral of sin(x) dx"
  🔄 **Convert** — "convert 45 degrees to radians", "100 mph to km/h"
  📖 **Explain** — "explain derivatives", "what is a Fourier transform?"
  ✏️ **Solve** — "solve x^2 - 4 = 0"
  🔗 **Intersect** — "find intersections of sin(x) and cos(x)"
  ⚖️ **Compare** — "compare x^2 and x^3"
  🎯 **Critical Points** — "find maxima of x^3 - 3x"
  📉 **Inflection** — "find inflection points of x^4 - 4x^2"
  ↕️ **Asymptotes** — "find asymptotes of 1/x"
  📐 **Area** — "area between sin(x) and cos(x) from 0 to pi"
  🏗️ **Drawing** — "draw a circular plate radius 50 in polar"
  🎛️ **Trig Analysis** — "analyze sin(x)" (amplitude, period, phase, properties)
  📊 **Log Analysis** — "analyze ln(x)" (base, domain, asymptotes, transformations)

  Just type naturally — I'll figure out what you mean!`,
        action: { type: 'none' },
      };

    case 'calculate': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I'd like to help you calculate something, but I couldn't find a mathematical expression in your message. Try something like \"calculate 2 + 2\" or \"what is sin(pi/4)?\"",
          action: { type: 'none' },
        };
      }
      const { result, error } = safeEvaluate(expr);
      if (error) {
        return {
          message: `Hmm, I couldn't compute that: ${error}\n\nMake sure the expression uses valid syntax. Try something like \`sin(pi/4)\` or \`2^10 + 5\`.`,
          action: { type: 'none' },
        };
      }
      return {
        message: `**${expr}** = **${result}**`,
        action: { type: 'calculate', result: result! },
      };
    }

    case 'plot': {
      const expr = intent.expression;
      const system = intent.system ?? 'cartesian';
      if (!expr) {
        return {
          message: "I'd love to plot something for you! Could you give me a function to plot? For example:\n• \"plot sin(x)\"\n• \"graph x^2 + 3x\"\n• \"draw r=sin(2θ) in polar\"",
          action: { type: 'none' },
        };
      }
      return {
        message: `📈 **Plotting:** \`${expr}\` in **${system}** coordinates\n\nI've added it to your function panel. You can toggle visibility, change colors, or remove it from the sidebar.`,
        action: {
          type: 'plot',
          expression: expr,
          system,
        },
      };
    }

    case 'multi_plot': {
      const exprs = intent.expressions;
      const system = intent.system ?? 'cartesian';
      if (!exprs || exprs.length < 2) {
        const singleExpr = intent.expression ?? extractExpression(intent.query ?? input);
        if (!singleExpr) {
          return {
            message: "I'd love to plot multiple functions together! Tell me which functions to compare, like:\n• \"plot sin(x) and cos(x) together\"\n• \"graph x^2 vs x^3\"\n• \"show me log(x) and ln(x) on the same graph\"",
            action: { type: 'none' },
          };
        }
        return {
          message: `📈 **Plotting:** \`${singleExpr}\` in **${system}** coordinates\n\n*Tip: For multi-plot, say "plot A and B together" or "graph A vs B"*`,
          action: { type: 'plot', expression: singleExpr, system },
        };
      }
      const exprList = exprs.map((e, i) => `  ${i + 1}. \`${e}\``).join('\n');
      return {
        message: `📊 **Multi-Plotting ${exprs.length} functions** in **${system}** coordinates:\n${exprList}\n\nI've added them to your function panel. Use the sidebar to toggle visibility, change colors, or compare them side by side.`,
        action: {
          type: 'multi_plot',
          expressions: exprs,
          system,
        },
      };
    }

    case 'analyze': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I'd love to analyze a function for you! Give me a function like:\n• \"analyze x^3 - 3x + 2\"\n• \"full analysis of sin(x) + cos(x)\"\n\nI'll show you domain, range, asymptotes, critical points, inflection points, concavity, and more.",
          action: { type: 'none' },
        };
      }
      const analysis = fullAnalysis(expr);
      const parts = [analysis.summary, analysis.table, analysis.insights].filter(Boolean).join('\n\n');
      return {
        message: `🔬 **Full Analysis of \`${expr}\`**\n\n${parts}\n\n💡 Want to visualize this? Try "plot ${expr}" to see the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: analysis,
        },
      };
    }

    case 'trig_analyze': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can analyze trigonometric functions! Give me one like:\n• \"analyze sin(x)\"\n• \"properties of cos(2x)\"\n• \"analyze tan(x + pi/4)\"\n\nI'll show you amplitude, period, phase shift, vertical shift, domain, range, and key properties.",
          action: { type: 'none' },
        };
      }
      const trigAnalysis = analyzeTrig(expr);
      const props = explainTrigProperties(expr);
      return {
        message: `🎛️ **Trigonometric Analysis of \`${expr}\`**\n\n${trigAnalysis}\n\n${props}\n\n💡 Try "plot ${expr}" to see the graph, or "compare ${expr} with cos(x)" for comparison.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: trigAnalysis,
        },
      };
    }

    case 'log_analyze': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can analyze logarithmic functions! Give me one like:\n• \"analyze log(x)\"\n• \"properties of ln(x + 2)\"\n• \"analyze log2(x - 1)\"\n\nI'll show you the base, domain, vertical asymptote, behavior, and key properties.",
          action: { type: 'none' },
        };
      }
      const logAnalysis = analyzeLog(expr);
      const props = explainLogProperties(expr);
      return {
        message: `📊 **Logarithmic Analysis of \`${expr}\`**\n\n${logAnalysis}\n\n${props}\n\n💡 Try "plot ${expr}" to see the graph, or "intersect ${expr} with x^2" to find crossing points.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: logAnalysis,
        },
      };
    }

    case 'intersect': {
      const query = intent.query ?? input;
      // Try to extract two function expressions
      const exprs = extractMultiExpressions(query);
      if (exprs.length < 2) {
        return {
          message: "I need two functions to find their intersections! Try:\n• \"find intersections of sin(x) and cos(x)\"\n• \"where do x^2 and 2x intersect?\"\n• \"intersection points of x^3 and 3x - 1\"",
          action: { type: 'none' },
        };
      }
      const intersections = findIntersections(exprs[0], exprs[1]);
      const pointsStr = intersections.length > 0
        ? intersections.map((p, i) => `  ${i + 1}. (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join('\n')
        : '  No intersection points found in the search range.';
      return {
        message: `🔗 **Intersections of \`${exprs[0]}\` and \`${exprs[1]}\`**\n\n${pointsStr}\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see them on the graph.`,
        action: {
          type: 'intersect',
          expressions: [exprs[0], exprs[1]],
          result: intersections.map(p => ({ x: p.x, y: p.y })),
        },
      };
    }

    case 'compare': {
      const query = intent.query ?? input;
      const exprs = extractMultiExpressions(query);
      if (exprs.length < 2) {
        return {
          message: "I need two functions to compare! Try:\n• \"compare x^2 and x^3\"\n• \"what are the differences between sin(x) and cos(x)?\"\n• \"similarities between x^2 and x^4\"",
          action: { type: 'none' },
        };
      }
      const comparison = compareFunctions(exprs[0], exprs[1]);
      return {
        message: `⚖️ **Comparing \`${exprs[0]}\` vs \`${exprs[1]}\`**\n\n${comparison}\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see them side by side.`,
        action: {
          type: 'compare',
          expressions: [exprs[0], exprs[1]],
          result: comparison,
        },
      };
    }

    case 'domain': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can find the domain of a function! Try:\n• \"domain of sqrt(x - 2)\"\n• \"what is the domain of 1/(x^2 - 4)?\"\n• \"domain of ln(x + 1)\"",
          action: { type: 'none' },
        };
      }
      const domain = analyzeDomain(expr);
      return {
        message: `📐 **Domain of \`${expr}\`**\n\n${domain}\n\n💡 Try "plot ${expr}" to see the graph and verify the domain visually.`,
        action: { type: 'analyze', expression: expr, result: domain },
      };
    }

    case 'range': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can estimate the range of a function! Try:\n• \"range of x^2 + 1\"\n• \"what is the range of sin(x)?\"\n• \"range of e^x\"",
          action: { type: 'none' },
        };
      }
      const range = estimateRange(expr);
      return {
        message: `📐 **Range of \`${expr}\`**\n\n${range}\n\n💡 Try "plot ${expr}" to see the graph and verify the range visually.`,
        action: { type: 'analyze', expression: expr, result: range },
      };
    }

    case 'critical_points': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can find critical points (maxima and minima) of a function! Try:\n• \"find critical points of x^3 - 3x\"\n• \"what are the maxima and minima of x^4 - 4x^2?\"\n• \"extrema of sin(x) from 0 to 2pi\"",
          action: { type: 'none' },
        };
      }
      const points = findCriticalPoints(expr);
      const pointsStr = points.length > 0
        ? points.map((p, i) => `  ${i + 1}. x = ${p.x.toFixed(4)}, f(x) = ${p.y.toFixed(4)} — **${p.type}**${p.note ? ` (${p.note})` : ''}`).join('\n')
        : '  No critical points found in the search range.';
      return {
        message: `🎯 **Critical Points of \`${expr}\`**\n\n${pointsStr}\n\n💡 Try "plot ${expr}" to see these points on the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: points.map(p => ({ x: p.x, y: p.y, type: p.type })),
        },
      };
    }

    case 'inflection': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can find inflection points and analyze concavity! Try:\n• \"find inflection points of x^3 - 3x\"\n• \"concavity of x^4 - 4x^2\"\n• \"where does x^3 change concavity?\"",
          action: { type: 'none' },
        };
      }
      const points = findInflectionPoints(expr);
      const pointsStr = points.length > 0
        ? points.map((p, i) => `  ${i + 1}. x = ${p.x.toFixed(4)}, f(x) = ${p.y.toFixed(4)}${p.concavityChange ? ` — changes from ${p.concavityChange}` : ''}`).join('\n')
        : '  No inflection points found in the search range.';
      return {
        message: `📉 **Inflection Points of \`${expr}\`**\n\n${pointsStr}\n\n💡 Try "plot ${expr}" to see the curvature changes on the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: points.map(p => ({ x: p.x, y: p.y })),
        },
      };
    }

    case 'asymptotes': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      if (!expr) {
        return {
          message: "I can find asymptotes of a function! Try:\n• \"find asymptotes of 1/x\"\n• \"asymptotes of (x^2 - 1)/(x - 2)\"\n• \"what are the asymptotes of tan(x)?\"",
          action: { type: 'none' },
        };
      }
      const vertical = findVerticalAsymptotes(expr);
      const horizontal = findHorizontalAsymptote(expr);
      const vStr = vertical.length > 0
        ? vertical.map(v => `  • x = ${v.toFixed(4)}`).join('\n')
        : '  • None detected';
      const hStr = horizontal !== null
        ? `  • y = ${horizontal.toFixed(4)}`
        : '  • None detected';
      return {
        message: `↕️ **Asymptotes of \`${expr}\`**\n\n**Vertical asymptotes:**\n${vStr}\n\n**Horizontal asymptote:**\n${hStr}\n\n💡 Try "plot ${expr}" to see the asymptotes on the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
          result: { vertical: vertical.map(v => v.toFixed(4)), horizontal: horizontal?.toFixed(4) ?? null },
        },
      };
    }

    case 'area': {
      const query = intent.query ?? input;
      const exprs = extractMultiExpressions(query);
      // Try to extract limits from query
      const fromMatch = query.match(/from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+)/i);
      const a = fromMatch ? parseFloat(fromMatch[1]) : 0;
      const b = fromMatch ? parseFloat(fromMatch[2]) : 1;
      if (exprs.length >= 2) {
        const area = numericalIntegrate(exprs[0], (a + b) / 2, a, b);
        const area2 = numericalIntegrate(exprs[1], (a + b) / 2, a, b);
        return {
          message: `📐 **Area between \`${exprs[0]}\` and \`${exprs[1]}\` from ${a} to ${b}**\n\nEstimated area: **${Math.abs(area - area2).toFixed(6)}**\n\n> *This is a numerical approximation. For more precision, try adjusting the range or using a definite integral.*\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see the region.`,
          action: { type: 'none' },
        };
      }
      const singleExpr = exprs[0] ?? extractExpression(query);
      if (!singleExpr) {
        return {
          message: "I can compute areas! Try:\n• \"area under sin(x) from 0 to pi\"\n• \"area between x^2 and x from 0 to 1\"\n• \"area enclosed by x^2 and 2x\"",
          action: { type: 'none' },
        };
      }
      const result = numericalIntegrate(singleExpr, (a + b) / 2, a, b);
      return {
        message: `📐 **Area under \`${singleExpr}\` from ${a} to ${b}**\n\nEstimated area: **${result.toFixed(6)}**\n\n> *This is a numerical approximation using Simpson's rule. For more precision, try a smaller interval.*\n\n💡 Try "plot ${singleExpr}" to see the region.`,
        action: { type: 'none' },
      };
    }

    case 'volume': {
      const query = intent.query ?? input;
      const expr = extractExpression(query);
      if (!expr) {
        return {
          message: "I can compute volumes of revolution! Try:\n• \"volume of revolution of x^2 from 0 to 1\"\n• \"volume of solid formed by rotating sin(x) around x-axis\"",
          action: { type: 'none' },
        };
      }
      const fromMatch = query.match(/from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+)/i);
      const a = fromMatch ? parseFloat(fromMatch[1]) : 0;
      const b = fromMatch ? parseFloat(fromMatch[2]) : 1;
      return {
        message: `🏗️ **Volume of Revolution for \`${expr}\` from ${a} to ${b}**\n\nUsing the disk method, V = π ∫ [f(x)]² dx\n\n> *For a numerical approximation, I can compute the definite integral. Try "calculate π * integral of (${expr})^2 from ${a} to ${b}" for a more precise approach.*\n\n💡 Try "plot ${expr}" to see the generating curve.`,
        action: { type: 'none' },
      };
    }

    case 'rate_of_change': {
      const expr = intent.expression ?? extractExpression(intent.query ?? input);
      const query = intent.query ?? input;
      // Try to extract a point
      const atMatch = query.match(/at\s+(?:x\s*=\s*)?(-?[\d.]+)/i);
      const atPoint = atMatch ? parseFloat(atMatch[1]) : undefined;
      if (!expr) {
        return {
          message: "I can analyze rates of change! Try:\n• \"rate of change of x^2 at x = 3\"\n• \"how fast does sin(x) change at x = pi/4?\"\n• \"instantaneous rate of change of e^x at x = 0\"",
          action: { type: 'none' },
        };
      }
      const deriv = differentiate(expr);
      if (!deriv) {
        return {
          message: `I couldn't differentiate that expression. Make sure it's a valid function of x. Try "differentiate ${expr}" first.`,
          action: { type: 'none' },
        };
      }
      let rateMsg = `⚡ **Rate of Change of \`${expr}\`**\n\n**Derivative:** f'(x) = **${deriv}**`;
      if (atPoint !== undefined) {
        try {
          const processed = deriv.replace(/(\d)([a-zA-Z])/g, '$1*$2');
          const val = math.evaluate(processed, { x: atPoint });
          rateMsg += `\n\n**At x = ${atPoint}:** f'(${atPoint}) = **${typeof val === 'number' ? val.toFixed(6) : val}**`;
          rateMsg += `\n\nThis means the function is ${typeof val === 'number' && val > 0 ? '**increasing**' : typeof val === 'number' && val < 0 ? '**decreasing**' : '**flat**'} at that point.`;
        } catch {
          // ignore evaluation error
        }
      }
      rateMsg += `\n\n💡 Try "plot ${expr} and ${deriv}" to see the function and its rate of change together.`;
      return {
        message: rateMsg,
        action: { type: 'calculate', result: deriv },
      };
    }

    case 'draw_shape': {
      const query = intent.query ?? input;
      const plan = generateDrawingPlan(query);
      if (!plan) {
        return {
          message: "I can help you create technical drawings! Describe what you'd like to draw:\n• \"draw a circle with radius 50\"\n• \"draw a rectangle 100 by 60\"\n• \"draw a circular plate radius 30 in polar coordinates\"\n• \"design a mechanical bar 200 units long\"\n\nI'll translate your description into precise coordinate-based plans.",
          action: { type: 'none' },
        };
      }
      return {
        message: `🏗️ **Technical Drawing Plan: ${plan.name}**\n\n**Coordinate System:** ${plan.system}\n**Steps:**\n${plan.steps.map((s: { instruction: string }, i: number) => `  ${i + 1}. ${s.instruction}`).join('\n')}\n\nI've generated a precise coordinate-based plan. You can refine it by asking for modifications like "make it bigger" or "add a hole in the center".`,
        action: {
          type: 'draw',
          drawing: plan,
        },
      };
    }

    case 'differentiate': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I can find derivatives for you! Just give me a function, like \"differentiate x^3 + 2x\" or \"derivative of sin(x)\".",
          action: { type: 'none' },
        };
      }
      const deriv = differentiate(expr);
      if (!deriv) {
        return {
          message: `I couldn't differentiate that expression. Make sure it's a valid function of x. For example: "differentiate x^3" or "derivative of sin(x)".`,
          action: { type: 'none' },
        };
      }
      return {
        message: `**d/dx [${expr}]** = **${deriv}**\n\nWant to see this on a graph? Try "plot ${expr}" and "plot ${deriv}" to compare the function and its derivative.`,
        action: { type: 'calculate', result: deriv },
      };
    }

    case 'integrate': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I can help with integrals! Give me a function like \"integrate x^2\" or \"integral of sin(x)\".",
          action: { type: 'none' },
        };
      }
      const integral = integrateExpr(expr);
      return {
        message: `**∫ ${expr} dx** = ${integral}\n\n> *Note: mathjs provides simplification but not full symbolic integration. The antiderivative is shown. For definite integrals, try asking "area under ${expr} from 0 to 1" and I'll evaluate numerically.*`,
        action: { type: 'none' },
      };
    }

    case 'solve': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I can help solve equations! Try something like \"solve x^2 - 4 = 0\" or \"find roots of x^2 + 2x - 3\".",
          action: { type: 'none' },
        };
      }
      // Try to find roots numerically
      try {
        const roots = findRoots(expr);
        if (roots.length > 0) {
          const rootsStr = roots.map((r, i) => `  ${i + 1}. x ≈ **${r.toFixed(6)}**`).join('\n');
          return {
            message: `✏️ **Solving \`${expr} = 0\`**\n\nFound ${roots.length} root(s):\n${rootsStr}\n\n💡 Try "plot ${expr}" to see where the function crosses the x-axis.`,
            action: { type: 'none' },
          };
        }
      } catch {
        // fall through
      }
      let eqExpr = expr;
      if (!eqExpr.includes('=')) {
        eqExpr = `${eqExpr} = 0`;
      }
      return {
        message: `**Solving:** ${eqExpr}\n\n> I couldn't find exact roots numerically. Try plotting the function with "plot ${expr}" to see where it crosses the x-axis, or use a narrower range.`,
        action: { type: 'none' },
      };
    }

    case 'convert': {
      const convResult = parseConversion(intent.query ?? input);
      if (!convResult) {
        return {
          message: "I can convert between common units! Try:\n• \"convert 45 degrees to radians\"\n• \"100 mph to km/h\"\n• \"25°C to Fahrenheit\"\n• \"10 feet to meters\"",
          action: { type: 'none' },
        };
      }
      return {
        message: `**${convResult}**`,
        action: { type: 'calculate', result: convResult },
      };
    }

    case 'explain': {
      const knowledge = searchKnowledge(intent.query ?? input);
      if (knowledge) {
        return {
          message: knowledge,
          action: { type: 'none' },
        };
      }
      return {
        message: `That's a great question! I have detailed explanations for:

  • Derivatives — "explain derivatives"
  • Integrals — "explain integrals"
  • Limits — "explain limits"
  • Trigonometry — "explain trigonometry"
  • Fourier Transforms — "explain Fourier transform"
  • Differential Equations — "explain differential equations"
  • Vectors — "explain vectors"
  • Matrices — "explain matrices"
  • Taylor Series — "explain Taylor series"

  Try one of these, or ask me to calculate or plot something!`,
        action: { type: 'none' },
      };
    }

    case 'general':
    default:
      return {
        message: `I'm not quite sure what you're asking. I can help with:

  • **Calculations** — "calculate sin(pi/4)"
  • **Plotting** — "plot x^2 + 3x" or "graph sin(x) and cos(x) together"
  • **Analysis** — "analyze x^3 - 3x + 2"
  • **Derivatives** — "differentiate x^3"
  • **Integrals** — "integrate sin(x)"
  • **Trig & Log** — "analyze sin(x)" or "analyze ln(x)"
  • **Engineering** — "critical points of x^3 - 3x"
  • **Drawing** — "draw a circle radius 50"

  Try one of these, or type **help** for more details!`,
        action: { type: 'none' },
      };
  }
}