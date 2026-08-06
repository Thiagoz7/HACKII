import type { Viewport, FunctionPlot, GraphConfig, Point2D } from '../types/graph';
import { worldToScreen, sampleFunction, samplePolarFunction, getNiceGridStep } from './coordinate-systems';
import { compileExpression, compilePolarExpression } from './function-parser';

export class GraphRenderer {
  private viewport: Viewport;
  private config: GraphConfig;
  private plots: FunctionPlot[] = [];
  private dpr: number;

  constructor(viewport: Viewport, config: GraphConfig) {
    this.viewport = { ...viewport };
    this.config = { ...config };
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  setViewport(viewport: Partial<Viewport>): void {
    Object.assign(this.viewport, viewport);
  }

  getViewport(): Viewport {
    return { ...this.viewport };
  }

  setConfig(config: Partial<GraphConfig>): void {
    Object.assign(this.config, config);
  }

  setPlots(plots: FunctionPlot[]): void {
    this.plots = plots;
  }

  /**
   * Main render entry point. Clears and redraws everything.
   */
  render(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = this.viewport;

    // Handle high-DPI
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    if (this.config.showGrid) {
      this.drawGrid(ctx);
    }

    // Draw axes
    if (this.config.showAxes) {
      this.drawAxes(ctx);
    }

    // Draw plots
    for (const plot of this.plots) {
      if (plot.visible) {
        this.drawPlot(ctx, plot);
      }
    }

    // Draw labels
    if (this.config.showLabels) {
      this.drawLabels(ctx);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { scale } = this.viewport;
    const targetPixels = 80; // target pixels between major grid lines
    const majorStep = getNiceGridStep(targetPixels / scale);

    // Minor grid
    if (this.config.showMinorGrid) {
      const minorStep = majorStep / 5;
      this.drawGridLines(ctx, minorStep, 0.5, 'rgba(255,255,255,0.06)');
    }

    // Major grid
    this.drawGridLines(ctx, majorStep, 1, 'rgba(255,255,255,0.12)');
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    step: number,
    lineWidth: number,
    color: string
  ): void {
    const { width, height, centerX, centerY, scale } = this.viewport;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    // Vertical lines
    const [wMinX] = (() => {
      const sx = 0;
      const wx = centerX + (sx - width / 2) / scale;
      return [wx];
    })();
    const [wMaxX] = (() => {
      const sx = width;
      const wx = centerX + (sx - width / 2) / scale;
      return [wx];
    })();

    const startX = Math.floor(wMinX / step) * step;
    for (let wx = startX; wx <= wMaxX; wx += step) {
      const [sx] = worldToScreen(wx, 0, this.viewport);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }

    // Horizontal lines
    const wMinY = (() => {
      const wy = centerY - (height - height / 2) / scale;
      return wy;
    })();
    const wMaxY = (() => {
      const wy = centerY - (0 - height / 2) / scale;
      return wy;
    })();

    const startY = Math.floor(wMinY / step) * step;
    for (let wy = startY; wy <= wMaxY; wy += step) {
      const [_, sy] = worldToScreen(0, wy, this.viewport);
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }

    ctx.stroke();
  }

  private drawAxes(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.viewport;
    const [originX, originY] = worldToScreen(0, 0, this.viewport);

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    // X-axis
    if (originY >= 0 && originY <= height) {
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
    }

    // Y-axis
    if (originX >= 0 && originX <= width) {
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
    }

    ctx.stroke();
  }

  private drawPlot(ctx: CanvasRenderingContext2D, plot: FunctionPlot): void {
    let points: Point2D[];

    if (plot.coordinateSystem === 'polar') {
      const fn = compilePolarExpression(plot.expression);
      if (!fn) return;
      points = samplePolarFunction(fn, this.viewport);
    } else {
      const fn = compileExpression(plot.expression);
      if (!fn) return;
      points = sampleFunction(fn, this.viewport, 2);
    }

    if (points.length === 0) return;

    ctx.strokeStyle = plot.color;
    ctx.lineWidth = plot.lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let firstPoint = true;
    for (const point of points) {
      if (!isFinite(point.x) || !isFinite(point.y)) {
        // Break in the graph (discontinuity)
        ctx.stroke();
        ctx.beginPath();
        firstPoint = true;
        continue;
      }

      const [sx, sy] = worldToScreen(point.x, point.y, this.viewport);

      // Skip points that are way off screen
      if (sx < -2000 || sx > this.viewport.width + 2000 ||
          sy < -2000 || sy > this.viewport.height + 2000) {
        firstPoint = true;
        continue;
      }

      if (firstPoint) {
        ctx.moveTo(sx, sy);
        firstPoint = false;
      } else {
        ctx.lineTo(sx, sy);
      }
    }

    ctx.stroke();
  }

  private drawLabels(ctx: CanvasRenderingContext2D): void {
    const { width, height, scale } = this.viewport;
    const [originX, originY] = worldToScreen(0, 0, this.viewport);

    const targetPixels = 80;
    const majorStep = getNiceGridStep(targetPixels / scale);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X-axis labels
    const [wMinX] = (() => {
      const wx = this.viewport.centerX + (0 - width / 2) / scale;
      return [wx];
    })();
    const [wMaxX] = (() => {
      const wx = this.viewport.centerX + (width - width / 2) / scale;
      return [wx];
    })();

    const startX = Math.floor(wMinX / majorStep) * majorStep;
    const labelY = originY >= 0 && originY <= height ? originY + 6 : height - 16;

    for (let wx = startX; wx <= wMaxX; wx += majorStep) {
      if (Math.abs(wx) < majorStep * 0.01) continue; // skip near-zero
      const [sx] = worldToScreen(wx, 0, this.viewport);
      if (sx < 20 || sx > width - 20) continue;

      const label = formatNumber(wx);
      ctx.fillText(label, sx, labelY);
    }

    // Y-axis labels
    const wMinY = (() => {
      const wy = this.viewport.centerY - (height - height / 2) / scale;
      return wy;
    })();
    const wMaxY = (() => {
      const wy = this.viewport.centerY - (0 - height / 2) / scale;
      return wy;
    })();

    const startY = Math.floor(wMinY / majorStep) * majorStep;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let wy = startY; wy <= wMaxY; wy += majorStep) {
      if (Math.abs(wy) < majorStep * 0.01) continue;
      const [_, sy] = worldToScreen(0, wy, this.viewport);
      if (sy < 12 || sy > height - 12) continue;

      const labelX = originX >= 0 && originX <= width ? originX - 8 : 16;
      const label = formatNumber(wy);
      ctx.fillText(label, labelX, sy);
    }

    // Origin label
    if (
      originX >= 0 && originX <= width &&
      originY >= 0 && originY <= height
    ) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('0', originX - 8, originY + 6);
    }
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  const abs = Math.abs(n);
  if (abs < 0.0001 || abs >= 10000) {
    return n.toExponential(1);
  }
  // Show enough decimals to be meaningful
  const decimals = Math.max(0, -Math.floor(Math.log10(abs)) + 1);
  const str = n.toFixed(Math.min(decimals, 4));
  // Remove trailing zeros
  if (str.includes('.')) {
    return str.replace(/\.?0+$/, '');
  }
  return str;
}