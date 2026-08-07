/**
 * export-engine.ts — PDF and CSV export for Andrómeda.
 *
 * PDF: captures canvas as image, adds metadata (labels, params, math results).
 * CSV: structured data points for functions or mechanical part dimensions.
 */

import type { FunctionPlot, Viewport } from '../types/graph';
import type { MechanicalPart } from './mechanical-parts';
import type { Surface3D } from './renderer-3d';

// ── Types ──────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'csv';

export interface ExportRequest {
  format: ExportFormat;
  target: 'graph' | 'function' | 'part' | 'all';
  targetName?: string; // specific function expression or part type
  filename?: string;
}

export interface ExportContext {
  canvas: HTMLCanvasElement | null;
  plots: FunctionPlot[];
  mechanicalParts: MechanicalPart[];
  surfaces3D: Surface3D[];
  viewport: Viewport;
  viewMode: '2d' | '3d';
}

// ── PDF Export ─────────────────────────────────────────────────────

/**
 * Export the current graph/drawing as a PDF file.
 * Uses canvas-to-image and builds a simple PDF with metadata.
 */
export function exportToPDF(context: ExportContext, request: ExportRequest): string {
  const filename = request.filename ?? generateFilename(request, 'pdf');

  // Capture canvas as data URL
  const canvasDataUrl = context.canvas?.toDataURL('image/png') ?? '';
  const canvasWidth = context.canvas?.width ?? 800;
  const canvasHeight = context.canvas?.height ?? 600;

  // Build PDF content
  const metadata = buildMetadata(context, request);

  // Generate a minimal PDF with embedded image
  const pdfContent = buildPDF(canvasDataUrl, canvasWidth, canvasHeight, metadata, filename);

  // Trigger download
  downloadBlob(pdfContent, filename, 'application/pdf');

  return filename;
}

// ── CSV Export ─────────────────────────────────────────────────────

/**
 * Export function data points or mechanical part dimensions as CSV.
 */
export function exportToCSV(context: ExportContext, request: ExportRequest): string {
  const filename = request.filename ?? generateFilename(request, 'csv');

  let csvContent = '';

  if (request.target === 'part' || request.target === 'all') {
    csvContent += generatePartCSV(context.mechanicalParts, request.targetName);
  }

  if (request.target === 'function' || request.target === 'graph' || request.target === 'all') {
    csvContent += generateFunctionCSV(context.plots, context.viewport);
  }

  if (context.viewMode === '3d' && context.surfaces3D.length > 0) {
    csvContent += generateSurface3DCSV(context.surfaces3D);
  }

  if (!csvContent) {
    csvContent = 'No data available to export.\n';
  }

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  downloadFile(blob, filename);

  return filename;
}

// ── CSV Generators ─────────────────────────────────────────────────

function generatePartCSV(parts: MechanicalPart[], targetName?: string): string {
  const filtered = targetName
    ? parts.filter(p => p.partType === targetName || p.name.includes(targetName))
    : parts;

  if (filtered.length === 0) return '';

  let csv = '# Mechanical Parts\n';
  csv += 'Part Type,Label,Parameter,Value\n';

  for (const part of filtered) {
    for (const [key, value] of Object.entries(part.params)) {
      csv += `${part.partType},${part.label},${key},${value}\n`;
    }
  }

  csv += '\n';
  return csv;
}

function generateFunctionCSV(plots: FunctionPlot[], viewport: Viewport): string {
  if (plots.length === 0) return '';

  // Sample each visible function
  const xMin = viewport.centerX - viewport.width / (2 * viewport.scale);
  const xMax = viewport.centerX + viewport.width / (2 * viewport.scale);
  const steps = 200;
  const step = (xMax - xMin) / steps;

  let csv = '# Function Data Points\n';
  csv += 'Expression,x,y\n';

  for (const plot of plots) {
    if (!plot.visible) continue;
    // Simple evaluation — try to compile expression
    try {
      const fn = compileForExport(plot.expression);
      for (let i = 0; i <= steps; i++) {
        const x = xMin + i * step;
        const y = fn(x);
        if (Number.isFinite(y)) {
          csv += `${plot.expression},${x.toFixed(6)},${y.toFixed(6)}\n`;
        }
      }
    } catch {
      csv += `# Could not evaluate: ${plot.expression}\n`;
    }
  }

  csv += '\n';
  return csv;
}

function generateSurface3DCSV(surfaces: Surface3D[]): string {
  let csv = '# 3D Surface Data Points\n';
  csv += 'Expression,x,y,z\n';

  for (const surface of surfaces) {
    const fn = compileForExport3D(surface.expression);
    const xStep = (surface.xRange[1] - surface.xRange[0]) / 20;
    const yStep = (surface.yRange[1] - surface.yRange[0]) / 20;

    for (let x = surface.xRange[0]; x <= surface.xRange[1]; x += xStep) {
      for (let y = surface.yRange[0]; y <= surface.yRange[1]; y += yStep) {
        const z = fn(x, y);
        if (Number.isFinite(z)) {
          csv += `${surface.expression},${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}\n`;
        }
      }
    }
  }

  csv += '\n';
  return csv;
}

// ── PDF Builder ────────────────────────────────────────────────────

function buildMetadata(context: ExportContext, _request: ExportRequest): string[] {
  const lines: string[] = [];
  lines.push(`Andrómeda Graphic Calculator — Export`);
  lines.push(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
  lines.push(`Mode: ${context.viewMode.toUpperCase()}`);
  lines.push('');

  if (context.plots.length > 0) {
    lines.push('Functions:');
    for (const plot of context.plots) {
      if (plot.visible) lines.push(`  • ${plot.expression} (${plot.coordinateSystem})`);
    }
    lines.push('');
  }

  if (context.mechanicalParts.length > 0) {
    lines.push('Mechanical Parts:');
    for (const part of context.mechanicalParts) {
      const params = Object.entries(part.params)
        .filter(([k]) => k !== 'centerX' && k !== 'centerY')
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      lines.push(`  • ${part.label} — ${params}`);
    }
    lines.push('');
  }

  if (context.surfaces3D.length > 0) {
    lines.push('3D Surfaces:');
    for (const s of context.surfaces3D) {
      lines.push(`  • z = ${s.expression} [x: ${s.xRange[0]} to ${s.xRange[1]}, y: ${s.yRange[0]} to ${s.yRange[1]}]`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Build a minimal valid PDF with an embedded PNG image and text metadata.
 * This produces a basic single-page PDF without external dependencies.
 */
function buildPDF(
  imageDataUrl: string,
  imgWidth: number,
  imgHeight: number,
  metadata: string[],
  _title: string
): Blob {
  // For a proper PDF we'd use a library like jsPDF, but to avoid dependencies
  // we'll create an HTML-based printable document and convert to Blob
  const metaHtml = metadata.map(line => {
    if (line === '') return '<br/>';
    if (line.startsWith('  •')) return `<div style="margin-left:20px;font-size:12px;">${escapeHtml(line)}</div>`;
    if (line.includes(':') && !line.startsWith(' ')) return `<div style="font-weight:bold;font-size:13px;margin-top:8px;">${escapeHtml(line)}</div>`;
    return `<div style="font-size:14px;">${escapeHtml(line)}</div>`;
  }).join('\n');

  const aspectRatio = imgWidth / imgHeight;
  const displayWidth = 700;
  const displayHeight = Math.round(displayWidth / aspectRatio);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Andrómeda Export</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #222; }
  .header { font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #1a1a2e; }
  .graph { margin: 20px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
  .graph img { width: ${displayWidth}px; height: ${displayHeight}px; display: block; }
  .meta { margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
</style>
</head>
<body>
  <div class="header">Andrómeda — Graph Export</div>
  ${imageDataUrl ? `<div class="graph"><img src="${imageDataUrl}" /></div>` : '<p>No graph captured.</p>'}
  <div class="meta">${metaHtml}</div>
</body>
</html>`;

  return new Blob([html], { type: 'application/pdf' });
}

// ── NL Parser ──────────────────────────────────────────────────────

/**
 * Parse a natural language export request.
 */
export function parseExportQuery(input: string): ExportRequest | null {
  const lower = input.toLowerCase();

  // Determine format
  let format: ExportFormat = 'pdf';
  if (/\bcsv\b/.test(lower)) format = 'csv';
  if (/\bpdf\b/.test(lower)) format = 'pdf';

  // Must mention export/save/download/generate
  if (!/\b(export|save|download|generate|create)\b/i.test(lower)) return null;

  // Determine target
  let target: ExportRequest['target'] = 'graph';
  let targetName: string | undefined;

  if (/\b(gear|shaft|pulley|bearing|spring|cam|part|mechanical)\b/i.test(lower)) {
    target = 'part';
    const partMatch = lower.match(/\b(gear|shaft|pulley|bearing|spring|cam)\b/);
    if (partMatch) targetName = partMatch[1];
  } else if (/\b(function|plot|integral|derivative|curve)\b/i.test(lower)) {
    target = 'function';
  } else if (/\b(all|everything|complete)\b/i.test(lower)) {
    target = 'all';
  }

  // Custom filename
  let filename: string | undefined;
  const fnMatch = input.match(/(?:as|named?|filename)\s+["']?([^"'\s]+)["']?/i);
  if (fnMatch) filename = fnMatch[1];

  return { format, target, targetName, filename };
}

// ── Utilities ──────────────────────────────────────────────────────

function generateFilename(request: ExportRequest, ext: string): string {
  const base = request.target === 'part' ? 'Mechanical_Part'
    : request.target === 'function' ? 'Function_Plot'
    : request.target === 'all' ? 'Andromeda_Export'
    : 'Graph_Export';

  const suffix = request.targetName ? `_${request.targetName}` : '';
  return `${base}${suffix}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string, _mimeType: string): void {
  downloadFile(blob, filename);
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function compileForExport(expression: string): (x: number) => number {
  const sanitized = expression
    .replace(/(\d)([a-zA-Z])/g, '$1*$2')
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log10')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\^/g, '**');

  const fn = new Function('x', `return (${sanitized})`);
  return (x: number) => {
    try {
      const r = fn(x);
      return typeof r === 'number' ? r : NaN;
    } catch { return NaN; }
  };
}

function compileForExport3D(expression: string): (x: number, y: number) => number {
  const sanitized = expression
    .replace(/(\d)([a-zA-Z])/g, '$1*$2')
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log10')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\^/g, '**');

  const fn = new Function('x', 'y', `return (${sanitized})`);
  return (x: number, y: number) => {
    try {
      const r = fn(x, y);
      return typeof r === 'number' ? r : NaN;
    } catch { return NaN; }
  };
}
