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
   * --------------------------------
   * WATER SURFACE
   * --------------------------------
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
      color: 0x78cbd4,

      transparent: true,
      opacity: 0.1,

      roughness: 0.22,
      metalness: 0,

      transmission: 0.25,

      side: THREE.DoubleSide,
      depthWrite: false,
    });

  const surface =
    new THREE.Mesh(
      surfaceGeometry,
      surfaceMaterial,
    );

  surface.position.y =
    tankHeight / 2 -
    0.08;

  scene.add(surface);

  /*
   * --------------------------------
   * CAUSTICS
   * --------------------------------
   *
   * These are intentionally subtle.
   * They should be something you
   * notice after looking at the tank,
   * not the first thing you see.
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
      opacity: 0.025,

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
      0.29,

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
   * --------------------------------
   * SOFT LIGHT RAYS
   * --------------------------------
   *
   * Unlike the previous trapezoids,
   * these use a shader.
   *
   * Alpha fades:
   * - at both horizontal edges
   * - near the bottom
   * - slightly near the top
   *
   * This removes the visible polygon
   * edges from the old version.
   */

  const rayGeometry =
    new THREE.PlaneGeometry(
      2.8,
      tankHeight * 1.15,
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
            /*
             * Soft horizontal center.
             */
            float distanceFromCenter =
              abs(vUv.x - 0.5) * 2.0;

            float horizontalFade =
              1.0 -
              smoothstep(
                0.15,
                1.0,
                distanceFromCenter
              );

            /*
             * Fade the bottom heavily.
             */
            float bottomFade =
              smoothstep(
                0.02,
                0.42,
                vUv.y
              );

            /*
             * Slight fade near the top.
             */
            float topFade =
              1.0 -
              smoothstep(
                0.82,
                1.0,
                vUv.y
              ) * 0.35;

            /*
             * Very subtle underwater
             * movement inside the ray.
             */
            float shimmer =
              0.92 +
              sin(
                vUv.y * 8.0 +
                uTime * 0.7
              ) * 0.08;

            float alpha =
              horizontalFade *
              bottomFade *
              topFade *
              shimmer *
              uOpacity;

            gl_FragColor =
              vec4(
                0.78,
                0.96,
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
      0.35,

      -tankDepth / 2 +
      0.04,
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

  /*
   * Only two broad rays.
   *
   * They should feel like sunlight
   * entering the water rather than
   * stage spotlights.
   */

  addRay(
    -2.1,
    -0.12,
    1.25,
    0.065,
    0,
  );

  addRay(
    2.2,
    0.1,
    1.45,
    0.045,
    Math.PI,
  );

  /*
   * --------------------------------
   * UPDATE
   * --------------------------------
   */

  const update = (
    _deltaTime: number,
    elapsed: number,
  ) => {
    /*
     * Water surface.
     */

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

      /*
       * Slower and smaller waves than
       * before.
       */

      const wave =
        Math.sin(
          originalX *
          1.15 +
          elapsed *
          0.75,
        ) *
        0.022 +
        Math.cos(
          originalZ *
          1.7 +
          elapsed *
          0.9,
        ) *
        0.016;

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

    /*
     * Caustics.
     */

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

    /*
     * Light rays.
     */

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

  /*
   * --------------------------------
   * CLEANUP
   * --------------------------------
   */

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