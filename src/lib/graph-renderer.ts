import type { Viewport, FunctionPlot, GraphConfig, Point2D } from '../types/graph';
import { worldToScreen, sampleFunction, samplePolarFunction, getNiceGridStep } from './coordinate-systems';
import { compileExpression, compilePolarExpression } from './function-parser';
import type { MechanicalPart } from './mechanical-parts';

export class GraphRenderer {
  private viewport: Viewport;
  private config: GraphConfig;
  private plots: FunctionPlot[] = [];
  private mechanicalParts: MechanicalPart[] = [];
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

  setMechanicalParts(parts: MechanicalPart[]): void {
    this.mechanicalParts = parts;
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

    // Draw mechanical parts
    for (const part of this.mechanicalParts) {
      this.drawMechanicalPart(ctx, part);
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

    // Main axes — bold and prominent
    ctx.strokeStyle = 'rgba(180,180,180,0.7)';
    ctx.lineWidth = 2;
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

    // Axis labels at edges
    ctx.font = 'bold 13px "JetBrains Mono", monospace';

    // X label
    if (originY >= 0 && originY <= height) {
      ctx.fillStyle = 'rgba(200,80,80,0.8)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('x', width - 6, originY - 6);
    }

    // Y label
    if (originX >= 0 && originX <= width) {
      ctx.fillStyle = 'rgba(80,200,80,0.8)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', originX + 6, 6);
    }

    // Tick marks on axes
    const tickSize = 4;
    ctx.strokeStyle = 'rgba(180,180,180,0.5)';
    ctx.lineWidth = 1;
    const targetPx = 80;
    const majorStep = getNiceGridStep(targetPx / this.viewport.scale);

    // X-axis ticks
    if (originY >= 0 && originY <= height) {
      const xMin = this.viewport.centerX - width / (2 * this.viewport.scale);
      const xMax = this.viewport.centerX + width / (2 * this.viewport.scale);
      const startX = Math.floor(xMin / majorStep) * majorStep;
      ctx.beginPath();
      for (let wx = startX; wx <= xMax; wx += majorStep) {
        if (Math.abs(wx) < majorStep * 0.01) continue;
        const [sx] = worldToScreen(wx, 0, this.viewport);
        ctx.moveTo(sx, originY - tickSize);
        ctx.lineTo(sx, originY + tickSize);
      }
      ctx.stroke();
    }

    // Y-axis ticks
    if (originX >= 0 && originX <= width) {
      const yMin = this.viewport.centerY - height / (2 * this.viewport.scale);
      const yMax = this.viewport.centerY + height / (2 * this.viewport.scale);
      const startY = Math.floor(yMin / majorStep) * majorStep;
      ctx.beginPath();
      for (let wy = startY; wy <= yMax; wy += majorStep) {
        if (Math.abs(wy) < majorStep * 0.01) continue;
        const [_, sy] = worldToScreen(0, wy, this.viewport);
        ctx.moveTo(originX - tickSize, sy);
        ctx.lineTo(originX + tickSize, sy);
      }
      ctx.stroke();
    }
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

  private drawMechanicalPart(ctx: CanvasRenderingContext2D, part: MechanicalPart): void {
    const colors = ['#00E5FF', '#76FF03', '#FF6D00', '#D500F9', '#FFEA00', '#FF1744'];
    const colorIdx = this.mechanicalParts.indexOf(part) % colors.length;
    const color = colors[colorIdx];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;

    for (const path of part.paths) {
      if (path.length < 2) continue;

      ctx.beginPath();
      let started = false;

      for (const point of path) {
        const [sx, sy] = worldToScreen(point.x, point.y, this.viewport);

        // Skip far off-screen points
        if (sx < -5000 || sx > this.viewport.width + 5000 ||
            sy < -5000 || sy > this.viewport.height + 5000) {
          started = false;
          continue;
        }

        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      }

      ctx.stroke();
    }

    // Draw label at the center of the part
    const [labelX, labelY] = worldToScreen(part.centerX, part.centerY, this.viewport);
    if (labelX >= 0 && labelX <= this.viewport.width && labelY >= 0 && labelY <= this.viewport.height) {
      ctx.fillStyle = color;
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(part.label, labelX, labelY - 12);
    }
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