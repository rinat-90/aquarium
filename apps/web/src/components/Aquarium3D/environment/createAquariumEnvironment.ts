import * as THREE from 'three';

import type {
  AquariumCustomization,
  AquariumDecorationInstance,
} from '../../../features/aquarium-customization/types';

import type { GraphicsQuality } from '../createGraphicsQualityController';
import type { UnderwaterEffects } from '../createUnderwaterEffects';
import type { createWaterEffects } from '../createWaterEffects';
import type { createSandCaustics } from '../createSandCaustics';

import { createBackground } from './createBackground';
import { ENVIRONMENT_PRESETS, LIGHTING_PRESETS } from './presets';
import { getSunnyReefScenery } from '../../../../../../../../Downloads/aquarium-sunny-reef-3d/apps/web/src/features/aquarium-customization/themeRegistry.ts';
import {
  createAquariumDecorations,
  type DecorationInstance,
} from '../decorations/createAquariumDecorations';

import {
  getSeabedScreenY,
} from './seabedGeometry';

type WaterEffects = ReturnType<typeof createWaterEffects>;
type SandCaustics = ReturnType<typeof createSandCaustics>;

type Lighting = {
  hemisphere: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  sunlight: THREE.DirectionalLight;
  frontFill: THREE.DirectionalLight;
};

export type AquariumEnvironmentController = {
  setAppearance(appearance: AquariumCustomization): void;
  update(deltaTime: number, elapsed: number): void;
  setQuality(quality: GraphicsQuality): void;
  resize(camera: THREE.PerspectiveCamera): void;

  getDecorationAtPoint(raycaster: THREE.Raycaster): string | null;
  moveDecoration(id: string, normalizedX: number): void;

  destroy(): void;
  setSelectedDecoration: (id: string | null) => void;
  setDraggingDecoration: (id: string | null) => void;
};

const MAX_DECORATIONS = 30;

/**
 * Coordinates the aquarium environment and its 3D decorations.
 * Uses the existing Three.js scene and render loop.
 */
export function createAquariumEnvironment(options: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  appearance: AquariumCustomization;
  lighting: Lighting;
  underwaterEffects: UnderwaterEffects;
  waterEffects: WaterEffects;
  sandCaustics: SandCaustics;
}): AquariumEnvironmentController {
  const {
    scene,
    lighting,
    underwaterEffects,
    waterEffects,
    sandCaustics,
  } = options;

  const background = createBackground(
    scene,
    ENVIRONMENT_PRESETS[options.appearance.background],
  );

  const decorations = createAquariumDecorations(scene);
  // Non-interactive theme scenery: intentionally separate from kids' decorations.
  const themeScenery = createAquariumDecorations(scene);
  let previousThemeSignature = '';

  let activeCamera = options.camera;
  let currentAppearance = options.appearance;

  // Avoid rebuilding meshes for unrelated appearance changes.
  let previousDecorationSignature = '';

  /**
   * Convert normalized decoration coordinates into
   * world-space positions based on the camera.
   */


  const getDecorationLayout = (
    instances: AquariumDecorationInstance[],
  ): DecorationInstance[] => {
    const camera = activeCamera;

    camera.updateMatrixWorld();

    const raycaster = new THREE.Raycaster();

    const groundPlane = new THREE.Plane(
      new THREE.Vector3(0, 0, 1),
      0,
    );

    const intersection = new THREE.Vector3();

    const screenToWorld = (
      normalizedX: number,
      normalizedY: number,
    ): THREE.Vector3 => {
      raycaster.setFromCamera(
        new THREE.Vector2(
          normalizedX * 2 - 1,
          1 - normalizedY * 2,
        ),
        camera,
      );

      const hit = raycaster.ray.intersectPlane(
        groundPlane,
        intersection,
      );

      return hit?.clone() ?? new THREE.Vector3();
    };

    return instances.slice(0, MAX_DECORATIONS).map((instance) => {
      const normalizedX = THREE.MathUtils.clamp(
        instance.x,
        0.06,
        0.94,
      );

      // Exact dune edge at this horizontal position.
      const seabedY = getSeabedScreenY(normalizedX);

      // Move the base slightly into the sand so it looks
      // naturally planted rather than hovering above it.
      const plantingOffset = 0.012;

      const normalizedY = THREE.MathUtils.clamp(
        seabedY + plantingOffset,
        0,
        1,
      );

      const ground = screenToWorld(
        normalizedX,
        normalizedY,
      );

      return {
        id: instance.id,
        type: instance.assetId,
        x: ground.x,
        y: ground.y,
        scale: instance.scale,
        rotation: instance.rotation,
        color: instance.color,
      };
    });
  };



  const syncDecorations = (force = false) => {
    const instances = currentAppearance.decorationInstances ?? [];

    const signature = JSON.stringify({
      instances,
      aspect: activeCamera.aspect,
      fov: activeCamera.fov,
      position: activeCamera.position.toArray(),
    });

    if (!force && signature === previousDecorationSignature) {
      return;
    }

    previousDecorationSignature = signature;

    decorations.setDecorations(
      getDecorationLayout(instances),
    );
  };

  const syncThemeScenery = (force = false) => {
    const instances = getSunnyReefScenery(currentAppearance);
    const signature = JSON.stringify({
      instances,
      aspect: activeCamera.aspect,
      fov: activeCamera.fov,
      position: activeCamera.position.toArray(),
    });
    if (!force && signature === previousThemeSignature) return;
    previousThemeSignature = signature;
    themeScenery.setDecorations(getDecorationLayout(instances));
  };

  const setAppearance = (appearance: AquariumCustomization) => {
    currentAppearance = appearance;

    const preset = ENVIRONMENT_PRESETS[appearance.background];

    background.setPreset(preset);

    const mood = appearance.lighting;

    const moodBrightness =
      mood === 'sunny' ? 1.5 : mood === 'night' ? 0.42 : 1;

    background.setBrightness(moodBrightness);

    waterEffects.setMood(mood);

    const fogColor = new THREE.Color(preset.fog.color);

    fogColor.multiplyScalar(
      mood === 'sunny' ? 1.2 : mood === 'night' ? 0.55 : 1,
    );

    scene.fog = new THREE.FogExp2(
      fogColor,
      preset.fog.density,
    );

    const light = LIGHTING_PRESETS[appearance.lighting];

    lighting.hemisphere.intensity = light.hemisphereIntensity;
    lighting.ambient.intensity = light.ambientIntensity;
    lighting.sunlight.intensity = light.sunlightIntensity;

    lighting.frontFill.intensity =
      0.32 * (light.sunlightIntensity / 1.65);

    underwaterEffects.setBubbles(appearance.bubbles);

    sandCaustics.setSubstrate(appearance.substrate);

    // Render saved decoration instances immediately.
    syncDecorations();
    syncThemeScenery();
  };

  setAppearance(options.appearance);


  const getDecorationAtPoint = (
    raycaster: THREE.Raycaster,
  ): string | null => {
    return decorations.getDecorationAtPoint(raycaster);
  };

  const moveDecoration = (
    id: string,
    normalizedX: number,
  ) => {
    const instance = (
      currentAppearance.decorationInstances ?? []
    ).find((item) => item.id === id);

    if (!instance) return;

    const updated = {
      ...instance,
      x: THREE.MathUtils.clamp(normalizedX, 0.06, 0.94),
    };

    const layout = getDecorationLayout([updated]);

    const position = layout[0];

    if (!position) return;

    decorations.moveDecoration(
      id,
      position.x,
      position.y,
    );
  };


  return {
    setAppearance,
    getDecorationAtPoint,
    moveDecoration,

    update(deltaTime, elapsed) {
      waterEffects.update(deltaTime, elapsed);
      underwaterEffects.update(deltaTime, elapsed);
      sandCaustics.update(elapsed);
      decorations.update(elapsed);
      themeScenery.update(elapsed);
    },
    setSelectedDecoration(id: string | null) {
      decorations.setSelectedDecoration(id);
    },

    setDraggingDecoration(id: string | null) {
      decorations.setDraggingDecoration(id);
    },

    setQuality(quality) {
      waterEffects.setQuality(quality);
    },

    resize(camera) {
      activeCamera = camera;

      waterEffects.resize(camera);
      sandCaustics.resize(camera);

      // Recalculate positions when the viewport changes.
      syncDecorations(true);
      syncThemeScenery(true);
    },

    destroy() {
      decorations.destroy();
      themeScenery.destroy();

      background.destroy();
      underwaterEffects.destroy();
      waterEffects.destroy();
      sandCaustics.destroy();

      scene.fog = null;
    },
  };
}
