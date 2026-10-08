
import * as THREE from 'three';

/**
 * Soft animated underwater sunlight on the sand.
 * Rendered on a separate transparent canvas behind
 * the main aquarium canvas.
 */
export function createSandCaustics(
  _scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: camera.aspect },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,

    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,

    fragmentShader: `
      precision highp float;

      varying vec2 vUv;

      uniform float uTime;
      uniform float uAspect;

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

      void main() {
        vec2 uv = vUv;
        float t = uTime;

        vec2 p = vec2(
          (uv.x - 0.5) * uAspect,
          uv.y
        );

        // Gentle water distortion.
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

        // Soft light with occasional brighter streaks.
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

        // Mask the sandy opening.
        float bottomFade = smoothstep(
          0.015,
          0.12,
          uv.y
        );

        float topFade =
          1.0 - smoothstep(
            0.25,
            0.44,
            uv.y
          );

        float halfWidth = mix(
          0.46,
          0.27,
          smoothstep(
            0.04,
            0.44,
            uv.y
          )
        );

        float sides =
          1.0 - smoothstep(
            halfWidth - 0.10,
            halfWidth,
            abs(uv.x - 0.5)
          );

        float mask =
          bottomFade *
          topFade *
          sides;

        // Soft fade near the edges of the sand.
        float depthStrength = mix(
          0.65,
          1.0,
          1.0 - smoothstep(
            0.08,
            0.43,
            uv.y
          )
        );

        float alpha =
          light *
          mask *
          depthStrength *
          0.42;

        // Warm-white reflected sunlight.
        vec3 sunlight = vec3(
          1.0,
          0.97,
          0.88
        );

        gl_FragColor = vec4(
          sunlight,
          alpha
        );
      }
    `,

    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const geometry =
    new THREE.PlaneGeometry(2, 2);

  const mesh =
    new THREE.Mesh(geometry, material);

  const overlayScene = new THREE.Scene();
  overlayScene.add(mesh);

  const overlayCamera = new THREE.Camera();

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
  });

  renderer.setClearColor(0x000000, 0);

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.zIndex = '0';

  const resize = (
    activeCamera: THREE.PerspectiveCamera,
  ) => {
    uniforms.uAspect.value =
      activeCamera.aspect;

    const parent =
      renderer.domElement.parentElement;

    if (parent) {
      renderer.setSize(
        parent.clientWidth,
        parent.clientHeight,
        false,
      );
    }
  };

  return {
    element: renderer.domElement,

    update(elapsed: number) {
      uniforms.uTime.value = elapsed;

      renderer.render(
        overlayScene,
        overlayCamera,
      );
    },

    resize,

    destroy() {
      renderer.domElement.remove();

      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
