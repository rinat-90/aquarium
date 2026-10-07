import {
  useEffect,
  useRef,
} from 'react';

import * as THREE from 'three';

import {
  Aquarium,
} from '@aquarium/aquarium-engine';

import type {
  CreatedFish,
} from '../../App';

import {
  createThreeFish,
  type ThreeFish,
} from './ThreeFish';

import {
  createUnderwaterEffects,
} from './createUnderwaterEffects';

import {
  createWaterEffects,
} from './createWaterEffects';

type ThreeAquariumViewProps = {
  createdFish: CreatedFish[];

  onFishSelect?: (
    fish: CreatedFish,
  ) => void;
};

type RenderedFish = {
  view: ThreeFish;
};

export function ThreeAquariumView({
                                    createdFish,
                                    onFishSelect,
                                  }: ThreeAquariumViewProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(
      null,
    );

  const aquariumRef =
    useRef<Aquarium | null>(
      null,
    );

  const threeFishRef =
    useRef(
      new Map<
        string,
        RenderedFish
      >(),
    );

  const loadingFishRef =
    useRef(
      new Set<string>(),
    );

  const createdFishRef =
    useRef(createdFish);

  const foodMeshesRef =
    useRef(
      new Map<
        string,
        THREE.Mesh
      >(),
    );

  const addCreatedFish = async (
    created: CreatedFish,
  ) => {
    /*
     * Capture the exact scene + aquarium
     * this load belongs to.
     */
    const scene =
      sceneRef.current;

    const aquarium =
      aquariumRef.current;

    if (
      !scene ||
      !aquarium
    ) {
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

    /*
     * Add the fish to this exact
     * simulation instance.
     */
    const fish =
      aquarium.createFish(
        created.id,
      );

    try {
      /*
       * Texture loading is async.
       *
       * React may destroy/recreate the
       * aquarium while this is waiting.
       */
      const view =
        await createThreeFish(
          created.image,
        );

      const currentScene =
        sceneRef.current;

      const currentAquarium =
        aquariumRef.current;

      /*
       * If React recreated the aquarium
       * while the texture was loading,
       * this fish belongs to the old
       * simulation.
       *
       * Destroy this render object and
       * let the active aquarium create
       * its own version.
       */
      if (
        !currentScene ||
        !currentAquarium ||
        currentScene !== scene ||
        currentAquarium !== aquarium
      ) {
        view.destroy();

        aquarium.removeFish(
          created.id,
        );

        return;
      }

      /*
       * Another async load may already
       * have finished for this fish.
       */
      if (
        threeFishRef.current.has(
          created.id,
        )
      ) {
        view.destroy();

        aquarium.removeFish(
          created.id,
        );

        return;
      }

      view.group.position.set(
        fish.position.x,
        fish.position.y,
        fish.position.z,
      );

      /*
       * Store the app fish ID on the
       * Three.js group so raycasting can
       * identify which fish was clicked.
       */
      view.group.userData.fishId =
        created.id;

      view.group.traverse(
        (object) => {
          object.userData.fishId =
            created.id;
        },
      );

      scene.add(
        view.group,
      );

      threeFishRef.current.set(
        created.id,
        {
          view,
        },
      );
    } catch (error) {
      aquarium.removeFish(
        created.id,
      );

      console.error(
        'Failed to create 3D fish:',
        error,
      );
    } finally {
      /*
       * Only clear loading state if this
       * aquarium is still active.
       *
       * Otherwise a newer aquarium may
       * already be loading the same fish.
       */
      if (
        aquariumRef.current ===
        aquarium
      ) {
        loadingFishRef.current.delete(
          created.id,
        );
      }
    }
  };

  useEffect(() => {
    createdFishRef.current =
      createdFish;

    if (
      !sceneRef.current ||
      !aquariumRef.current
    ) {
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

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    /*
     * Aquarium dimensions
     */
    const tankWidth = 10;
    const tankHeight = 6;
    const tankDepth = 4;

    /*
     * Simulation
     */
    const aquarium =
      new Aquarium({
        width: tankWidth,
        height: tankHeight,
        depth: tankDepth,
      });

    aquariumRef.current =
      aquarium;

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
 * Underwater environment
 */
    const underwaterEffects =
      createUnderwaterEffects(
        scene,
        tankWidth,
        tankHeight,
        tankDepth,
      );

    /*
 * Water surface + underwater light
 */
    const waterEffects =
      createWaterEffects(
        scene,
        tankWidth,
        tankHeight,
        tankDepth,
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
     * Shared food rendering resources.
     */
    const foodGeometry =
      new THREE.SphereGeometry(
        0.09,
        10,
        10,
      );

    const foodMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x7c3f00,
        roughness: 0.9,
      });

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
     * Feeding
     *
     * Convert pointer coordinates into
     * a ray going through the aquarium.
     */
    const raycaster =
      new THREE.Raycaster();

    const pointer =
      new THREE.Vector2();

    /*
     * Intersect the pointer ray with
     * the middle of the tank.
     *
     * We then give the food a random Z
     * position so the fish must move
     * through real depth to reach it.
     */
    const feedingPlane =
      new THREE.Plane(
        new THREE.Vector3(
          0,
          0,
          1,
        ),
        0,
      );

    const intersection =
      new THREE.Vector3();

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const rect =
        renderer.domElement
          .getBoundingClientRect();

      if (
        rect.width === 0 ||
        rect.height === 0
      ) {
        return;
      }

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

      /*
       * First check whether the user
       * clicked one of the fish.
       *
       * Feeding only happens when no fish
       * was selected.
       */
      const fishObjects =
        Array.from(
          threeFishRef.current.values(),
        ).map(
          ({ view }) =>
            view.group,
        );

      const fishHits =
        raycaster.intersectObjects(
          fishObjects,
          true,
        );

      if (fishHits.length > 0) {
        const clickedObject =
          fishHits[0].object;

        const fishId =
          clickedObject.userData
            .fishId as
            | string
            | undefined;

        if (fishId) {
          const created =
            createdFishRef.current.find(
              (fish) =>
                fish.id === fishId,
            );

          if (created) {
            onFishSelect?.(
              created,
            );

            /*
             * Important:
             *
             * Clicking a fish should NOT
             * also drop food.
             */
            return;
          }
        }
      }

      /*
       * No fish was clicked.
       * Treat the click as feeding.
       */
      const hit =
        raycaster.ray.intersectPlane(
          feedingPlane,
          intersection,
        );

      if (!hit) {
        return;
      }

      const x =
        THREE.MathUtils.clamp(
          intersection.x,
          -tankWidth / 2 +
          0.5,
          tankWidth / 2 -
          0.5,
        );

      const y =
        THREE.MathUtils.clamp(
          intersection.y,
          -tankHeight / 2 +
          0.5,
          tankHeight / 2 -
          0.5,
        );

      /*
       * Random depth gives each pellet
       * a genuine 3D position.
       */
      const z =
        (
          Math.random() -
          0.5
        ) *
        (
          tankDepth -
          1
        );

      const id =
        crypto.randomUUID();

      aquarium.addFood({
        id,

        position: {
          x,
          y,
          z,
        },
      });

      const pellet =
        new THREE.Mesh(
          foodGeometry,
          foodMaterial,
        );

      pellet.position.set(
        x,
        y,
        z,
      );

      scene.add(
        pellet,
      );

      foodMeshesRef.current.set(
        id,
        pellet,
      );
    };

    renderer.domElement
      .addEventListener(
        'pointerdown',
        handlePointerDown,
      );

    /*
     * Existing persisted fish.
     *
     * Clear stale loading state left by
     * a previous React lifecycle before
     * starting the active aquarium.
     */
    loadingFishRef.current.clear();

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

      const deltaTime =
        Math.min(
          clock.getDelta(),
          0.05,
        );

      const elapsed =
        clock.elapsedTime;

      /*
       * Update the real 3D simulation.
       */
      aquarium.update(
        deltaTime,
      );

      /*
 * Bubbles + suspended particles
 */
      underwaterEffects.update(
        deltaTime,
        elapsed,
      );

      waterEffects.update(
        deltaTime,
        elapsed,
      );

      /*
       * Synchronize food.
       */
      const existingFoodIds =
        new Set<string>();

      for (
        const food of
        aquarium.getFood()
        ) {
        existingFoodIds.add(
          food.id,
        );

        const pellet =
          foodMeshesRef.current.get(
            food.id,
          );

        if (!pellet) {
          continue;
        }

        pellet.position.set(
          food.position.x,
          food.position.y,
          food.position.z,
        );

        pellet.rotation.x +=
          deltaTime * 0.8;

        pellet.rotation.y +=
          deltaTime * 1.1;
      }

      /*
       * Food disappears from the
       * simulation after it is eaten.
       * Remove its Three.js object too.
       */
      for (
        const [
          id,
          pellet,
        ] of
        foodMeshesRef.current
        ) {
        if (
          existingFoodIds.has(
            id,
          )
        ) {
          continue;
        }

        scene.remove(
          pellet,
        );

        foodMeshesRef.current.delete(
          id,
        );
      }

      /*
       * Plants
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
       * Synchronize rendered fish with
       * the real 3D simulation.
       */
      for (
        const fish of
        aquarium.getFish()
        ) {
        const rendered =
          threeFishRef.current.get(
            fish.id,
          );

        if (!rendered) {
          continue;
        }

        const {
          view,
        } = rendered;

        view.group.position.set(
          fish.position.x,
          fish.position.y,
          fish.position.z,
        );

        const velocityMagnitude =
          Math.sqrt(
            fish.velocity.x *
            fish.velocity.x +
            fish.velocity.y *
            fish.velocity.y +
            fish.velocity.z *
            fish.velocity.z,
          );

        const speedRatio =
          fish.speed > 0
            ? velocityMagnitude /
            fish.speed
            : 1;

        /*
         * Vertical movement tilts the
         * complete fish slightly.
         */
        const verticalTilt =
          Math.max(
            -0.25,
            Math.min(
              0.25,
              fish.velocity.y *
              0.18,
            ),
          );

        view.group.rotation.z =
          verticalTilt;

        /*
         * ThreeFish handles Z movement
         * visually while keeping the
         * original drawing readable.
         */
        view.update(
          elapsed *
          (
            3.5 +
            speedRatio * 2
          ),

          0.55 +
          speedRatio * 0.45,

          fish.direction,

          fish.velocity.z,
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

      renderer.domElement
        .removeEventListener(
          'pointerdown',
          handlePointerDown,
        );

      sceneRef.current =
        null;

      aquariumRef.current =
        null;

      for (
        const rendered of
        threeFishRef.current.values()
        ) {
        rendered.view.destroy();
      }

      threeFishRef.current.clear();

      loadingFishRef.current.clear();

      underwaterEffects.destroy();
      waterEffects.destroy();

      /*
       * Food meshes share geometry and
       * material, so remove meshes first
       * and dispose shared resources once.
       */
      for (
        const pellet of
        foodMeshesRef.current.values()
        ) {
        scene.remove(
          pellet,
        );
      }

      foodMeshesRef.current.clear();

      foodGeometry.dispose();
      foodMaterial.dispose();

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