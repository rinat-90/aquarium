import * as THREE from 'three';
import type { AquariumEnvironmentPreset } from './presets';

export function createBackground(scene: THREE.Scene, preset: AquariumEnvironmentPreset) {
  const uniforms = {
    topColor: { value: new THREE.Color(preset.background.top) },
    bottomColor: { value: new THREE.Color(preset.background.bottom) },
    uBrightness: { value: 1 },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float uBrightness;
      void main() {
        float t = smoothstep(0.0, 1.0, vUv.y);
        vec3 color = mix(bottomColor, topColor, t) * uBrightness;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10000;
  scene.add(mesh);

  return {
    setPreset(nextPreset: AquariumEnvironmentPreset) {
      uniforms.topColor.value.set(nextPreset.background.top);
      uniforms.bottomColor.value.set(nextPreset.background.bottom);
    },
    setBrightness(brightness: number) {
      uniforms.uBrightness.value = Math.max(0, brightness);
    },
    destroy() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
