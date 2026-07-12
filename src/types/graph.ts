export type CoordinateSystem = 'cartesian' | 'polar' | 'relative' | 'absolute';

export interface Viewport {
  centerX: number;
  centerY: number;
  scale: number;
  width: number;
  height: number;
}

export interface FunctionPlot {
  id: string;
  expression: string;
  color: string;
  coordinateSystem: CoordinateSystem;
  visible: boolean;
  lineWidth: number;
}

export interface GraphConfig {
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  showMinorGrid: boolean;
  majorGridStep: number;
  minorGridStep: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface PolarPoint {
  r: number;
  theta: number;
}

export const DEFAULT_COLORS = [
  '#4A90D9',
  '#00C9A7',
  '#E0556A',
  '#F5A623',
  '#9B59B6',
  '#1ABC9C',
  '#E74C3C',
  '#3498DB',
];

export const DEFAULT_VIEWPORT: Viewport = {
  centerX: 0,
  centerY: 0,
  scale: 50,
  width: 800,
  height: 600,
};

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  showGrid: true,
  showAxes: true,
  showLabels: true,
  showMinorGrid: true,
  majorGridStep: 1,
  minorGridStep: 0.2,
};

// ── Technical Drawing Types ──────────────────────────────────────

export type DrawingCommandType = 'line' | 'circle' | 'arc' | 'rectangle' | 'polygon' | 'point';

export interface DrawingCommand {
  type: DrawingCommandType;
  system: 'absolute' | 'relative' | 'polar';
  params: Record<string, number>;
  label?: string;
}

export interface DrawingPlan {
  name: string;
  description: string;
  commands: DrawingCommand[];
}

/** Resolved drawing points ready for rendering */
export interface DrawingRenderData {
  points: Point2D[][]; // each array is a continuous path
  circles: Array<{ center: Point2D; radius: number }>;
  labels: Array<{ position: Point2D; text: string }>;
}