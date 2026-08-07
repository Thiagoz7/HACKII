import { create, all } from 'mathjs';
import type { ChatIntent, ChatAction } from '../types/chatbot';
import type { CoordinateSystem } from '../types/graph';
import {
  fullAnalysis, findIntersections, compareFunctions,
  explainTrigProperties,
  explainLogProperties,
  findRoots, findCriticalPoints, findInflectionPoints,
  findVerticalAsymptotes, findHorizontalAsymptote,
  analyzeDomain, estimateRange, numericalIntegrate,
} from './math-analysis';
import { parseDrawingIntent } from './drawing-engine';
import {
  computeLimit, computeDerivative, computePartialDerivative, computeIntegral,
  formatLimitResult, formatDerivativeResult, formatIntegralResult,
} from './calculus-engine';
import { parseMechanicalQuery, parseEditCommand, parseDeleteCommand } from './mechanical-parts';
import { parseAnimationQuery, createAnimationId, getAnimationColor } from './animation-engine';
import type { AnimationConfig } from './animation-engine';
import { parse3DPlotQuery } from './renderer-3d';
import type { Surface3D } from './renderer-3d';
import { parseExportQuery } from './export-engine';
import { parseBeamQuery, analyzeBeam, analyzeTorsion } from './beam-analysis';
import type { BeamConfig } from './beam-analysis';
import { generateBeamGeometry, generateSFDiagram, generateBMDiagram, generateDeflectionDiagram, generateFullBeamVisualization } from './beam-visualization';
import { parseSolveQuery, solveEquation } from './equation-solver';
import {
  loadDatabase, saveDatabase, addQuery, addFunction,
  searchDatabase, getDatabaseStats, parseTrainingCommand,
} from './training-database';
import type { TrainingDatabase } from './training-database';
import { detectLanguageCommand, normalizeCommand } from './i18n';
import type { Locale } from './i18n';

const math = create(all);

// ── Helpers ──────────────────────────────────────────────────────

function extractExpression(input: string): string | null {
  // Try to extract a math expression from the input
  const patterns = [
    // "calculate/compute the integral/derivative of X"
    /(?:calculate|compute|evaluate|find)\s+(?:the\s+)?(?:integral|derivative|limit|antiderivative)\s+(?:of\s+)?(.+?)(?:\s+and\s+|\s+from\s|\s+as\s|\?|$)/i,
    // "integrate/differentiate X"
    /(?:integrate|differentiate|derivative\s+of)\s+(.+?)(?:\s+and\s+plot|\s+from\s+|\s+as\s+|\s+at\s+|\?|$)/i,
    // "plot/graph the derivative/integral of X"
    /(?:plot|graph|draw|show)\s+(?:the\s+)?(?:derivative|integral|antiderivative)\s+(?:of\s+)?(.+?)(?:\s+from\s|\s+in\s|\?|$)/i,
    // "plot/graph X"
    /(?:plot|graph|draw|show\s+me)\s+(.+?)(?:\s+from\s|\s+in\s+|\s+and\s+|\?|$)/i,
    // "calculate/evaluate/what is X"
    /(?:calculate|compute|evaluate|what\s+is|what's|find|solve\s+for)\s+(.+?)(?:\s+and\s+|\?|$)/i,
    // "limit of X as..."
    /(?:limit|lim)\s+(?:of\s+)?(.+?)(?:\s+as\s+|\s+when\s+|\s+at\s+|\?|$)/i,
    // "d/dx of X"
    /d\/d[a-z]\s*(?:of\s+)?(.+?)(?:\s+at\s+|\?|$)/i,
    // "∫ X dx"
    /∫\s*(.+?)\s*d[a-z]/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      let expr = match[1].trim();
      // Remove trailing noise words
      expr = expr.replace(/\s+(and|then|also|please|now)\s*$/i, '');
      // Remove trailing punctuation
      expr = expr.replace(/[?.,;!]+$/, '');
      // Remove "plot it" / "graph it" suffixes
      expr = expr.replace(/\s+(plot|graph|draw|show)\s+(it|that|this|the\s+result)\s*$/i, '');
      if (expr.length > 0) return expr;
    }
  }

  // If input looks like a pure math expression, use it directly
  const pureMath = /^[\d\s+\-*/^().,x\syθ]+$/i;
  if (pureMath.test(input.trim())) {
    return input.trim();
  }

  // Last resort: try to find function-like patterns anywhere
  const funcPattern = /\b(sin|cos|tan|log|ln|sqrt|exp|abs)\s*\([^)]+\)/i;
  const funcMatch = input.match(funcPattern);
  if (funcMatch) {
    // Extract the surrounding expression context
    const idx = input.indexOf(funcMatch[0]);
    let start = idx;
    let end = idx + funcMatch[0].length;
    // Expand left for coefficients
    while (start > 0 && /[\d*\s]/.test(input[start - 1])) start--;
    // Expand right for operations
    while (end < input.length && /[\s+\-*/^)(\d.]/.test(input[end])) end++;
    const extracted = input.slice(start, end).trim();
    if (extracted.length > 0) return extracted;
  }

  // Try x^ patterns
  const xPattern = /x\s*\^\s*[\d.]+(?:\s*[+\-*/]\s*[\dx^.\s()]+)*/i;
  const xMatch = input.match(xPattern);
  if (xMatch) return xMatch[0].trim();

  return null;
}

/**
 * Detect compound intents: e.g., "calculate the integral of sin(x) and plot it"
 * Returns the primary operation and whether to also plot.
 */
function detectCompoundIntent(input: string): { shouldPlot: boolean; shouldCompute: 'derivative' | 'integral' | 'limit' | null } {
  const lower = input.toLowerCase();
  const shouldPlot = /\b(and\s+)?(plot|graph|draw|show|visualize)\s*(it|that|this|the\s+result)?\b/i.test(lower) ||
                     /\b(plot|graph|draw|show)\s+(?:the\s+)?(?:derivative|integral|result)\b/i.test(lower);

  let shouldCompute: 'derivative' | 'integral' | 'limit' | null = null;
  if (/\b(plot|graph|draw|show)\s+(?:the\s+)?(?:derivative|d\/dx)\b/i.test(lower)) {
    shouldCompute = 'derivative';
  } else if (/\b(plot|graph|draw|show)\s+(?:the\s+)?(?:integral|antiderivative)\b/i.test(lower)) {
    shouldCompute = 'integral';
  } else if (/\b(calculate|compute|find)\s+(?:the\s+)?(?:derivative|d\/dx)\s+.+?(?:and\s+)?(plot|graph|show)/i.test(lower)) {
    shouldCompute = 'derivative';
  } else if (/\b(calculate|compute|find)\s+(?:the\s+)?(?:integral|antiderivative)\s+.+?(?:and\s+)?(plot|graph|show)/i.test(lower)) {
    shouldCompute = 'integral';
  } else if (/\b(calculate|compute|find)\s+(?:the\s+)?limit\s+.+?(?:and\s+)?(plot|graph|show)/i.test(lower)) {
    shouldCompute = 'limit';
  }

  return { shouldPlot, shouldCompute };
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

  // ── Mechanical / Technical Drawing (more specific than "draw" → plot) ──
  if (/\b(draw|create|generate|design|make|plot)\s+(a\s+|an\s+|the\s+)?(gear|shaft|pulley|bearing|spring|cam|sprocket|flywheel)\b/i.test(lower) ||
      /\b(gear|shaft|pulley|bearing|spring|cam)\s+(with|of|having)\b/i.test(lower) ||
      /\b(mechanical|engineering)\s+(part|component|drawing)\b/i.test(lower) ||
      /\bdraw\s+(a\s+|an\s+)?(circle|rectangle|square|polygon|arc|plate|disk|bar|beam|bolt|flange)\b/i.test(lower) ||
      /\bdesign\s+(a\s+|an\s+)?(mechanical|part|piece|component|plate|disk|bar|beam)\b/i.test(lower) ||
      /\btechnical\s+drawing\b/i.test(lower) ||
      /\b(assembly|assemble)\b/i.test(lower) && /\b(gear|shaft|pulley|bearing|spring|cam|part)\b/i.test(lower)) {
    return { type: 'draw_shape', query: input, confidence: 0.93 };
  }

  // ── Edit Mechanical Part ──
  if (/\b(edit|update|change|modify|set|adjust)\b/i.test(lower) &&
      /\b(gear|shaft|pulley|bearing|spring|cam|radius|length|diameter|teeth|coils?|lift)\b/i.test(lower) &&
      /\b(to|=|:)\s*\d/i.test(lower)) {
    return { type: 'edit_part', query: input, confidence: 0.93 };
  }

  // ── Delete/Remove/Reset Mechanical Part ──
  if (/\b(delete|remove|clear|reset)\b/i.test(lower) &&
      /\b(gear|shaft|pulley|bearing|spring|cam|part|drawing|radius|length|diameter|teeth|coils?|lift|all|defaults?)\b/i.test(lower)) {
    return { type: 'delete_part', query: input, confidence: 0.93 };
  }

  // ── Animation ──
  if (/\b(animate|animat(?:e|ion|ing)|oscillat|wave\s+(?:motion|animation)|rotat(?:e|ing|ion)|spin(?:ning)?)\b/i.test(lower) &&
      !/\b(draw|design|create)\s+(a\s+)?rotat/i.test(lower)) {
    return { type: 'animate', query: input, confidence: 0.93 };
  }

  // ── 3D Plot ──
  if (/\b3[dD]\b/.test(input) && /\b(plot|graph|surface|show|draw|visualize)\b/i.test(lower)) {
    return { type: 'plot_3d', query: input, confidence: 0.93 };
  }
  if (/\bz\s*=\s*.+\b(x|y)\b/i.test(input) && /\b(x|y)\b/i.test(input)) {
    return { type: 'plot_3d', query: input, confidence: 0.90 };
  }
  if (/\bsurface\b/i.test(lower) && /\b(plot|graph|show|of)\b/i.test(lower)) {
    return { type: 'plot_3d', query: input, confidence: 0.90 };
  }

  // ── Export ──
  if (/\b(export|save|download|generate)\b/i.test(lower) &&
      /\b(pdf|csv|file|graph|plot|part|gear|shaft|data|drawing|report)\b/i.test(lower)) {
    return { type: 'export', query: input, confidence: 0.93 };
  }

  // ── Structural / Beam Analysis ──
  if (/\b(beam|shear\s+force|bending\s+moment|deflection\s+(?:of|diagram|curve)|cantilever|simply\s*supported\s+beam|structural\s+analysis|torsion)\b/i.test(lower)) {
    return { type: 'beam_analysis', query: input, confidence: 0.93 };
  }
  if (/\b(draw|plot|show|graph)\s+(?:a\s+)?(?:simply\s*supported|cantilever|fixed)\s+beam\b/i.test(lower)) {
    return { type: 'beam_analysis', query: input, confidence: 0.93 };
  }

  // ── Highlight Critical Points ──
  if (/\b(highlight|show|mark|display|find)\s+(?:the\s+)?(critical\s+points?|roots?|zeros?|maxima|minima|max\s+and\s+min|extrema|inflection|intercepts?)\b/i.test(lower)) {
    return { type: 'highlight_points', query: input, confidence: 0.92 };
  }

  // ── Import / Define Function ──
  if (/\b(import|define|add)\s+(?:function\s+)?[a-zA-Z]\s*\(/i.test(lower) ||
      /[a-zA-Z]\s*\(\s*[a-zA-Z]\s*\)\s*=\s*.+/.test(input)) {
    return { type: 'import_function', query: input, confidence: 0.93 };
  }

  // ── Solve Equation (more specific than general 'solve') ──
  if (/\b(solve|find\s+roots?\s+of|find\s+zeros?\s+of|find\s+solutions?\s+(?:of|to))\b/i.test(lower) &&
      /[=<>]|[a-z]\s*\^|x\s*\^/.test(lower)) {
    return { type: 'solve_equation', query: input, confidence: 0.92 };
  }

  // ── Training Database ──
  if (/\b(import|upload)\s+(?:this\s+)?(?:pdf|file|document)\s+(?:for\s+)?(?:training)?\b/i.test(lower) ||
      /\b(add|store|save|update|enrich)\s+(?:to\s+|the\s+)?(?:training\s+)?(?:database|db|data\s*set)\b/i.test(lower) ||
      /\b(show|view|display)\s+(?:training\s+)?(?:database|db)\s*(?:stats|statistics|info)?\b/i.test(lower) ||
      /\b(clear|reset)\s+(?:the\s+)?(?:training\s+)?(?:database|db)\b/i.test(lower) ||
      /\b(search|find)\s+(?:in\s+)?(?:the\s+)?(?:training\s+)?(?:database|db)\b/i.test(lower)) {
    return { type: 'training', query: input, confidence: 0.93 };
  }

  // ── Language Switch ──
  if (/\b(translate|switch|change|set)\s+(?:to|the\s+language|interface)\b/i.test(lower) ||
      /\b(respond|answer|reply)\s+in\s+\w+/i.test(lower) ||
      /\b(accept\s+commands?\s+in|use)\s+\w+\s*(language)?\b/i.test(lower) ||
      /\b(español|français|deutsch|português|italiano|日本語|中文)\b/i.test(lower)) {
    return { type: 'language', query: input, confidence: 0.95 };
  }

  // ── Compound: compute + plot (e.g., "plot the derivative of cos(x)", "calculate integral of x^2 and graph it") ──
  const compound = detectCompoundIntent(lower);
  if (compound.shouldCompute && compound.shouldPlot) {
    if (compound.shouldCompute === 'derivative') {
      return {
        type: 'differentiate',
        expression: extractExpression(input) ?? undefined,
        query: input,
        system: detectSystem(input),
        confidence: 0.93,
      };
    }
    if (compound.shouldCompute === 'integral') {
      return {
        type: 'integrate',
        expression: extractExpression(input) ?? undefined,
        query: input,
        system: detectSystem(input),
        confidence: 0.93,
      };
    }
    if (compound.shouldCompute === 'limit') {
      return {
        type: 'limit',
        expression: extractExpression(input) ?? undefined,
        query: input,
        confidence: 0.93,
      };
    }
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

  // ── Limits ──
  if (/\b(limit|lim)\b/i.test(lower) && /\b(as|approaches|→|->|tends\s+to|when\s+x)\b/i.test(lower)) {
    return {
      type: 'limit',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.92,
    };
  }
  if (/\blim\s*\[/i.test(lower) || /\blim\s*\(/i.test(lower) || /\blimit\s+of\b/i.test(lower)) {
    return {
      type: 'limit',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.92,
    };
  }

  // ── Definite Integral (with bounds) ──
  if (/\b(integral|integrate|∫)\b/i.test(lower) && /\b(from\s+[\d.-]+\s+to\s+[\d.-]+)\b/i.test(lower)) {
    return {
      type: 'definite_integral',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.92,
    };
  }

  // ── Higher-Order Derivative ──
  if (/\b(second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+derivative\b/i.test(lower) ||
      /\bd\^?\d+\s*\/\s*d[a-z]\^?\d+/i.test(lower) ||
      /\bf['′]{2,}\s*\(/i.test(lower)) {
    return {
      type: 'higher_derivative',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.92,
    };
  }

  // ── Partial Derivative ──
  if (/\b(partial\s+derivative|∂)\b/i.test(lower) ||
      /\b∂\/∂[a-z]/i.test(lower) ||
      /\bpartial\b/i.test(lower)) {
    return {
      type: 'partial_derivative',
      expression: extractExpression(input) ?? undefined,
      query: input,
      confidence: 0.92,
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
      if (Number.isNaN(result)) return { result: null, error: 'Result is undefined (NaN).' };
      if (!Number.isFinite(result)) return { result: null, error: 'Result is infinite.' };
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
    return { result: null, error: `Couldn't evaluate that: ${msg}` };
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
  locale?: Locale;
}

// ── Training Database Instance ────────────────────────────────────
let trainingDb: TrainingDatabase = loadDatabase();

function getExampleCommand(locale: Locale): string {
  const examples: Record<Locale, string> = {
    en: 'plot sin(x)',
    es: 'graficar sin(x)',
    fr: 'tracer sin(x)',
    de: 'zeichnen sin(x)',
    pt: 'plotar sin(x)',
    it: 'tracciare sin(x)',
    ja: 'plot sin(x)',
    zh: 'plot sin(x)',
  };
  return examples[locale] ?? examples.en;
}

// ── Current locale (updated by language commands) ─────────────────
let currentLocale: Locale = 'en';

export function setProcessMessageLocale(locale: Locale): void {
  currentLocale = locale;
}

export function processMessage(input: string, locale?: Locale): BotResponse {
  const activeLocale = locale ?? currentLocale;

  // Normalize input from user's language to English for processing
  const normalizedInput = normalizeCommand(input, activeLocale);
  const intent = classifyIntent(normalizedInput);

  // Auto-record query to training database (non-blocking)
  try {
    addQuery(trainingDb, input, intent.type);
    saveDatabase(trainingDb);
  } catch { /* don't disrupt main flow */ }

  // Handle language switch specially
  if (intent.type === 'language') {
    const detectedLocale = detectLanguageCommand(input);
    if (detectedLocale) {
      currentLocale = detectedLocale;
      const langName = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano', ja: '日本語', zh: '中文' }[detectedLocale];
      return {
        message: `🌐 **Language switched to ${langName}!**\n\n✅ The interface and chatbot responses will now use ${langName}.\nCommands in ${langName} are accepted (e.g., "${getExampleCommand(detectedLocale)}").\n\nMathematical notation remains universal.`,
        action: { type: 'none' },
        locale: detectedLocale,
      };
    }
    return {
      message: "I can switch languages! Try:\n• \"Translate to Spanish\" / \"Español\"\n• \"Respond in French\" / \"Français\"\n• \"Switch to German\" / \"Deutsch\"\n• \"Use Portuguese\" / \"Português\"",
      action: { type: 'none' },
    };
  }

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
      const parts: string[] = [];
      parts.push(`**Domain:** ${analysis.domain}`);
      parts.push(`**Range:** ${analysis.range}`);
      parts.push(`**Intercepts:** x = [${analysis.intercepts.x.map(v => v.toFixed(4)).join(', ')}], y = ${analysis.intercepts.y !== null ? analysis.intercepts.y.toFixed(4) : 'N/A'}`);
      parts.push(`**Symmetry:** ${analysis.symmetry}`);
      parts.push(`**Asymptotes:** vertical: [${analysis.asymptotes.vertical.map(v => v.toFixed(4)).join(', ')}], horizontal: ${analysis.asymptotes.horizontal !== null ? analysis.asymptotes.horizontal.toFixed(4) : 'none'}`);
      parts.push(`**First Derivative:** ${analysis.firstDerivative}`);
      parts.push(`**Critical Points:** [${analysis.criticalPoints.map(v => v.toFixed(4)).join(', ')}]`);
      parts.push(`**Intervals of Increase:** ${analysis.intervalsIncrease.join(', ') || 'none'}`);
      parts.push(`**Intervals of Decrease:** ${analysis.intervalsDecrease.join(', ') || 'none'}`);
      parts.push(`**Second Derivative:** ${analysis.secondDerivative}`);
      parts.push(`**Inflection Points:** [${analysis.inflectionPoints.map(v => v.toFixed(4)).join(', ')}]`);
      parts.push(`**Concave Up:** ${analysis.concavityUp.join(', ') || 'none'}`);
      parts.push(`**Concave Down:** ${analysis.concavityDown.join(', ') || 'none'}`);
      parts.push(`**End Behavior:** ${analysis.endBehavior}`);
      return {
        message: `🔬 **Full Analysis of \`${expr}\`**\n\n${parts.join('\n')}\n\n💡 Want to visualize this? Try "plot ${expr}" to see the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
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
      const props = explainTrigProperties(expr);
      return {
        message: `🎛️ **Trigonometric Analysis of \`${expr}\`**\n\n${props}\n\n💡 Try "plot ${expr}" to see the graph, or "compare ${expr} with cos(x)" for comparison.`,
        action: {
          type: 'analyze',
          expression: expr,
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
      const props = explainLogProperties(expr);
      return {
        message: `📊 **Logarithmic Analysis of \`${expr}\`**\n\n${props}\n\n💡 Try "plot ${expr}" to see the graph, or "intersect ${expr} with x^2" to find crossing points.`,
        action: {
          type: 'analyze',
          expression: expr,
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
      const intersectionResult = findIntersections(exprs[0], exprs[1]);
      const pointsStr = intersectionResult.points.length > 0
        ? intersectionResult.points.map((p, i) => `  ${i + 1}. (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join('\n')
        : '  No intersection points found in the search range.';
      return {
        message: `🔗 **Intersections of \`${exprs[0]}\` and \`${exprs[1]}\`**\n\n${pointsStr}\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see them on the graph.`,
        action: {
          type: 'intersect',
          expressions: [exprs[0], exprs[1]],
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
      const compParts: string[] = [];
      if (comparison.similarities.length > 0) {
        compParts.push('**Similarities:**');
        comparison.similarities.forEach(s => compParts.push(`  • ${s}`));
      }
      if (comparison.differences.length > 0) {
        compParts.push('**Differences:**');
        comparison.differences.forEach(d => compParts.push(`  • ${d}`));
      }
      if (comparison.intersections.points.length > 0) {
        compParts.push(`**Intersections:** ${comparison.intersections.points.length} point(s)`);
      }
      return {
        message: `⚖️ **Comparing \`${exprs[0]}\` vs \`${exprs[1]}\`**\n\n${compParts.join('\n')}\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see them side by side.`,
        action: {
          type: 'compare',
          expressions: [exprs[0], exprs[1]],
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
      const points = findCriticalPoints(expr, -10, 10);
      const fn = (x: number) => {
        try { return math.evaluate(expr.replace(/(\d)([a-zA-Z])/g, '$1*$2'), { x }); } catch { return NaN; }
      };
      const pointsStr = points.length > 0
        ? points.map((p, i) => `  ${i + 1}. x = ${p.toFixed(4)}, f(x) = ${(typeof fn(p) === 'number' ? fn(p) : NaN).toFixed(4)}`).join('\n')
        : '  No critical points found in the search range.';
      return {
        message: `🎯 **Critical Points of \`${expr}\`**\n\n${pointsStr}\n\n💡 Try "plot ${expr}" to see these points on the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
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
      const points = findInflectionPoints(expr, -10, 10);
      const fn = (x: number) => {
        try { return math.evaluate(expr.replace(/(\d)([a-zA-Z])/g, '$1*$2'), { x }); } catch { return NaN; }
      };
      const pointsStr = points.length > 0
        ? points.map((p, i) => `  ${i + 1}. x = ${p.toFixed(4)}, f(x) = ${(typeof fn(p) === 'number' ? fn(p) : NaN).toFixed(4)}`).join('\n')
        : '  No inflection points found in the search range.';
      return {
        message: `📉 **Inflection Points of \`${expr}\`**\n\n${pointsStr}\n\n💡 Try "plot ${expr}" to see the curvature changes on the graph.`,
        action: {
          type: 'analyze',
          expression: expr,
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
      const vertical = findVerticalAsymptotes(expr, -10, 10);
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
        const area1 = numericalIntegrate(exprs[0], a, b);
        const area2 = numericalIntegrate(exprs[1], a, b);
        return {
          message: `📐 **Area between \`${exprs[0]}\` and \`${exprs[1]}\` from ${a} to ${b}**\n\nEstimated area: **${Math.abs(area1 - area2).toFixed(6)}**\n\n> *This is a numerical approximation. For more precision, try adjusting the range or using a definite integral.*\n\n💡 Try "plot ${exprs[0]} and ${exprs[1]} together" to see the region.`,
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
      const result = numericalIntegrate(singleExpr, a, b);
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

      // First, try to parse as a mechanical part
      const mechPart = parseMechanicalQuery(query);
      if (mechPart) {
        return {
          message: `🏗️ **${mechPart.label}**\n\nGenerated a parametric mechanical drawing with ${mechPart.paths.length} path(s).\n\n📈 The part has been plotted on the graph in Cartesian coordinates.\n\n💡 You can combine parts into assemblies: "draw a gear with 20 teeth and a shaft length 10"`,
          action: {
            type: 'mechanical_draw',
            mechanicalPart: mechPart,
          } as ChatAction,
        };
      }

      // Fall back to generic drawing intent
      const plan = parseDrawingIntent(query);
      if (!plan) {
        return {
          message: "I can draw mechanical parts and shapes! Try:\n\n**Mechanical parts:**\n• \"draw a gear with 20 teeth and radius 5\"\n• \"draw a shaft length 10 diameter 2\"\n• \"draw a pulley radius 4\"\n• \"draw a bearing inner radius 2 outer radius 5\"\n• \"draw a spring length 8 with 6 coils\"\n• \"draw a cam base radius 3 lift 1.5\"\n\n**Basic shapes:**\n• \"draw a circle with radius 50\"\n• \"draw a rectangle 100 by 60\"",
          action: { type: 'none' },
        };
      }
      const stepsStr = plan.commands.map((cmd, i) => `  ${i + 1}. ${cmd.type} (${cmd.system}) — ${JSON.stringify(cmd.params)}`).join('\n');
      return {
        message: `🏗️ **Technical Drawing: ${plan.name}**\n\n**Description:** ${plan.description}\n**Steps:**\n${stepsStr}`,
        action: {
          type: 'draw',
          drawing: plan,
        },
      };
    }

    case 'edit_part': {
      const query = intent.query ?? input;
      const editCmd = parseEditCommand(query);
      if (!editCmd || Object.keys(editCmd.updates).length === 0) {
        return {
          message: "I can edit mechanical parts! Try:\n• \"change the gear radius to 8\"\n• \"update shaft length to 12\"\n• \"set bearing outer radius to 7\"\n• \"edit spring coils to 10\"\n\nMake sure to specify the parameter and new value.",
          action: { type: 'none' },
        };
      }

      const updatesStr = Object.entries(editCmd.updates)
        .map(([k, v]) => `**${k}** → ${v}`)
        .join(', ');

      return {
        message: `✏️ **Editing ${editCmd.targetType ?? 'part'}**\n\nUpdating: ${updatesStr}\n\n✅ Changes applied — the drawing has been refreshed.`,
        action: {
          type: 'edit_part',
          targetPartType: editCmd.targetType ?? undefined,
          editUpdates: editCmd.updates,
        },
      };
    }

    case 'delete_part': {
      const query = intent.query ?? input;
      const deleteCmd = parseDeleteCommand(query);

      if (deleteCmd.deleteWholePart) {
        return {
          message: `🗑️ **Deleted ${deleteCmd.targetType ?? 'part'}**\n\n✅ The part has been removed from the graph.`,
          action: {
            type: 'delete_part',
            targetPartType: deleteCmd.targetType ?? undefined,
            deleteWholePart: true,
            resetParams: [],
          },
        };
      }

      if (deleteCmd.resetParams.length > 0) {
        const paramsStr = deleteCmd.resetParams.join(', ');
        return {
          message: `🔄 **Reset ${paramsStr}** on ${deleteCmd.targetType ?? 'part'} to default values.\n\n✅ The drawing has been refreshed with default parameters.`,
          action: {
            type: 'delete_part',
            targetPartType: deleteCmd.targetType ?? undefined,
            deleteWholePart: false,
            resetParams: deleteCmd.resetParams,
          },
        };
      }

      // Reset all params
      if (/\breset\b/i.test(query)) {
        return {
          message: `🔄 **Reset ${deleteCmd.targetType ?? 'all parts'}** to default values.\n\n✅ All parameters restored to defaults.`,
          action: {
            type: 'delete_part',
            targetPartType: deleteCmd.targetType ?? undefined,
            deleteWholePart: false,
            resetParams: [],
          },
        };
      }

      return {
        message: "I can delete parts or reset parameters! Try:\n• \"delete the gear\"\n• \"remove the shaft\"\n• \"reset radius\" (restores default)\n• \"reset all to defaults\"",
        action: { type: 'none' },
      };
    }

    case 'animate': {
      const query = intent.query ?? input;
      const parsed = parseAnimationQuery(query);
      if (!parsed) {
        return {
          message: "I can create animations! Try:\n• \"Animate a sine wave\"\n• \"Show a gear rotating clockwise\"\n• \"Animate cos(x) fast\"\n• \"Rotate the pulley counterclockwise at speed 2\"\n\nYou can control speed, direction, and duration.",
          action: { type: 'none' },
        };
      }

      // For rotation: auto-create the part if a target type is specified
      let autoCreatedPart: ReturnType<typeof parseMechanicalQuery> = null;
      let creationMsg = '';

      if (parsed.type === 'rotation' && parsed.targetPart) {
        // Try to generate the part with defaults (or params from the query)
        autoCreatedPart = parseMechanicalQuery(`draw a ${parsed.targetPart} ${query}`);
        if (!autoCreatedPart) {
          // Fallback: create with just the part name
          autoCreatedPart = parseMechanicalQuery(`draw a ${parsed.targetPart}`);
        }
        if (autoCreatedPart) {
          creationMsg = `\n\n🔧 **Auto-created ${autoCreatedPart.label}** (part was not yet on graph).\nAfter animation, use ⏹ "Finalize" to keep it as a static drawing.`;
        }
      }

      const animConfig: AnimationConfig = {
        id: createAnimationId(),
        type: parsed.type,
        label: parsed.label,
        expression: parsed.expression,
        speed: parsed.speed,
        direction: parsed.direction,
        duration: parsed.duration,
        color: getAnimationColor(0),
        paths: autoCreatedPart?.paths ?? undefined,
        rotationCenter: autoCreatedPart
          ? { x: autoCreatedPart.centerX, y: autoCreatedPart.centerY }
          : parsed.type === 'rotation' ? { x: 0, y: 0 } : undefined,
      };

      const dirStr = parsed.direction !== 'forward' ? ` (${parsed.direction})` : '';
      const speedStr = parsed.speed !== 1 ? ` at ${parsed.speed}× speed` : '';
      const durStr = parsed.duration > 0 ? ` for ${parsed.duration}s` : '';

      return {
        message: `🎬 **${parsed.label}**${dirStr}${speedStr}${durStr}${creationMsg}\n\n▶ Animation started! Use the playback controls to pause, stop, adjust speed, or **Finalize** to keep the part as a static drawing.`,
        action: {
          type: 'animate',
          animationConfig: animConfig,
          mechanicalPart: autoCreatedPart ?? undefined,
        },
      };
    }

    case 'plot_3d': {
      const query = intent.query ?? input;
      const parsed = parse3DPlotQuery(query);
      if (!parsed) {
        return {
          message: "I can create 3D surface plots! Try:\n• \"plot z = sin(x)*cos(y) in 3D\"\n• \"3D surface of x^2 + y^2\"\n• \"show z = exp(-(x^2+y^2)) in 3D\"\n\nUse expressions with x and y variables for the surface height (z).",
          action: { type: 'none' },
        };
      }

      const surface: Surface3D = {
        id: `surf-${Math.random().toString(36).slice(2, 8)}`,
        expression: parsed.expression,
        label: parsed.label,
        color: '#00E5FF',
        gridResolution: 30,
        xRange: parsed.xRange,
        yRange: parsed.yRange,
      };

      return {
        message: `🌐 **3D Surface: ${parsed.label}**\n\nPlotting in 3D over x ∈ [${parsed.xRange[0]}, ${parsed.xRange[1]}], y ∈ [${parsed.yRange[0]}, ${parsed.yRange[1]}]\n\n🖱️ Drag to orbit · Scroll to zoom · The view has switched to 3D mode.`,
        action: {
          type: 'plot_3d',
          surface3D: surface,
        },
      };
    }

    case 'export': {
      const query = intent.query ?? input;
      const exportReq = parseExportQuery(query);
      if (!exportReq) {
        return {
          message: "I can export your work! Try:\n• \"Export this graph to PDF\"\n• \"Save the gear dimensions as CSV\"\n• \"Download function data as CSV\"\n• \"Generate a PDF of everything\"\n\nSupported formats: **PDF** (with graph image + metadata) and **CSV** (data points + dimensions).",
          action: { type: 'none' },
        };
      }

      const formatLabel = exportReq.format.toUpperCase();
      const targetLabel = exportReq.target === 'all' ? 'all data'
        : exportReq.target === 'part' ? (exportReq.targetName ?? 'mechanical parts')
        : exportReq.target === 'function' ? 'function plots'
        : 'current graph';

      return {
        message: `📄 **Exporting ${targetLabel} as ${formatLabel}**\n\n✅ File will download shortly.\n\nContents: ${formatLabel === 'PDF' ? 'graph visualization + parameters + labels' : 'structured data points and dimensions'}`,
        action: {
          type: 'export',
          exportRequest: exportReq,
        },
      };
    }

    case 'highlight_points': {
      return {
        message: `🎯 **Critical points are highlighted on the graph!**\n\nHover over any marker to see its coordinates:\n\n• 🔴 **Roots** (x-intercepts) — where f(x) = 0\n• 🟢 **Y-intercept** — where x = 0\n• 🟡 **Local maxima** — peaks\n• 🟢 **Local minima** — valleys\n• 🟣 **Inflection points** — where curvature changes\n\nMove your cursor over the colored dots on the graph to see precise values.`,
        action: { type: 'none' },
      };
    }

    case 'import_function': {
      const query = intent.query ?? input;
      const parsed = parseSolveQuery(query);
      if (!parsed || parsed.type !== 'import' || !parsed.functionDef) {
        return {
          message: "I can import and define functions! Try:\n• \"f(x) = sin(x) + log(x)\"\n• \"Import function g(y) = y^2 + 3y\"\n• \"Define h(t) = exp(-t) * cos(2t)\"\n\nI'll add it to the graph and you can analyze it further.",
          action: { type: 'none' },
        };
      }

      const fn = parsed.functionDef;
      // Replace variable with x for plotting (graph engine uses x)
      const plotExpr = fn.variable === 'x' ? fn.expression : fn.expression.replace(new RegExp(`\\b${fn.variable}\\b`, 'g'), 'x');

      return {
        message: `📥 **Imported: ${fn.label}**\n\n✅ Function added to the graph. Critical points are auto-highlighted.\n\n💡 Try "solve ${fn.name}(${fn.variable}) = 0" or "find maxima of ${fn.expression}"`,
        action: {
          type: 'plot',
          expression: plotExpr,
          system: 'cartesian',
        },
      };
    }

    case 'solve_equation': {
      const query = intent.query ?? input;
      const parsed = parseSolveQuery(query);

      let equation = '';
      if (parsed && parsed.type === 'solve' && parsed.equation) {
        equation = parsed.equation;
      } else {
        // Try to extract equation directly
        const eqMatch = query.match(/(?:solve|find\s+roots?\s+(?:of)?|find\s+zeros?\s+(?:of)?)\s*(.+)/i);
        equation = eqMatch ? eqMatch[1].trim().replace(/[?.,;!]+$/, '') : '';
      }

      if (!equation) {
        return {
          message: "I can solve equations! Try:\n• \"Solve 3x^2 = 2x + 1\"\n• \"Find roots of x^3 - 4x + 2\"\n• \"Solve sin(x) = 0.5\"\n• \"Find zeros of x^4 - 16\"\n\nI'll provide both symbolic and numerical solutions.",
          action: { type: 'none' },
        };
      }

      const result = solveEquation(equation);
      const stepsStr = result.steps.join('\n');

      // Build roots summary
      let rootsSummary = '';
      if (result.symbolicRoots.length > 0) {
        rootsSummary += `\n\n**Exact roots:** ${result.symbolicRoots.join(', ')}`;
      }
      if (result.numericalRoots.length > 0) {
        rootsSummary += `\n**Numerical:** ${result.numericalRoots.map(r => r.toFixed(6)).join(', ')}`;
      }

      return {
        message: `✏️ **Solving: ${equation}**\n\n${stepsStr}${rootsSummary}\n\n📈 Equation plotted on graph — roots are highlighted.`,
        action: {
          type: 'plot',
          expression: result.plotExpression ?? equation.split('=')[0],
          system: 'cartesian',
        },
      };
    }

    case 'training': {
      const query = intent.query ?? input;
      const cmd = parseTrainingCommand(query);

      if (!cmd) {
        return {
          message: "I can manage the training database! Try:\n• \"Show database stats\"\n• \"Import PDF for training\" (use the file upload button)\n• \"Add to training database: sin(x) + cos(x)\"\n• \"Search database for integrals\"\n• \"Clear training database\"",
          action: { type: 'none' },
        };
      }

      switch (cmd.action) {
        case 'show_stats': {
          const stats = getDatabaseStats(trainingDb);
          return {
            message: `📊 ${stats}`,
            action: { type: 'none' },
          };
        }

        case 'add_to_db': {
          if (cmd.content) {
            addFunction(trainingDb, cmd.content);
            saveDatabase(trainingDb);
            return {
              message: `✅ **Added to training database:**\n\`${cmd.content}\`\n\nThe database now contains ${trainingDb.entries.length} entries.`,
              action: { type: 'none' },
            };
          }
          return {
            message: "What would you like to add? Provide an expression, equation, or note.\n\nExample: \"Add to database: x^3 - 3x + 1\"",
            action: { type: 'none' },
          };
        }

        case 'search_db': {
          const results = searchDatabase(trainingDb, cmd.content ?? query, 5);
          if (results.length === 0) {
            return {
              message: `🔍 No matches found in the training database for "${cmd.content ?? query}".`,
              action: { type: 'none' },
            };
          }
          const resultStr = results.map((r, i) =>
            `  ${i + 1}. [${r.category}] ${r.content.slice(0, 60)}${r.content.length > 60 ? '...' : ''}`
          ).join('\n');
          return {
            message: `🔍 **Database search results:**\n\n${resultStr}`,
            action: { type: 'none' },
          };
        }

        case 'import_pdf': {
          return {
            message: `📄 **Ready to import!**\n\nTo upload a file, use the 📎 button in the input area. I'll extract mathematical expressions, equations, and parameters from the document and add them to the training database.\n\nSupported: .txt, .csv, .md files (PDF text extraction requires copy-paste of content).`,
            action: { type: 'none' },
          };
        }

        case 'clear_db': {
          trainingDb = loadDatabase();
          trainingDb.entries = [];
          trainingDb.stats = { totalQueries: 0, totalFunctions: 0, totalEquations: 0, totalParts: 0, totalPDFs: 0, lastUpdated: Date.now() };
          saveDatabase(trainingDb);
          return {
            message: `🗑️ **Training database cleared.**\n\nAll entries have been removed. The database will start fresh from your next interactions.`,
            action: { type: 'none' },
          };
        }
      }

      return { message: "Training database command not recognized.", action: { type: 'none' } };
    }

    case 'beam_analysis': {
      const query = intent.query ?? input;
      const parsed = parseBeamQuery(query);
      if (!parsed) {
        return {
          message: "I can perform structural beam analysis and visualization! Try:\n• \"Draw a simply supported beam of length 10\"\n• \"Plot bending moment diagram for a cantilever beam length 5m with point load 500N at 3m\"\n• \"Show shear force distribution for beam with uniform load 1000 N/m\"\n• \"Analyze deflection of beam under distributed load\"\n• \"Analyze torsion in a shaft diameter 50mm torque 200 N·m\"",
          action: { type: 'none' },
        };
      }

      // Handle torsion separately
      if (parsed.action === 'torsion') {
        const torqueMatch = query.match(/(\d+\.?\d*)\s*(?:n[·.]?m|nm)/i);
        const torque = torqueMatch ? parseFloat(torqueMatch[1]) : 100;
        const diaMatch = query.match(/(?:diameter|d)\s*(?:[:=]\s*)?(\d+\.?\d*)\s*(?:mm)?/i);
        const diameter = diaMatch ? parseFloat(diaMatch[1]) / 1000 : 0.05;
        const lenMatch = query.match(/length\s*(?:[:=]\s*)?(\d+\.?\d*)/i);
        const length = lenMatch ? parseFloat(lenMatch[1]) : 1;

        const torsionResult = analyzeTorsion(torque, diameter, length);
        return {
          message: `🔩 ${torsionResult.summary.join('\n')}\n\n💡 You can edit parameters: "analyze torsion torque 500 N·m diameter 80mm"`,
          action: { type: 'none' },
        };
      }

      // Beam analysis with visualization
      const beamConfig: BeamConfig = {
        length: parsed.config.length ?? 10,
        support: parsed.config.support ?? 'simply_supported',
        loads: parsed.config.loads ?? [{ type: 'distributed', magnitude: 1000, start: 0, end: 10 }],
        width: parsed.config.width,
        height: parsed.config.height,
        elasticModulus: parsed.config.elasticModulus,
      };

      const results = analyzeBeam(beamConfig);

      // Generate visualization parts based on requested diagram
      let beamParts: ReturnType<typeof generateFullBeamVisualization> = [];

      if (parsed.action === 'shear') {
        beamParts = [generateBeamGeometry(beamConfig, 0), generateSFDiagram(results, -(beamConfig.length * 0.4))];
      } else if (parsed.action === 'moment') {
        beamParts = [generateBeamGeometry(beamConfig, 0), generateBMDiagram(results, -(beamConfig.length * 0.4))];
      } else if (parsed.action === 'deflection') {
        beamParts = [generateBeamGeometry(beamConfig, 0), generateDeflectionDiagram(results, -(beamConfig.length * 0.4))];
      } else {
        // Full analysis: beam + all diagrams
        beamParts = generateFullBeamVisualization(beamConfig, results);
      }

      const summaryStr = results.summary.join('\n');
      const diagramLabel = parsed.action === 'shear' ? 'Shear Force Diagram'
        : parsed.action === 'moment' ? 'Bending Moment Diagram'
        : parsed.action === 'deflection' ? 'Deflection Curve'
        : 'Full Structural Analysis';

      return {
        message: `🏗️ **${diagramLabel}**\n\n${summaryStr}\n\n📐 Beam geometry and diagrams drawn on the graph.\n💡 Try "plot shear force diagram", "show bending moment", or "edit beam length to 12" to update.`,
        action: {
          type: 'beam_analysis',
          beamParts,
        },
      };
    }

    case 'limit': {
      const query = intent.query ?? input;
      const expr = intent.expression ?? extractExpression(query);
      if (!expr) {
        return {
          message: "I can compute limits! Try:\n• \"limit of sin(x)/x as x approaches 0\"\n• \"lim x→∞ of 1/x\"\n• \"limit of (x^2-1)/(x-1) as x→1\"\n• \"left limit of 1/x as x approaches 0\"",
          action: { type: 'none' },
        };
      }

      // Parse the approaching value
      let approaching: number | '+Infinity' | '-Infinity' = 0;
      let direction: 'left' | 'right' | 'both' = 'both';

      const infMatch = query.match(/(?:approaches?|→|->|tends\s+to)\s*([\+\-]?\s*(?:infinity|inf|∞))/i);
      if (infMatch) {
        const sign = infMatch[1].trim();
        approaching = /^-|^negative/i.test(sign) ? '-Infinity' : '+Infinity';
      } else {
        const valMatch = query.match(/(?:approaches?|→|->|tends\s+to|x\s*=)\s*(-?[\d.]+(?:\/[\d.]+)?(?:\s*\*?\s*pi)?)/i);
        if (valMatch) {
          let valStr = valMatch[1].trim();
          valStr = valStr.replace(/pi/gi, String(Math.PI)).replace(/\s+/g, '');
          try { approaching = math.evaluate(valStr) as number; } catch { approaching = parseFloat(valStr) || 0; }
        }
      }

      if (/\b(left|from\s+the\s+left|from\s+below)\b/i.test(query)) direction = 'left';
      if (/\b(right|from\s+the\s+right|from\s+above)\b/i.test(query)) direction = 'right';

      const limitResult = computeLimit(expr, approaching, direction);
      const formatted = formatLimitResult(limitResult);
      return {
        message: `🔢 ${formatted}\n\n💡 Try "plot ${expr}" to see the function's behavior near that point.`,
        action: { type: 'plot', expression: expr, system: 'cartesian' },
      };
    }

    case 'higher_derivative': {
      const query = intent.query ?? input;
      const expr = intent.expression ?? extractExpression(query);
      if (!expr) {
        return {
          message: "I can compute higher-order derivatives! Try:\n• \"second derivative of x^4 + 3x^2\"\n• \"third derivative of sin(x)\"\n• \"find f''(x) for x^5 - 2x^3\"",
          action: { type: 'none' },
        };
      }

      // Determine order
      let order = 2;
      if (/\bsecond|2nd\b/i.test(query)) order = 2;
      else if (/\bthird|3rd\b/i.test(query)) order = 3;
      else if (/\bfourth|4th\b/i.test(query)) order = 4;
      else if (/\bfifth|5th\b/i.test(query)) order = 5;
      else {
        const numMatch = query.match(/(\d+)(?:st|nd|rd|th)/i);
        if (numMatch) order = parseInt(numMatch[1]);
      }

      // Check if evaluate at a point
      let evalAt: number | undefined;
      const atMatch = query.match(/at\s+(?:x\s*=\s*)?(-?[\d.]+)/i);
      if (atMatch) evalAt = parseFloat(atMatch[1]);

      const result = computeDerivative(expr, 'x', order, evalAt);
      const formatted = formatDerivativeResult(result);
      return {
        message: `📐 ${formatted}\n\n💡 Try "plot ${expr}" and "plot ${result.simplified}" to compare the original and its derivative.`,
        action: { type: 'plot', expression: result.simplified !== 'N/A' ? result.simplified : expr, system: 'cartesian' },
      };
    }

    case 'partial_derivative': {
      const query = intent.query ?? input;
      const expr = intent.expression ?? extractExpression(query);
      if (!expr) {
        return {
          message: "I can compute partial derivatives! Try:\n• \"partial derivative of x^2*y + y^3 with respect to x\"\n• \"∂/∂y of sin(x*y)\"\n• \"partial of x^2 + x*y + y^2 with respect to y\"",
          action: { type: 'none' },
        };
      }

      // Determine variable
      let withRespect = 'x';
      const wrMatch = query.match(/(?:with\s+respect\s+to|w\.?r\.?t\.?|∂\/∂)([a-z])/i);
      if (wrMatch) withRespect = wrMatch[1].toLowerCase();

      const variables = ['x', 'y', 'z'].filter(v => expr.includes(v));
      const result = computePartialDerivative(expr, withRespect, variables.length > 0 ? variables : ['x', 'y']);
      const formatted = formatDerivativeResult(result);
      return {
        message: `📐 ${formatted}`,
        action: { type: 'none' },
      };
    }

    case 'definite_integral': {
      const query = intent.query ?? input;
      const expr = intent.expression ?? extractExpression(query);
      if (!expr) {
        return {
          message: "I can compute definite integrals with step-by-step explanations! Try:\n• \"integrate x^2 from 0 to 3\"\n• \"definite integral of sin(x) from 0 to pi\"\n• \"∫ cos(x) dx from 0 to pi/2\"",
          action: { type: 'none' },
        };
      }

      // Parse bounds
      const boundsMatch = query.match(/from\s+(-?[\d.]+(?:\*?pi)?)\s+to\s+(-?[\d.]+(?:\*?pi)?)/i);
      let lower = 0;
      let upper = 1;
      if (boundsMatch) {
        try {
          lower = math.evaluate(boundsMatch[1].replace(/pi/gi, String(Math.PI))) as number;
          upper = math.evaluate(boundsMatch[2].replace(/pi/gi, String(Math.PI))) as number;
        } catch {
          lower = parseFloat(boundsMatch[1]) || 0;
          upper = parseFloat(boundsMatch[2]) || 1;
        }
      }

      const result = computeIntegral(expr, 'x', lower, upper);
      const formatted = formatIntegralResult(result);
      return {
        message: `∫ ${formatted}\n\n💡 Try "plot ${expr}" to see the area under the curve.`,
        action: { type: 'plot', expression: expr, system: 'cartesian' },
      };
    }

    case 'differentiate': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I can find derivatives for you! Try:\n• \"differentiate x^3 + 2x\"\n• \"derivative of sin(x)\"\n• \"find d/dx of cos(x) and plot it\"\n\nFor higher-order derivatives: \"second derivative of x^4\"",
          action: { type: 'none' },
        };
      }
      const derivResult = computeDerivative(expr, 'x', 1);
      if (derivResult.simplified === 'N/A') {
        return {
          message: `I couldn't differentiate \`${expr}\`. Make sure it's a valid function of x.\n\n**Did you mean:**\n• "differentiate x^3"\n• "derivative of sin(x)"\n• "d/dx of cos(2x)"`,
          action: { type: 'none' },
        };
      }
      const formatted = formatDerivativeResult(derivResult);
      // Auto-plot the derivative result
      return {
        message: `📐 ${formatted}\n\n📈 **Plotting:** f'(x) = \`${derivResult.simplified}\``,
        action: { type: 'plot', expression: derivResult.simplified, system: 'cartesian' },
      };
    }

    case 'integrate': {
      const expr = intent.expression;
      if (!expr) {
        return {
          message: "I can help with integrals! Try:\n• \"integrate x^2\" (indefinite)\n• \"integrate sin(x) from 0 to pi\" (definite)\n• \"calculate the integral of cos(x) and plot it\"\n\nI'll provide step-by-step solutions and numerical results.",
          action: { type: 'none' },
        };
      }

      // Check if there are bounds in the query
      const query = intent.query ?? input;
      const boundsMatch = query.match(/from\s+(-?[\d.]+(?:\*?pi)?)\s+to\s+(-?[\d.]+(?:\*?pi)?)/i);
      let lower: number | undefined;
      let upper: number | undefined;
      if (boundsMatch) {
        try {
          lower = math.evaluate(boundsMatch[1].replace(/pi/gi, String(Math.PI))) as number;
          upper = math.evaluate(boundsMatch[2].replace(/pi/gi, String(Math.PI))) as number;
        } catch {
          lower = parseFloat(boundsMatch[1]) || undefined;
          upper = parseFloat(boundsMatch[2]) || undefined;
        }
      }

      const integralResult = computeIntegral(expr, 'x', lower, upper);
      const integralFormatted = formatIntegralResult(integralResult);

      // For indefinite integrals, plot the antiderivative if we got one
      let plotExpr = expr;
      if (integralResult.type === 'indefinite' && !integralResult.symbolicResult.startsWith('∫')) {
        plotExpr = integralResult.symbolicResult.replace(' + C', '');
      }

      return {
        message: `∫ ${integralFormatted}\n\n📈 **Plotting:** \`${plotExpr}\``,
        action: { type: 'plot', expression: plotExpr, system: 'cartesian' },
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
        const roots = findRoots(expr, -10, 10);
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
    default: {
      // Try to provide intelligent suggestions based on what the user typed
      const suggestions: string[] = [];
      if (/\b(sin|cos|tan|log|sqrt|exp)\b/i.test(input)) {
        suggestions.push(`• Did you mean: **"plot ${extractExpression(input) ?? 'sin(x)'}"** or **"differentiate ${extractExpression(input) ?? 'sin(x)'}"**?`);
      }
      if (/\bx\s*\^/.test(input) || /\bx\s*[+\-*/]/.test(input)) {
        suggestions.push(`• Did you mean: **"plot ${extractExpression(input) ?? 'x^2'}"** or **"integrate ${extractExpression(input) ?? 'x^2'}"**?`);
      }
      if (/\b(limit|lim)\b/i.test(input)) {
        suggestions.push(`• For limits, try: **"limit of sin(x)/x as x approaches 0"**`);
      }
      if (/\b(deriv|diff)\b/i.test(input)) {
        suggestions.push(`• For derivatives, try: **"derivative of sin(x)"** or **"second derivative of x^4"**`);
      }
      if (/\b(integr|antideriv)\b/i.test(input)) {
        suggestions.push(`• For integrals, try: **"integrate x^2 from 0 to 3"** or **"integral of cos(x)"**`);
      }

      const suggestionBlock = suggestions.length > 0
        ? `\n\n**Maybe you meant:**\n${suggestions.join('\n')}`
        : '';

      return {
        message: `I couldn't quite understand that.${suggestionBlock}\n\n**I can help with:**\n• **Limits** — "limit of sin(x)/x as x→0"\n• **Derivatives** — "differentiate x^3" or "second derivative of x^4"\n• **Integrals** — "integrate sin(x) from 0 to pi"\n• **Plotting** — "plot x^2" or "plot derivative of cos(x)"\n• **Analysis** — "analyze x^3 - 3x + 2"\n\nType **help** for full command reference.`,
        action: { type: 'none' },
      };
    }
  }
}