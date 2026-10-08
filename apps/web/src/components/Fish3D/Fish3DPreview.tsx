import {
  useEffect,
  useRef,
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
     * Pointer rotation
     */
    let dragging = false;

    let previousX = 0;
    let previousY = 0;

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      dragging = true;

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
      if (!dragging) {
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

      /*
       * Don't allow the fish to
       * turn upside down.
       */
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
      dragging = false;

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

      const height =
        container.clientHeight;

      if (
        width === 0 ||
        height === 0
      ) {
        return;
      }

      renderer.setSize(
        width,
        height,
        false,
      );

      camera.aspect =
        width / height;

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

      /*
       * Tail now has a real pivot
       * at the base of the body.
       *
       * Neutral rotation is 0.
       */
      fish.tail.rotation.y =
        Math.sin(
          seconds * 5,
        ) * 0.28;

      /*
       * Small fin movement.
       */
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
      ref={containerRef}
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
        borderRadius: 18,
        touchAction: 'none',
        cursor: 'grab',
      }}
    />
  );
}