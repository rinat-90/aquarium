import * as THREE from 'three';

export type WaterEffects = {
  update: (
    deltaTime: number,
    elapsed: number,
  ) => void;

  destroy: () => void;
};

type Caustic = {
  mesh: THREE.Mesh;
  phase: number;
  baseX: number;
  baseZ: number;
  baseScaleX: number;
  baseScaleY: number;
  speed: number;
};

type LightRay = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  baseX: number;
  baseRotation: number;
  phase: number;
};

export function createWaterEffects(
  scene: THREE.Scene,
  tankWidth: number,
  tankHeight: number,
  tankDepth: number,
): WaterEffects {
  /*
   * WATER SURFACE
   *
   * The previous horizontal plane was visible
   * edge-on from the front camera and produced
   * a strong horizontal band. Keep the animated
   * surface, but make it much subtler and move
   * it slightly above the visible tank area.
   */
  const surfaceGeometry =
    new THREE.PlaneGeometry(
      tankWidth,
      tankDepth,
      32,
      16,
    );

  surfaceGeometry.rotateX(
    -Math.PI / 2,
  );

  const originalPositions =
    Float32Array.from(
      surfaceGeometry.attributes
        .position.array as ArrayLike<number>,
    );

  const surfaceMaterial =
    new THREE.MeshPhysicalMaterial({
      color: 0xb8edf1,
      transparent: true,
      opacity: 0.035,
      roughness: 0.28,
      metalness: 0,
      transmission: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

  const surface =
    new THREE.Mesh(
      surfaceGeometry,
      surfaceMaterial,
    );

  surface.position.y =
    tankHeight / 2 +
    0.08;

  scene.add(surface);

  /*
   * CAUSTICS
   */
  const causticGeometry =
    new THREE.CircleGeometry(
      1,
      32,
    );

  causticGeometry.rotateX(
    -Math.PI / 2,
  );

  const causticMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xd9f4ef,
      transparent: true,
      opacity: 0.018,
      blending:
      THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

  const caustics:
    Caustic[] = [];

  for (
    let index = 0;
    index < 9;
    index++
  ) {
    const mesh =
      new THREE.Mesh(
        causticGeometry,
        causticMaterial,
      );

    const baseX =
      (
        Math.random() -
        0.5
      ) *
      (
        tankWidth -
        1.5
      );

    const baseZ =
      (
        Math.random() -
        0.5
      ) *
      (
        tankDepth -
        0.8
      );

    const baseScaleX =
      0.75 +
      Math.random() *
      0.85;

    const baseScaleY =
      0.3 +
      Math.random() *
      0.35;

    mesh.position.set(
      baseX,
      -tankHeight / 2 +
      0.31,
      baseZ,
    );

    mesh.scale.set(
      baseScaleX,
      baseScaleY,
      1,
    );

    mesh.rotation.z =
      Math.random() *
      Math.PI;

    scene.add(mesh);

    caustics.push({
      mesh,
      baseX,
      baseZ,
      baseScaleX,
      baseScaleY,

      phase:
        Math.random() *
        Math.PI *
        2,

      speed:
        0.16 +
        Math.random() *
        0.18,
    });
  }

  /*
   * SOFT LIGHT RAYS
   *
   * Keep the rays behind the fish and fade
   * them before they reach the bottom.
   */
  const rayGeometry =
    new THREE.PlaneGeometry(
      2.8,
      tankHeight * 1.05,
      1,
      1,
    );

  const createRayMaterial =
    (
      opacity: number,
    ) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,

        blending:
        THREE.AdditiveBlending,

        side:
        THREE.DoubleSide,

        uniforms: {
          uOpacity: {
            value: opacity,
          },

          uTime: {
            value: 0,
          },
        },

        vertexShader: `
          varying vec2 vUv;

          void main() {
            vUv = uv;

            gl_Position =
              projectionMatrix *
              modelViewMatrix *
              vec4(position, 1.0);
          }
        `,

        fragmentShader: `
          varying vec2 vUv;

          uniform float uOpacity;
          uniform float uTime;

          void main() {
            float distanceFromCenter =
              abs(vUv.x - 0.5) * 2.0;

            float horizontalFade =
              1.0 -
              smoothstep(
                0.1,
                1.0,
                distanceFromCenter
              );

            float bottomFade =
              smoothstep(
                0.08,
                0.48,
                vUv.y
              );

            float topFade =
              1.0 -
              smoothstep(
                0.88,
                1.0,
                vUv.y
              ) * 0.25;

            float shimmer =
              0.94 +
              sin(
                vUv.y * 7.0 +
                uTime * 0.55
              ) * 0.06;

            float alpha =
              horizontalFade *
              bottomFade *
              topFade *
              shimmer *
              uOpacity;

            gl_FragColor =
              vec4(
                0.72,
                0.94,
                1.0,
                alpha
              );
          }
        `,
      });

  const rays:
    LightRay[] = [];

  const addRay = (
    x: number,
    rotation: number,
    widthScale: number,
    opacity: number,
    phase: number,
  ) => {
    const material =
      createRayMaterial(
        opacity,
      );

    const ray =
      new THREE.Mesh(
        rayGeometry,
        material,
      );

    ray.position.set(
      x,
      0.55,
      -tankDepth / 2 -
      0.12,
    );

    ray.rotation.z =
      rotation;

    ray.scale.x =
      widthScale;

    scene.add(ray);

    rays.push({
      mesh: ray,
      material,
      baseX: x,
      baseRotation:
      rotation,
      phase,
    });
  };

  addRay(
    -2.2,
    -0.1,
    1.35,
    0.038,
    0,
  );

  addRay(
    2.25,
    0.08,
    1.5,
    0.03,
    Math.PI,
  );

  const update = (
    _deltaTime: number,
    elapsed: number,
  ) => {
    const position =
      surfaceGeometry.attributes
        .position as
        THREE.BufferAttribute;

    for (
      let index = 0;
      index <
      position.count;
      index++
    ) {
      const offset =
        index * 3;

      const originalX =
        originalPositions[
          offset
          ];

      const originalY =
        originalPositions[
        offset + 1
          ];

      const originalZ =
        originalPositions[
        offset + 2
          ];

      const wave =
        Math.sin(
          originalX *
          1.05 +
          elapsed *
          0.65,
        ) *
        0.014 +
        Math.cos(
          originalZ *
          1.55 +
          elapsed *
          0.75,
        ) *
        0.01;

      position.setXYZ(
        index,
        originalX,
        originalY +
        wave,
        originalZ,
      );
    }

    position.needsUpdate =
      true;

    surfaceGeometry
      .computeVertexNormals();

    for (
      const caustic of
      caustics
      ) {
      const wave =
        elapsed *
        caustic.speed +
        caustic.phase;

      caustic.mesh
        .position.x =
        caustic.baseX +
        Math.sin(wave) *
        0.12;

      caustic.mesh
        .position.z =
        caustic.baseZ +
        Math.cos(
          wave * 0.7,
        ) *
        0.1;

      caustic.mesh
        .rotation.z +=
        0.0008;

      const pulse =
        1 +
        Math.sin(
          wave * 1.2,
        ) *
        0.08;

      caustic.mesh
        .scale.x =
        caustic.baseScaleX *
        pulse;

      caustic.mesh
        .scale.y =
        caustic.baseScaleY *
        (
          1 +
          Math.cos(
            wave * 0.9,
          ) *
          0.07
        );
    }

    for (
      const ray of
      rays
      ) {
      ray.material.uniforms
        .uTime.value =
        elapsed +
        ray.phase;

      ray.mesh.position.x =
        ray.baseX +
        Math.sin(
          elapsed *
          0.11 +
          ray.phase,
        ) *
        0.12;

      ray.mesh.rotation.z =
        ray.baseRotation +
        Math.sin(
          elapsed *
          0.08 +
          ray.phase,
        ) *
        0.018;
    }
  };

  const destroy = () => {
    scene.remove(surface);

    for (
      const caustic of
      caustics
      ) {
      scene.remove(
        caustic.mesh,
      );
    }

    for (
      const ray of
      rays
      ) {
      scene.remove(
        ray.mesh,
      );

      ray.material.dispose();
    }

    surfaceGeometry.dispose();
    surfaceMaterial.dispose();

    causticGeometry.dispose();
    causticMaterial.dispose();

    rayGeometry.dispose();
  };

  return {
    update,
    destroy,
  };
}
