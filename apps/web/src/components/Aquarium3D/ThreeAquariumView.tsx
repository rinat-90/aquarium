import {
  loadPublishedScenery,
  subscribeToPublishedScenery,
} from '../../features/aquarium-customization/publishedScenery';
import { useEffect, useRef } from 'react';

import * as THREE from 'three';
import './AquariumQuickActions.css';

import { Aquarium } from '@aquarium/aquarium-engine';

import { createThreeFish, type ThreeFish } from './ThreeFish';

import { createUnderwaterEffects } from './createUnderwaterEffects';

import { createWaterEffects } from './createWaterEffects';

import { createThreeModelFish, type ThreeModelFish } from './ThreeModelFish.ts';

import { createSandCaustics } from './createSandCaustics';

import type { CreatedFish } from '../../types/fish.ts';

import { createGraphicsQualityController } from './createGraphicsQualityController';

import { createAquariumEnvironment } from './environment/createAquariumEnvironment';
import type { AquariumEnvironmentController } from './environment/createAquariumEnvironment';

import {
  DEFAULT_AQUARIUM_CUSTOMIZATION,
  type AquariumCustomization,
} from '../../features/aquarium-customization/types';

type ThreeAquariumViewProps = {
  createdFish: CreatedFish[];
  appearance?: AquariumCustomization;
  onAppearanceChange?: (next: AquariumCustomization) => void;
  /** Increment to drop a handful of pellets from the water surface. */
  feedSequence?: number;

  onFishSelect?: (fish: CreatedFish) => void;
  /** Disable fish selection and click-to-feed on display-only screens. */
  interactive?: boolean;
  /** Show renderer performance statistics. */
  showDebugStats?: boolean;
  /** Render inside a parent container instead of covering the viewport. */
  embedded?: boolean;

  decorationEditing?: boolean;
  onDecorationMove?: (id: string, normalizedX: number) => void;
  selectedDecorationId?: string | null;
  onDecorationSelect?: (id: string | null) => void;
};

type RenderedFish = {
  view: ThreeFish | ThreeModelFish;
};

export function ThreeAquariumView({
  createdFish,
  appearance,
  onAppearanceChange,
  feedSequence = 0,
  onFishSelect,
  interactive = true,
  showDebugStats = import.meta.env.DEV,
  embedded = false,
  decorationEditing = false,
  onDecorationMove,
  selectedDecorationId = null,
  onDecorationSelect,
}: ThreeAquariumViewProps) {
  // The catalog is shared by the editor, phone renderer and TV renderer.
  // A loaded catalog updates existing meshes without recreating the scene.
  useEffect(() => {
    const unsubscribe = subscribeToPublishedScenery(() => {
      environmentRef.current?.setAppearance(appearanceRef.current);
    });
    void loadPublishedScenery();
    return unsubscribe;
  }, []);

  const environmentRef = useRef<AquariumEnvironmentController | null>(null);
  const appearanceRef = useRef(appearance ?? DEFAULT_AQUARIUM_CUSTOMIZATION);
  appearanceRef.current = appearance ?? DEFAULT_AQUARIUM_CUSTOMIZATION;

  const decorationEditingRef = useRef(decorationEditing);
  const onDecorationMoveRef = useRef(onDecorationMove);
  const onDecorationSelectRef = useRef(onDecorationSelect);

  decorationEditingRef.current = decorationEditing;
  onDecorationMoveRef.current = onDecorationMove;
  onDecorationSelectRef.current = onDecorationSelect;

  useEffect(() => {
    environmentRef.current?.setSelectedDecoration(selectedDecorationId);
  }, [selectedDecorationId]);

  useEffect(() => {
    environmentRef.current?.setAppearance(appearance ?? DEFAULT_AQUARIUM_CUSTOMIZATION);
  }, [appearance]);

  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);

  const aquariumRef = useRef<Aquarium | null>(null);

  const threeFishRef = useRef(new Map<string, RenderedFish>());

  const loadingFishRef = useRef(new Set<string>());

  const createdFishRef = useRef(createdFish);

  // Stable bridge from the toolbar prop into the existing Three.js scene.
  const feedFromToolbarRef = useRef<(() => void) | null>(null);
  const lastFeedSequenceRef = useRef(feedSequence);

  useEffect(() => {
    if (feedSequence !== lastFeedSequenceRef.current) {
      lastFeedSequenceRef.current = feedSequence;
      feedFromToolbarRef.current?.();
    }
  }, [feedSequence]);

  const foodMeshesRef = useRef(new Map<string, THREE.Mesh>());

  const removeCreatedFish = (id: string) => {
    const rendered = threeFishRef.current.get(id);

    if (rendered) {
      sceneRef.current?.remove(rendered.view.group);
      rendered.view.destroy();
      threeFishRef.current.delete(id);
    }

    // Remove the fish from the swimming simulation too.
    aquariumRef.current?.removeFish(id);
  };

  const addCreatedFish = async (created: CreatedFish) => {
    /*
     * Capture the exact scene + aquarium
     * this load belongs to.
     */
    const scene = sceneRef.current;

    const aquarium = aquariumRef.current;
    if (!scene || !aquarium) {
      return;
    }

    if (threeFishRef.current.has(created.id)) {
      return;
    }

    if (loadingFishRef.current.has(created.id)) {
      return;
    }

    // Do not create fish that have already been released.
    if (!createdFishRef.current.some((item) => item.id === created.id)) {
      return;
    }

    loadingFishRef.current.add(created.id);

    /*
     * Add the fish to this exact
     * simulation instance.
     */
    const species =
      created.type === '3d'
        ? created.model === 'angelfish'
          ? 'angelfish'
          : created.model === 'guppy'
            ? 'guppy'
            : 'basic'
        : 'basic';

    const fish = aquarium.createFish(created.id, created.size, species);

    try {
      /*
       * Texture loading is async.
       *
       * React may destroy/recreate the
       * aquarium while this is waiting.
       */
      let view: ThreeFish | ThreeModelFish;

      if (created.type === 'drawn') {
        view = await createThreeFish(created.image, 1.3 * created.size, created.headDirection);
      } else {
        view = createThreeModelFish(
          created.bodyColor,
          created.finColor,
          created.paintImage,
          created.size,
          created.model === 'angelfish'
            ? 'angelfish'
            : created.model === 'guppy'
              ? 'guppy'
              : 'classic',
        );
      }

      // The fish may have been released while its texture was loading.
      if (!createdFishRef.current.some((item) => item.id === created.id)) {
        view.destroy();
        aquarium.removeFish(created.id);
        return;
      }

      const currentScene = sceneRef.current;

      const currentAquarium = aquariumRef.current;

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

        aquarium.removeFish(created.id);

        return;
      }

      /*
       * Another async load may already
       * have finished for this fish.
       */
      if (threeFishRef.current.has(created.id)) {
        view.destroy();
        return;
      }

      view.group.position.set(fish.position.x, fish.position.y, fish.position.z);

      /*
       * Store the app fish ID on the
       * Three.js group so raycasting can
       * identify which fish was clicked.
       */
      view.group.userData.fishId = created.id;

      view.group.traverse((object) => {
        object.userData.fishId = created.id;
      });

      scene.add(view.group);

      threeFishRef.current.set(created.id, {
        view,
      });
    } catch (error) {
      aquarium.removeFish(created.id);

      console.error('Failed to create 3D fish:', error);
    } finally {
      /*
       * Only clear loading state if this
       * aquarium is still active.
       *
       * Otherwise a newer aquarium may
       * already be loading the same fish.
       */
      if (aquariumRef.current === aquarium) {
        loadingFishRef.current.delete(created.id);
      }
    }
  };

  useEffect(() => {
    createdFishRef.current = createdFish;

    const aquarium = aquariumRef.current;
    if (!sceneRef.current || !aquarium) return;

    const activeIds = new Set(createdFish.map((fish) => fish.id));

    // Remove released fish from both rendering and simulation.
    for (const id of threeFishRef.current.keys()) {
      if (!activeIds.has(id)) {
        removeCreatedFish(id);
      }
    }

    // A drawn fish may still be waiting for its texture.
    // Its pending load will be discarded by the guard above.
    for (const id of loadingFishRef.current) {
      if (!activeIds.has(id)) {
        aquarium.removeFish(id);
      }
    }

    for (const created of createdFish) {
      void addCreatedFish(created);
    }
  }, [createdFish]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    /*
     * Aquarium dimensions
     */
    const tankWidth = 16;
    const tankHeight = 10;
    const tankDepth = 10;

    /*
     * Simulation
     */
    const aquarium = new Aquarium({
      width: tankWidth,
      height: tankHeight,
      depth: tankDepth,
    });

    aquariumRef.current = aquarium;

    /*
     * Scene
     */
    const scene = new THREE.Scene();

    sceneRef.current = scene;

    /*
     * The illustrated aquarium is rendered
     * by the container behind the transparent
     * WebGL canvas.
     */
    scene.background = null;

    /*
     * Underwater environment
     */
    const underwaterEffects = createUnderwaterEffects(scene, tankWidth, tankHeight, tankDepth);

    const graphicsQuality = createGraphicsQualityController('low');

    /*
     * Dynamic water lighting.
     *
     * This renders animated sunlight shafts and
     * screen-aligned caustics over the illustrated
     * aquarium background.
     */
    const waterEffects = createWaterEffects(
      scene,
      tankWidth,
      tankHeight,
      tankDepth,
      graphicsQuality.getQuality(),
    );

    /*
     * Camera
     */
    const camera = new THREE.PerspectiveCamera(
      45,

      container.clientWidth / container.clientHeight,

      0.1,
      100,
    );

    camera.position.set(0, 2, 12);

    camera.lookAt(0, 0, 0);

    waterEffects.setCamera(camera);

    const sandCaustics = createSandCaustics(scene, camera);

    /*
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setClearColor(0x000000, 0);

    const highPixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    const lowPixelRatio = Math.min(window.devicePixelRatio || 1, 0.45);

    renderer.setPixelRatio(graphicsQuality.getQuality() === 'low' ? lowPixelRatio : highPixelRatio);

    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.05;

    // The 2D substrate is rendered inside the main Three.js scene,
    // behind the fish. No separate canvas is needed.
    sandCaustics.resize(camera);

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    renderer.domElement.style.touchAction = 'none';

    container.appendChild(renderer.domElement);

    /*
     * Lighting
     */
    /*
     * A hemisphere light gives the tank
     * a brighter surface and a cooler,
     * darker lower half without putting
     * a visible spotlight in the scene.
     */
    const waterLight = new THREE.HemisphereLight(0xc9f7ff, 0x174957, 1.35);

    scene.add(waterLight);

    /*
     * Soft ambient fill.
     *
     * Fish can turn through the full X/Z plane,
     * so some orientations receive very little
     * directional light. Keep enough ambient
     * underwater light that their chosen colors
     * never become almost black.
     */
    const ambientLight = new THREE.AmbientLight(0xbfefff, 1.15);

    scene.add(ambientLight);

    /*
     * Soft daylight from above/front.
     */
    const sunlight = new THREE.DirectionalLight(0xe8fbff, 1.65);

    sunlight.position.set(-3.5, 7.5, 5);

    scene.add(sunlight);

    /*
     * Very small fill so the front of
     * rocks and plants does not become
     * completely flat or black.
     */
    const frontFill = new THREE.DirectionalLight(0x8edce8, 0.32);

    frontFill.position.set(3, 1, 8);

    scene.add(frontFill);

    // One controller owns the appearance and lifecycle of scene effects.
    const environment = createAquariumEnvironment({
      scene,
      camera,
      appearance: appearance ?? DEFAULT_AQUARIUM_CUSTOMIZATION,
      lighting: {
        hemisphere: waterLight,
        ambient: ambientLight,
        sunlight,
        frontFill,
      },
      underwaterEffects,
      waterEffects,
      sandCaustics,
    });
    environmentRef.current = environment;
    environment.setSelectedDecoration(selectedDecorationId);

    /*
     * Shared food rendering resources.
     */
    const foodGeometry = new THREE.SphereGeometry(0.09, 10, 10);

    const foodMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c3f00,
      roughness: 0.9,
    });

    /*
     * Feeding
     *
     * Convert pointer coordinates into
     * a ray going through the aquarium.
     */
    const raycaster = new THREE.Raycaster();

    const pointer = new THREE.Vector2();

    let draggedDecorationId: string | null = null;
    let activeDragPointerId: number | null = null;

    const updatePointerRay = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) return null;

      const normalizedX = THREE.MathUtils.clamp(
        (event.clientX - rect.left) / rect.width,
        0.06,
        0.94,
      );

      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(pointer, camera);

      return normalizedX;
    };

    const handleDecorationPointerDown = (event: PointerEvent): boolean => {
      if (!decorationEditingRef.current) return false;
      if (activeDragPointerId !== null) return true;
      if (event.button !== 0 && event.pointerType === 'mouse') return true;

      // While decorating, prevent feeding and fish selection.
      const normalizedX = updatePointerRay(event);

      if (normalizedX === null) return true;

      const id = environmentRef.current?.getDecorationAtPoint(raycaster);

      onDecorationSelectRef.current?.(id ?? null);
      environmentRef.current?.setSelectedDecoration(id ?? null);
      if (!id) return true;

      environmentRef.current?.setDraggingDecoration(id);
      draggedDecorationId = id;
      activeDragPointerId = event.pointerId;

      // Keep receiving moves even when the pointer leaves the decoration.
      if (renderer.domElement.isConnected) {
        renderer.domElement.setPointerCapture(event.pointerId);
      }

      event.preventDefault();

      return true;
    };

    const handleDecorationPointerMove = (event: PointerEvent) => {
      if (
        !decorationEditingRef.current ||
        draggedDecorationId === null ||
        activeDragPointerId !== event.pointerId
      ) {
        return;
      }

      const normalizedX = updatePointerRay(event);

      if (normalizedX === null) return;

      environmentRef.current?.moveDecoration(draggedDecorationId, normalizedX);

      // Persist the final position on pointer-up rather than
      // updating React state on every pointer movement.
      event.preventDefault();
    };

    const finishDecorationDrag = (event: PointerEvent, commit: boolean) => {
      if (draggedDecorationId === null || activeDragPointerId !== event.pointerId) {
        return;
      }

      const normalizedX = updatePointerRay(event);

      if (commit && normalizedX !== null) {
        onDecorationMoveRef.current?.(draggedDecorationId, normalizedX);
      }

      environmentRef.current?.setDraggingDecoration(null);
      draggedDecorationId = null;
      activeDragPointerId = null;

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const handleDecorationPointerUp = (event: PointerEvent) => {
      finishDecorationDrag(event, true);
    };

    const handleDecorationPointerCancel = (event: PointerEvent) => {
      if (activeDragPointerId !== event.pointerId) return;
      finishDecorationDrag(event, false);
      environmentRef.current?.setAppearance(appearanceRef.current);
    };

    /*
     * Intersect the pointer ray with
     * the middle of the tank.
     *
     * We then give the food a random Z
     * position so the fish must move
     * through real depth to reach it.
     */
    const feedingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    const intersection = new THREE.Vector3();

    // Both toolbar feeding and click-to-feed use the same engine and meshes.
    const spawnFood = (x: number, y: number, z: number) => {
      const id = THREE.MathUtils.generateUUID();

      aquarium.addFood({ id, position: { x, y, z } });

      const pellet = new THREE.Mesh(foodGeometry, foodMaterial);
      pellet.position.set(x, y, z);
      scene.add(pellet);

      foodMeshesRef.current.set(id, pellet);
    };

    feedFromToolbarRef.current = () => {
      // Drop a small cluster from the upper water surface.
      const centerX = (Math.random() - 0.5) * tankWidth * 0.55;
      for (let i = 0; i < 6; i += 1) {
        const x = THREE.MathUtils.clamp(
          centerX + (Math.random() - 0.5) * 2.4,
          -tankWidth / 2 + 0.5,
          tankWidth / 2 - 0.5,
        );
        const y = tankHeight / 2 - 0.7 - Math.random() * 0.4;
        const z = (Math.random() - 0.5) * (tankDepth - 1);
        spawnFood(x, y, z);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest?.('.aquarium-quick-actions')) {
        return;
      }
      if (handleDecorationPointerDown(event)) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;

      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      /*
       * First check whether the user
       * clicked one of the fish.
       *
       * Feeding only happens when no fish
       * was selected.
       */
      const fishObjects = Array.from(threeFishRef.current.values()).map(({ view }) => view.group);

      const fishHits = raycaster.intersectObjects(fishObjects, true);

      if (fishHits.length > 0) {
        const clickedObject = fishHits[0].object;

        const fishId = clickedObject.userData.fishId as string | undefined;

        if (fishId) {
          const created = createdFishRef.current.find((fish) => fish.id === fishId);

          if (created) {
            onFishSelect?.(created);

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
      const hit = raycaster.ray.intersectPlane(feedingPlane, intersection);

      if (!hit) {
        return;
      }

      const x = THREE.MathUtils.clamp(intersection.x, -tankWidth / 2 + 0.5, tankWidth / 2 - 0.5);

      const y = THREE.MathUtils.clamp(intersection.y, -tankHeight / 2 + 0.5, tankHeight / 2 - 0.5);

      /*
       * Random depth gives each pellet
       * a genuine 3D position.
       */
      const z = (Math.random() - 0.5) * (tankDepth - 1);

      spawnFood(x, y, z);
    };

    if (interactive) {
      // Listen on the tank container so decorative DOM layers cannot
      // accidentally block interaction with the WebGL canvas.
      container.addEventListener('pointerdown', handlePointerDown, true);

      container.addEventListener('pointermove', handleDecorationPointerMove, true);

      container.addEventListener('pointerup', handleDecorationPointerUp, true);

      container.addEventListener('pointercancel', handleDecorationPointerCancel, true);
    }

    /*
     * Existing persisted fish.
     *
     * Clear stale loading state left by
     * a previous React lifecycle before
     * starting the active aquarium.
     */
    loadingFishRef.current.clear();

    for (const created of createdFishRef.current) {
      void addCreatedFish(created);
    }

    /*
     * Animation
     */
    const clock = new THREE.Clock();

    // Development-only overlay: no React re-renders and no production DOM.
    const fpsOverlay = showDebugStats ? document.createElement('div') : null;

    if (fpsOverlay) {
      Object.assign(fpsOverlay.style, {
        position: 'absolute',
        bottom: '24px',
        left: '16px',
        zIndex: '100',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'rgba(0, 18, 30, 0.78)',
        color: '#d8faff',
        font: '12px/1.6 monospace',
        pointerEvents: 'none',
        whiteSpace: 'pre',
      });
      fpsOverlay.textContent = 'FPS: --\nQuality: high\nPixel ratio: --';
      container.appendChild(fpsOverlay);
    }

    let fpsFrames = 0;
    let fpsElapsed = 0;
    let animationFrame = 0;
    let currentQuality = graphicsQuality.getQuality();
    // Reuse this collection across frames to avoid per-frame allocations.
    const existingFoodIds = new Set<string>();

    const animate = () => {
      if (cancelled) {
        return;
      }

      animationFrame = requestAnimationFrame(animate);

      const rawDeltaTime = clock.getDelta();
      const deltaTime = Math.min(rawDeltaTime, 0.05);

      const elapsed = clock.elapsedTime;

      // Use the real frame interval for performance measurements.
      const quality = graphicsQuality.update(rawDeltaTime);

      if (fpsOverlay && rawDeltaTime > 0 && rawDeltaTime <= 0.25) {
        fpsFrames += 1;
        fpsElapsed += rawDeltaTime;

        // Update the overlay once per second, not every frame.
        if (fpsElapsed >= 1) {
          const fps = Math.round(fpsFrames / fpsElapsed);
          const renderInfo = renderer.info.render;

          fpsOverlay.textContent = [
            `FPS: ${fps}`,
            `Quality: ${quality.toUpperCase()}`,
            `Pixel ratio: ${renderer.getPixelRatio().toFixed(2)}`,
            `Fish: ${threeFishRef.current.size}`,
            `Draw calls: ${renderInfo.calls}`,
            `Triangles: ${renderInfo.triangles.toLocaleString()}`,
            `Geometries: ${renderer.info.memory.geometries}`,
            `Textures: ${renderer.info.memory.textures}`,
          ].join('\n');

          fpsFrames = 0;
          fpsElapsed = 0;
        }
      }

      if (quality !== currentQuality) {
        currentQuality = quality;
        environment.setQuality(quality);
        renderer.setPixelRatio(quality === 'low' ? lowPixelRatio : highPixelRatio);
      }

      environment.update(deltaTime, elapsed);

      /*
       * Update the real 3D simulation.
       */
      aquarium.update(deltaTime);

      /*
       * Synchronize food.
       */
      existingFoodIds.clear();

      for (const food of aquarium.getFood()) {
        existingFoodIds.add(food.id);

        const pellet = foodMeshesRef.current.get(food.id);

        if (!pellet) {
          continue;
        }

        pellet.position.set(food.position.x, food.position.y, food.position.z);

        pellet.rotation.x += deltaTime * 0.8;

        pellet.rotation.y += deltaTime * 1.1;
      }

      /*
       * Food disappears from the
       * simulation after it is eaten.
       * Remove its Three.js object too.
       */
      for (const [id, pellet] of foodMeshesRef.current) {
        if (existingFoodIds.has(id)) {
          continue;
        }

        scene.remove(pellet);

        foodMeshesRef.current.delete(id);
      }

      /*
       * Synchronize rendered fish with
       * the real 3D simulation.
       */
      for (const fish of aquarium.getFish()) {
        const rendered = threeFishRef.current.get(fish.id);

        if (!rendered) {
          continue;
        }

        const { view } = rendered;

        view.group.position.set(fish.position.x, fish.position.y, fish.position.z);

        const velocityMagnitude = Math.sqrt(
          fish.velocity.x * fish.velocity.x +
            fish.velocity.y * fish.velocity.y +
            fish.velocity.z * fish.velocity.z,
        );

        const speedRatio = fish.speed > 0 ? velocityMagnitude / fish.speed : 1;

        /*
         * Vertical movement tilts the
         * complete fish slightly.
         */
        const verticalTilt = Math.max(-0.25, Math.min(0.25, fish.velocity.y * 0.18));

        view.group.rotation.z = verticalTilt;

        /*
         * ThreeFish handles Z movement
         * visually while keeping the
         * original drawing readable.
         */
        view.update(
          elapsed * (3.5 + speedRatio * 2),

          0.55 + speedRatio * 0.45,

          fish.direction,
          fish.velocity.z,
          aquarium.getNibbleProgress(fish.id),
        );
      }

      renderer.render(scene, camera);
    };

    animate();

    /*
     * Resize
     */
    const handleResize = () => {
      const width = container.clientWidth;

      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        return;
      }

      camera.aspect = width / height;

      camera.updateProjectionMatrix();

      environment.resize(camera);

      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    /*
     * Cleanup
     */
    return () => {
      cancelled = true;
      feedFromToolbarRef.current = null;

      cancelAnimationFrame(animationFrame);

      window.removeEventListener('resize', handleResize);

      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointermove', handleDecorationPointerMove, true);
      container.removeEventListener('pointerup', handleDecorationPointerUp, true);
      container.removeEventListener('pointercancel', handleDecorationPointerCancel, true);

      sceneRef.current = null;

      aquariumRef.current = null;

      for (const rendered of threeFishRef.current.values()) {
        rendered.view.destroy();
      }

      threeFishRef.current.clear();

      loadingFishRef.current.clear();

      if (environmentRef.current === environment) {
        environmentRef.current = null;
      }
      environment.destroy();

      /*
       * Food meshes share geometry and
       * material, so remove meshes first
       * and dispose shared resources once.
       */
      for (const pellet of foodMeshesRef.current.values()) {
        scene.remove(pellet);
      }

      foodMeshesRef.current.clear();

      foodGeometry.dispose();
      foodMaterial.dispose();

      renderer.dispose();

      fpsOverlay?.remove();
      renderer.domElement.remove();
    };
  }, [interactive, showDebugStats]);

  const selectedDecoration = (appearance?.decorationInstances ?? []).find(
    (item) => item.id === selectedDecorationId,
  );

  const updateSelectedDecoration = (changes: Partial<NonNullable<typeof selectedDecoration>>) => {
    if (!selectedDecoration || !appearance || !onAppearanceChange) return;
    onAppearanceChange({
      ...appearance,
      decorationInstances: (appearance.decorationInstances ?? []).map((item) =>
        item.id === selectedDecoration.id ? { ...item, ...changes } : item,
      ),
    });
  };

  const removeSelectedDecoration = () => {
    if (!selectedDecoration || !appearance || !onAppearanceChange) return;
    onAppearanceChange({
      ...appearance,
      decorationInstances: (appearance.decorationInstances ?? []).filter(
        (item) => item.id !== selectedDecoration.id,
      ),
    });
    onDecorationSelect?.(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: embedded ? 'relative' : 'fixed',
        inset: embedded ? undefined : 0,
        width: embedded ? '100%' : '100vw',
        height: embedded ? '100%' : '100dvh',
        overflow: 'hidden',
        backgroundColor: '#04132f',
      }}
    >
      {decorationEditing && selectedDecoration && onAppearanceChange && (
        <div
          className="aquarium-quick-actions"
          role="toolbar"
          aria-label="Selected decoration actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="aquarium-quick-actions__label">✨ Edit decoration</span>
          <button
            type="button"
            aria-label="Make smaller"
            title="Smaller"
            disabled={selectedDecoration.scale <= 0.3}
            onClick={() =>
              updateSelectedDecoration({
                scale: Math.max(0.3, Number((selectedDecoration.scale - 0.1).toFixed(2))),
              })
            }
          >
            −
          </button>
          <button
            type="button"
            aria-label="Make bigger"
            title="Bigger"
            disabled={selectedDecoration.scale >= 2}
            onClick={() =>
              updateSelectedDecoration({
                scale: Math.min(2, Number((selectedDecoration.scale + 0.1).toFixed(2))),
              })
            }
          >
            +
          </button>
          <span className="aquarium-quick-actions__divider" aria-hidden="true" />
          <button
            type="button"
            aria-label="Rotate left"
            title="Rotate left"
            onClick={() =>
              updateSelectedDecoration({
                rotation: Math.max(
                  -Math.PI,
                  Number((selectedDecoration.rotation - Math.PI / 12).toFixed(3)),
                ),
              })
            }
          >
            ↶
          </button>
          <button
            type="button"
            aria-label="Rotate right"
            title="Rotate right"
            onClick={() =>
              updateSelectedDecoration({
                rotation: Math.min(
                  Math.PI,
                  Number((selectedDecoration.rotation + Math.PI / 12).toFixed(3)),
                ),
              })
            }
          >
            ↷
          </button>
          <span className="aquarium-quick-actions__divider" aria-hidden="true" />
          <button
            type="button"
            className="aquarium-quick-actions__delete"
            aria-label="Remove decoration"
            title="Remove decoration"
            onClick={removeSelectedDecoration}
          >
            🗑️
          </button>
          <button
            type="button"
            className="aquarium-quick-actions__close"
            aria-label="Deselect decoration"
            title="Done editing"
            onClick={() => onDecorationSelect?.(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
