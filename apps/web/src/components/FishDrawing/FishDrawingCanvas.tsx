import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { cropDrawing } from '@aquarium/drawing';
import {
  FISH_TEMPLATES,
  getFishTemplateAssets,
  type FishTemplateId,
} from '../../lib/image-processing/fishTemplateRegistry';
import './FishDrawingCanvas.css';

import { Fish3DPreview } from '../Fish3D/Fish3DPreview';

export type FishCreation =
  | {
      type: 'drawn';
      image: string;
      size: number;
      headDirection?: 'left' | 'right';
    }
  | {
      type: '3d';
      model: 'classic' | 'angelfish' | 'guppy' | 'finny';
      bodyColor: string;
      finColor: string;
      paintImage?: string;
      size: number;
    };

type FishDrawingCanvasProps = {
  mode?: 'draw' | 'color-3d';
  onDone: (fish: FishCreation) => void;
  onCancel: () => void;
  remainingCapacity: number;
};

type Tool = 'brush' | 'eraser' | 'bucket';

const COLORS = [
  '#ff6b35',
  '#ffcc00',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#06b6d4',
  '#22c55e',
  '#111827',
];

const BRUSH_SIZES = [
  {
    label: 'Small',
    size: 7,
  },
  {
    label: 'Medium',
    size: 14,
  },
  {
    label: 'Large',
    size: 26,
  },
];

export function FishDrawingCanvas({
  mode = 'draw',
  onDone,
  onCancel,
  remainingCapacity,
}: FishDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const historyRef = useRef<ImageData[]>([]);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const outlineRef = useRef<HTMLCanvasElement | null>(null);
  const [templateId, setTemplateId] = useState<FishTemplateId | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [, setFillNotice] = useState<string | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);

  const [color, setColor] = useState('#ff6b35');

  const [brushSize, setBrushSize] = useState(14);

  const [tool, setTool] = useState<Tool>('brush');

  const [canUndo, setCanUndo] = useState(false);

  const [bodyColor, setBodyColor] = useState('#ff8a3d');

  const [finColor, setFinColor] = useState('#ffb347');

  const [paintImage, setPaintImage] = useState<string | null>(null);

  type FishSpecies = 'basic' | 'angelfish' | 'guppy' | 'finny';

  const [fishSpecies, setFishSpecies] = useState<FishSpecies>('basic');

  const [fishSize, setFishSize] = useState(1);

  const [headDirection, setHeadDirection] = useState<'left' | 'right'>('right');

  const fishSizeLabel =
    fishSize < 0.75
      ? 'Tiny'
      : fishSize < 0.95
        ? 'Small'
        : fishSize < 1.1
          ? 'Medium'
          : fishSize < 1.3
            ? 'Large'
            : 'Huge';

  const fishCapacityCost = fishSize * fishSize;

  const hasCapacity = fishCapacityCost <= remainingCapacity + 0.0001;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  // Each template is fitted into the same 600 × 400 editor coordinates.
  // Its grayscale mask is converted to alpha; its black printed lines become
  // a separate transparent overlay, so paint never obscures the details.
  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setCanUndo(false);
    maskRef.current = null;
    outlineRef.current = null;
    setTemplateError(null);
    setFillNotice(null);
    if (!templateId) {
      setTemplateLoading(false);
      setTool((current) => (current === 'bucket' ? 'brush' : current));
      return;
    }

    let cancelled = false;
    setTemplateLoading(true);
    const { mask, reference } = getFishTemplateAssets(templateId);
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Unable to load fish template assets.'));
        img.src = src;
      });
    void Promise.all([load(mask), load(reference)])
      .then(([shape, lines]) => {
        if (cancelled) return;
        const bounds = Math.min(
          (canvas.width * 0.85) / shape.width,
          (canvas.height * 0.88) / shape.height,
        );
        const w = shape.width * bounds;
        const h = shape.height * bounds;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        const makeCanvas = () => {
          const off = document.createElement('canvas');
          off.width = canvas.width;
          off.height = canvas.height;
          return off;
        };
        const maskCanvas = makeCanvas();
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
        maskCtx.drawImage(shape, x, y, w, h);
        const maskPixels = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < maskPixels.data.length; i += 4) {
          const luminance = maskPixels.data[i];
          maskPixels.data[i] = 255;
          maskPixels.data[i + 1] = 255;
          maskPixels.data[i + 2] = 255;
          maskPixels.data[i + 3] = luminance;
        }
        maskCtx.putImageData(maskPixels, 0, 0);

        const outlineCanvas = makeCanvas();
        const outlineCtx = outlineCanvas.getContext('2d', { willReadFrequently: true })!;
        outlineCtx.drawImage(lines, x, y, w, h);
        const outlinePixels = outlineCtx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < outlinePixels.data.length; i += 4) {
          const lightness =
            (outlinePixels.data[i] + outlinePixels.data[i + 1] + outlinePixels.data[i + 2]) / 3;
          outlinePixels.data[i] = 25;
          outlinePixels.data[i + 1] = 40;
          outlinePixels.data[i + 2] = 52;
          outlinePixels.data[i + 3] = Math.round(Math.max(0, (220 - lightness) / 170) * 255);
        }
        outlineCtx.putImageData(outlinePixels, 0, 0);
        outlineCtx.globalCompositeOperation = 'destination-in';
        outlineCtx.drawImage(maskCanvas, 0, 0);
        outlineCtx.globalCompositeOperation = 'source-over';
        maskRef.current = maskCanvas;
        outlineRef.current = outlineCanvas;
        setTemplateLoading(false);
        // Paint layer is kept independent; the reference is displayed as a CSS
        // overlay and only merged when exporting.
        const preview = outlineCanvas.toDataURL('image/png');
        setOutlinePreview(preview);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTemplateError(error instanceof Error ? error.message : 'Template failed to load.');
          setTemplateLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, templateId]);

  const [outlinePreview, setOutlinePreview] = useState<string | null>(null);

  const constrainPaint = () => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask || !templateId) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.restore();
  };

  const getPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;

    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),

      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  /**
   * Save the canvas before a stroke.
   * Undo restores this snapshot.
   */
  const saveHistory = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const snapshot = context.getImageData(0, 0, canvas.width, canvas.height);

    historyRef.current.push(snapshot);

    /**
     * Prevent unlimited memory growth.
     */
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }

    setCanUndo(true);
  };

  // Flood-fill the region enclosed by the printed template lines. The line
  // overlay is not part of the paint layer, so it must act as a barrier here.
  const fillRegion = (x: number, y: number): boolean => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    const outline = outlineRef.current;
    if (!canvas || !mask || !outline || !templateId) return false;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const maskCtx = mask.getContext('2d', { willReadFrequently: true });
    const lineCtx = outline.getContext('2d', { willReadFrequently: true });
    if (!ctx || !maskCtx || !lineCtx) return false;
    const w = canvas.width,
      h = canvas.height;
    const sx = Math.floor(x),
      sy = Math.floor(y);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;
    const paint = ctx.getImageData(0, 0, w, h);
    const maskData = maskCtx.getImageData(0, 0, w, h).data;
    const lines = lineCtx.getImageData(0, 0, w, h).data;
    const total = w * h;
    const blocked = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      // Allow antialiased edges but stop at dark printed lines.
      blocked[i] = maskData[i * 4 + 3] < 128 || lines[i * 4 + 3] > 95 ? 1 : 0;
    }
    // Printed templates use DASHED lines, with gaps much wider than one pixel.
    // Morphological closing joins nearby dashes without making every stroke
    // permanently thick. Work on the outline alone (not the exterior mask).
    const lineBarrier = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      lineBarrier[i] = lines[i * 4 + 3] > 65 ? 1 : 0;
    }
    const radius = 7; // 15px closing kernel at the 600x400 editor resolution
    const dilated = new Uint8Array(total);
    // Separable square dilation: horizontal then vertical.
    const horizontal = new Uint8Array(total);
    for (let yy = 0; yy < h; yy++) {
      const base = yy * w;
      for (let xx = 0; xx < w; xx++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = xx + dx;
          if (nx >= 0 && nx < w && lineBarrier[base + nx]) {
            horizontal[base + xx] = 1;
            break;
          }
        }
      }
    }
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = yy + dy;
          if (ny >= 0 && ny < h && horizontal[ny * w + xx]) {
            dilated[yy * w + xx] = 1;
            break;
          }
        }
      }
    }
    // Erode back to a narrow line after connecting dashes. Ignore pixels
    // outside the image to avoid introducing a false frame.
    const erodedHorizontal = new Uint8Array(total);
    for (let yy = 0; yy < h; yy++) {
      const base = yy * w;
      for (let xx = 0; xx < w; xx++) {
        let solid = true;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = xx + dx;
          if (nx >= 0 && nx < w && !dilated[base + nx]) {
            solid = false;
            break;
          }
        }
        erodedHorizontal[base + xx] = solid ? 1 : 0;
      }
    }
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        let solid = true;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = yy + dy;
          if (ny >= 0 && ny < h && !erodedHorizontal[ny * w + xx]) {
            solid = false;
            break;
          }
        }
        if (solid) blocked[yy * w + xx] = 1;
      }
    }
    const expanded = blocked;
    // Taps often land directly on an antialiased outline. Find a nearby
    // paintable pixel instead of silently ignoring the tap.
    let start = sy * w + sx;
    if (expanded[start]) {
      let found = -1;
      for (let r = 1; r <= 12 && found < 0; r++) {
        for (let dy = -r; dy <= r && found < 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = sx + dx,
              ny = sy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const candidate = ny * w + nx;
            if (!expanded[candidate]) {
              found = candidate;
              break;
            }
          }
        }
      }
      if (found < 0) {
        setFillNotice('Tap inside a fish section, away from its outline.');
        return false;
      }
      start = found;
    }
    const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
    const source = start * 4;
    const target = paint.data.slice(source, source + 4);
    const same = (i: number) => {
      const j = i * 4;
      return (
        Math.abs(paint.data[j] - target[0]) <= 12 &&
        Math.abs(paint.data[j + 1] - target[1]) <= 12 &&
        Math.abs(paint.data[j + 2] - target[2]) <= 12 &&
        Math.abs(paint.data[j + 3] - target[3]) <= 12
      );
    };
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0,
      tail = 1;
    queue[0] = start;
    visited[start] = 1;
    const region: number[] = [];
    while (head < tail) {
      const i = queue[head++];
      if (expanded[i] || !same(i)) continue;
      region.push(i);
      const px = i % w;
      const neighbors = [
        px > 0 ? i - 1 : -1,
        px < w - 1 ? i + 1 : -1,
        i >= w ? i - w : -1,
        i < total - w ? i + w : -1,
      ];
      for (const next of neighbors) {
        if (next >= 0 && !visited[next] && !expanded[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (!region.length) return false;
    // Never paint almost the entire silhouette when an open/dashed boundary
    // leaks. Better to do nothing than destroy the child's existing colors.
    let fishPixels = 0;
    for (let i = 0; i < total; i++) {
      if (maskData[i * 4 + 3] >= 128) fishPixels++;
    }
    if (region.length > fishPixels * 0.48) {
      setFillNotice('This template section is not closed. Try another section or use Brush.');
      return false;
    }
    setFillNotice(null);
    // No history entry for no-op fills.
    if (target[3] === 255 && rgb.every((v, i) => Math.abs(v - target[i]) <= 12)) return false;
    saveHistory();
    for (const i of region) {
      const j = i * 4;
      paint.data[j] = rgb[0];
      paint.data[j + 1] = rgb[1];
      paint.data[j + 2] = rgb[2];
      paint.data[j + 3] = 255;
    }
    ctx.putImageData(paint, 0, 0);
    constrainPaint();
    return true;
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const position = getPosition(event);
    if (tool === 'bucket') {
      fillRegion(position.x, position.y);
      return;
    }

    saveHistory();
    canvas.setPointerCapture(event.pointerId);

    context.beginPath();

    context.moveTo(position.x, position.y);

    /**
     * Draw a small dot immediately.
     *
     * This means a simple tap creates
     * something instead of requiring
     * pointer movement.
     */
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    context.strokeStyle = color;

    context.fillStyle = color;

    context.lineWidth = brushSize;

    context.beginPath();

    context.arc(position.x, position.y, brushSize / 2, 0, Math.PI * 2);

    context.fill();
    constrainPaint();

    context.beginPath();

    context.moveTo(position.x, position.y);

    setIsDrawing(true);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const position = getPosition(event);

    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    context.strokeStyle = color;

    context.lineWidth = brushSize;

    context.lineTo(position.x, position.y);

    context.stroke();
    constrainPaint();
  };

  const stopDrawing = (event?: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (canvas && event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    constrainPaint();
    setIsDrawing(false);
  };

  const selectColor = (nextColor: string) => {
    setColor(nextColor);

    /**
     * Choosing a color automatically
     * switches back to the brush.
     */
    // Selecting a new color must not unexpectedly deactivate Paint Bucket.
    setTool((current) => (current === 'bucket' ? 'bucket' : 'brush'));
  };

  const undo = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const previous = historyRef.current.pop();

    if (!previous) {
      return;
    }

    context.putImageData(previous, 0, 0);

    setCanUndo(historyRef.current.length > 0);
  };

  const clear = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    /**
     * Clear is undoable too.
     */
    saveHistory();

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const finish = () => {
    if (!hasCapacity) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    /**
     * Reset compositing before export.
     */
    const context = canvas.getContext('2d');

    if (context) {
      context.globalCompositeOperation = 'source-over';
    }

    let exportCanvas = canvas;
    if (templateId) {
      const mask = maskRef.current;
      const outline = outlineRef.current;
      if (!mask || !outline || templateLoading) return;
      const combined = document.createElement('canvas');
      combined.width = canvas.width;
      combined.height = canvas.height;
      const combinedCtx = combined.getContext('2d');
      if (!combinedCtx) return;
      // White base for uncolored regions and eyes; transparent outside the fish.
      combinedCtx.drawImage(mask, 0, 0);
      combinedCtx.drawImage(canvas, 0, 0);
      combinedCtx.drawImage(outline, 0, 0);
      exportCanvas = combined;
    }
    const image = cropDrawing(exportCanvas, {
      padding: 16,
    });

    if (!image) {
      return;
    }

    onDone({
      type: 'drawn',
      image,
      size: fishSize,
      headDirection,
    });
  };

  const finish3D = () => {
    if (!hasCapacity) {
      return;
    }

    onDone({
      type: '3d',
      model: fishSpecies === 'basic' ? 'classic' : fishSpecies,
      bodyColor,
      finColor,
      size: fishSize,
      ...(paintImage
        ? {
            paintImage,
          }
        : {}),
    });
  };

  const palette = (value: string, choose: (color: string) => void) => (
    <div className="fish-editor__palette">
      {COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          className={`fish-editor__swatch ${value === swatch ? 'is-selected' : ''}`}
          style={{ backgroundColor: swatch }}
          onClick={() => choose(swatch)}
          aria-label={`Choose ${swatch}`}
          aria-pressed={value === swatch}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(event) => choose(event.target.value)}
        aria-label="Custom color"
        className="fish-editor__color-input"
      />
    </div>
  );

  return (
    <div className="fish-editor">
      <div className="fish-editor__workspace">
        <section
          className="fish-editor__stage"
          aria-label={mode === 'draw' ? 'Fish drawing canvas' : '3D fish preview'}
        >
          {mode === 'draw' ? (
            <div className="fish-editor__canvas-wrap">
              {templateId && outlinePreview && !templateLoading && (
                <img
                  className="fish-editor__template-outline"
                  src={outlinePreview}
                  alt=""
                  aria-hidden="true"
                />
              )}
              {!templateId && (
                <div className="fish-editor__guide" aria-hidden="true">
                  <svg viewBox="0 0 600 320" width="100%" height="100%">
                    <path
                      d="M155 160 C110 130 72 96 38 72 C48 116 50 140 50 160 C50 180 48 204 38 248 C72 224 110 190 155 160 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                    />
                    <path
                      d="M145 160 C190 78 300 60 405 86 C485 106 540 132 555 160 C540 188 485 214 405 234 C300 260 190 242 145 160 Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeDasharray="11 9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M280 82 C305 42 345 35 375 76 M295 239 C320 276 355 278 380 230"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeDasharray="9 8"
                      strokeLinecap="round"
                    />
                    <circle cx="475" cy="137" r="10" fill="currentColor" />
                    <path
                      d="M510 170 Q525 180 538 168"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="fish-editor__canvas"
                style={{
                  cursor: tool === 'bucket' ? 'pointer' : tool === 'eraser' ? 'cell' : 'crosshair',
                }}
              />
            </div>
          ) : (
            <div className="fish-editor__3d-stage">
              <Fish3DPreview
                key={fishSpecies}
                species={fishSpecies === 'basic' ? 'classic' : fishSpecies}
                bodyColor={bodyColor}
                finColor={finColor}
                size={fishSize}
                height={540}
                onPaintChange={setPaintImage}
              />
            </div>
          )}
        </section>

        <aside className="fish-editor__sidebar" aria-label="Fish editing tools">
          {mode === 'color-3d' ? (
            <>
              <div className="fish-editor__section">
                <h2>Species</h2>
                <div className="fish-editor__segmented">
                  {(['basic', 'angelfish', 'guppy', 'finny'] as const).map((species) => (
                    <button
                      type="button"
                      key={species}
                      className={fishSpecies === species ? 'is-active' : ''}
                      onClick={() => {
                        setFishSpecies(species);
                        setPaintImage(null);
                      }}
                      aria-pressed={fishSpecies === species}
                    >
                      {species === 'basic'
                        ? 'Classic'
                        : species === 'angelfish'
                          ? 'Angelfish'
                          : species === 'guppy'
                            ? 'Guppy'
                            : 'Finny'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fish-editor__section">
                <h2>Body Color</h2>
                {palette(bodyColor, setBodyColor)}
              </div>
              <div className="fish-editor__section">
                <h2>Fins &amp; Tail</h2>
                {palette(finColor, setFinColor)}
              </div>
              <p className="fish-editor__hint">
                Use the Paint / Rotate controls over the fish to paint directly on the model.
              </p>
            </>
          ) : (
            <>
              <div className="fish-editor__section">
                <h2>Draw Mode</h2>
                <div className="fish-editor__segmented">
                  <button
                    type="button"
                    className={!templateId ? 'is-active' : ''}
                    onClick={() => {
                      setTemplateId(null);
                      setOutlinePreview(null);
                    }}
                  >
                    Free Draw
                  </button>
                  <button
                    type="button"
                    className={templateId ? 'is-active' : ''}
                    onClick={() => {
                      setTemplateId('goldfish');
                      setOutlinePreview(null);
                    }}
                  >
                    Fish Template
                  </button>
                </div>
                {templateId && (
                  <div
                    className="fish-editor__template-grid"
                    role="group"
                    aria-label="Choose fish template"
                  >
                    {FISH_TEMPLATES.map((fish) => (
                      <button
                        type="button"
                        key={fish.id}
                        className={templateId === fish.id ? 'is-active' : ''}
                        aria-pressed={templateId === fish.id}
                        onClick={() => {
                          setTemplateId(fish.id);
                          setOutlinePreview(null);
                        }}
                      >
                        <img src={getFishTemplateAssets(fish.id).reference} alt="" />
                        <span>{fish.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {templateLoading && <p className="fish-editor__hint">Loading template…</p>}
                {templateError && (
                  <p role="alert" className="fish-editor__hint">
                    {templateError}
                  </p>
                )}
                {templateId && (
                  <p className="fish-editor__hint">
                    Choose Fill, then tap a body or fin section to color it instantly. Switching
                    templates starts a fresh drawing.
                  </p>
                )}
              </div>
              <div className="fish-editor__section">
                <h2>Colors</h2>
                {palette(color, selectColor)}
              </div>
              <div className="fish-editor__section">
                <h2>Brush Size</h2>
                <div className="fish-editor__segmented">
                  {BRUSH_SIZES.map((brush) => (
                    <button
                      type="button"
                      key={brush.size}
                      className={tool === 'brush' && brushSize === brush.size ? 'is-active' : ''}
                      onClick={() => {
                        setBrushSize(brush.size);
                        setTool('brush');
                      }}
                    >
                      {brush.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fish-editor__section">
                <h2>Tools</h2>
                <div className="fish-editor__tool-grid">
                  <button
                    type="button"
                    className={tool === 'bucket' ? 'is-active' : ''}
                    onClick={() => setTool('bucket')}
                    disabled={!templateId || templateLoading || !!templateError}
                    title={
                      templateId
                        ? 'Tap an enclosed section to fill it'
                        : 'Choose a fish template to use Fill'
                    }
                  >
                    🪣 Fill
                  </button>
                  <button
                    type="button"
                    className={tool === 'eraser' ? 'is-active' : ''}
                    onClick={() => setTool('eraser')}
                  >
                    Eraser
                  </button>
                  <button type="button" onClick={undo} disabled={!canUndo}>
                    Undo
                  </button>
                  <button type="button" onClick={clear}>
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === 'draw' && (
            <div className="fish-editor__section">
              <h2>Which way is your fish looking?</h2>
              <div className="fish-editor__segmented" role="group" aria-label="Fish head direction">
                <button
                  type="button"
                  className={headDirection === 'left' ? 'is-active' : ''}
                  aria-pressed={headDirection === 'left'}
                  onClick={() => setHeadDirection('left')}
                >
                  ← Left
                </button>
                <button
                  type="button"
                  className={headDirection === 'right' ? 'is-active' : ''}
                  aria-pressed={headDirection === 'right'}
                  onClick={() => setHeadDirection('right')}
                >
                  Right →
                </button>
              </div>
            </div>
          )}

          <div className="fish-editor__section fish-editor__capacity">
            <div className="fish-editor__size-header">
              <h2>Fish Size</h2>
              <span>{fishSizeLabel}</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={fishSize}
              onChange={(event) => setFishSize(Number(event.target.value))}
              aria-label="Fish size"
            />
            <div className="fish-editor__range-labels">
              <span>Small</span>
              <span>Big</span>
            </div>
            <p className={hasCapacity ? 'fish-editor__capacity-ok' : 'fish-editor__capacity-full'}>
              {hasCapacity
                ? `${remainingCapacity.toFixed(1)} space left · this fish uses ${fishCapacityCost.toFixed(1)}`
                : 'Not enough aquarium space. Choose a smaller fish.'}
            </p>
          </div>
          <div className="fish-editor__actions">
            <button type="button" className="fish-editor__cancel" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="fish-editor__save"
              onClick={mode === 'draw' ? finish : finish3D}
              disabled={
                !hasCapacity ||
                (mode === 'draw' && !!templateId && (templateLoading || !!templateError))
              }
            >
              {!hasCapacity ? 'Aquarium Full' : 'Save Fish'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
