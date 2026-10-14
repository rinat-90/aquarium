
import * as THREE from 'three';
import type { AquariumSubstrate } from '../../features/aquarium-customization/types';

/**
 * Cartoon 2D seabed.
 *
 * Drawn in the main scene after the background and
 * before fish. No additional WebGL canvas or 3D floor.
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
          sin(dot(p, vec2(127.1, 311.7))) *
          43758.5453
        );
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));

        return mix(
          mix(a, b, f.x),
          mix(c, d, f.x),
          f.y
        );
      }

      // Smooth, gently rolling cartoon dunes.
      float duneHeight(float x) {
        return 0.155
          + 0.018 * sin(x * 8.0 + 0.3)
          + 0.014 * sin(x * 15.0 - 0.8)
          + 0.009 * sin(x * 24.0 + 1.4);
      }

      // Smaller rolling ridge in front of the main dune.
      float foregroundHeight(float x) {
        return 0.060
          + 0.014 * sin(x * 12.0 + 1.8)
          + 0.009 * sin(x * 21.0 - 0.5);
      }

      vec3 substrateBase() {
        if (uSubstrate < 0.5) {
          return vec3(0.96, 0.75, 0.43);
        }

        if (uSubstrate < 1.5) {
          return vec3(0.97, 0.92, 0.75);
        }

        if (uSubstrate < 2.5) {
          return vec3(0.57, 0.59, 0.56);
        }

        return vec3(0.25, 0.29, 0.39);
      }

      vec3 substrateLight() {
        if (uSubstrate < 0.5) {
          return vec3(1.0, 0.89, 0.60);
        }

        if (uSubstrate < 1.5) {
          return vec3(1.0, 0.98, 0.88);
        }

        if (uSubstrate < 2.5) {
          return vec3(0.76, 0.74, 0.67);
        }

        return vec3(0.42, 0.47, 0.60);
      }

      vec3 substrateShadow() {
        if (uSubstrate < 0.5) {
          return vec3(0.72, 0.47, 0.27);
        }

        if (uSubstrate < 1.5) {
          return vec3(0.73, 0.69, 0.59);
        }

        if (uSubstrate < 2.5) {
          return vec3(0.32, 0.38, 0.40);
        }

        return vec3(0.13, 0.16, 0.24);
      }

      // Scattered little cartoon stones.
      // No repeating uniform grid of dots.
      vec3 addStones(vec2 uv, vec3 color) {
        vec2 p = vec2(
          uv.x * uAspect * 28.0,
          uv.y * 28.0
        );

        vec2 cell = floor(p);
        vec2 local = fract(p) - 0.5;

        float randomValue = hash21(cell + 4.0);

        // Only some cells contain stones.
        if (randomValue < 0.83) {
          return color;
        }

        vec2 offset = vec2(
          hash21(cell + 12.0),
          hash21(cell + 31.0)
        ) * 0.55 - 0.275;

        float size = mix(
          0.08,
          0.20,
          hash21(cell + 19.0)
        );

        vec2 delta = local - offset;

        // Slightly flattened, rounded pebble.
        float shape = length(
          delta / vec2(1.0, 0.65)
        );

        float stone = 1.0 - smoothstep(
          size - 0.025,
          size + 0.025,
          shape
        );

        float variation = hash21(cell + 48.0);

        vec3 stoneColor = mix(
          vec3(0.98, 0.58, 0.48),
          vec3(0.48, 0.68, 0.83),
          variation
        );

        if (uSubstrate > 1.5 && uSubstrate < 2.5) {
          stoneColor = mix(
            vec3(0.43, 0.46, 0.48),
            vec3(0.82, 0.75, 0.62),
            variation
          );
        }

        if (uSubstrate > 2.5) {
          stoneColor = mix(
            vec3(0.31, 0.36, 0.51),
            vec3(0.53, 0.47, 0.66),
            variation
          );
        }

        // Small highlight on the top-left of each stone.
        float highlight = 1.0 - smoothstep(
          0.0,
          size,
          length(
            (delta + vec2(0.035, 0.035)) /
            vec2(1.0, 0.65)
          )
        );

        stoneColor += highlight * 0.10;

        return mix(color, stoneColor, stone * 0.9);
      }

      void main() {
        vec2 uv = vUv;

        float x = uv.x;

        float backDune = duneHeight(x);
        float frontDune = foregroundHeight(x);

        // Anti-aliased upper edge.
        float edgeSoftness = max(
          fwidth(uv.y) * 1.5,
          0.002
        );

        float sandMask =
          1.0 - smoothstep(
            backDune - edgeSoftness,
            backDune + edgeSoftness,
            uv.y
          );

        float frontMask =
          1.0 - smoothstep(
            frontDune - edgeSoftness,
            frontDune + edgeSoftness,
            uv.y
          );

        vec3 base = substrateBase();
        vec3 lightColor = substrateLight();
        vec3 shadowColor = substrateShadow();

        // Broad, smooth shading across the dunes.
        float slope = smoothstep(
          -0.025,
          0.025,
          sin(x * 11.0 + 0.7)
        );

        vec3 color = mix(
          base,
          lightColor,
          slope * 0.34
        );

        // Very subtle sand texture.
        float fineGrain = hash21(
          floor(
            vec2(uv.x * uAspect, uv.y) * 420.0
          )
        );

        float softGrain = noise2(
          vec2(uv.x * uAspect, uv.y) * 65.0
        );

        color += (fineGrain - 0.5) * 0.025;
        color += (softGrain - 0.5) * 0.045;

        // Darker contour just below the dune crest.
        float crestShadow = 1.0 - smoothstep(
          0.0,
          0.035,
          backDune - uv.y
        );

        color = mix(
          color,
          shadowColor,
          crestShadow * 0.22
        );

        // Soft foreground dune adds cartoon layering.
        vec3 frontColor = mix(
          base,
          lightColor,
          0.38
        );

        float frontShade = smoothstep(
          0.0,
          0.065,
          frontDune - uv.y
        );

        frontColor = mix(
          frontColor,
          shadowColor,
          frontShade * 0.12
        );

        color = mix(
          color,
          frontColor,
          frontMask * 0.68
        );

        // Tiny scattered colorful stones.
        color = addStones(uv, color);

        // Gentle animated light moving over the sand.
        float caustic = sin(
          uv.x * 23.0 +
          sin(uv.y * 17.0 + uTime * 0.24)
        );

        caustic *= sin(
          uv.y * 21.0 -
          uTime * 0.18
        );

        float shimmer = smoothstep(
          0.48,
          0.95,
          caustic
        );

        color = mix(
          color,
          lightColor,
          shimmer * 0.075
        );

        // Keep the seabed at the bottom of the screen.
        // No oval or spotlight-shaped mask.
        gl_FragColor = vec4(
          color,
          sandMask
        );
      }
    `,

    // Render in the opaque pass before fish,
    // while blending the curved 2D edge.
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

  // Background is -10000; floor is -9999.
  // Normal fish geometry renders afterward.
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
