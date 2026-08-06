/**
 * mechanical-parts.ts — Parametric 2D mechanical part generators for Andrómeda.
 *
 * Each generator produces an array of Point2D paths that can be rendered
 * on the existing Cartesian graph canvas as polylines.
 */

import type { Point2D } from '../types/graph';

// ── Types ──────────────────────────────────────────────────────────

export interface MechanicalPart {
  name: string;
  label: string;
  paths: Point2D[][];  // multiple polyline paths
  centerX: number;
  centerY: number;
}

export interface GearParams {
  teeth: number;
  pitchRadius: number;
  centerX?: number;
  centerY?: number;
  pressureAngle?: number; // degrees, default 20
}

export interface ShaftParams {
  length: number;
  diameter: number;
  centerX?: number;
  centerY?: number;
}

export interface PulleyParams {
  radius: number;
  grooveDepth?: number;
  centerX?: number;
  centerY?: number;
}

export interface BearingParams {
  innerRadius: number;
  outerRadius: number;
  centerX?: number;
  centerY?: number;
}

export interface SpringParams {
  length: number;
  coils: number;
  amplitude?: number;
  centerX?: number;
  centerY?: number;
}

export interface AssemblyParams {
  parts: MechanicalPart[];
}

// ── Gear Generator ─────────────────────────────────────────────────

/**
 * Generate a 2D involute-style gear profile.
 * Produces the outer tooth profile and a hub circle.
 */
export function generateGear(params: GearParams): MechanicalPart {
  const { teeth, pitchRadius, centerX = 0, centerY = 0, pressureAngle = 20 } = params;
  const paths: Point2D[][] = [];

  const pa = (pressureAngle * Math.PI) / 180;
  const addendum = pitchRadius / teeth;
  const dedendum = 1.25 * addendum;
  const outerRadius = pitchRadius + addendum;
  const rootRadius = pitchRadius - dedendum;
  const baseRadius = pitchRadius * Math.cos(pa);

  // Hub circle (inner)
  const hubRadius = rootRadius * 0.4;
  paths.push(generateCirclePath(centerX, centerY, hubRadius, 60));

  // Root circle
  paths.push(generateCirclePath(centerX, centerY, rootRadius, 120));

  // Tooth profiles
  const toothPath: Point2D[] = [];
  const angularPitch = (2 * Math.PI) / teeth;
  const toothThickness = angularPitch / 2;

  for (let i = 0; i < teeth; i++) {
    const baseAngle = i * angularPitch;

    // Left flank (simplified involute approximation)
    const leftStart = baseAngle - toothThickness / 2;
    const leftEnd = baseAngle - toothThickness / 3;

    // Root to base
    toothPath.push({
      x: centerX + rootRadius * Math.cos(leftStart),
      y: centerY + rootRadius * Math.sin(leftStart),
    });

    // Base to tip (left flank)
    for (let t = 0; t <= 1; t += 0.25) {
      const r = baseRadius + t * (outerRadius - baseRadius);
      const angle = leftStart + t * (leftEnd - leftStart);
      toothPath.push({
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      });
    }

    // Tip arc
    const tipLeft = leftEnd;
    const tipRight = baseAngle + toothThickness / 3;
    const tipSteps = 3;
    for (let t = 0; t <= tipSteps; t++) {
      const angle = tipLeft + (t / tipSteps) * (tipRight - tipLeft);
      toothPath.push({
        x: centerX + outerRadius * Math.cos(angle),
        y: centerY + outerRadius * Math.sin(angle),
      });
    }

    // Tip to base (right flank)
    const rightEnd = baseAngle + toothThickness / 2;
    for (let t = 1; t >= 0; t -= 0.25) {
      const r = baseRadius + t * (outerRadius - baseRadius);
      const angle = tipRight + (1 - t) * (rightEnd - tipRight);
      toothPath.push({
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      });
    }

    // Back to root
    toothPath.push({
      x: centerX + rootRadius * Math.cos(rightEnd),
      y: centerY + rootRadius * Math.sin(rightEnd),
    });
  }

  // Close the tooth path
  if (toothPath.length > 0) {
    toothPath.push(toothPath[0]);
  }
  paths.push(toothPath);

  return {
    name: 'gear',
    label: `Gear (${teeth} teeth, r=${pitchRadius})`,
    paths,
    centerX,
    centerY,
  };
}

// ── Shaft Generator ────────────────────────────────────────────────

/**
 * Generate a 2D shaft cross-section (rectangular side view with rounded ends).
 */
export function generateShaft(params: ShaftParams): MechanicalPart {
  const { length, diameter, centerX = 0, centerY = 0 } = params;
  const paths: Point2D[][] = [];
  const r = diameter / 2;
  const halfL = length / 2;

  // Outer rectangle with rounded ends
  const outline: Point2D[] = [];

  // Top edge
  outline.push({ x: centerX - halfL, y: centerY + r });
  outline.push({ x: centerX + halfL, y: centerY + r });

  // Right semicircle
  for (let a = Math.PI / 2; a >= -Math.PI / 2; a -= Math.PI / 10) {
    outline.push({
      x: centerX + halfL + r * Math.cos(a) * 0.3,
      y: centerY + r * Math.sin(a),
    });
  }

  // Bottom edge
  outline.push({ x: centerX + halfL, y: centerY - r });
  outline.push({ x: centerX - halfL, y: centerY - r });

  // Left semicircle
  for (let a = -Math.PI / 2; a <= Math.PI / 2; a += Math.PI / 10) {
    outline.push({
      x: centerX - halfL + r * Math.cos(a + Math.PI) * 0.3,
      y: centerY + r * Math.sin(a),
    });
  }

  outline.push(outline[0]); // close
  paths.push(outline);

  // Center line (dashed representation as a single line)
  paths.push([
    { x: centerX - halfL - r * 0.5, y: centerY },
    { x: centerX + halfL + r * 0.5, y: centerY },
  ]);

  // Keyway slot (small rectangle on top)
  const keyWidth = diameter * 0.3;
  const keyDepth = diameter * 0.15;
  paths.push([
    { x: centerX - keyWidth / 2, y: centerY + r },
    { x: centerX - keyWidth / 2, y: centerY + r + keyDepth },
    { x: centerX + keyWidth / 2, y: centerY + r + keyDepth },
    { x: centerX + keyWidth / 2, y: centerY + r },
  ]);

  return {
    name: 'shaft',
    label: `Shaft (L=${length}, D=${diameter})`,
    paths,
    centerX,
    centerY,
  };
}

// ── Pulley Generator ───────────────────────────────────────────────

/**
 * Generate a 2D pulley cross-section (side view with groove).
 */
export function generatePulley(params: PulleyParams): MechanicalPart {
  const { radius, grooveDepth = radius * 0.15, centerX = 0, centerY = 0 } = params;
  const paths: Point2D[][] = [];

  // Outer rim
  paths.push(generateCirclePath(centerX, centerY, radius, 80));

  // Inner groove circle
  paths.push(generateCirclePath(centerX, centerY, radius - grooveDepth, 60));

  // Hub
  const hubRadius = radius * 0.25;
  paths.push(generateCirclePath(centerX, centerY, hubRadius, 40));

  // Bore hole
  const boreRadius = hubRadius * 0.4;
  paths.push(generateCirclePath(centerX, centerY, boreRadius, 30));

  // Spokes (4 lines from hub to inner groove)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    paths.push([
      { x: centerX + hubRadius * Math.cos(angle), y: centerY + hubRadius * Math.sin(angle) },
      { x: centerX + (radius - grooveDepth) * Math.cos(angle), y: centerY + (radius - grooveDepth) * Math.sin(angle) },
    ]);
  }

  return {
    name: 'pulley',
    label: `Pulley (r=${radius})`,
    paths,
    centerX,
    centerY,
  };
}

// ── Bearing Generator ──────────────────────────────────────────────

/**
 * Generate a 2D ball bearing cross-section.
 */
export function generateBearing(params: BearingParams): MechanicalPart {
  const { innerRadius, outerRadius, centerX = 0, centerY = 0 } = params;
  const paths: Point2D[][] = [];

  // Outer race
  paths.push(generateCirclePath(centerX, centerY, outerRadius, 80));

  // Inner race
  paths.push(generateCirclePath(centerX, centerY, innerRadius, 60));

  // Ball positions (simplified as small circles between races)
  const ballRadius = (outerRadius - innerRadius) * 0.3;
  const midRadius = (outerRadius + innerRadius) / 2;
  const numBalls = Math.max(6, Math.round(midRadius * 2));

  for (let i = 0; i < numBalls; i++) {
    const angle = (i / numBalls) * 2 * Math.PI;
    const bx = centerX + midRadius * Math.cos(angle);
    const by = centerY + midRadius * Math.sin(angle);
    paths.push(generateCirclePath(bx, by, ballRadius, 12));
  }

  return {
    name: 'bearing',
    label: `Bearing (ID=${innerRadius * 2}, OD=${outerRadius * 2})`,
    paths,
    centerX,
    centerY,
  };
}

// ── Spring Generator ───────────────────────────────────────────────

/**
 * Generate a 2D coil spring profile (side view).
 */
export function generateSpring(params: SpringParams): MechanicalPart {
  const { length, coils, amplitude = length * 0.1, centerX = 0, centerY = 0 } = params;
  const paths: Point2D[][] = [];

  const halfL = length / 2;
  const coilPath: Point2D[] = [];
  const totalPoints = coils * 20;

  // Start hook
  coilPath.push({ x: centerX - halfL - amplitude * 0.5, y: centerY });
  coilPath.push({ x: centerX - halfL, y: centerY });

  // Coil body
  for (let i = 0; i <= totalPoints; i++) {
    const t = i / totalPoints;
    const x = centerX - halfL + t * length;
    const y = centerY + amplitude * Math.sin(t * coils * 2 * Math.PI);
    coilPath.push({ x, y });
  }

  // End hook
  coilPath.push({ x: centerX + halfL, y: centerY });
  coilPath.push({ x: centerX + halfL + amplitude * 0.5, y: centerY });

  paths.push(coilPath);

  // Guide lines (top and bottom bounds)
  paths.push([
    { x: centerX - halfL, y: centerY + amplitude * 1.2 },
    { x: centerX + halfL, y: centerY + amplitude * 1.2 },
  ]);
  paths.push([
    { x: centerX - halfL, y: centerY - amplitude * 1.2 },
    { x: centerX + halfL, y: centerY - amplitude * 1.2 },
  ]);

  return {
    name: 'spring',
    label: `Spring (L=${length}, ${coils} coils)`,
    paths,
    centerX,
    centerY,
  };
}

// ── Cam Generator ──────────────────────────────────────────────────

export interface CamParams {
  baseRadius: number;
  lift: number;
  centerX?: number;
  centerY?: number;
}

/**
 * Generate a 2D cam profile (eccentric disc).
 */
export function generateCam(params: CamParams): MechanicalPart {
  const { baseRadius, lift, centerX = 0, centerY = 0 } = params;
  const paths: Point2D[][] = [];

  // Cam profile (harmonic rise/fall)
  const camPath: Point2D[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    // Simple harmonic cam: rise from 0 to pi, fall from pi to 2pi
    const r = baseRadius + lift * (0.5 * (1 - Math.cos(angle)));
    camPath.push({
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    });
  }
  paths.push(camPath);

  // Hub
  const hubRadius = baseRadius * 0.3;
  paths.push(generateCirclePath(centerX, centerY, hubRadius, 30));

  // Keyway
  paths.push([
    { x: centerX - hubRadius * 0.3, y: centerY },
    { x: centerX - hubRadius * 0.3, y: centerY + hubRadius },
    { x: centerX + hubRadius * 0.3, y: centerY + hubRadius },
    { x: centerX + hubRadius * 0.3, y: centerY },
  ]);

  return {
    name: 'cam',
    label: `Cam (base=${baseRadius}, lift=${lift})`,
    paths,
    centerX,
    centerY,
  };
}

// ── Assembly Generator ─────────────────────────────────────────────

/**
 * Combine multiple parts into a single assembly for rendering.
 */
export function createAssembly(name: string, parts: MechanicalPart[]): MechanicalPart {
  const allPaths: Point2D[][] = [];
  for (const part of parts) {
    allPaths.push(...part.paths);
  }

  // Compute bounding center
  let sumX = 0, sumY = 0;
  for (const part of parts) {
    sumX += part.centerX;
    sumY += part.centerY;
  }

  return {
    name: 'assembly',
    label: name,
    paths: allPaths,
    centerX: parts.length > 0 ? sumX / parts.length : 0,
    centerY: parts.length > 0 ? sumY / parts.length : 0,
  };
}

// ── NL Parsing ─────────────────────────────────────────────────────

/**
 * Parse a natural language drawing request into a MechanicalPart.
 * Returns null if the request cannot be understood.
 */
export function parseMechanicalQuery(input: string): MechanicalPart | null {
  const lower = input.toLowerCase();

  // ── Gear ──
  if (/\bgear\b/i.test(lower)) {
    let teeth = 20;
    let radius = 5;

    const teethMatch = lower.match(/(\d+)\s*teeth/);
    if (teethMatch) teeth = parseInt(teethMatch[1]);
    const teethMatch2 = lower.match(/teeth\s*[:=]?\s*(\d+)/);
    if (teethMatch2) teeth = parseInt(teethMatch2[1]);

    const radiusMatch = lower.match(/radius\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (radiusMatch) radius = parseFloat(radiusMatch[1]);
    const rMatch = lower.match(/r\s*=\s*(\d+\.?\d*)/);
    if (rMatch) radius = parseFloat(rMatch[1]);

    return generateGear({ teeth, pitchRadius: radius });
  }

  // ── Shaft ──
  if (/\bshaft\b/i.test(lower)) {
    let length = 10;
    let diameter = 2;

    const lenMatch = lower.match(/length\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (lenMatch) length = parseFloat(lenMatch[1]);
    const lMatch = lower.match(/l\s*=\s*(\d+\.?\d*)/i);
    if (lMatch) length = parseFloat(lMatch[1]);

    const diaMatch = lower.match(/diameter\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (diaMatch) diameter = parseFloat(diaMatch[1]);
    const dMatch = lower.match(/d\s*=\s*(\d+\.?\d*)/i);
    if (dMatch) diameter = parseFloat(dMatch[1]);

    return generateShaft({ length, diameter });
  }

  // ── Pulley ──
  if (/\bpulley\b/i.test(lower)) {
    let radius = 4;

    const radiusMatch = lower.match(/radius\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (radiusMatch) radius = parseFloat(radiusMatch[1]);
    const rMatch = lower.match(/r\s*=\s*(\d+\.?\d*)/);
    if (rMatch) radius = parseFloat(rMatch[1]);

    return generatePulley({ radius });
  }

  // ── Bearing ──
  if (/\bbearing\b/i.test(lower)) {
    let innerRadius = 2;
    let outerRadius = 5;

    const innerMatch = lower.match(/inner\s*(?:radius|r|diameter|d)\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (innerMatch) innerRadius = parseFloat(innerMatch[1]);
    const outerMatch = lower.match(/outer\s*(?:radius|r|diameter|d)\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (outerMatch) outerRadius = parseFloat(outerMatch[1]);

    // Handle "ID" and "OD" notation
    const idMatch = lower.match(/\bid\s*[:=]\s*(\d+\.?\d*)/);
    if (idMatch) innerRadius = parseFloat(idMatch[1]) / 2;
    const odMatch = lower.match(/\bod\s*[:=]\s*(\d+\.?\d*)/);
    if (odMatch) outerRadius = parseFloat(odMatch[1]) / 2;

    return generateBearing({ innerRadius, outerRadius });
  }

  // ── Spring ──
  if (/\bspring\b/i.test(lower)) {
    let length = 8;
    let coils = 6;

    const lenMatch = lower.match(/length\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (lenMatch) length = parseFloat(lenMatch[1]);
    const coilMatch = lower.match(/(\d+)\s*coils?/);
    if (coilMatch) coils = parseInt(coilMatch[1]);

    return generateSpring({ length, coils });
  }

  // ── Cam ──
  if (/\bcam\b/i.test(lower)) {
    let baseRadius = 3;
    let lift = 1.5;

    const radiusMatch = lower.match(/(?:base\s*)?radius\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (radiusMatch) baseRadius = parseFloat(radiusMatch[1]);
    const liftMatch = lower.match(/lift\s*(?:of\s*|[:=]\s*)?(\d+\.?\d*)/);
    if (liftMatch) lift = parseFloat(liftMatch[1]);

    return generateCam({ baseRadius, lift });
  }

  return null;
}

// ── Utility ────────────────────────────────────────────────────────

function generateCirclePath(cx: number, cy: number, radius: number, segments: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Convert a MechanicalPart into FunctionPlot-compatible expressions.
 * Since the graph engine works with f(x) plots, we convert paths into
 * a set of parametric-style data points that can be rendered directly.
 */
export function getPartBounds(part: MechanicalPart): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const path of part.paths) {
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, maxX, minY, maxY };
}
