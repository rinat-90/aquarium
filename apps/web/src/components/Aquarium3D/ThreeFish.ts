import * as THREE from 'three';

export type ThreeFish = {
  group: THREE.Group;
  update: (
    elapsed: number,
    intensity: number,
    direction: 'left' | 'right',
  ) => void;
  destroy: () => void;
};

export async function createThreeFish(
  image: string,
  maxWidth = 2.2,
): Promise<ThreeFish> {
  const loader =
    new THREE.TextureLoader();

  const texture =
    await loader.loadAsync(
      image,
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  const imageSource =
    texture.image as {
      width: number;
      height: number;
    };

  const aspect =
    imageSource.width /
    imageSource.height;

  const width =
    maxWidth;

  const height =
    width / aspect;

  const group =
    new THREE.Group();

  /**
   * We split the drawing into vertical
   * pieces just like the Pixi version.
   *
   * Later we can replace this with a
   * shader/mesh deformation without
   * changing the aquarium engine.
   */
  const segmentCount = 12;

  const segmentWidth =
    width /
    segmentCount;

  const segments: {
    mesh: THREE.Mesh;
    normalizedX: number;
  }[] = [];

  for (
    let index = 0;
    index < segmentCount;
    index++
  ) {
    const normalizedX =
      index /
      (segmentCount - 1);

    const geometry =
      new THREE.PlaneGeometry(
        segmentWidth * 1.02,
        height,
      );

    const segmentTexture =
      texture.clone();

    segmentTexture.needsUpdate =
      true;

    segmentTexture.repeat.set(
      1 / segmentCount,
      1,
    );

    segmentTexture.offset.set(
      index / segmentCount,
      0,
    );

    const material =
      new THREE.MeshBasicMaterial({
        map: segmentTexture,
        transparent: true,
        alphaTest: 0.02,
        side:
        THREE.DoubleSide,
        depthWrite: false,
      });

    const mesh =
      new THREE.Mesh(
        geometry,
        material,
      );

    mesh.position.x =
      -width / 2 +
      segmentWidth / 2 +
      index *
      segmentWidth;

    group.add(mesh);

    segments.push({
      mesh,
      normalizedX,
    });
  }

  const update = (
    elapsed: number,
    intensity: number,
    direction:
      | 'left'
      | 'right',
  ) => {
    const clampedIntensity =
      Math.max(
        0.35,
        Math.min(
          intensity,
          1.8,
        ),
      );

    for (
      const segment of
      segments
      ) {
      /**
       * Drawing faces right:
       *
       * tail ---------> head
       *  0               1
       */
      const tailAmount =
        1 -
        segment.normalizedX;

      const wave =
        Math.sin(
          elapsed -
          tailAmount * 2.4,
        );

      /**
       * This time the body deformation
       * can happen in actual depth.
       */
      segment.mesh.position.z =
        wave *
        tailAmount *
        0.12 *
        clampedIntensity;

      segment.mesh.rotation.y =
        wave *
        tailAmount *
        0.18 *
        clampedIntensity;
    }

    group.scale.x =
      direction === 'right'
        ? 1
        : -1;
  };

  const destroy = () => {
    for (
      const segment of
      segments
      ) {
      segment.mesh.geometry.dispose();

      const material =
        segment.mesh.material;

      if (
        material instanceof
        THREE.MeshBasicMaterial
      ) {
        material.map?.dispose();
        material.dispose();
      }
    }

    texture.dispose();

    group.clear();
  };

  return {
    group,
    update,
    destroy,
  };
}