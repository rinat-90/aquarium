import {
  useEffect,
  useRef,
  useState,
} from 'react';

import * as THREE from 'three';

import {
  createFish3DModel,
  type Fish3DModel,
} from './createFish3DModel';

type Fish3DPreviewProps = {
  bodyColor: string;
  finColor: string;
  height?: number;
  size?: number;

  paintImage?: string;

  editable?: boolean;

  onPaintChange?: (
    paintImage: string | null,
  ) => void;
};

type InteractionMode =
  | 'paint'
  | 'rotate';

type PaintPoint = {
  x: number;
  y: number;
  u: number;
};

const PAINT_COLORS = [
  '#ff2d8d',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00b8d9',
  '#007aff',
  '#5856d6',
  '#af52de',
  '#ffffff',
  '#111111',
];

const BRUSH_SIZES = [
  {
    label: 'S',
    value: 12,
  },
  {
    label: 'M',
    value: 22,
  },
  {
    label: 'L',
    value: 38,
  },
];

export function Fish3DPreview({
                                bodyColor,
                                finColor,
                                height = 400,
                                size = 1,
                                paintImage,
                                editable = true,
                                onPaintChange,
                              }: Fish3DPreviewProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const fishRef =
    useRef<Fish3DModel | null>(
      null,
    );

  /*
   * Interaction mode
   */
  const modeRef =
    useRef<InteractionMode>(
      'rotate',
    );

  const [mode, setMode] =
    useState<InteractionMode>(
      'rotate',
    );

  /*
   * Brush settings
   */
  const brushColorRef =
    useRef('#ff2d8d');

  const brushSizeRef =
    useRef(22);

  const eraserRef =
    useRef(false);

  const onPaintChangeRef =
    useRef(onPaintChange);

  useEffect(() => {
    onPaintChangeRef.current =
      onPaintChange;
  }, [onPaintChange]);

  const [
    brushColor,
    setBrushColor,
  ] = useState('#ff2d8d');

  const [
    brushSize,
    setBrushSize,
  ] = useState(22);

  const [
    eraser,
    setEraser,
  ] = useState(false);

  /*
   * Painting commands are created
   * inside the Three.js effect but
   * triggered by React buttons.
   */
  const undoRef =
    useRef<(() => void) | null>(
      null,
    );

  const clearRef =
    useRef<(() => void) | null>(
      null,
    );

  /*
   * Used only to update the enabled
   * state of the Undo button.
   */
  const [
    canUndo,
    setCanUndo,
  ] = useState(false);

  /*
   * Sync React state with refs.
   */
  useEffect(() => {
    modeRef.current =
      mode;
  }, [mode]);

  useEffect(() => {
    brushColorRef.current =
      brushColor;
  }, [brushColor]);

  useEffect(() => {
    brushSizeRef.current =
      brushSize;
  }, [brushSize]);

  useEffect(() => {
    eraserRef.current =
      eraser;
  }, [eraser]);

  /*
   * Update fish colors without
   * recreating the Three.js scene.
   */
  useEffect(() => {
    fishRef.current?.setBodyColor(
      bodyColor,
    );
  }, [bodyColor]);

  useEffect(() => {
    fishRef.current?.setFinColor(
      finColor,
    );
  }, [finColor]);

  useEffect(() => {
    fishRef.current?.group.scale.setScalar(
      size,
    );
  }, [size]);

  /*
   * Create Three.js scene once.
   */
  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const scene =
      new THREE.Scene();

    scene.background =
      new THREE.Color(
        0xeaf8ff,
      );

    const camera =
      new THREE.PerspectiveCamera(
        40,
        1,
        0.1,
        100,
      );

    camera.position.set(
      0,
      0.2,
      6.5,
    );

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2,
      ),
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
      1.1;

    container.appendChild(
      renderer.domElement,
    );

    /*
     * Lighting
     */
    const ambientLight =
      new THREE.HemisphereLight(
        0xffffff,
        0x5d8ca3,
        2.2,
      );

    scene.add(
      ambientLight,
    );

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        3,
      );

    keyLight.position.set(
      4,
      6,
      6,
    );

    scene.add(
      keyLight,
    );

    const fillLight =
      new THREE.DirectionalLight(
        0x9ee7ff,
        1.5,
      );

    fillLight.position.set(
      -4,
      1,
      4,
    );

    scene.add(
      fillLight,
    );

    /*
     * Fish
     */
    const fish =
      createFish3DModel();

    fishRef.current =
      fish;

    fish.setBodyColor(
      bodyColor,
    );

    fish.setFinColor(
      finColor,
    );

    fish.group.scale.setScalar(
      size,
    );

    if (paintImage) {
      fish.setPaintImage(
        paintImage,
      );
    }

    scene.add(
      fish.group,
    );

    /*
     * Painting / raycasting
     */
    const raycaster =
      new THREE.Raycaster();

    const pointer =
      new THREE.Vector2();

    const paintContext =
      fish.paintCanvas.getContext(
        '2d',
      );

    if (!paintContext) {
      fish.dispose();
      renderer.dispose();
      renderer.domElement.remove();

      return;
    }

    const emitPaintChange = () => {
      const image =
        fish.paintCanvas.toDataURL(
          'image/png',
        );

      onPaintChangeRef.current?.(
        image,
      );
    };

    /*
     * Undo history.
     *
     * Each entry is the complete
     * paint canvas BEFORE an action.
     *
     * That means one complete stroke
     * becomes one Undo operation.
     */
    const history:
      ImageData[] = [];

    const HISTORY_LIMIT = 30;

    const updateCanUndo = () => {
      setCanUndo(
        history.length > 0,
      );
    };

    const saveSnapshot = () => {
      const snapshot =
        paintContext.getImageData(
          0,
          0,
          fish.paintCanvas.width,
          fish.paintCanvas.height,
        );

      history.push(
        snapshot,
      );

      /*
       * Keep memory usage bounded.
       */
      if (
        history.length >
        HISTORY_LIMIT
      ) {
        history.shift();
      }

      updateCanUndo();
    };

    const restoreSnapshot = (
      snapshot: ImageData,
    ) => {
      paintContext.save();

      /*
       * putImageData ignores normal
       * compositing, but resetting here
       * keeps our canvas state clean.
       */
      paintContext
        .globalCompositeOperation =
        'source-over';

      paintContext.putImageData(
        snapshot,
        0,
        0,
      );

      paintContext.restore();

      fish.paintTexture.needsUpdate =
        true;
    };

    /*
     * Expose Undo to React.
     */
    undoRef.current = () => {
      const snapshot =
        history.pop();

      if (!snapshot) {
        updateCanUndo();

        return;
      }

      restoreSnapshot(
        snapshot,
      );

      emitPaintChange();

      updateCanUndo();
    };

    /*
     * Expose Clear to React.
     *
     * Clear itself is undoable.
     */
    clearRef.current = () => {
      saveSnapshot();

      paintContext.clearRect(
        0,
        0,
        fish.paintCanvas.width,
        fish.paintCanvas.height,
      );

      fish.paintTexture.needsUpdate =
        true;

      onPaintChangeRef.current?.(
        null,
      );
    };

    const getBodyIntersection = (
      event: PointerEvent,
    ) => {
      const rect =
        renderer.domElement
          .getBoundingClientRect();

      pointer.x =
        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *
        2 -
        1;

      pointer.y =
        -(
          (
            event.clientY -
            rect.top
          ) /
          rect.height
        ) *
        2 +
        1;

      raycaster.setFromCamera(
        pointer,
        camera,
      );

      const intersections =
        raycaster.intersectObject(
          fish.body,
          false,
        );

      return (
        intersections[0] ??
        null
      );
    };

    const getPaintPoint = (
      intersection:
      THREE.Intersection,
    ): PaintPoint | null => {
      const uv =
        intersection.uv;

      if (!uv) {
        return null;
      }

      return {
        x:
          uv.x *
          fish.paintCanvas.width,

        y:
          (1 - uv.y) *
          fish.paintCanvas.height,

        u: uv.x,
      };
    };

    /*
     * Configure normal painting
     * or erasing.
     */
    const configureBrush = (
      type: 'fill' | 'stroke',
    ) => {
      if (eraserRef.current) {
        paintContext
          .globalCompositeOperation =
          'destination-out';

        if (type === 'fill') {
          paintContext.fillStyle =
            '#000000';
        } else {
          paintContext.strokeStyle =
            '#000000';
        }

        return;
      }

      paintContext
        .globalCompositeOperation =
        'source-over';

      if (type === 'fill') {
        paintContext.fillStyle =
          brushColorRef.current;
      } else {
        paintContext.strokeStyle =
          brushColorRef.current;
      }
    };

    /*
     * Paint one round point.
     */
    const paintPoint = (
      point: PaintPoint,
    ) => {
      paintContext.save();

      configureBrush(
        'fill',
      );

      paintContext.beginPath();

      paintContext.arc(
        point.x,
        point.y,
        brushSizeRef.current /
        2,
        0,
        Math.PI * 2,
      );

      paintContext.fill();

      paintContext.restore();

      fish.paintTexture.needsUpdate =
        true;

      emitPaintChange();
    };

    /*
     * Connect two UV points.
     */
    const paintLine = (
      from: PaintPoint,
      to: PaintPoint,
    ) => {
      /*
       * Protect against UV seam.
       */
      const uDifference =
        Math.abs(
          to.u - from.u,
        );

      if (uDifference > 0.5) {
        paintPoint(to);

        return;
      }

      paintContext.save();

      configureBrush(
        'stroke',
      );

      paintContext.lineWidth =
        brushSizeRef.current;

      paintContext.lineCap =
        'round';

      paintContext.lineJoin =
        'round';

      paintContext.beginPath();

      paintContext.moveTo(
        from.x,
        from.y,
      );

      paintContext.lineTo(
        to.x,
        to.y,
      );

      paintContext.stroke();

      paintContext.restore();

      fish.paintTexture.needsUpdate =
        true;

      emitPaintChange();
    };

    /*
     * Pointer state
     */
    let painting = false;
    let rotating = false;

    let previousPaintPoint:
      PaintPoint | null = null;

    let previousX = 0;
    let previousY = 0;

    const handlePointerDown = (
      event: PointerEvent,
    ) => {

      if (!editable) {
        return;
      }

      /*
       * PAINT MODE
       */
      if (
        modeRef.current ===
        'paint'
      ) {
        const intersection =
          getBodyIntersection(
            event,
          );

        if (!intersection) {
          return;
        }

        const point =
          getPaintPoint(
            intersection,
          );

        if (!point) {
          return;
        }

        /*
         * Snapshot once at the start
         * of the stroke.
         */
        saveSnapshot();

        painting = true;

        previousPaintPoint =
          point;

        paintPoint(point);

        renderer.domElement
          .setPointerCapture(
            event.pointerId,
          );

        return;
      }

      /*
       * ROTATE MODE
       */
      rotating = true;

      previousX =
        event.clientX;

      previousY =
        event.clientY;

      renderer.domElement
        .setPointerCapture(
          event.pointerId,
        );
    };

    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      /*
       * PAINT MODE
       */
      if (painting) {
        const intersection =
          getBodyIntersection(
            event,
          );

        if (!intersection) {
          previousPaintPoint =
            null;

          return;
        }

        const point =
          getPaintPoint(
            intersection,
          );

        if (!point) {
          return;
        }

        if (
          previousPaintPoint
        ) {
          paintLine(
            previousPaintPoint,
            point,
          );
        } else {
          paintPoint(
            point,
          );
        }

        previousPaintPoint =
          point;

        return;
      }

      /*
       * ROTATE MODE
       */
      if (!rotating) {
        return;
      }

      const deltaX =
        event.clientX -
        previousX;

      const deltaY =
        event.clientY -
        previousY;

      fish.group.rotation.y +=
        deltaX * 0.01;

      fish.group.rotation.x +=
        deltaY * 0.006;

      fish.group.rotation.x =
        THREE.MathUtils.clamp(
          fish.group.rotation.x,
          -0.45,
          0.45,
        );

      previousX =
        event.clientX;

      previousY =
        event.clientY;
    };

    const handlePointerUp = (
      event: PointerEvent,
    ) => {
      const finishedPainting =
        painting;

      painting = false;
      rotating = false;

      if (finishedPainting) {
        emitPaintChange();
      }

      previousPaintPoint =
        null;

      if (
        renderer.domElement
          .hasPointerCapture(
            event.pointerId,
          )
      ) {
        renderer.domElement
          .releasePointerCapture(
            event.pointerId,
          );
      }
    };

    renderer.domElement
      .addEventListener(
        'pointerdown',
        handlePointerDown,
      );

    renderer.domElement
      .addEventListener(
        'pointermove',
        handlePointerMove,
      );

    renderer.domElement
      .addEventListener(
        'pointerup',
        handlePointerUp,
      );

    renderer.domElement
      .addEventListener(
        'pointercancel',
        handlePointerUp,
      );

    /*
     * Responsive renderer
     */
    const resize = () => {
      const width =
        container.clientWidth;

      const currentHeight =
        container.clientHeight;

      if (
        width === 0 ||
        currentHeight === 0
      ) {
        return;
      }

      renderer.setSize(
        width,
        currentHeight,
        false,
      );

      camera.aspect =
        width /
        currentHeight;

      camera
        .updateProjectionMatrix();
    };

    const resizeObserver =
      new ResizeObserver(
        resize,
      );

    resizeObserver.observe(
      container,
    );

    resize();

    /*
     * Animation
     */
    let animationFrame = 0;

    const animate = (
      time: number,
    ) => {
      const seconds =
        time * 0.001;

      fish.tail.rotation.y =
        Math.sin(
          seconds * 5,
        ) * 0.28;

      fish.leftFin.rotation.z =
        -Math.PI / 2.5 +
        Math.sin(
          seconds * 3.5,
        ) *
        0.08;

      fish.rightFin.rotation.z =
        -Math.PI / 2.5 -
        Math.sin(
          seconds * 3.5,
        ) *
        0.08;

      renderer.render(
        scene,
        camera,
      );

      animationFrame =
        requestAnimationFrame(
          animate,
        );
    };

    animationFrame =
      requestAnimationFrame(
        animate,
      );

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      resizeObserver.disconnect();

      renderer.domElement
        .removeEventListener(
          'pointerdown',
          handlePointerDown,
        );

      renderer.domElement
        .removeEventListener(
          'pointermove',
          handlePointerMove,
        );

      renderer.domElement
        .removeEventListener(
          'pointerup',
          handlePointerUp,
        );

      renderer.domElement
        .removeEventListener(
          'pointercancel',
          handlePointerUp,
        );

      undoRef.current = null;
      clearRef.current = null;

      fishRef.current = null;

      fish.dispose();

      renderer.dispose();

      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Paint / Rotate */}
      {editable && <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',

          transform:
            'translateX(-50%)',

          zIndex: 3,

          display: 'flex',
          gap: 6,

          padding: 5,

          borderRadius: 14,

          background:
            'rgba(255, 255, 255, 0.92)',

          boxShadow:
            '0 4px 14px rgba(0, 0, 0, 0.12)',
        }}
      >
        <button
          type="button"
          onClick={() =>
            setMode('paint')
          }
          style={{
            padding:
              '8px 14px',

            border: 0,
            borderRadius: 10,

            background:
              mode === 'paint'
                ? '#37b6d5'
                : 'transparent',

            color:
              mode === 'paint'
                ? 'white'
                : '#17324d',

            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🖌️ Paint
        </button>

        <button
          type="button"
          onClick={() =>
            setMode('rotate')
          }
          style={{
            padding:
              '8px 14px',

            border: 0,
            borderRadius: 10,

            background:
              mode === 'rotate'
                ? '#37b6d5'
                : 'transparent',

            color:
              mode === 'rotate'
                ? 'white'
                : '#17324d',

            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🔄 Rotate
        </button>
      </div>}

      {/* Painting controls */}
      {editable && mode === 'paint' && (
        <div
          style={{
            position: 'absolute',

            left: 12,
            right: 12,
            bottom: 12,

            zIndex: 3,

            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'center',

            flexWrap: 'wrap',

            gap: 10,

            padding: 10,

            borderRadius: 14,

            background:
              'rgba(255, 255, 255, 0.94)',

            boxShadow:
              '0 4px 14px rgba(0, 0, 0, 0.12)',
          }}
        >
          {/* Colors */}
          {PAINT_COLORS.map(
            (color) => (
              <button
                key={color}
                type="button"
                aria-label={
                  `Use ${color}`
                }
                onClick={() => {
                  setBrushColor(
                    color,
                  );

                  setEraser(
                    false,
                  );
                }}
                style={{
                  width: 28,
                  height: 28,

                  padding: 0,

                  flexShrink: 0,

                  borderRadius:
                    '50%',

                  border:
                    !eraser &&
                    brushColor ===
                    color
                      ? '3px solid #17324d'
                      : '2px solid rgba(0, 0, 0, 0.15)',

                  background:
                  color,

                  cursor:
                    'pointer',

                  boxShadow:
                    color ===
                    '#ffffff'
                      ? 'inset 0 0 0 1px #ddd'
                      : undefined,
                }}
              />
            ),
          )}

          {/* Custom color */}
          <input
            type="color"
            value={brushColor}
            title="Custom color"
            aria-label="Custom paint color"
            onChange={(
              event,
            ) => {
              setBrushColor(
                event.target.value,
              );

              setEraser(
                false,
              );
            }}
            style={{
              width: 32,
              height: 32,

              padding: 0,
              border: 0,

              flexShrink: 0,

              background:
                'transparent',

              cursor:
                'pointer',
            }}
          />

          <div
            style={{
              width: 1,
              height: 30,

              background:
                'rgba(0, 0, 0, 0.12)',
            }}
          />

          {/* Brush sizes */}
          {BRUSH_SIZES.map(
            (size) => (
              <button
                key={size.value}
                type="button"
                onClick={() =>
                  setBrushSize(
                    size.value,
                  )
                }
                style={{
                  minWidth: 34,
                  height: 34,

                  border:
                    brushSize ===
                    size.value
                      ? '2px solid #37b6d5'
                      : '1px solid #ccd7df',

                  borderRadius: 9,

                  background:
                    brushSize ===
                    size.value
                      ? '#e7f8fc'
                      : '#ffffff',

                  color:
                    '#17324d',

                  fontWeight: 800,

                  cursor:
                    'pointer',
                }}
              >
                {size.label}
              </button>
            ),
          )}

          <div
            style={{
              width: 1,
              height: 30,

              background:
                'rgba(0, 0, 0, 0.12)',
            }}
          />

          {/* Eraser */}
          <button
            type="button"
            onClick={() =>
              setEraser(
                (current) =>
                  !current,
              )
            }
            style={{
              height: 36,

              padding:
                '0 12px',

              border:
                eraser
                  ? '2px solid #37b6d5'
                  : '1px solid #ccd7df',

              borderRadius: 9,

              background:
                eraser
                  ? '#e7f8fc'
                  : '#ffffff',

              color:
                '#17324d',

              fontWeight: 800,

              cursor:
                'pointer',
            }}
          >
            🧽 Eraser
          </button>

          <div
            style={{
              width: 1,
              height: 30,

              background:
                'rgba(0, 0, 0, 0.12)',
            }}
          />

          {/* Undo */}
          <button
            type="button"
            disabled={!canUndo}
            onClick={() =>
              undoRef.current?.()
            }
            style={{
              height: 36,

              padding:
                '0 12px',

              border:
                '1px solid #ccd7df',

              borderRadius: 9,

              background:
                '#ffffff',

              color:
                '#17324d',

              fontWeight: 800,

              cursor:
                canUndo
                  ? 'pointer'
                  : 'default',

              opacity:
                canUndo
                  ? 1
                  : 0.4,
            }}
          >
            ↩️ Undo
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={() =>
              clearRef.current?.()
            }
            style={{
              height: 36,

              padding:
                '0 12px',

              border:
                '1px solid #f0b5b5',

              borderRadius: 9,

              background:
                '#fff5f5',

              color:
                '#b42318',

              fontWeight: 800,

              cursor:
                'pointer',
            }}
          >
            🗑️ Clear
          </button>
        </div>
      )}

      {/* Three.js */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,

          overflow: 'hidden',

          borderRadius: 18,

          touchAction: 'none',

          cursor:
            !editable
              ? 'default'
              : mode === 'paint'
                ? 'crosshair'
                : 'grab',
        }}
      />
    </div>
  );
}