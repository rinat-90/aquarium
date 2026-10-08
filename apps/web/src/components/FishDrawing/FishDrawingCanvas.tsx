import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import { cropDrawing } from '@aquarium/drawing';

import {
  Fish3DPreview
} from '../Fish3D/Fish3DPreview';

export type FishCreation =
  | {
  type: 'drawn';
  image: string;
  size: number;
}
  | {
  type: '3d';
  model: 'classic' | 'angelfish';
  bodyColor: string;
  finColor: string;
  paintImage?: string;
  size: number;
};

type FishDrawingCanvasProps = {
  onDone: (
    fish: FishCreation,
  ) => void;
  onCancel: () => void;
  remainingCapacity: number;
};

type Tool = 'brush' | 'eraser';

type CreatorTab = 'draw' | 'color-3d';

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
                                    onDone,
                                    onCancel,
                                    remainingCapacity,
                                  }: FishDrawingCanvasProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const historyRef =
    useRef<ImageData[]>([]);

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [color, setColor] =
    useState('#ff6b35');

  const [brushSize, setBrushSize] =
    useState(14);

  const [tool, setTool] =
    useState<Tool>('brush');

  const [canUndo, setCanUndo] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<CreatorTab>('draw');

  const [bodyColor, setBodyColor] =
    useState('#ff8a3d');

  const [finColor, setFinColor] =
    useState('#ffb347');

  const [
    paintImage,
    setPaintImage,
  ] = useState<string | null>(
    null,
  );

  type FishSpecies = 'basic' | 'angelfish';

  const [fishSpecies, setFishSpecies] =
    useState<FishSpecies>('basic');

  const [
    fishSize,
    setFishSize,
  ] = useState(1);

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

  const fishCapacityCost =
    fishSize * fishSize;

  const hasCapacity =
    fishCapacityCost <=
    remainingCapacity + 0.0001;

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  const getPosition = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas =
      canvasRef.current!;

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX -
          rect.left) *
        (canvas.width /
          rect.width),

      y:
        (event.clientY -
          rect.top) *
        (canvas.height /
          rect.height),
    };
  };

  /**
   * Save the canvas before a stroke.
   * Undo restores this snapshot.
   */
  const saveHistory = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    const snapshot =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );

    historyRef.current.push(
      snapshot,
    );

    /**
     * Prevent unlimited memory growth.
     */
    if (
      historyRef.current.length >
      30
    ) {
      historyRef.current.shift();
    }

    setCanUndo(true);
  };

  const startDrawing = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    saveHistory();

    const position =
      getPosition(event);

    canvas.setPointerCapture(
      event.pointerId,
    );

    context.beginPath();

    context.moveTo(
      position.x,
      position.y,
    );

    /**
     * Draw a small dot immediately.
     *
     * This means a simple tap creates
     * something instead of requiring
     * pointer movement.
     */
    context.globalCompositeOperation =
      tool === 'eraser'
        ? 'destination-out'
        : 'source-over';

    context.strokeStyle =
      color;

    context.fillStyle =
      color;

    context.lineWidth =
      brushSize;

    context.beginPath();

    context.arc(
      position.x,
      position.y,
      brushSize / 2,
      0,
      Math.PI * 2,
    );

    context.fill();

    context.beginPath();

    context.moveTo(
      position.x,
      position.y,
    );

    setIsDrawing(true);
  };

  const draw = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing) {
      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    const position =
      getPosition(event);

    context.globalCompositeOperation =
      tool === 'eraser'
        ? 'destination-out'
        : 'source-over';

    context.strokeStyle =
      color;

    context.lineWidth =
      brushSize;

    context.lineTo(
      position.x,
      position.y,
    );

    context.stroke();
  };

  const stopDrawing = (
    event?: PointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas =
      canvasRef.current;

    if (
      canvas &&
      event &&
      canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      canvas.releasePointerCapture(
        event.pointerId,
      );
    }

    setIsDrawing(false);
  };

  const selectColor = (
    nextColor: string,
  ) => {
    setColor(nextColor);

    /**
     * Choosing a color automatically
     * switches back to the brush.
     */
    setTool('brush');
  };

  const undo = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    const previous =
      historyRef.current.pop();

    if (!previous) {
      return;
    }

    context.putImageData(
      previous,
      0,
      0,
    );

    setCanUndo(
      historyRef.current.length > 0,
    );
  };

  const clear = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const context =
      canvas.getContext('2d');

    if (!context) {
      return;
    }

    /**
     * Clear is undoable too.
     */
    saveHistory();

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  const finish = () => {
    if (!hasCapacity) {
      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    /**
     * Reset compositing before export.
     */
    const context =
      canvas.getContext('2d');

    if (context) {
      context.globalCompositeOperation =
        'source-over';
    }

    const image =
      cropDrawing(
        canvas,
        {
          padding: 16,
        },
      );

    if (!image) {
      return;
    }

    onDone({
      type: 'drawn',
      image,
      size: fishSize,
    });
  };

  const finish3D = () => {
    if (!hasCapacity) {
      return;
    }

    onDone({
      type: '3d',
      model: fishSpecies === 'angelfish' ? 'angelfish' : 'classic',
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

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>
              Create a Fish 🐟
            </h2>

            <div
              style={
                styles.subtitle
              }
            >
              Draw your own fish or color a 3D fish.
            </div>
          </div>

          <button
            onClick={onCancel}
            style={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() =>
              setActiveTab('draw')
            }
            style={{
              ...styles.tabButton,
              ...(activeTab === 'draw'
                ? styles.activeTabButton
                : {}),
            }}
          >
            ✏️ Draw
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('color-3d')
            }
            style={{
              ...styles.tabButton,
              ...(activeTab === 'color-3d'
                ? styles.activeTabButton
                : {}),
            }}
          >
            🎨 Color 3D
          </button>
        </div>

        <div style={styles.sizeSection}>
          <div style={styles.sizeHeader}>
            <span style={styles.sizeTitle}>
              Fish Size
            </span>

            <span style={styles.sizeValue}>
              {fishSizeLabel}
            </span>
          </div>

          <div style={styles.sizeSliderRow}>
            <span style={styles.sizeFishSmall}>
              🐟
            </span>

            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={fishSize}
              onChange={(event) =>
                setFishSize(
                  Number(
                    event.target.value,
                  ),
                )
              }
              style={styles.sizeSlider}
              aria-label="Fish size"
            />

            <span style={styles.sizeFishLarge}>
              🐟
            </span>
          </div>

          <div style={styles.sizeLabels}>
            <span>Small</span>
            <span>Big</span>
          </div>

          <div
            style={{
              ...styles.capacityStatus,
              ...(!hasCapacity
                ? styles.capacityStatusFull
                : {}),
            }}
          >
            {hasCapacity
              ? `${remainingCapacity.toFixed(1)} aquarium space left · this fish uses ${fishCapacityCost.toFixed(1)}`
              : `Aquarium is too full for a ${fishSizeLabel.toLowerCase()} fish. Choose a smaller size or release a fish.`}
          </div>
        </div>

        {activeTab === 'draw' ? (
          <>
            <div
              style={
                styles.canvasContainer
              }
            >
              {/*
            This guide is behind the
            transparent canvas.

            Because it is HTML/CSS and
            NOT drawn onto the canvas,
            it won't be exported.
          */}
              <div style={styles.fishGuide}>
                <svg
                  viewBox="0 0 600 320"
                  width="100%"
                  height="100%"
                  aria-hidden="true"
                >
                  {/* Tail */}
                  <path
                    d="
        M 155 160
        C 110 130, 72 96, 38 72
        C 48 116, 50 140, 50 160
        C 50 180, 48 204, 38 248
        C 72 224, 110 190, 155 160
        Z
      "
                    fill="#64748b"
                    fillOpacity="0.18"
                    stroke="#64748b"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />

                  {/* Body */}
                  <path
                    d="
        M 145 160
        C 190 78, 300 60, 405 86
        C 485 106, 540 132, 555 160
        C 540 188, 485 214, 405 234
        C 300 260, 190 242, 145 160
        Z
      "
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="5"
                    strokeDasharray="11 9"
                    strokeLinecap="round"
                  />

                  {/* Top fin */}
                  <path
                    d="
        M 280 82
        C 305 42, 345 35, 375 76
      "
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="5"
                    strokeDasharray="9 8"
                    strokeLinecap="round"
                  />

                  {/* Bottom fin */}
                  <path
                    d="
        M 295 239
        C 320 276, 355 278, 380 230
      "
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="5"
                    strokeDasharray="9 8"
                    strokeLinecap="round"
                  />

                  {/* Eye */}
                  <circle
                    cx="475"
                    cy="137"
                    r="10"
                    fill="#64748b"
                  />

                  {/* Small smile */}
                  <path
                    d="M 510 170 Q 525 180 538 168"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                onPointerDown={
                  startDrawing
                }
                onPointerMove={draw}
                onPointerUp={
                  stopDrawing
                }
                onPointerCancel={
                  stopDrawing
                }
                style={{
                  ...styles.canvas,

                  cursor:
                    tool === 'eraser'
                      ? 'cell'
                      : 'crosshair',
                }}
              />
            </div>

            <div style={styles.toolbar}>
              <div
                style={
                  styles.toolSection
                }
              >
            <span
              style={
                styles.toolLabel
              }
            >
              Colors
            </span>

                <div
                  style={
                    styles.colorRow
                  }
                >
                  {COLORS.map(
                    (
                      paletteColor,
                    ) => (
                      <button
                        key={
                          paletteColor
                        }
                        onClick={() =>
                          selectColor(
                            paletteColor,
                          )
                        }
                        aria-label={`Select ${paletteColor}`}
                        style={{
                          ...styles.colorButton,

                          background:
                          paletteColor,

                          transform:
                            color ===
                            paletteColor &&
                            tool ===
                            'brush'
                              ? 'scale(1.18)'
                              : 'scale(1)',

                          outline:
                            color ===
                            paletteColor &&
                            tool ===
                            'brush'
                              ? '3px solid #111827'
                              : '2px solid #ffffff',
                        }}
                      />
                    ),
                  )}

                  <input
                    type="color"
                    value={color}
                    onChange={(
                      event,
                    ) =>
                      selectColor(
                        event.target
                          .value,
                      )
                    }
                    title="Custom color"
                    style={
                      styles.colorPicker
                    }
                  />
                </div>
              </div>

              <div
                style={
                  styles.toolSection
                }
              >
            <span
              style={
                styles.toolLabel
              }
            >
              Brush
            </span>

                <div
                  style={
                    styles.brushRow
                  }
                >
                  {BRUSH_SIZES.map(
                    (brush) => (
                      <button
                        key={
                          brush.size
                        }
                        onClick={() => {
                          setBrushSize(
                            brush.size,
                          );

                          setTool(
                            'brush',
                          );
                        }}
                        title={
                          brush.label
                        }
                        style={{
                          ...styles.brushButton,

                          background:
                            brushSize ===
                            brush.size &&
                            tool ===
                            'brush'
                              ? '#dbeafe'
                              : '#ffffff',

                          borderColor:
                            brushSize ===
                            brush.size &&
                            tool ===
                            'brush'
                              ? '#2563eb'
                              : '#d1d5db',
                        }}
                      >
                    <span
                      style={{
                        width:
                          Math.max(
                            6,
                            brush.size *
                            0.75,
                          ),

                        height:
                          Math.max(
                            6,
                            brush.size *
                            0.75,
                          ),

                        borderRadius:
                          '50%',

                        background:
                        color,

                        display:
                          'block',
                      }}
                    />
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div
                style={
                  styles.toolSection
                }
              >
            <span
              style={
                styles.toolLabel
              }
            >
              Tools
            </span>

                <div
                  style={
                    styles.actionRow
                  }
                >
                  <button
                    onClick={() =>
                      setTool(
                        'eraser',
                      )
                    }
                    style={{
                      ...styles.toolButton,

                      background:
                        tool ===
                        'eraser'
                          ? '#dbeafe'
                          : '#ffffff',

                      borderColor:
                        tool ===
                        'eraser'
                          ? '#2563eb'
                          : '#d1d5db',
                    }}
                  >
                    🧽 Eraser
                  </button>

                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    style={{
                      ...styles.toolButton,

                      opacity:
                        canUndo
                          ? 1
                          : 0.4,
                    }}
                  >
                    ↩ Undo
                  </button>

                  <button
                    onClick={clear}
                    style={
                      styles.toolButton
                    }
                  >
                    🗑 Clear
                  </button>
                </div>
              </div>
            </div>

          </>
        ) : (
          <div style={styles.color3DSection}>
            <div style={styles.color3DContainer}>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: 12,
                  background: '#f8fafc',
                }}
              >
                {(['basic', 'angelfish'] as const).map((species) => (
                  <button
                    key={species}
                    type="button"
                    onClick={() => {
                      setFishSpecies(species);
                      setPaintImage(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 12,
                      border:
                        fishSpecies === species
                          ? '2px solid #2563eb'
                          : '2px solid #e5e7eb',
                      background:
                        fishSpecies === species ? '#dbeafe' : '#ffffff',
                      color: '#1e293b',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {species === 'basic' ? '🐠 Classic Fish' : '🐟 Angelfish'}
                  </button>
                ))}
              </div>

              <Fish3DPreview
                key={fishSpecies}
                species={fishSpecies === 'basic' ? 'classic' : 'angelfish'}
                bodyColor={bodyColor}
                finColor={finColor}
                size={fishSize}
                onPaintChange={setPaintImage}
              />

              <div style={styles.rotateHint}>
                👆 Drag the fish to turn it
              </div>
            </div>

            <div style={styles.fishColorControls}>
              <div style={styles.fishColorSection}>
      <span style={styles.toolLabel}>
        Body
      </span>

                <div style={styles.colorRow}>
                  {COLORS.map(
                    (paletteColor) => (
                      <button
                        key={paletteColor}
                        type="button"
                        onClick={() =>
                          setBodyColor(
                            paletteColor,
                          )
                        }
                        aria-label={`Body color ${paletteColor}`}
                        style={{
                          ...styles.fishColorButton,

                          background:
                          paletteColor,

                          transform:
                            bodyColor ===
                            paletteColor
                              ? 'scale(1.18)'
                              : 'scale(1)',

                          outline:
                            bodyColor ===
                            paletteColor
                              ? '3px solid #2563eb'
                              : '2px solid #ffffff',
                        }}
                      />
                    ),
                  )}

                  <label
                    style={
                      styles.customColorWrapper
                    }
                    title="Custom body color"
                  >
                    🎨

                    <input
                      type="color"
                      value={bodyColor}
                      onChange={(event) =>
                        setBodyColor(
                          event.target.value,
                        )
                      }
                      style={
                        styles.hiddenColorInput
                      }
                    />
                  </label>
                </div>
              </div>

              <div style={styles.fishColorSection}>
      <span style={styles.toolLabel}>
        Fins & Tail
      </span>

                <div style={styles.colorRow}>
                  {COLORS.map(
                    (paletteColor) => (
                      <button
                        key={paletteColor}
                        type="button"
                        onClick={() =>
                          setFinColor(
                            paletteColor,
                          )
                        }
                        aria-label={`Fin color ${paletteColor}`}
                        style={{
                          ...styles.fishColorButton,

                          background:
                          paletteColor,

                          transform:
                            finColor ===
                            paletteColor
                              ? 'scale(1.18)'
                              : 'scale(1)',

                          outline:
                            finColor ===
                            paletteColor
                              ? '3px solid #2563eb'
                              : '2px solid #ffffff',
                        }}
                      />
                    ),
                  )}

                  <label
                    style={
                      styles.customColorWrapper
                    }
                    title="Custom fin color"
                  >
                    🎨

                    <input
                      type="color"
                      value={finColor}
                      onChange={(event) =>
                        setFinColor(
                          event.target.value,
                        )
                      }
                      style={
                        styles.hiddenColorInput
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <button
            onClick={onCancel}
            style={styles.cancelButton}
          >
            Cancel
          </button>

          <button
            onClick={
              activeTab === 'draw'
                ? finish
                : finish3D
            }
            disabled={!hasCapacity}
            style={{
              ...styles.addButton,
              ...(!hasCapacity
                ? styles.addButtonDisabled
                : {}),
            }}
          >
            {hasCapacity
              ? 'Add to Aquarium 🐠'
              : 'Aquarium Full'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    padding: 20,

    background:
      'rgba(0, 0, 0, 0.6)',
  },

  panel: {
    width: 720,
    maxWidth: '100%',
    maxHeight: '95vh',

    overflowY: 'auto',

    background: '#ffffff',

    borderRadius: 24,

    padding: 24,

    boxShadow:
      '0 25px 60px rgba(0, 0, 0, 0.3)',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent:
      'space-between',

    gap: 16,

    marginBottom: 18,
  },

  title: {
    margin: 0,

    fontSize: 28,

    color: '#111827',
  },

  subtitle: {
    marginTop: 4,

    color: '#6b7280',

    fontSize: 15,
  },

  closeButton: {
    width: 40,
    height: 40,

    border: 0,
    borderRadius: '50%',

    background: '#f3f4f6',

    fontSize: 18,

    cursor: 'pointer',
  },

  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 18,
    padding: 5,
    borderRadius: 14,
    background: '#f3f4f6',
  },

  tabButton: {
    flex: 1,
    minHeight: 46,
    border: 0,
    borderRadius: 10,
    background: 'transparent',
    color: '#6b7280',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  activeTabButton: {
    background: '#ffffff',
    color: '#2563eb',
    boxShadow:
      '0 2px 8px rgba(0, 0, 0, 0.08)',
  },

  sizeSection: {
    marginBottom: 18,
    padding: '14px 18px',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    background: '#f8fafc',
  },

  sizeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  sizeTitle: {
    color: '#374151',
    fontSize: 14,
    fontWeight: 700,
  },

  sizeValue: {
    padding: '4px 10px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 700,
  },

  sizeSliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  sizeSlider: {
    flex: 1,
    cursor: 'pointer',
    accentColor: '#2563eb',
  },

  sizeFishSmall: {
    fontSize: 16,
  },

  sizeFishLarge: {
    fontSize: 25,
  },

  sizeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingLeft: 28,
    paddingRight: 31,
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 600,
  },

  capacityStatus: {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 10,
    background: '#ecfdf5',
    color: '#047857',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.4,
  },

  capacityStatusFull: {
    background: '#fef2f2',
    color: '#b91c1c',
  },

  color3DPlaceholder: {
    minHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    border: '2px solid #dbeafe',
    borderRadius: 18,
    background:
      'linear-gradient(180deg, #f8fdff 0%, #eef9ff 100%)',
    textAlign: 'center',
  },

  placeholderFish: {
    marginBottom: 14,
    fontSize: 72,
  },

  placeholderTitle: {
    margin: 0,
    color: '#111827',
    fontSize: 22,
  },

  placeholderText: {
    maxWidth: 360,
    margin: '8px 0 0',
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 1.5,
  },

  canvasContainer: {
    position: 'relative',

    width: '100%',

    aspectRatio: '3 / 2',

    overflow: 'hidden',

    border:
      '2px solid #dbeafe',

    borderRadius: 18,

    background: '#ffffff',
  },

  canvas: {
    position: 'absolute',
    inset: 0,

    zIndex: 2,

    width: '100%',
    height: '100%',

    touchAction: 'none',

    background:
      'transparent',
  },

  /**
   * Fish guide.
   */
  fishGuide: {
    position: 'absolute',

    zIndex: 1,

    left: '50%',
    top: '50%',

    width: '72%',
    height: '62%',

    transform:
      'translate(-50%, -50%)',

    opacity: 0.2,

    pointerEvents: 'none',
  },

  fishGuideBody: {
    position: 'absolute',

    left: '20%',
    top: '15%',

    width: '65%',
    height: '70%',

    border:
      '5px dashed #64748b',

    borderRadius: '50%',

    boxSizing:
      'border-box',
  },

  fishGuideTail: {
    position: 'absolute',

    left: '2%',
    top: '24%',

    width: 0,
    height: 0,

    borderTop:
      '55px solid transparent',

    borderBottom:
      '55px solid transparent',

    borderRight:
      '100px solid #64748b',
  },

  fishGuideEye: {
    position: 'absolute',

    right: '15%',
    top: '30%',

    width: 16,
    height: 16,

    borderRadius: '50%',

    background: '#64748b',
  },

  toolbar: {
    display: 'flex',

    flexDirection:
      'column',

    gap: 16,

    marginTop: 20,
  },

  toolSection: {
    display: 'flex',

    flexDirection:
      'column',

    gap: 8,
  },

  toolLabel: {
    fontWeight: 700,

    color: '#374151',

    fontSize: 14,
  },

  colorRow: {
    display: 'flex',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 10,
  },

  colorButton: {
    width: 34,
    height: 34,

    padding: 0,

    borderRadius: '50%',

    border: 0,

    cursor: 'pointer',

    transition:
      'transform 120ms ease',
  },

  colorPicker: {
    width: 38,
    height: 38,

    padding: 0,

    border:
      '1px solid #d1d5db',

    borderRadius: 8,

    cursor: 'pointer',
  },

  brushRow: {
    display: 'flex',

    gap: 8,
  },

  brushButton: {
    width: 48,
    height: 44,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    border:
      '2px solid #d1d5db',

    borderRadius: 10,

    cursor: 'pointer',
  },

  actionRow: {
    display: 'flex',

    flexWrap: 'wrap',

    gap: 8,
  },

  toolButton: {
    minHeight: 42,

    padding:
      '8px 14px',

    border:
      '2px solid #d1d5db',

    borderRadius: 10,

    background: '#ffffff',

    fontWeight: 600,

    cursor: 'pointer',
  },

  footer: {
    display: 'flex',

    justifyContent:
      'flex-end',

    gap: 12,

    marginTop: 24,
  },

  cancelButton: {
    padding:
      '12px 20px',

    border:
      '1px solid #d1d5db',

    borderRadius: 12,

    background: '#ffffff',

    fontSize: 16,

    cursor: 'pointer',
  },

  addButton: {
    padding:
      '12px 22px',

    border: 0,

    borderRadius: 12,

    background: '#2563eb',

    color: '#ffffff',

    fontWeight: 700,

    fontSize: 16,

    cursor: 'pointer',
  },

  addButtonDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed',
    opacity: 0.75,
  },

  color3DContainer: {
    overflow: 'hidden',
    border: '2px solid #dbeafe',
    borderRadius: 18,
    background: '#eaf8ff',
  },

  rotateHint: {
    padding: '10px 16px 14px',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
  },
  color3DSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },

  fishColorControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,

    padding: 18,

    border: '2px solid #e5e7eb',
    borderRadius: 16,

    background: '#f8fafc',
  },

  fishColorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  fishColorButton: {
    width: 38,
    height: 38,

    padding: 0,

    border: 0,
    borderRadius: '50%',

    cursor: 'pointer',

    boxShadow:
      '0 1px 4px rgba(0, 0, 0, 0.15)',

    transition:
      'transform 120ms ease',
  },

  customColorWrapper: {
    position: 'relative',

    width: 40,
    height: 40,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    border: '2px solid #d1d5db',
    borderRadius: '50%',

    background: '#ffffff',

    fontSize: 20,

    cursor: 'pointer',

    overflow: 'hidden',
  },

  hiddenColorInput: {
    position: 'absolute',

    width: '100%',
    height: '100%',

    inset: 0,

    opacity: 0,

    cursor: 'pointer',
  },
} as const;