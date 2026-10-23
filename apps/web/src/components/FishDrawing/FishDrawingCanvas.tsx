import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { cropDrawing } from '@aquarium/drawing';
import { FISH_TEMPLATES, getFishTemplateAssets, type FishTemplateId } from '../../lib/image-processing/fishTemplateRegistry';
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

type Tool = 'brush' | 'eraser';

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
    if (!templateId) { setTemplateLoading(false); return; }

    let cancelled = false;
    setTemplateLoading(true);
    const { mask, reference } = getFishTemplateAssets(templateId);
    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load fish template assets.'));
      img.src = src;
    });
    void Promise.all([load(mask), load(reference)]).then(([shape, lines]) => {
      if (cancelled) return;
      const bounds = Math.min(canvas.width * 0.85 / shape.width, canvas.height * 0.88 / shape.height);
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
        const lightness = (outlinePixels.data[i] + outlinePixels.data[i + 1] + outlinePixels.data[i + 2]) / 3;
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
    }).catch((error: unknown) => {
      if (!cancelled) {
        setTemplateError(error instanceof Error ? error.message : 'Template failed to load.');
        setTemplateLoading(false);
      }
    });
    return () => { cancelled = true; };
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

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    saveHistory();

    const position = getPosition(event);

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
    setTool('brush');
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
      // All built-in fish templates have their heads on the left.
      headDirection: templateId ? 'left' : headDirection,
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
                <img className="fish-editor__template-outline" src={outlinePreview} alt="" aria-hidden="true" />
              )}
              {!templateId && <div className="fish-editor__guide" aria-hidden="true">
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
              </div>}
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="fish-editor__canvas"
                style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
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
                  <button type="button" className={!templateId ? 'is-active' : ''} onClick={() => { setTemplateId(null); setOutlinePreview(null); }}>Free Draw</button>
                  <button type="button" className={templateId ? 'is-active' : ''} onClick={() => { setTemplateId('goldfish'); setOutlinePreview(null); }}>Fish Template</button>
                </div>
                {templateId && (
                  <div className="fish-editor__template-grid" role="group" aria-label="Choose fish template">
                    {FISH_TEMPLATES.map((fish) => (
                      <button type="button" key={fish.id} className={templateId === fish.id ? 'is-active' : ''} aria-pressed={templateId === fish.id} onClick={() => { setTemplateId(fish.id); setOutlinePreview(null); }}>
                        <img src={getFishTemplateAssets(fish.id).reference} alt="" />
                        <span>{fish.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {templateLoading && <p className="fish-editor__hint">Loading template…</p>}
                {templateError && <p role="alert" className="fish-editor__hint">{templateError}</p>}
                {templateId && <p className="fish-editor__hint">Color inside the fish. Switching templates starts a fresh drawing.</p>}
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

          {mode === 'draw' && !templateId && (
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
              disabled={!hasCapacity || (mode === 'draw' && !!templateId && (templateLoading || !!templateError))}
            >
              {!hasCapacity ? 'Aquarium Full' : 'Save Fish'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
