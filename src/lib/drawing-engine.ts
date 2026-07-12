import type { DrawingCommand, DrawingPlan, DrawingRenderData, Point2D } from '../types/graph';

// ── NL Parsing ────────────────────────────────────────────────────

interface ParsedDrawing {
  shape: 'line' | 'circle' | 'arc' | 'rectangle' | 'polygon' | 'point';
  system: 'absolute' | 'relative' | 'polar';
  params: Record<string, number>;
  label?: string;
}

/**
 * Convert natural language drawing description into a DrawingPlan.
 * Supports: lines, circles, arcs, rectangles, polygons, and points
 * in absolute, relative, or polar coordinates.
 */
export function parseDrawingIntent(input: string): DrawingPlan | null {
  const lower = input.toLowerCase().trim();

  // Detect coordinate system
  let system: 'absolute' | 'relative' | 'polar' = 'absolute';
  if (/\bpolar\b/.test(lower) || /\bfrom origin\b/.test(lower)) {
    system = 'polar';
  } else if (/\brelative\b/.test(lower) || /\bfrom last\b/.test(lower)) {
    system = 'relative';
  }

  const commands: DrawingCommand[] = [];

  // ── Circle detection ──
  const circlePatterns = [
    /circle\s+(?:with\s+)?(?:a\s+)?radius\s+(?:of\s+)?([\d.]+)/i,
    /circle\s+(?:with\s+)?(?:a\s+)?r\s*=\s*([\d.]+)/i,
    /circle\s+(?:at|centered\s+at)\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?\s*(?:with\s+)?(?:a\s+)?(?:radius|r)\s*(?:of\s+)?([\d.]+)/i,
    /circle\s+(?:with\s+)?(?:a\s+)?diameter\s+(?:of\s+)?([\d.]+)/i,
  ];

  for (const pattern of circlePatterns) {
    const m = lower.match(pattern);
    if (m) {
      if (m[2] !== undefined && m[3] !== undefined) {
        // Circle at (cx, cy) with radius
        commands.push({
          type: 'circle',
          system,
          params: { cx: parseFloat(m[1]), cy: parseFloat(m[2]), r: parseFloat(m[3]) },
        });
      } else if (pattern.source.includes('diameter')) {
        commands.push({
          type: 'circle',
          system,
          params: { cx: 0, cy: 0, r: parseFloat(m[1]) / 2 },
        });
      } else {
        commands.push({
          type: 'circle',
          system,
          params: { cx: 0, cy: 0, r: parseFloat(m[1]) },
        });
      }
      break;
    }
  }

  // ── Line detection ──
  const linePatterns = [
    /line\s+from\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?\s*to\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?/i,
    /line\s+(?:with\s+)?(?:a\s+)?length\s+(?:of\s+)?([\d.]+)\s+(?:at\s+)?(?:an\s+)?(?:angle\s+)?(?:of\s+)?([\d.]+)\s*(?:deg|°|degrees)?/i,
    /line\s+(?:from\s+)?\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?\s*(?:with\s+)?(?:a\s+)?(?:length|len)\s+(?:of\s+)?([\d.]+)\s+(?:at\s+)?([\d.]+)\s*(?:deg|°|degrees)?/i,
    /horizontal\s+line\s+(?:at\s+)?y\s*=\s*([\d.-]+)\s*(?:from\s+)?x\s*=\s*([\d.-]+)\s*(?:to\s+)?x\s*=\s*([\d.-]+)/i,
    /vertical\s+line\s+(?:at\s+)?x\s*=\s*([\d.-]+)\s*(?:from\s+)?y\s*=\s*([\d.-]+)\s*(?:to\s+)?y\s*=\s*([\d.-]+)/i,
  ];

  for (const pattern of linePatterns) {
    const m = lower.match(pattern);
    if (m) {
      if (m[4] !== undefined && pattern.source.includes('from')) {
        // Line from (x1,y1) to (x2,y2)
        commands.push({
          type: 'line',
          system,
          params: { x1: parseFloat(m[1]), y1: parseFloat(m[2]), x2: parseFloat(m[3]), y2: parseFloat(m[4]) },
        });
      } else if (pattern.source.includes('horizontal')) {
        commands.push({
          type: 'line',
          system: 'absolute',
          params: { x1: parseFloat(m[2]), y1: parseFloat(m[1]), x2: parseFloat(m[3]), y2: parseFloat(m[1]) },
          label: `y = ${m[1]}`,
        });
      } else if (pattern.source.includes('vertical')) {
        commands.push({
          type: 'line',
          system: 'absolute',
          params: { x1: parseFloat(m[1]), y1: parseFloat(m[2]), x2: parseFloat(m[1]), y2: parseFloat(m[3]) },
          label: `x = ${m[1]}`,
        });
      } else {
        // Line with length + angle
        const angleRad = parseFloat(m[2]) * (Math.PI / 180);
        const len = parseFloat(m[1]);
        commands.push({
          type: 'line',
          system: 'polar',
          params: { x1: 0, y1: 0, x2: len * Math.cos(angleRad), y2: len * Math.sin(angleRad) },
        });
      }
      break;
    }
  }

  // ── Rectangle detection ──
  const rectPatterns = [
    /rectangle\s+(?:with\s+)?(?:a\s+)?(?:width|w)\s+(?:of\s+)?([\d.]+)\s+(?:and\s+)?(?:height|h)\s+(?:of\s+)?([\d.]+)/i,
    /rectangle\s+([\d.]+)\s*(?:x|by|×)\s*([\d.]+)/i,
    /rectangle\s+from\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?\s*to\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?/i,
    /square\s+(?:with\s+)?(?:a\s+)?(?:side|s)\s+(?:of\s+)?([\d.]+)/i,
  ];

  for (const pattern of rectPatterns) {
    const m = lower.match(pattern);
    if (m) {
      if (pattern.source.includes('square')) {
        commands.push({
          type: 'rectangle',
          system,
          params: { x: 0, y: 0, w: parseFloat(m[1]), h: parseFloat(m[1]) },
        });
      } else if (m[3] !== undefined && pattern.source.includes('from')) {
        const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
        const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
        commands.push({
          type: 'rectangle',
          system,
          params: { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) },
        });
      } else {
        commands.push({
          type: 'rectangle',
          system,
          params: { x: 0, y: 0, w: parseFloat(m[1]), h: parseFloat(m[2]) },
        });
      }
      break;
    }
  }

  // ── Polygon detection ──
  const polyPatterns = [
    /(?:regular\s+)?polygon\s+(?:with\s+)?([\d.]+)\s+sides?\s+(?:of\s+)?(?:length|side)\s+([\d.]+)/i,
    /(?:regular\s+)?([\d.]+)\s*-\s*gon\s+(?:with\s+)?(?:side|s)\s+([\d.]+)/i,
    /triangle\s+(?:with\s+)?(?:sides?\s+)?([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)/i,
    /hexagon\s+(?:with\s+)?(?:side|s)\s+(?:of\s+)?([\d.]+)/i,
    /pentagon\s+(?:with\s+)?(?:side|s)\s+(?:of\s+)?([\d.]+)/i,
    /octagon\s+(?:with\s+)?(?:side|s)\s+(?:of\s+)?([\d.]+)/i,
  ];

  for (const pattern of polyPatterns) {
    const m = lower.match(pattern);
    if (m) {
      if (pattern.source.includes('hexagon')) {
        commands.push({ type: 'polygon', system, params: { sides: 6, radius: parseFloat(m[1]) } });
      } else if (pattern.source.includes('pentagon')) {
        commands.push({ type: 'polygon', system, params: { sides: 5, radius: parseFloat(m[1]) } });
      } else if (pattern.source.includes('octagon')) {
        commands.push({ type: 'polygon', system, params: { sides: 8, radius: parseFloat(m[1]) } });
      } else if (pattern.source.includes('triangle')) {
        commands.push({
          type: 'polygon',
          system,
          params: { sides: 3, side1: parseFloat(m[1]), side2: parseFloat(m[2]), side3: parseFloat(m[3]) },
        });
      } else {
        commands.push({
          type: 'polygon',
          system,
          params: { sides: parseInt(m[1]), radius: parseFloat(m[2]) },
        });
      }
      break;
    }
  }

  // ── Arc detection ──
  const arcPatterns = [
    /arc\s+(?:from|start)\s+(\d+)\s*(?:deg|°|degrees)?\s*to\s+(\d+)\s*(?:deg|°|degrees)?\s*(?:with\s+)?(?:a\s+)?(?:radius|r)\s+(?:of\s+)?([\d.]+)/i,
    /arc\s+(?:with\s+)?(?:a\s+)?(?:radius|r)\s+(?:of\s+)?([\d.]+)\s+(?:from|start)\s+(\d+)\s*to\s+(\d+)/i,
  ];

  for (const pattern of arcPatterns) {
    const m = lower.match(pattern);
    if (m) {
      if (m[3] !== undefined && pattern.source.includes('radius')) {
        commands.push({
          type: 'arc',
          system: 'polar',
          params: {
            cx: 0, cy: 0,
            r: parseFloat(m[3]),
            startAngle: parseFloat(m[1]) * (Math.PI / 180),
            endAngle: parseFloat(m[2]) * (Math.PI / 180),
          },
        });
      } else {
        commands.push({
          type: 'arc',
          system: 'polar',
          params: {
            cx: 0, cy: 0,
            r: parseFloat(m[1]),
            startAngle: parseFloat(m[2]) * (Math.PI / 180),
            endAngle: parseFloat(m[3]) * (Math.PI / 180),
          },
        });
      }
      break;
    }
  }

  // ── Point detection ──
  const pointPatterns = [
    /point\s+at\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?/i,
    /plot\s+point\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?/i,
    /mark\s+point\s*\(?\s*([\d.-]+)\s*,?\s*([\d.-]+)\s*\)?/i,
  ];

  for (const pattern of pointPatterns) {
    const m = lower.match(pattern);
    if (m) {
      commands.push({
        type: 'point',
        system: 'absolute',
        params: { x: parseFloat(m[1]), y: parseFloat(m[2]) },
      });
      break;
    }
  }

  if (commands.length === 0) return null;

  return {
    name: 'drawing',
    description: input,
    commands,
  };
}

// ── Resolve Drawing to Render Data ─────────────────────────────────

/**
 * Resolve drawing commands into render-ready point sets.
 * This converts relative/polar coordinates into absolute screen coordinates.
 */
export function resolveDrawingCommands(plan: DrawingPlan): DrawingRenderData {
  const points: Point2D[][] = [];
  const circles: Array<{ center: Point2D; radius: number }> = [];
  const labels: Array<{ position: Point2D; text: string }> = [];

  let lastX = 0;
  let lastY = 0;

  for (const cmd of plan.commands) {
    const { type, system, params, label } = cmd;

    switch (type) {
      case 'line': {
        let x1 = params.x1 ?? 0;
        let y1 = params.y1 ?? 0;
        let x2 = params.x2 ?? 0;
        let y2 = params.y2 ?? 0;

        if (system === 'relative') {
          x1 = lastX + x1;
          y1 = lastY + y1;
          x2 = lastX + x2;
          y2 = lastY + y2;
        }

        points.push([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
        lastX = x2;
        lastY = y2;

        if (label) {
          labels.push({ position: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, text: label });
        }
        break;
      }

      case 'circle': {
        const cx = params.cx ?? 0;
        const cy = params.cy ?? 0;
        const r = params.r ?? 1;

        circles.push({ center: { x: cx, y: cy }, radius: r });
        lastX = cx;
        lastY = cy;

        if (label) {
          labels.push({ position: { x: cx, y: cy + r + 0.5 }, text: label });
        }
        break;
      }

      case 'arc': {
        const cx = params.cx ?? 0;
        const cy = params.cy ?? 0;
        const r = params.r ?? 1;
        const startAngle = params.startAngle ?? 0;
        const endAngle = params.endAngle ?? Math.PI;

        // Sample arc points
        const arcPoints: Point2D[] = [];
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / steps);
          arcPoints.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        points.push(arcPoints);
        lastX = cx + r * Math.cos(endAngle);
        lastY = cy + r * Math.sin(endAngle);
        break;
      }

      case 'rectangle': {
        const x = params.x ?? 0;
        const y = params.y ?? 0;
        const w = params.w ?? 1;
        const h = params.h ?? 1;

        points.push([
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
          { x, y }, // close
        ]);
        lastX = x;
        lastY = y;

        if (label) {
          labels.push({ position: { x: x + w / 2, y: y + h / 2 }, text: label });
        }
        break;
      }

      case 'polygon': {
        const sides = params.sides ?? 3;
        const radius = params.radius ?? 1;
        const polyPoints: Point2D[] = [];

        for (let i = 0; i < sides; i++) {
          const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
          polyPoints.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
        }
        polyPoints.push(polyPoints[0]); // close
        points.push(polyPoints);
        lastX = 0;
        lastY = 0;
        break;
      }

      case 'point': {
        const x = params.x ?? 0;
        const y = params.y ?? 0;

        points.push([{ x, y }]);
        lastX = x;
        lastY = y;

        if (label) {
          labels.push({ position: { x, y: y + 0.5 }, text: label });
        } else {
          labels.push({ position: { x, y: y + 0.5 }, text: `(${x}, ${y})` });
        }
        break;
      }
    }
  }

  return { points, circles, labels };
}

/**
 * Generate a human-readable summary of what was drawn.
 */
export function describeDrawing(plan: DrawingPlan): string {
  const parts: string[] = [`**Drawing:** ${plan.description}`, ''];

  for (const cmd of plan.commands) {
    const { type, params } = cmd;
    switch (type) {
      case 'line':
        parts.push(`• Line from (${params.x1 ?? 0}, ${params.y1 ?? 0}) to (${params.x2 ?? 0}, ${params.y2 ?? 0})`);
        break;
      case 'circle':
        parts.push(`• Circle at (${params.cx ?? 0}, ${params.cy ?? 0}) with radius ${params.r ?? 1}`);
        break;
      case 'arc':
        parts.push(`• Arc from ${params.startAngle ? (params.startAngle * 180 / Math.PI).toFixed(0) + '°' : '0°'} to ${params.endAngle ? (params.endAngle * 180 / Math.PI).toFixed(0) + '°' : '0°'}, radius ${params.r ?? 1}`);
        break;
      case 'rectangle':
        parts.push(`• Rectangle ${params.w ?? 1} × ${params.h ?? 1} at (${params.x ?? 0}, ${params.y ?? 0})`);
        break;
      case 'polygon':
        parts.push(`• Regular polygon with ${params.sides ?? 3} sides, radius ${params.radius ?? 1}`);
        break;
      case 'point':
        parts.push(`• Point at (${params.x ?? 0}, ${params.y ?? 0})`);
        break;
    }
  }

  return parts.join('\n');
}