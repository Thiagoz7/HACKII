/**
 * solids-3d.ts — 3D solid object generation with materials for Andrómeda.
 *
 * Generates triangle meshes for basic solids (cube, cylinder, sphere, cone)
 * and applies flat shading with material properties (color, reflectivity).
 */

import type { Vec3 } from './renderer-3d';

// ── Types ──────────────────────────────────────────────────────────

export type MaterialType = 'metal' | 'wood' | 'aluminum' | 'plastic' | 'glass' | 'default';

export interface Material {
  name: MaterialType;
  baseColor: [number, number, number]; // RGB 0-255
  ambient: number;   // 0-1, ambient light contribution
  diffuse: number;   // 0-1, diffuse light reflection
  specular: number;  // 0-1, specular highlight strength
  shininess: number; // exponent for specular
}

export interface Triangle3D {
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  normal: Vec3;
}

export interface Solid3D {
  id: string;
  label: string;
  triangles: Triangle3D[];
  material: Material;
  center: Vec3;
}

// ── Materials ──────────────────────────────────────────────────────

export const MATERIALS: Record<MaterialType, Material> = {
  metal: { name: 'metal', baseColor: [180, 190, 200], ambient: 0.15, diffuse: 0.6, specular: 0.8, shininess: 64 },
  aluminum: { name: 'aluminum', baseColor: [200, 210, 220], ambient: 0.2, diffuse: 0.6, specular: 0.7, shininess: 48 },
  wood: { name: 'wood', baseColor: [160, 110, 60], ambient: 0.25, diffuse: 0.7, specular: 0.1, shininess: 8 },
  plastic: { name: 'plastic', baseColor: [60, 120, 200], ambient: 0.2, diffuse: 0.7, specular: 0.4, shininess: 32 },
  glass: { name: 'glass', baseColor: [200, 220, 255], ambient: 0.1, diffuse: 0.3, specular: 0.9, shininess: 96 },
  default: { name: 'default', baseColor: [100, 140, 200], ambient: 0.2, diffuse: 0.7, specular: 0.3, shininess: 16 },
};

// ── Solid Generators ───────────────────────────────────────────────

export function generateCube(size: number, center: Vec3 = { x: 0, y: 0, z: 0 }): Triangle3D[] {
  const h = size / 2;
  const c = center;
  // 8 vertices
  const v = [
    { x: c.x - h, y: c.y - h, z: c.z - h }, // 0: left-bottom-back
    { x: c.x + h, y: c.y - h, z: c.z - h }, // 1: right-bottom-back
    { x: c.x + h, y: c.y + h, z: c.z - h }, // 2: right-top-back
    { x: c.x - h, y: c.y + h, z: c.z - h }, // 3: left-top-back
    { x: c.x - h, y: c.y - h, z: c.z + h }, // 4: left-bottom-front
    { x: c.x + h, y: c.y - h, z: c.z + h }, // 5: right-bottom-front
    { x: c.x + h, y: c.y + h, z: c.z + h }, // 6: right-top-front
    { x: c.x - h, y: c.y + h, z: c.z + h }, // 7: left-top-front
  ];

  // 12 triangles (2 per face)
  const faces: [number, number, number, Vec3][] = [
    [0, 1, 2, { x: 0, y: 0, z: -1 }], [0, 2, 3, { x: 0, y: 0, z: -1 }], // back
    [4, 6, 5, { x: 0, y: 0, z: 1 }], [4, 7, 6, { x: 0, y: 0, z: 1 }],   // front
    [0, 4, 5, { x: 0, y: -1, z: 0 }], [0, 5, 1, { x: 0, y: -1, z: 0 }], // bottom
    [3, 2, 6, { x: 0, y: 1, z: 0 }], [3, 6, 7, { x: 0, y: 1, z: 0 }],   // top
    [0, 3, 7, { x: -1, y: 0, z: 0 }], [0, 7, 4, { x: -1, y: 0, z: 0 }], // left
    [1, 5, 6, { x: 1, y: 0, z: 0 }], [1, 6, 2, { x: 1, y: 0, z: 0 }],   // right
  ];

  return faces.map(([i0, i1, i2, normal]) => ({
    v0: v[i0], v1: v[i1], v2: v[i2], normal,
  }));
}

export function generateCylinder(radius: number, height: number, segments = 24, center: Vec3 = { x: 0, y: 0, z: 0 }): Triangle3D[] {
  const triangles: Triangle3D[] = [];
  const halfH = height / 2;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * 2 * Math.PI;
    const a1 = ((i + 1) / segments) * 2 * Math.PI;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);

    // Side quad (2 triangles)
    const bl = { x: center.x + radius * c0, y: center.y - halfH, z: center.z + radius * s0 };
    const br = { x: center.x + radius * c1, y: center.y - halfH, z: center.z + radius * s1 };
    const tl = { x: center.x + radius * c0, y: center.y + halfH, z: center.z + radius * s0 };
    const tr = { x: center.x + radius * c1, y: center.y + halfH, z: center.z + radius * s1 };
    const nx = (c0 + c1) / 2, nz = (s0 + s1) / 2;
    const len = Math.sqrt(nx * nx + nz * nz) || 1;
    const normal = { x: nx / len, y: 0, z: nz / len };

    triangles.push({ v0: bl, v1: br, v2: tr, normal });
    triangles.push({ v0: bl, v1: tr, v2: tl, normal });

    // Top cap
    const tc = { x: center.x, y: center.y + halfH, z: center.z };
    triangles.push({ v0: tc, v1: tl, v2: tr, normal: { x: 0, y: 1, z: 0 } });

    // Bottom cap
    const bc = { x: center.x, y: center.y - halfH, z: center.z };
    triangles.push({ v0: bc, v1: br, v2: bl, normal: { x: 0, y: -1, z: 0 } });
  }

  return triangles;
}

export function generateSphere(radius: number, segments = 16, center: Vec3 = { x: 0, y: 0, z: 0 }): Triangle3D[] {
  const triangles: Triangle3D[] = [];
  const rings = segments;
  const slices = segments * 2;

  for (let i = 0; i < rings; i++) {
    const phi0 = (i / rings) * Math.PI;
    const phi1 = ((i + 1) / rings) * Math.PI;

    for (let j = 0; j < slices; j++) {
      const theta0 = (j / slices) * 2 * Math.PI;
      const theta1 = ((j + 1) / slices) * 2 * Math.PI;

      const p = (ph: number, th: number): Vec3 => ({
        x: center.x + radius * Math.sin(ph) * Math.cos(th),
        y: center.y + radius * Math.cos(ph),
        z: center.z + radius * Math.sin(ph) * Math.sin(th),
      });

      const v00 = p(phi0, theta0);
      const v01 = p(phi0, theta1);
      const v10 = p(phi1, theta0);
      const v11 = p(phi1, theta1);

      const mid = { x: (v00.x + v11.x) / 2 - center.x, y: (v00.y + v11.y) / 2 - center.y, z: (v00.z + v11.z) / 2 - center.z };
      const mlen = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z) || 1;
      const normal = { x: mid.x / mlen, y: mid.y / mlen, z: mid.z / mlen };

      if (i > 0) triangles.push({ v0: v00, v1: v10, v2: v01, normal });
      if (i < rings - 1) triangles.push({ v0: v01, v1: v10, v2: v11, normal });
    }
  }

  return triangles;
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedSolidCommand {
  shape: 'cube' | 'cylinder' | 'sphere' | 'gear' | 'beam' | 'shaft';
  material: MaterialType;
  size: number;
  radius?: number;
  height?: number;
  label: string;
}

export function parseSolidCommand(input: string): ParsedSolidCommand | null {
  const lower = input.toLowerCase();

  // Must mention solid/3d + a shape keyword
  if (!/\b(solid|3d|metal|wood|wooden|aluminum|aluminium|plastic|glass)\b/i.test(lower)) return null;
  if (!/\b(cube|cylinder|sphere|ball|gear|beam|shaft|box|rod)\b/i.test(lower)) return null;

  // Shape
  let shape: ParsedSolidCommand['shape'] = 'cube';
  if (/\b(cylinder|rod)\b/.test(lower)) shape = 'cylinder';
  else if (/\b(sphere|ball)\b/.test(lower)) shape = 'sphere';
  else if (/\bgear\b/.test(lower)) shape = 'gear';
  else if (/\bbeam\b/.test(lower)) shape = 'beam';
  else if (/\bshaft\b/.test(lower)) shape = 'shaft';
  else if (/\b(cube|box)\b/.test(lower)) shape = 'cube';

  // Material
  let material: MaterialType = 'default';
  if (/\bmetal\b/.test(lower) || /\bmetallic\b/.test(lower) || /\bsteel\b/.test(lower)) material = 'metal';
  else if (/\b(aluminum|aluminium)\b/.test(lower)) material = 'aluminum';
  else if (/\b(wood|wooden)\b/.test(lower)) material = 'wood';
  else if (/\bplastic\b/.test(lower)) material = 'plastic';
  else if (/\bglass\b/.test(lower)) material = 'glass';

  // Dimensions
  let size = 5;
  let radius: number | undefined;
  let height: number | undefined;

  const sideMatch = lower.match(/(?:side|size|s)\s*(?:[:=]\s*)?(\d+\.?\d*)/);
  if (sideMatch) size = parseFloat(sideMatch[1]);

  const radiusMatch = lower.match(/radius\s*(?:[:=]\s*)?(\d+\.?\d*)/);
  if (radiusMatch) radius = parseFloat(radiusMatch[1]);

  const heightMatch = lower.match(/height\s*(?:[:=]\s*)?(\d+\.?\d*)/);
  if (heightMatch) height = parseFloat(heightMatch[1]);

  // Generic number
  if (!sideMatch && !radiusMatch) {
    const numMatch = lower.match(/(\d+\.?\d*)\s*(?:units?|m|cm)?/);
    if (numMatch) size = parseFloat(numMatch[1]);
  }

  const matLabel = material === 'default' ? '' : ` (${material})`;
  const label = `${shape.charAt(0).toUpperCase() + shape.slice(1)}${matLabel}`;

  return { shape, material, size, radius, height, label };
}

// ── Solid Builder ──────────────────────────────────────────────────

export function buildSolid(cmd: ParsedSolidCommand): Solid3D {
  let triangles: Triangle3D[];
  const mat = MATERIALS[cmd.material];

  switch (cmd.shape) {
    case 'cube':
      triangles = generateCube(cmd.size);
      break;
    case 'cylinder':
    case 'shaft':
      triangles = generateCylinder(cmd.radius ?? cmd.size / 2, cmd.height ?? cmd.size, 24);
      break;
    case 'sphere':
      triangles = generateSphere(cmd.radius ?? cmd.size / 2, 14);
      break;
    case 'beam':
      // Beam as elongated cube
      triangles = generateCube(1, { x: 0, y: 0, z: 0 });
      // Scale: length along X, height and width = size/5
      const scaleX = cmd.size;
      const scaleYZ = cmd.size / 5;
      triangles = triangles.map(t => ({
        ...t,
        v0: { x: t.v0.x * scaleX, y: t.v0.y * scaleYZ, z: t.v0.z * scaleYZ },
        v1: { x: t.v1.x * scaleX, y: t.v1.y * scaleYZ, z: t.v1.z * scaleYZ },
        v2: { x: t.v2.x * scaleX, y: t.v2.y * scaleYZ, z: t.v2.z * scaleYZ },
      }));
      break;
    case 'gear':
      // Gear as a short cylinder
      triangles = generateCylinder(cmd.radius ?? cmd.size, cmd.height ?? cmd.size * 0.3, 32);
      break;
    default:
      triangles = generateCube(cmd.size);
  }

  return {
    id: `solid-${Math.random().toString(36).slice(2, 8)}`,
    label: cmd.label,
    triangles,
    material: mat,
    center: { x: 0, y: 0, z: 0 },
  };
}
