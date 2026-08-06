import type { CoordinateSystem, DrawingPlan } from './graph';
import type { MechanicalPart } from '../lib/mechanical-parts';
import type { AnimationConfig } from '../lib/animation-engine';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Optional action that the assistant performed */
  action?: ChatAction;
}

export interface ChatAction {
  type: 'calculate' | 'plot' | 'multi_plot' | 'viewport' | 'drawing' | 'draw' | 'mechanical_draw' | 'edit_part' | 'delete_part' | 'animate' | 'analyze' | 'intersect' | 'compare' | 'none';
  /** For calculate: the result string */
  result?: string;
  /** For plot: single expression */
  expression?: string;
  /** For multi_plot: multiple expressions as strings */
  expressions?: string[];
  /** For plot: the coordinate system */
  system?: CoordinateSystem;
  /** For viewport: center X */
  centerX?: number;
  /** For viewport: center Y */
  centerY?: number;
  /** For viewport: scale */
  scale?: number;
  /** For draw: the drawing plan */
  drawing?: DrawingPlan;
  /** For mechanical_draw: the generated part */
  mechanicalPart?: MechanicalPart;
  /** For edit_part: the param updates to apply */
  editUpdates?: Record<string, number>;
  /** For edit_part/delete_part: target part type */
  targetPartType?: string;
  /** For delete_part: whether to remove the whole part */
  deleteWholePart?: boolean;
  /** For delete_part: params to reset to defaults */
  resetParams?: string[];
  /** For animate: animation configuration */
  animationConfig?: AnimationConfig;
}

export interface ChatIntent {
  type: IntentType;
  /** Single expression */
  expression?: string;
  /** Multiple expressions (for comparison, intersection) */
  expressions?: string[];
  variable?: string;
  system?: CoordinateSystem;
  from?: number;
  to?: number;
  at?: number;
  query?: string;
  /** User wants step-by-step explanation */
  steps?: boolean;
  confidence: number;
}

export type IntentType =
  | 'calculate'
  | 'plot'
  | 'multi_plot'
  | 'analyze'
  | 'intersect'
  | 'compare'
  | 'explain'
  | 'differentiate'
  | 'higher_derivative'
  | 'partial_derivative'
  | 'integrate'
  | 'definite_integral'
  | 'limit'
  | 'solve'
  | 'convert'
  | 'domain'
  | 'range'
  | 'critical_points'
  | 'inflection'
  | 'asymptotes'
  | 'area'
  | 'volume'
  | 'rate_of_change'
  | 'trig_analyze'
  | 'log_analyze'
  | 'draw_shape'
  | 'edit_part'
  | 'delete_part'
  | 'animate'
  | 'help'
  | 'greeting'
  | 'general';

/** Result of a full function analysis */
export interface FunctionAnalysis {
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

/** Result of an intersection analysis */
export interface IntersectionResult {
  points: Array<{ x: number; y: number }>;
  f1: string;
  f2: string;
}

/** Result of trig function property analysis */
export interface TrigAnalysis {
  expression: string;
  amplitude: number | null;
  period: number | null;
  frequency: number | null;
  phaseShift: number | null;
  verticalShift: number | null;
  functionType: string;
}

/** Result of log function property analysis */
export interface LogAnalysis {
  expression: string;
  base: number | null;
  verticalAsymptote: number | null;
  horizontalShift: number | null;
  verticalShift: number | null;
  domain: string;
  range: string;
}