import {
  useEffect,
  useRef,
} from 'react';

import * as THREE from 'three';

import type {
  CreatedFish,
} from '../../App';

import {
  createThreeFish,
  type ThreeFish,
} from './ThreeFish';

type ThreeAquariumViewProps = {
  createdFish: CreatedFish[];
};

export function ThreeAquariumView({
                                    createdFish,
                                  }: ThreeAquariumViewProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(
      null,
    );

  const threeFishRef =
    useRef(
      new Map<
        string,
        ThreeFish
      >(),
    );

  const loadingFishRef =
    useRef(
      new Set<string>(),
    );

  const createdFishRef =
    useRef(createdFish);

  useEffect(() => {
    createdFishRef.current =
      createdFish;

    const scene =
      sceneRef.current;

    if (!scene) {
      return;
    }

    for (
      const created of
      createdFish
      ) {
      void addCreatedFish(
        created,
      );
    }
  }, [createdFish]);

  const addCreatedFish = async (
    created: CreatedFish,
  ) => {
    const scene =
      sceneRef.current;

    if (!scene) {
      return;
    }

    if (
      threeFishRef.current.has(
        created.id,
      )
    ) {
      return;
    }

    if (
      loadingFishRef.current.has(
        created.id,
      )
    ) {
      return;
    }

    loadingFishRef.current.add(
      created.id,
    );

    try {
      const threeFish =
        await createThreeFish(
          created.image,
        );

      const currentScene =
        sceneRef.current;

      if (
        !currentScene ||
        threeFishRef.current.has(
          created.id,
        )
      ) {
        threeFish.destroy();
        return;
      }

      threeFish.group.position.set(
        (
          Math.random() -
          0.5
        ) * 6,

        (
          Math.random() -
          0.5
        ) * 3,

        (
          Math.random() -
          0.5
        ) * 1.5,
      );

      currentScene.add(
        threeFish.group,
      );

      threeFishRef.current.set(
        created.id,
        threeFish,
      );
    } catch (error) {
      console.error(
        'Failed to create 3D fish:',
        error,
      );
    } finally {
      loadingFishRef.current.delete(
        created.id,
      );
    }
  };

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    /*
     * Scene
     */
    const scene =
      new THREE.Scene();

    sceneRef.current =
      scene;

    scene.background =
      new THREE.Color(
        0x58c8e8,
      );

    scene.fog =
      new THREE.FogExp2(
        0x58c8e8,
        0.025,
      );

    /*
     * Camera
     */
    const camera =
      new THREE.PerspectiveCamera(
        45,

        container.clientWidth /
        container.clientHeight,

        0.1,
        100,
      );

    camera.position.set(
      0,
      2,
      12,
    );

    camera.lookAt(
      0,
      0,
      0,
    );

    /*
     * Renderer
     */
    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2,
      ),
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight,
    );

    container.appendChild(
      renderer.domElement,
    );

    /*
     * Lighting
     */
    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        1.6,
      );

    scene.add(
      ambientLight,
    );

    const sunlight =
      new THREE.DirectionalLight(
        0xffffff,
        2.5,
      );

    sunlight.position.set(
      -4,
      8,
      6,
    );

    scene.add(
      sunlight,
    );

    /*
     * Aquarium dimensions
     */
    const tankWidth = 10;
    const tankHeight = 6;
    const tankDepth = 4;

    /*
     * Sand
     */
    const sandGeometry =
      new THREE.BoxGeometry(
        tankWidth,
        0.3,
        tankDepth,
      );

    const sandMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xe8c982,
        roughness: 0.9,
      });

    const sand =
      new THREE.Mesh(
        sandGeometry,
        sandMaterial,
      );

    sand.position.y =
      -tankHeight / 2 +
      0.15;

    scene.add(
      sand,
    );

    /*
     * Back wall
     */
    const backGeometry =
      new THREE.PlaneGeometry(
        tankWidth,
        tankHeight,
      );

    const backMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x3fa9c9,
        roughness: 1,
      });

    const backWall =
      new THREE.Mesh(
        backGeometry,
        backMaterial,
      );

    backWall.position.z =
      -tankDepth / 2;

    scene.add(
      backWall,
    );

    /*
     * Rocks
     */
    const rockMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.95,
      });

    const rock1Geometry =
      new THREE.DodecahedronGeometry(
        0.65,
        0,
      );

    const rock1 =
      new THREE.Mesh(
        rock1Geometry,
        rockMaterial,
      );

    rock1.position.set(
      -3.4,
      -2.55,
      -0.6,
    );

    rock1.scale.set(
      1.4,
      0.7,
      1,
    );

    scene.add(
      rock1,
    );

    const rock2Geometry =
      new THREE.DodecahedronGeometry(
        0.45,
        0,
      );

    const rock2 =
      new THREE.Mesh(
        rock2Geometry,
        rockMaterial,
      );

    rock2.position.set(
      -2.5,
      -2.65,
      0.2,
    );

    rock2.scale.set(
      1.2,
      0.7,
      1,
    );

    scene.add(
      rock2,
    );

    /*
     * Plants
     */
    const plantMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.8,
      });

    const plants:
      THREE.Mesh[] = [];

    const plantGeometries:
      THREE.BufferGeometry[] =
      [];

    for (
      let index = 0;
      index < 7;
      index++
    ) {
      const height =
        1.1 +
        Math.random() * 1.5;

      const geometry =
        new THREE.CapsuleGeometry(
          0.08,
          height,
          4,
          8,
        );

      plantGeometries.push(
        geometry,
      );

      const plant =
        new THREE.Mesh(
          geometry,
          plantMaterial,
        );

      plant.position.set(
        2.5 +
        index * 0.35,

        -tankHeight / 2 +
        height / 2 +
        0.25,

        -0.8 +
        Math.random() * 1.2,
      );

      plant.rotation.z =
        (
          Math.random() -
          0.5
        ) * 0.15;

      scene.add(
        plant,
      );

      plants.push(
        plant,
      );
    }

    /*
     * Tank outline
     */
    const tankGeometry =
      new THREE.BoxGeometry(
        tankWidth,
        tankHeight,
        tankDepth,
      );

    const edges =
      new THREE.EdgesGeometry(
        tankGeometry,
      );

    const outlineMaterial =
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });

    const outline =
      new THREE.LineSegments(
        edges,
        outlineMaterial,
      );

    scene.add(
      outline,
    );

    /*
     * Load any fish that already
     * existed before the Three.js
     * scene initialized.
     */
    for (
      const created of
      createdFishRef.current
      ) {
      void addCreatedFish(
        created,
      );
    }

    /*
     * Animation
     */
    const clock =
      new THREE.Clock();

    let animationFrame = 0;

    const animate = () => {
      if (cancelled) {
        return;
      }

      animationFrame =
        requestAnimationFrame(
          animate,
        );

      const elapsed =
        clock.getElapsedTime();

      /*
       * Gentle plant movement.
       */
      plants.forEach(
        (
          plant,
          index,
        ) => {
          plant.rotation.z =
            Math.sin(
              elapsed * 0.8 +
              index,
            ) * 0.05;
        },
      );

      /*
       * Animate the actual body of
       * every drawn fish.
       *
       * Movement through the aquarium
       * comes in the next step.
       */
      for (
        const fish of
        threeFishRef.current.values()
        ) {
        fish.update(
          elapsed * 5,
          1,
          'right',
        );
      }

      renderer.render(
        scene,
        camera,
      );
    };

    animate();

    /*
     * Resize
     */
    const handleResize = () => {
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

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
      );
    };

    window.addEventListener(
      'resize',
      handleResize,
    );

    /*
     * Cleanup
     */
    return () => {
      cancelled = true;

      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        'resize',
        handleResize,
      );

      sceneRef.current =
        null;

      for (
        const fish of
        threeFishRef.current.values()
        ) {
        fish.destroy();
      }

      threeFishRef.current.clear();

      loadingFishRef.current.clear();

      sandGeometry.dispose();
      sandMaterial.dispose();

      backGeometry.dispose();
      backMaterial.dispose();

      rock1Geometry.dispose();
      rock2Geometry.dispose();
      rockMaterial.dispose();

      for (
        const geometry of
        plantGeometries
        ) {
        geometry.dispose();
      }

      plantMaterial.dispose();

      tankGeometry.dispose();
      edges.dispose();
      outlineMaterial.dispose();

      renderer.dispose();

      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    />
  );
}