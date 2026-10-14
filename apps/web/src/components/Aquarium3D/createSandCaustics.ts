
import * as THREE from 'three';
import type { AquariumSubstrate } from '../../features/aquarium-customization/types';

/**
 * Flat 2D aquarium floor with animated underwater sunlight.
 *
 * Rendered inside the main Three.js scene:
 * background -> substrate -> fish and other objects.
 *
 * No additional WebGL renderer or canvas.
 */
export function createSandCaustics(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const substrateIds: Record<AquariumSubstrate, number> = {
    sand: 0,
    'white-sand': 1,
    pebbles: 2,
    'dark-gravel': 3,
  };

  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: camera.aspect },
    uSubstrate: { value: substrateIds.sand },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,

    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;

        // Flat, screen-aligned 2D layer.
        // Depth 0.5 is in front of the background
        // but behind normal aquarium geometry.
        gl_Position = vec4(position.xy, 0.5, 1.0);
      }
    `,

    fragmentShader: `
      precision highp float;

      varying vec2 vUv;

      uniform float uTime;
      uniform float uAspect;
      uniform float uSubstrate;

      float hash21(vec2 p) {
        return fract(
          sin(dot(p, vec2(127.1, 311.7))) * 43758.5453
        );
      }

      float waveField(vec2 p, float t) {
        float a = sin(
          p.x * 11.0 +
          sin(p.y * 5.2 + t * 0.24) * 1.5 +
          t * 0.31
        );

        float b = sin(
          p.y * 9.0 -
          p.x * 3.8 +
          sin(p.x * 6.5 - t * 0.21) * 1.3 -
          t * 0.26
        );

        float c = sin(
          (p.x + p.y * 0.75) * 13.0 +
          sin(p.y * 7.0 + t * 0.19) * 1.2 +
          t * 0.22
        );

        return (
          a * 0.42 +
          b * 0.34 +
          c * 0.24
        );
      }

      vec3 getSubstrateColor(vec2 uv) {
        vec2 p = vec2(uv.x * uAspect, uv.y);
        float grain = hash21(floor(p * 550.0));

        // Natural golden sand.
        if (uSubstrate < 0.5) {
          return vec3(0.70, 0.58, 0.38)
            + (grain - 0.5) * 0.08;
        }

        // White tropical sand.
        if (uSubstrate < 1.5) {
          return vec3(0.87, 0.86, 0.77)
            + (grain - 0.5) * 0.06;
        }

        // Small illustrated pebbles.
        if (uSubstrate < 2.5) {
          vec2 cell = p * 105.0;
          vec2 id = floor(cell);
          vec2 local = fract(cell) - 0.5;

          vec2 offset = vec2(
            hash21(id + 13.0),
            hash21(id + 37.0)
          ) * 0.26 - 0.13;

          float distanceToCenter = length(
            (local - offset) * vec2(1.0, 1.2)
          );

          float stone = 1.0 - smoothstep(
            0.33,
            0.43,
            distanceToCenter
          );

          float variation = hash21(id + 71.0);

          vec3 gravel = vec3(0.28, 0.30, 0.29);

          vec3 pebble = mix(
            vec3(0.38, 0.34, 0.29),
            vec3(0.72, 0.68, 0.59),
            variation
          );

          return mix(gravel, pebble, stone);
        }

        // Dark charcoal gravel.
        return vec3(0.12, 0.14, 0.16)
          + (grain - 0.5) * 0.08;
      }

      void main() {
        vec2 uv = vUv;
        float t = uTime;

        vec2 p = vec2(
          (uv.x - 0.5) * uAspect,
          uv.y
        );

        // Gentle underwater distortion.
        p += 0.035 * vec2(
          sin(p.y * 8.0 + t * 0.15),
          cos(p.x * 7.0 - t * 0.13)
        );

        float field = waveField(p, t);

        float detail = waveField(
          p * 1.45 + vec2(1.7, 0.9),
          t * 0.68
        );

        float combined =
          field * 0.78 +
          detail * 0.22;

        float glow = smoothstep(
          -0.12,
          0.42,
          combined
        );

        float streaks = smoothstep(
          0.25,
          0.65,
          combined
        );

        float light =
          glow * 0.65 +
          streaks * 0.35;

        // Soft 2D seabed shape.
        float bottomFade = smoothstep(
          0.005,
          0.07,
          uv.y
        );

        // Keep the floor near the bottom of the screen.
        // Keep the seabed close to the bottom of the aquarium.
        float topFade =
          1.0 - smoothstep(
            0.08,
            0.19,
            uv.y
          );

        float halfWidth = mix(
          0.65,
          0.48,
          smoothstep(
            0.02,
            0.19,
            uv.y
          )
        );

        float sides =
          1.0 - smoothstep(
            halfWidth - 0.12,
            halfWidth,
            abs(uv.x - 0.5)
          );

        float mask =
          bottomFade *
          topFade *
          sides;

        float depthStrength = mix(
          0.65,
          1.0,
          1.0 - smoothstep(
            0.08,
            0.34,
            uv.y
          )
        );

        vec3 substrate = getSubstrateColor(uv);

        vec3 sunlight = vec3(
          1.0,
          0.97,
          0.88
        );

        vec3 color = mix(
          substrate,
          sunlight,
          clamp(
            light * depthStrength * 0.25,
            0.0,
            0.40
          )
        );

        // Alpha blends the floor into the background.
        gl_FragColor = vec4(
          color,
          mask * 0.96
        );
      }
    `,

    // Important:
    // Keep this material in the opaque render pass so it
    // renders before transparent fish and water effects.
    transparent: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,

    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);

  // Background is -10000.
  // Floor comes immediately after it.
  // Fish and water effects render later.
  mesh.renderOrder = -9999;
  mesh.frustumCulled = false;

  scene.add(mesh);

  return {
    setSubstrate(substrate: AquariumSubstrate) {
      uniforms.uSubstrate.value = substrateIds[substrate];
    },

    update(elapsed: number) {
      uniforms.uTime.value = elapsed;
    },

    resize(activeCamera: THREE.PerspectiveCamera) {
      uniforms.uAspect.value = activeCamera.aspect;
    },

    destroy() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
