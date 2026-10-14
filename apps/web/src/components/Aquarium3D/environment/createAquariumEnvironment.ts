import * as THREE from 'three';
import type { AquariumCustomization } from '../../../features/aquarium-customization/types';
import type { GraphicsQuality } from '../createGraphicsQualityController';
import type { UnderwaterEffects } from '../createUnderwaterEffects';
import type { createWaterEffects } from '../createWaterEffects';
import type { createSandCaustics } from '../createSandCaustics';
import { createBackground } from './createBackground.ts';
import { ENVIRONMENT_PRESETS, LIGHTING_PRESETS } from './presets';

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
  destroy(): void;
};

/** Coordinates existing effects; never creates a second render loop. */
export function createAquariumEnvironment(options: {
  scene: THREE.Scene;
  appearance: AquariumCustomization;
  lighting: Lighting;
  underwaterEffects: UnderwaterEffects;
  waterEffects: WaterEffects;
  sandCaustics: SandCaustics;
}): AquariumEnvironmentController {
  const { scene, lighting, underwaterEffects, waterEffects, sandCaustics } = options;
  const background = createBackground(scene, ENVIRONMENT_PRESETS[options.appearance.background]);

  const setAppearance = (appearance: AquariumCustomization) => {
    const preset = ENVIRONMENT_PRESETS[appearance.background];
    background.setPreset(preset);
    const mood = appearance.lighting;
    const moodBrightness = mood === 'sunny' ? 1.5 : mood === 'night' ? 0.42 : 1;
    background.setBrightness(moodBrightness);
    waterEffects.setMood(mood);
    const fogColor = new THREE.Color(preset.fog.color);
    fogColor.multiplyScalar(mood === 'sunny' ? 1.2 : mood === 'night' ? 0.55 : 1);
    scene.fog = new THREE.FogExp2(fogColor, preset.fog.density);

    const light = LIGHTING_PRESETS[appearance.lighting];
    lighting.hemisphere.intensity = light.hemisphereIntensity;
    lighting.ambient.intensity = light.ambientIntensity;
    lighting.sunlight.intensity = light.sunlightIntensity;
    // Keep the front fill modest relative to the selected lighting.
    lighting.frontFill.intensity = 0.32 * (light.sunlightIntensity / 1.65);

    underwaterEffects.setBubbles(appearance.bubbles);
    sandCaustics.setSubstrate(appearance.substrate);
    // Decorations will be implemented separately.
  };

  setAppearance(options.appearance);

  return {
    setAppearance,
    update(deltaTime, elapsed) {
      waterEffects.update(deltaTime, elapsed);
      underwaterEffects.update(deltaTime, elapsed);
      sandCaustics.update(elapsed);
    },
    setQuality(quality) {
      waterEffects.setQuality(quality);
    },
    resize(camera) {
      waterEffects.resize(camera);
      sandCaustics.resize(camera);
    },
    destroy() {
      background.destroy();
      underwaterEffects.destroy();
      waterEffects.destroy();
      sandCaustics.destroy();
      scene.fog = null;
    },
  };
}
