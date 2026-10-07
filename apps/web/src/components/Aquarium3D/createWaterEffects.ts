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
  speed: number;
};

type LightRay = {
  mesh: THREE.Mesh;
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
   * Water surface
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
      color: 0x8de8f5,
      transparent: true,
      opacity: 0.18,
      roughness: 0.15,
      metalness: 0,
      transmission: 0.35,
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
   * Soft caustic patches on the sand.
   */
  const causticGeometry =
    new THREE.CircleGeometry(
      0.9,
      32,
    );

  causticGeometry.rotateX(
    -Math.PI / 2,
  );

  const causticMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      blending:
      THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

  const caustics: Caustic[] =
    [];

  for (
    let index = 0;
    index < 14;
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
        1
      );

    const baseZ =
      (
        Math.random() -
        0.5
      ) *
      (
        tankDepth -
        0.6
      );

    mesh.position.set(
      baseX,
      -tankHeight / 2 +
      0.32,
      baseZ,
    );

    const scale =
      0.65 +
      Math.random() *
      0.65;

    mesh.scale.set(
      scale,
      scale *
      (
        0.55 +
        Math.random() *
        0.25
      ),
      1,
    );

    mesh.rotation.z =
      Math.random() *
      Math.PI;

    scene.add(mesh);

    caustics.push({
      mesh,

      phase:
        Math.random() *
        Math.PI *
        2,

      baseX,
      baseZ,

      speed:
        0.25 +
        Math.random() *
        0.35,
    });
  }

  /*
   * Soft tapered underwater light rays.
   *
   * A trapezoid looks much more like a
   * light beam than the previous
   * rectangular planes.
   */
  const rayWidthTop =
    0.35;

  const rayWidthBottom =
    1.15;

  const rayHeight =
    tankHeight * 1.15;

  const rayGeometry =
    new THREE.BufferGeometry();

  const rayVertices =
    new Float32Array([
      -rayWidthTop / 2,
      rayHeight / 2,
      0,

      rayWidthTop / 2,
      rayHeight / 2,
      0,

      -rayWidthBottom / 2,
      -rayHeight / 2,
      0,

      rayWidthBottom / 2,
      -rayHeight / 2,
      0,
    ]);

  const rayIndices = [
    0,
    2,
    1,

    2,
    3,
    1,
  ];

  rayGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      rayVertices,
      3,
    ),
  );

  rayGeometry.setIndex(
    rayIndices,
  );

  /*
   * Vertex colors make the lower part
   * of each beam darker.
   */
  const rayColors =
    new Float32Array([
      1,
      1,
      1,

      1,
      1,
      1,

      0.15,
      0.15,
      0.15,

      0.15,
      0.15,
      0.15,
    ]);

  rayGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      rayColors,
      3,
    ),
  );

  const rayMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xdffaff,
      vertexColors: true,
      transparent: true,
      opacity: 0.045,

      blending:
      THREE.AdditiveBlending,

      depthWrite: false,
      side: THREE.DoubleSide,
    });

  const rays: LightRay[] =
    [];

  for (
    let index = 0;
    index < 5;
    index++
  ) {
    const baseX =
      -3.5 +
      index * 1.75;

    const baseRotation =
      -0.09 +
      index * 0.025;

    const ray =
      new THREE.Mesh(
        rayGeometry,
        rayMaterial,
      );

    ray.position.set(
      baseX,
      0.25,
      -tankDepth / 2 +
      0.06,
    );

    ray.rotation.z =
      baseRotation;

    ray.scale.x =
      0.75 +
      Math.random() *
      0.4;

    scene.add(ray);

    rays.push({
      mesh: ray,
      baseX,
      baseRotation,

      phase:
        Math.random() *
        Math.PI *
        2,
    });
  }

  const update = (
    _deltaTime: number,
    elapsed: number,
  ) => {
    /*
     * Animate water surface vertices.
     */
    const position =
      surfaceGeometry.attributes
        .position as
        THREE.BufferAttribute;

    for (
      let index = 0;
      index < position.count;
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
          1.5 +
          elapsed *
          1.3,
        ) *
        0.035 +
        Math.cos(
          originalZ *
          2.1 +
          elapsed *
          1.7,
        ) *
        0.025;

      position.setXYZ(
        index,
        originalX,
        originalY + wave,
        originalZ,
      );
    }

    position.needsUpdate =
      true;

    surfaceGeometry
      .computeVertexNormals();

    /*
     * Slowly drifting caustics.
     */
    for (
      const caustic of
      caustics
      ) {
      const wave =
        elapsed *
        caustic.speed +
        caustic.phase;

      caustic.mesh.position.x =
        caustic.baseX +
        Math.sin(wave) *
        0.18;

      caustic.mesh.position.z =
        caustic.baseZ +
        Math.cos(
          wave * 0.8,
        ) *
        0.14;

      caustic.mesh.rotation.z =
        Math.sin(
          wave * 0.55,
        ) *
        0.25 +
        caustic.phase;

      const pulse =
        0.82 +
        Math.sin(
          wave * 1.4,
        ) *
        0.1;

      caustic.mesh.scale.x =
        pulse;

      caustic.mesh.scale.y =
        0.55 +
        Math.cos(
          wave * 1.15,
        ) *
        0.08;
    }

    /*
     * Slow movement of the light rays.
     */
    for (
      const ray of
      rays
      ) {
      ray.mesh.position.x =
        ray.baseX +
        Math.sin(
          elapsed *
          0.25 +
          ray.phase,
        ) *
        0.16;

      ray.mesh.rotation.z =
        ray.baseRotation +
        Math.sin(
          elapsed *
          0.18 +
          ray.phase,
        ) *
        0.025;

      /*
       * Tiny breathing effect so the
       * rays don't look completely
       * static.
       */
      ray.mesh.scale.x =
        0.9 +
        Math.sin(
          elapsed *
          0.35 +
          ray.phase,
        ) *
        0.08;
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
    }

    surfaceGeometry.dispose();
    surfaceMaterial.dispose();

    causticGeometry.dispose();
    causticMaterial.dispose();

    rayGeometry.dispose();
    rayMaterial.dispose();
  };

  return {
    update,
    destroy,
  };
}