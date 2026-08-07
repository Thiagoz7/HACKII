/**
 * beam-analysis.ts — Structural mechanics engine for Andrómeda.
 *
 * Supports: simply supported, cantilever, and fixed beams under
 * point loads, distributed loads, and moments. Computes reactions,
 * shear force, bending moment, and deflection diagrams.
 */

// ── Types ──────────────────────────────────────────────────────────

export type SupportType = 'simply_supported' | 'cantilever' | 'fixed';

export interface PointLoad {
  type: 'point';
  magnitude: number; // positive = downward
  position: number;  // distance from left end
}

export interface DistributedLoad {
  type: 'distributed';
  magnitude: number; // load per unit length (positive = downward)
  start: number;
  end: number;
}

export interface MomentLoad {
  type: 'moment';
  magnitude: number; // positive = counterclockwise
  position: number;
}

export type Load = PointLoad | DistributedLoad | MomentLoad;

export interface BeamConfig {
  length: number;
  support: SupportType;
  loads: Load[];
  // Cross-section (optional, for stress/deflection)
  width?: number;       // m
  height?: number;      // m
  elasticModulus?: number; // Pa (default steel ~200e9)
  momentOfInertia?: number; // m^4 (auto-calculated if width/height given)
}

export interface BeamResults {
  config: BeamConfig;
  reactions: { leftVertical: number; rightVertical: number; fixedMoment: number };
  shearForce: Array<{ x: number; v: number }>;
  bendingMoment: Array<{ x: number; m: number }>;
  deflection: Array<{ x: number; d: number }>;
  maxShear: number;
  maxMoment: number;
  maxDeflection: number;
  summary: string[];
}

// ── Default Values ─────────────────────────────────────────────────

const DEFAULT_E = 200e9;  // Steel, Pa
const DEFAULT_STEPS = 200;

// ── Main Analysis ──────────────────────────────────────────────────

export function analyzeBeam(config: BeamConfig): BeamResults {
  const { length, support } = config;
  const E = config.elasticModulus ?? DEFAULT_E;
  const I = config.momentOfInertia ?? calculateI(config);
  const steps = DEFAULT_STEPS;
  const dx = length / steps;

  // Calculate reactions
  const reactions = calculateReactions(config);

  // Compute shear force and bending moment at each point
  const shearForce: Array<{ x: number; v: number }> = [];
  const bendingMoment: Array<{ x: number; m: number }> = [];
  const deflection: Array<{ x: number; d: number }> = [];

  let maxShear = 0;
  let maxMoment = 0;

  for (let i = 0; i <= steps; i++) {
    const x = i * dx;
    const v = computeShear(x, config, reactions);
    const m = computeMoment(x, config, reactions);

    shearForce.push({ x, v });
    bendingMoment.push({ x, m });

    if (Math.abs(v) > Math.abs(maxShear)) maxShear = v;
    if (Math.abs(m) > Math.abs(maxMoment)) maxMoment = m;
  }

  // Compute deflection using double integration (numerical)
  const deflData = computeDeflection(bendingMoment, dx, E, I, support, length);
  let maxDeflection = 0;
  for (const pt of deflData) {
    deflection.push(pt);
    if (Math.abs(pt.d) > Math.abs(maxDeflection)) maxDeflection = pt.d;
  }

  // Summary
  const summary = buildSummary(config, reactions, maxShear, maxMoment, maxDeflection);

  return { config, reactions, shearForce, bendingMoment, deflection, maxShear, maxMoment, maxDeflection, summary };
}

// ── Reactions ──────────────────────────────────────────────────────

function calculateReactions(config: BeamConfig): { leftVertical: number; rightVertical: number; fixedMoment: number } {
  const { length, support, loads } = config;

  // Total load and moment about left support
  let totalForce = 0;
  let totalMomentAboutLeft = 0;

  for (const load of loads) {
    if (load.type === 'point') {
      totalForce += load.magnitude;
      totalMomentAboutLeft += load.magnitude * load.position;
    } else if (load.type === 'distributed') {
      const w = load.magnitude;
      const len = load.end - load.start;
      const resultant = w * len;
      const centroid = load.start + len / 2;
      totalForce += resultant;
      totalMomentAboutLeft += resultant * centroid;
    } else if (load.type === 'moment') {
      totalMomentAboutLeft += load.magnitude;
    }
  }

  if (support === 'cantilever') {
    // Fixed at left: R_left = total downward force, M_fixed = total moment about left
    return { leftVertical: totalForce, rightVertical: 0, fixedMoment: totalMomentAboutLeft };
  }

  if (support === 'simply_supported' || support === 'fixed') {
    // Sum moments about left → R_right * L = totalMomentAboutLeft
    const rightVertical = totalMomentAboutLeft / length;
    const leftVertical = totalForce - rightVertical;
    return { leftVertical, rightVertical, fixedMoment: 0 };
  }

  return { leftVertical: 0, rightVertical: 0, fixedMoment: 0 };
}

// ── Shear Force ────────────────────────────────────────────────────

function computeShear(
  x: number,
  config: BeamConfig,
  reactions: { leftVertical: number; rightVertical: number; fixedMoment: number }
): number {
  let v = 0;

  // Reaction at left (upward → negative shear convention: V = +upward forces to left)
  if (config.support !== 'cantilever') {
    v += reactions.leftVertical; // upward reaction (positive V)
  } else {
    v += reactions.leftVertical; // cantilever: reaction at fixed end
  }

  // Applied loads to the left of x
  for (const load of config.loads) {
    if (load.type === 'point' && load.position <= x) {
      v -= load.magnitude; // downward load reduces shear
    } else if (load.type === 'distributed') {
      if (x >= load.end) {
        v -= load.magnitude * (load.end - load.start);
      } else if (x > load.start) {
        v -= load.magnitude * (x - load.start);
      }
    }
  }

  return v;
}

// ── Bending Moment ─────────────────────────────────────────────────

function computeMoment(
  x: number,
  config: BeamConfig,
  reactions: { leftVertical: number; rightVertical: number; fixedMoment: number }
): number {
  let m = 0;

  // Reaction moment contribution
  if (config.support === 'cantilever') {
    m -= reactions.fixedMoment; // fixed-end moment (resisting)
  }

  // Left reaction × distance
  m += reactions.leftVertical * x;

  // Applied loads
  for (const load of config.loads) {
    if (load.type === 'point' && load.position < x) {
      m -= load.magnitude * (x - load.position);
    } else if (load.type === 'distributed') {
      if (x >= load.end) {
        const len = load.end - load.start;
        const centroid = load.start + len / 2;
        m -= load.magnitude * len * (x - centroid);
      } else if (x > load.start) {
        const activeLen = x - load.start;
        const centroid = load.start + activeLen / 2;
        m -= load.magnitude * activeLen * (x - centroid);
      }
    } else if (load.type === 'moment' && load.position <= x) {
      m += load.magnitude;
    }
  }

  return m;
}

// ── Deflection (double integration of M/EI) ───────────────────────

function computeDeflection(
  momentData: Array<{ x: number; m: number }>,
  dx: number,
  E: number,
  I: number,
  support: SupportType,
  length: number
): Array<{ x: number; d: number }> {
  const n = momentData.length;
  const EI = E * I;

  // First integration: slope θ(x) = ∫ M(x)/(EI) dx + C1
  const slope: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    slope[i] = slope[i - 1] + (momentData[i - 1].m / EI) * dx;
  }

  // Second integration: deflection y(x) = ∫ θ(x) dx + C2
  const defl: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    defl[i] = defl[i - 1] + slope[i - 1] * dx;
  }

  // Apply boundary conditions to find C1, C2
  if (support === 'simply_supported' || support === 'fixed') {
    // y(0) = 0 and y(L) = 0
    const yL = defl[n - 1];
    // Adjust: subtract linear correction
    for (let i = 0; i < n; i++) {
      const x = momentData[i].x;
      defl[i] -= (yL / length) * x;
    }
  } else if (support === 'cantilever') {
    // y(0) = 0 and θ(0) = 0 → already satisfied by starting at 0
    // No correction needed
  }

  return momentData.map((pt, i) => ({ x: pt.x, d: defl[i] }));
}

// ── Moment of Inertia ──────────────────────────────────────────────

function calculateI(config: BeamConfig): number {
  const w = config.width ?? 0.1;  // default 100mm
  const h = config.height ?? 0.2; // default 200mm
  return (w * h * h * h) / 12; // rectangular section: bh³/12
}

// ── Summary Builder ────────────────────────────────────────────────

function buildSummary(
  config: BeamConfig,
  reactions: { leftVertical: number; rightVertical: number; fixedMoment: number },
  maxShear: number,
  maxMoment: number,
  maxDeflection: number
): string[] {
  const lines: string[] = [];
  lines.push(`**Beam Analysis Summary**`);
  lines.push(`Length: ${config.length} m | Support: ${config.support.replace('_', ' ')}`);
  lines.push(`Loads: ${config.loads.length} applied`);
  lines.push('');
  lines.push(`**Reactions:**`);
  lines.push(`  R_left = ${reactions.leftVertical.toFixed(2)} N (upward)`);
  if (config.support !== 'cantilever') {
    lines.push(`  R_right = ${reactions.rightVertical.toFixed(2)} N (upward)`);
  }
  if (reactions.fixedMoment !== 0) {
    lines.push(`  M_fixed = ${reactions.fixedMoment.toFixed(2)} N·m`);
  }
  lines.push('');
  lines.push(`**Maximum Values:**`);
  lines.push(`  V_max = ${maxShear.toFixed(2)} N`);
  lines.push(`  M_max = ${maxMoment.toFixed(2)} N·m`);
  lines.push(`  δ_max = ${(maxDeflection * 1000).toFixed(4)} mm`);
  return lines;
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedBeamQuery {
  action: 'analyze' | 'shear' | 'moment' | 'deflection' | 'torsion';
  config: Partial<BeamConfig>;
}

export function parseBeamQuery(input: string): ParsedBeamQuery | null {
  const lower = input.toLowerCase();

  // Must reference beam/structural terms
  if (!/\b(beam|shear|bending|moment|deflection|torsion|cantilever|simply\s*supported|fixed\s*beam|structural)\b/i.test(lower)) {
    return null;
  }

  // Determine action
  let action: ParsedBeamQuery['action'] = 'analyze';
  if (/\bshear\b/.test(lower)) action = 'shear';
  if (/\b(bending|moment)\b/.test(lower)) action = 'moment';
  if (/\bdeflection\b/.test(lower)) action = 'deflection';
  if (/\btorsion\b/.test(lower)) action = 'torsion';

  // Parse beam config
  const config: Partial<BeamConfig> = {};

  // Length
  const lenMatch = lower.match(/length\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)\s*(?:m|meters?)?/);
  if (lenMatch) config.length = parseFloat(lenMatch[1]);
  if (!config.length) {
    const numMatch = lower.match(/(\d+\.?\d*)\s*(?:m\b|meter)/);
    if (numMatch) config.length = parseFloat(numMatch[1]);
  }
  if (!config.length) config.length = 10; // default

  // Support type
  if (/\bcantilever\b/.test(lower)) config.support = 'cantilever';
  else if (/\bsimply\s*supported\b/.test(lower)) config.support = 'simply_supported';
  else if (/\bfixed\b/.test(lower) && /\bbeam\b/.test(lower)) config.support = 'fixed';
  else config.support = 'simply_supported';

  // Loads
  config.loads = [];

  // Point load
  const pointMatch = lower.match(/point\s+load\s+(?:of\s+)?(\d+\.?\d*)\s*(?:n|kn|newton)?\s*(?:at\s+)?(\d+\.?\d*)?/);
  if (pointMatch) {
    let mag = parseFloat(pointMatch[1]);
    if (/kn/.test(lower)) mag *= 1000;
    const pos = pointMatch[2] ? parseFloat(pointMatch[2]) : (config.length ?? 10) / 2;
    config.loads.push({ type: 'point', magnitude: mag, position: pos });
  }

  // Distributed/uniform load
  const distMatch = lower.match(/(?:uniform|distributed)\s+load\s+(?:of\s+)?(\d+\.?\d*)\s*(?:n\/m|kn\/m)?/);
  if (distMatch) {
    let mag = parseFloat(distMatch[1]);
    if (/kn\/m/.test(lower)) mag *= 1000;
    config.loads.push({ type: 'distributed', magnitude: mag, start: 0, end: config.length ?? 10 });
  }

  // Generic load (if no specific pattern matched)
  if (config.loads.length === 0) {
    const genericLoad = lower.match(/(\d+\.?\d*)\s*(?:n|kn|newton)/);
    if (genericLoad) {
      let mag = parseFloat(genericLoad[1]);
      if (/kn/.test(lower)) mag *= 1000;
      config.loads.push({ type: 'point', magnitude: mag, position: (config.length ?? 10) / 2 });
    }
  }

  // If still no loads, add a default uniform load
  if (config.loads.length === 0) {
    config.loads.push({ type: 'distributed', magnitude: 1000, start: 0, end: config.length ?? 10 });
  }

  return { action, config };
}

// ── Torsion Analysis ───────────────────────────────────────────────

export interface TorsionResult {
  torque: number;
  shaftDiameter: number;
  shaftLength: number;
  shearStress: number;
  angleOfTwist: number; // radians
  summary: string[];
}

export function analyzeTorsion(torque: number, diameter: number, length: number, G = 80e9): TorsionResult {
  const r = diameter / 2;
  const J = (Math.PI * Math.pow(r, 4)) / 2; // polar moment of inertia
  const shearStress = (torque * r) / J;
  const angleOfTwist = (torque * length) / (G * J);

  const summary = [
    `**Torsion Analysis**`,
    `Torque: ${torque.toFixed(2)} N·m`,
    `Shaft: D=${diameter * 1000} mm, L=${length} m`,
    '',
    `**Results:**`,
    `  Max Shear Stress: ${(shearStress / 1e6).toFixed(2)} MPa`,
    `  Angle of Twist: ${(angleOfTwist * 180 / Math.PI).toFixed(4)}°`,
    `  Polar Moment J: ${J.toExponential(4)} m⁴`,
  ];

  return { torque, shaftDiameter: diameter, shaftLength: length, shearStress, angleOfTwist, summary };
}
