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
};

type InteractionMode =
  | 'paint'
  | 'rotate';

type PaintPoint = {
  x: number;
  y: number;
  u: number;
};

export function Fish3DPreview({
                                bodyColor,
                                finColor,
                                height = 400,
                              }: Fish3DPreviewProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const fishRef =
    useRef<Fish3DModel | null>(
      null,
    );

  const modeRef =
    useRef<InteractionMode>(
      'rotate',
    );

  const [mode, setMode] =
    useState<InteractionMode>(
      'rotate',
    );

  /*
   * Keep the event handlers inside
   * Three.js in sync with React state.
   */
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /*
   * Update colors without recreating
   * the Three.js scene.
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

  /*
   * Create the Three.js scene once.
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

    scene.add(
      fish.group,
    );

    /*
     * Painting
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

    const brushColor =
      '#ff2d8d';

    const brushSize = 22;

    /*
     * Paint one round point.
     *
     * This makes taps work and also
     * gives strokes rounded ends.
     */
    const paintPoint = (
      point: PaintPoint,
    ) => {
      paintContext.save();

      paintContext.fillStyle =
        brushColor;

      paintContext.beginPath();

      paintContext.arc(
        point.x,
        point.y,
        brushSize / 2,
        0,
        Math.PI * 2,
      );

      paintContext.fill();

      paintContext.restore();

      fish.paintTexture.needsUpdate =
        true;
    };

    /*
     * Connect two UV points.
     */
    const paintLine = (
      from: PaintPoint,
      to: PaintPoint,
    ) => {
      /*
       * SphereGeometry has a UV seam.
       *
       * If U suddenly jumps from
       * something like 0.99 to 0.01,
       * those points are physically
       * close on the fish but far apart
       * on the texture.
       *
       * Don't connect them directly or
       * we'd draw across the texture.
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

      paintContext.strokeStyle =
        brushColor;

      paintContext.lineWidth =
        brushSize;

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

        /*
         * Pointer can temporarily leave
         * the fish while dragging.
         */
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
          paintPoint(point);
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
      painting = false;
      rotating = false;

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
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform:
            'translateX(-50%)',

          zIndex: 2,

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
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          overflow: 'hidden',

          borderRadius: 18,

          touchAction: 'none',

          cursor:
            mode === 'paint'
              ? 'crosshair'
              : 'grab',
        }}
      />
    </div>
  );
}