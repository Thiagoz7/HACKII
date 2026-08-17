/**
 * visualization-engine.ts — Advanced visualization with Plotly.js and Pyodide.
 *
 * Plotly.js: Interactive 2D/3D charts, heatmaps, statistical plots, dashboards.
 * Pyodide: In-browser Python for Matplotlib/Seaborn/NumPy computations.
 */

// ── Types ──────────────────────────────────────────────────────────

export type VisualizationType =
  | 'plotly_line' | 'plotly_scatter' | 'plotly_surface'
  | 'plotly_heatmap' | 'plotly_histogram' | 'plotly_bar'
  | 'plotly_3d' | 'plotly_contour'
  | 'matplotlib' | 'seaborn';

export interface VisualizationRequest {
  type: VisualizationType;
  expression?: string;
  title?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  data?: number[][];
  pythonCode?: string;
}

// ── Plotly Chart Generators ────────────────────────────────────────

export function generatePlotlyLine(expression: string, xRange: [number, number] = [-10, 10], title?: string): PlotlyConfig {
  const steps = 200;
  const dx = (xRange[1] - xRange[0]) / steps;
  const x: number[] = [];
  const y: number[] = [];
  const fn = compileExpr(expression);

  for (let i = 0; i <= steps; i++) {
    const xv = xRange[0] + i * dx;
    const yv = fn(xv);
    if (Number.isFinite(yv)) {
      x.push(xv);
      y.push(yv);
    }
  }

  return {
    data: [{ x, y, type: 'scatter', mode: 'lines', name: expression, line: { color: '#00E5FF', width: 2 } }],
    layout: { title: title ?? expression, xaxis: { title: 'x' }, yaxis: { title: 'f(x)' }, template: 'plotly_dark' },
  };
}

export function generatePlotlySurface(expression: string, xRange: [number, number] = [-5, 5], yRange: [number, number] = [-5, 5], title?: string): PlotlyConfig {
  const res = 40;
  const xArr: number[] = [];
  const yArr: number[] = [];
  const zArr: number[][] = [];
  const fn = compileSurfaceExpr(expression);

  for (let i = 0; i <= res; i++) {
    xArr.push(xRange[0] + (i / res) * (xRange[1] - xRange[0]));
  }
  for (let j = 0; j <= res; j++) {
    yArr.push(yRange[0] + (j / res) * (yRange[1] - yRange[0]));
  }
  for (let j = 0; j <= res; j++) {
    const row: number[] = [];
    for (let i = 0; i <= res; i++) {
      const z = fn(xArr[i], yArr[j]);
      row.push(Number.isFinite(z) ? z : 0);
    }
    zArr.push(row);
  }

  return {
    data: [{ x: xArr, y: yArr, z: zArr, type: 'surface', colorscale: 'Viridis' }],
    layout: { title: title ?? `z = ${expression}`, scene: { xaxis: { title: 'x' }, yaxis: { title: 'y' }, zaxis: { title: 'z' } }, template: 'plotly_dark' },
  };
}

export function generatePlotlyHeatmap(expression: string, xRange: [number, number] = [-5, 5], yRange: [number, number] = [-5, 5], title?: string): PlotlyConfig {
  const res = 50;
  const zArr: number[][] = [];
  const fn = compileSurfaceExpr(expression);

  for (let j = 0; j <= res; j++) {
    const row: number[] = [];
    const yv = yRange[0] + (j / res) * (yRange[1] - yRange[0]);
    for (let i = 0; i <= res; i++) {
      const xv = xRange[0] + (i / res) * (xRange[1] - xRange[0]);
      const z = fn(xv, yv);
      row.push(Number.isFinite(z) ? z : 0);
    }
    zArr.push(row);
  }

  return {
    data: [{ z: zArr, type: 'heatmap', colorscale: 'Viridis' }],
    layout: { title: title ?? `Heatmap: ${expression}`, template: 'plotly_dark' },
  };
}

export function generatePlotlyHistogram(data: number[], title?: string): PlotlyConfig {
  return {
    data: [{ x: data, type: 'histogram', marker: { color: '#6366f1' } }],
    layout: { title: title ?? 'Histogram', template: 'plotly_dark' },
  };
}

export function generatePlotlyScatter(xData: number[], yData: number[], title?: string): PlotlyConfig {
  return {
    data: [{ x: xData, y: yData, type: 'scatter', mode: 'markers', marker: { color: '#00E5FF', size: 6 } }],
    layout: { title: title ?? 'Scatter Plot', xaxis: { title: 'x' }, yaxis: { title: 'y' }, template: 'plotly_dark' },
  };
}

// ── Plotly Config Type ─────────────────────────────────────────────

export interface PlotlyConfig {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
}

// ── Pyodide Integration ────────────────────────────────────────────

let pyodideInstance: unknown = null;
let pyodideLoading = false;
let pyodideReady = false;

/**
 * Load Pyodide (Python in the browser via WebAssembly).
 * Lazy-loaded on first use to avoid slowing down app startup.
 */
export async function loadPyodide(): Promise<boolean> {
  if (pyodideReady) return true;
  if (pyodideLoading) {
    // Wait for existing load
    while (pyodideLoading) await new Promise(r => setTimeout(r, 100));
    return pyodideReady;
  }

  pyodideLoading = true;
  try {
    // Load Pyodide from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
    document.head.appendChild(script);

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pyodide'));
    });

    // Initialize Pyodide
    const loadPyodideFn = (window as unknown as Record<string, unknown>).loadPyodide as (config: Record<string, string>) => Promise<unknown>;
    pyodideInstance = await loadPyodideFn({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
    });

    // Install matplotlib and numpy
    const pyodide = pyodideInstance as { loadPackage: (pkgs: string[]) => Promise<void>; runPython: (code: string) => unknown };
    await pyodide.loadPackage(['numpy', 'matplotlib']);

    pyodideReady = true;
    return true;
  } catch (e) {
    console.error('Pyodide load failed:', e);
    return false;
  } finally {
    pyodideLoading = false;
  }
}

/**
 * Run Python code via Pyodide and return the result.
 * For matplotlib: returns a base64 PNG image.
 */
export async function runPython(code: string): Promise<{ output: string; image?: string }> {
  if (!pyodideReady || !pyodideInstance) {
    const loaded = await loadPyodide();
    if (!loaded) return { output: 'Error: Pyodide could not be loaded.' };
  }

  const pyodide = pyodideInstance as { runPythonAsync: (code: string) => Promise<unknown>; runPython: (code: string) => unknown };

  try {
    // Setup matplotlib to output base64
    const setupCode = `
import io, base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

_output_buffer = io.StringIO()
_image_buffer = None
`;
    await pyodide.runPythonAsync(setupCode);

    // Run user code
    await pyodide.runPythonAsync(code);

    // Capture plot if one was created
    const captureCode = `
_img_data = None
if plt.get_fignums():
    _buf = io.BytesIO()
    plt.savefig(_buf, format='png', dpi=100, bbox_inches='tight', facecolor='#1a1a2e')
    _buf.seek(0)
    _img_data = base64.b64encode(_buf.read()).decode('utf-8')
    plt.close('all')
_img_data if _img_data else ''
`;
    const imageResult = await pyodide.runPythonAsync(captureCode);
    const image = String(imageResult || '');

    return { output: 'Python executed successfully.', image: image || undefined };
  } catch (e) {
    return { output: `Python error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedVisualizationCommand {
  type: VisualizationType;
  expression?: string;
  title?: string;
  pythonCode?: string;
}

export function parseVisualizationCommand(input: string): ParsedVisualizationCommand | null {
  const lower = input.toLowerCase();

  // Must reference a visualization library or chart type
  if (!/\b(plotly|matplotlib|seaborn|heatmap|histogram|scatter|dashboard|bokeh|interactive\s+plot|statistical)\b/i.test(lower)) return null;

  // Plotly interactive 3D
  if (/\b(plotly|interactive)\b/i.test(lower) && /\b(3d|surface|3D)\b/i.test(lower)) {
    const expr = extractVisExpr(input) ?? 'sin(x)*cos(y)';
    return { type: 'plotly_surface', expression: expr, title: `Interactive 3D: z = ${expr}` };
  }

  // Heatmap
  if (/\bheatmap\b/i.test(lower)) {
    const expr = extractVisExpr(input) ?? 'sin(x)*cos(y)';
    return { type: 'plotly_heatmap', expression: expr, title: `Heatmap: ${expr}` };
  }

  // Histogram
  if (/\bhistogram\b/i.test(lower)) {
    return { type: 'plotly_histogram', title: 'Statistical Histogram' };
  }

  // Scatter
  if (/\bscatter\b/i.test(lower)) {
    return { type: 'plotly_scatter', title: 'Scatter Plot' };
  }

  // Matplotlib
  if (/\bmatplotlib\b/i.test(lower)) {
    const expr = extractVisExpr(input) ?? 'np.sin(x)';
    const code = `
import numpy as np
import matplotlib.pyplot as plt
x = np.linspace(-10, 10, 300)
y = ${expr}
plt.figure(figsize=(8, 5))
plt.plot(x, y, color='#00E5FF', linewidth=2)
plt.title('${expr}')
plt.xlabel('x')
plt.ylabel('y')
plt.grid(True, alpha=0.3)
plt.style.use('dark_background')
`;
    return { type: 'matplotlib', pythonCode: code, title: `Matplotlib: ${expr}` };
  }

  // Seaborn
  if (/\bseaborn\b/i.test(lower)) {
    const code = `
import numpy as np
import matplotlib.pyplot as plt
try:
    import seaborn as sns
except:
    pass
x = np.random.randn(200)
y = x * 0.5 + np.random.randn(200) * 0.3
plt.figure(figsize=(8, 5))
plt.scatter(x, y, alpha=0.6, color='#6366f1')
plt.title('Correlation Plot')
plt.xlabel('X')
plt.ylabel('Y')
plt.style.use('dark_background')
`;
    return { type: 'seaborn', pythonCode: code, title: 'Seaborn Correlation Plot' };
  }

  // Plotly line (default)
  if (/\bplotly\b/i.test(lower)) {
    const expr = extractVisExpr(input) ?? 'sin(x)';
    return { type: 'plotly_line', expression: expr, title: `Plotly: ${expr}` };
  }

  return null;
}

function extractVisExpr(input: string): string | null {
  const match = input.match(/(?:plot|show|graph|visualize|render)\s+(.+?)(?:\s+with|\s+using|\s+in|\s*$)/i);
  if (match) {
    let expr = match[1].trim().replace(/[?.,;!]+$/, '');
    expr = expr.replace(/\b(function|expression|equation)\s+/i, '');
    if (expr.length > 2 && /[a-zA-Z]/.test(expr)) return expr;
  }
  return null;
}

// ── Expression Compilers ───────────────────────────────────────────

function compileExpr(expression: string): (x: number) => number {
  const sanitized = expression
    .replace(/(\d)([a-zA-Z])/g, '$1*$2')
    .replace(/\bsin\b/g, 'Math.sin').replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan').replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs').replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log10').replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI)).replace(/\^/g, '**');
  try {
    const fn = new Function('x', `return (${sanitized})`);
    return (x: number) => { try { return fn(x); } catch { return NaN; } };
  } catch { return () => NaN; }
}

function compileSurfaceExpr(expression: string): (x: number, y: number) => number {
  const sanitized = expression
    .replace(/(\d)([a-zA-Z])/g, '$1*$2')
    .replace(/\bsin\b/g, 'Math.sin').replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan').replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs').replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log10').replace(/\bln\b/g, 'Math.log')
    .replace(/\bpi\b/g, String(Math.PI)).replace(/\^/g, '**');
  try {
    const fn = new Function('x', 'y', `return (${sanitized})`);
    return (x: number, y: number) => { try { return fn(x, y); } catch { return NaN; } };
  } catch { return () => NaN; }
}
