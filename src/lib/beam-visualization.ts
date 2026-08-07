/**
 * beam-visualization.ts — Generates 2D visual paths for beam geometry and diagrams.
 *
 * Produces MechanicalPart-compatible path arrays that render directly on the
 * Cartesian graph canvas alongside other plots and parts.
 */

import type { Point2D } from '../types/graph';
import type { MechanicalPart } from './mechanical-parts';
import type { BeamConfig, BeamResults, Load } from './beam-analysis';

// ── Beam Geometry Drawing ──────────────────────────────────────────

/**
 * Generate a 2D visualization of the beam geometry:
 * - Beam body (rectangle)
 * - Support symbols (triangle for pin, triangle+rollers for roller, wall for fixed)
 * - Load arrows (point loads, distributed loads, moments)
 * - Dimension labels as tick marks
 */
export function generateBeamGeometry(config: BeamConfig, yOffset = 0): MechanicalPart {
  const paths: Point2D[][] = [];
  const L = config.length;
  const beamHeight = L * 0.04;  // proportional height
  const y0 = yOffset;

  // ── Beam body ──
  paths.push([
    { x: 0, y: y0 + beamHeight / 2 },
    { x: L, y: y0 + beamHeight / 2 },
    { x: L, y: y0 - beamHeight / 2 },
    { x: 0, y: y0 - beamHeight / 2 },
    { x: 0, y: y0 + beamHeight / 2 },
  ]);

  // ── Supports ──
  const supportSize = L * 0.05;

  if (config.support === 'simply_supported') {
    // Left: pin support (triangle)
    paths.push(generatePinSupport(0, y0 - beamHeight / 2, supportSize));
    // Right: roller support (triangle with circle)
    paths.push(generateRollerSupport(L, y0 - beamHeight / 2, supportSize));
  } else if (config.support === 'cantilever') {
    // Left: fixed support (hatched wall)
    paths.push(...generateFixedSupport(0, y0, beamHeight, supportSize));
  } else if (config.support === 'fixed') {
    // Both ends fixed
    paths.push(...generateFixedSupport(0, y0, beamHeight, supportSize));
    paths.push(...generateFixedSupport(L, y0, beamHeight, supportSize));
  }

  // ── Loads ──
  for (const load of config.loads) {
    paths.push(...generateLoadSymbol(load, L, y0 + beamHeight / 2, supportSize));
  }

  // ── Dimension line ──
  const dimY = y0 - beamHeight / 2 - supportSize * 2.5;
  paths.push([
    { x: 0, y: dimY },
    { x: L, y: dimY },
  ]);
  // End ticks
  paths.push([
    { x: 0, y: dimY - supportSize * 0.3 },
    { x: 0, y: dimY + supportSize * 0.3 },
  ]);
  paths.push([
    { x: L, y: dimY - supportSize * 0.3 },
    { x: L, y: dimY + supportSize * 0.3 },
  ]);

  return {
    id: `beam-geom-${Math.random().toString(36).slice(2, 8)}`,
    name: 'beam',
    partType: 'assembly',
    label: `Beam (L=${L}m, ${config.support.replace('_', ' ')})`,
    paths,
    centerX: L / 2,
    centerY: y0,
    params: { length: L },
  };
}

// ── Diagram Generators ─────────────────────────────────────────────

/**
 * Generate a Shear Force Diagram as a filled-area path.
 */
export function generateSFDiagram(results: BeamResults, yOffset = -3, scale = 1): MechanicalPart {
  const L = results.config.length;
  const maxV = Math.max(Math.abs(results.maxShear), 1);
  const displayHeight = L * 0.3 * scale;
  const factor = displayHeight / maxV;

  const paths: Point2D[][] = [];

  // Baseline (zero line)
  paths.push([
    { x: 0, y: yOffset },
    { x: L, y: yOffset },
  ]);

  // SFD curve (area from baseline)
  const sfdPath: Point2D[] = [{ x: 0, y: yOffset }];
  for (const pt of results.shearForce) {
    sfdPath.push({ x: pt.x, y: yOffset + pt.v * factor });
  }
  sfdPath.push({ x: L, y: yOffset });
  paths.push(sfdPath);

  // Closing verticals at changes
  for (const pt of results.shearForce) {
    if (Math.abs(pt.v) > maxV * 0.01) {
      // Only draw a vertical tick at significant jumps
      const idx = results.shearForce.indexOf(pt);
      if (idx > 0) {
        const prev = results.shearForce[idx - 1];
        if (Math.abs(pt.v - prev.v) > maxV * 0.3) {
          paths.push([
            { x: pt.x, y: yOffset },
            { x: pt.x, y: yOffset + pt.v * factor },
          ]);
        }
      }
    }
  }

  return {
    id: `beam-sfd-${Math.random().toString(36).slice(2, 8)}`,
    name: 'sfd',
    partType: 'assembly',
    label: 'Shear Force Diagram',
    paths,
    centerX: L / 2,
    centerY: yOffset,
    params: { maxShear: results.maxShear },
  };
}

/**
 * Generate a Bending Moment Diagram as a filled-area path.
 */
export function generateBMDiagram(results: BeamResults, yOffset = -7, scale = 1): MechanicalPart {
  const L = results.config.length;
  const maxM = Math.max(Math.abs(results.maxMoment), 1);
  const displayHeight = L * 0.3 * scale;
  const factor = displayHeight / maxM;

  const paths: Point2D[][] = [];

  // Baseline
  paths.push([
    { x: 0, y: yOffset },
    { x: L, y: yOffset },
  ]);

  // BMD curve
  const bmdPath: Point2D[] = [{ x: 0, y: yOffset }];
  for (const pt of results.bendingMoment) {
    bmdPath.push({ x: pt.x, y: yOffset - pt.m * factor }); // convention: sagging positive drawn below
  }
  bmdPath.push({ x: L, y: yOffset });
  paths.push(bmdPath);

  return {
    id: `beam-bmd-${Math.random().toString(36).slice(2, 8)}`,
    name: 'bmd',
    partType: 'assembly',
    label: 'Bending Moment Diagram',
    paths,
    centerX: L / 2,
    centerY: yOffset,
    params: { maxMoment: results.maxMoment },
  };
}

/**
 * Generate a Deflection Curve.
 */
export function generateDeflectionDiagram(results: BeamResults, yOffset = -11, scale = 1000): MechanicalPart {
  const L = results.config.length;
  const maxD = Math.max(Math.abs(results.maxDeflection), 1e-10);
  const displayHeight = L * 0.2;
  const factor = (displayHeight / maxD) * scale;

  const paths: Point2D[][] = [];

  // Baseline (undeformed)
  paths.push([
    { x: 0, y: yOffset },
    { x: L, y: yOffset },
  ]);

  // Deflection curve
  const deflPath: Point2D[] = [];
  for (const pt of results.deflection) {
    deflPath.push({ x: pt.x, y: yOffset + pt.d * factor });
  }
  paths.push(deflPath);

  return {
    id: `beam-defl-${Math.random().toString(36).slice(2, 8)}`,
    name: 'deflection',
    partType: 'assembly',
    label: 'Deflection Curve',
    paths,
    centerX: L / 2,
    centerY: yOffset,
    params: { maxDeflection: results.maxDeflection },
  };
}

// ── Support Symbols ────────────────────────────────────────────────

function generatePinSupport(x: number, y: number, size: number): Point2D[] {
  return [
    { x, y },
    { x: x - size * 0.6, y: y - size },
    { x: x + size * 0.6, y: y - size },
    { x, y },
  ];
}

function generateRollerSupport(x: number, y: number, size: number): Point2D[] {
  const path: Point2D[] = [];
  // Triangle
  path.push({ x, y });
  path.push({ x: x - size * 0.6, y: y - size * 0.7 });
  path.push({ x: x + size * 0.6, y: y - size * 0.7 });
  path.push({ x, y });

  // Roller circle (approximated as small polygon)
  const circleY = y - size;
  const r = size * 0.15;
  for (let i = 0; i <= 12; i++) {
    const angle = (i / 12) * 2 * Math.PI;
    path.push({ x: x + r * Math.cos(angle), y: circleY + r * Math.sin(angle) });
  }

  return path;
}

function generateFixedSupport(x: number, y: number, beamHeight: number, size: number): Point2D[][] {
  const paths: Point2D[][] = [];
  const wallX = x < 0.01 ? x - size * 0.3 : x + size * 0.3;
  const halfH = beamHeight / 2 + size * 0.5;

  // Vertical wall line
  paths.push([
    { x: wallX, y: y - halfH },
    { x: wallX, y: y + halfH },
  ]);

  // Hatch lines
  const hatchCount = 5;
  const hatchLen = size * 0.4;
  for (let i = 0; i <= hatchCount; i++) {
    const hy = y - halfH + (i / hatchCount) * 2 * halfH;
    const dir = x < 0.01 ? -1 : 1;
    paths.push([
      { x: wallX, y: hy },
      { x: wallX + dir * hatchLen, y: hy - hatchLen * 0.5 },
    ]);
  }

  return paths;
}

// ── Load Symbols ───────────────────────────────────────────────────

function generateLoadSymbol(load: Load, beamLength: number, beamTopY: number, size: number): Point2D[][] {
  const paths: Point2D[][] = [];
  const arrowLen = beamLength * 0.12;
  const arrowHeadSize = size * 0.3;

  if (load.type === 'point') {
    const x = load.position;
    const topY = beamTopY + arrowLen;
    // Arrow shaft
    paths.push([
      { x, y: topY },
      { x, y: beamTopY },
    ]);
    // Arrowhead
    paths.push([
      { x: x - arrowHeadSize, y: beamTopY + arrowHeadSize * 1.5 },
      { x, y: beamTopY },
      { x: x + arrowHeadSize, y: beamTopY + arrowHeadSize * 1.5 },
    ]);
  } else if (load.type === 'distributed') {
    const numArrows = Math.max(4, Math.round((load.end - load.start) / (beamLength * 0.1)));
    const step = (load.end - load.start) / numArrows;
    const topY = beamTopY + arrowLen * 0.7;

    // Top line connecting arrows
    paths.push([
      { x: load.start, y: topY },
      { x: load.end, y: topY },
    ]);

    // Individual arrows
    for (let i = 0; i <= numArrows; i++) {
      const x = load.start + i * step;
      paths.push([
        { x, y: topY },
        { x, y: beamTopY },
      ]);
      // Small arrowhead
      paths.push([
        { x: x - arrowHeadSize * 0.5, y: beamTopY + arrowHeadSize },
        { x, y: beamTopY },
        { x: x + arrowHeadSize * 0.5, y: beamTopY + arrowHeadSize },
      ]);
    }
  } else if (load.type === 'moment') {
    // Curved arrow for moment
    const x = load.position;
    const r = arrowLen * 0.5;
    const path: Point2D[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i / 16) * Math.PI * 1.5 - Math.PI * 0.75;
      path.push({ x: x + r * Math.cos(angle), y: beamTopY + arrowLen * 0.5 + r * Math.sin(angle) });
    }
    paths.push(path);
    // Arrowhead at end of arc
    const endAngle = Math.PI * 0.75;
    const ex = x + r * Math.cos(endAngle);
    const ey = beamTopY + arrowLen * 0.5 + r * Math.sin(endAngle);
    paths.push([
      { x: ex - arrowHeadSize * 0.4, y: ey + arrowHeadSize * 0.4 },
      { x: ex, y: ey },
      { x: ex + arrowHeadSize * 0.4, y: ey + arrowHeadSize * 0.4 },
    ]);
  }

  return paths;
}

// ── Combined Beam + Diagrams ───────────────────────────────────────

/**
 * Generate all beam visualizations: geometry + all diagrams.
 */
export function generateFullBeamVisualization(
  config: BeamConfig,
  results: BeamResults
): MechanicalPart[] {
  const parts: MechanicalPart[] = [];

  // Beam geometry at y=0
  parts.push(generateBeamGeometry(config, 0));

  // Shear Force Diagram below the beam
  parts.push(generateSFDiagram(results, -(config.length * 0.4)));

  // Bending Moment Diagram further below
  parts.push(generateBMDiagram(results, -(config.length * 0.8)));

  // Deflection Curve at the bottom
  parts.push(generateDeflectionDiagram(results, -(config.length * 1.2)));

  return parts;
}
