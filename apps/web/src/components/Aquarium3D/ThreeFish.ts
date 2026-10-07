import * as THREE from 'three';

export type ThreeFish = {
  group: THREE.Group;

  update: (
    elapsed: number,
    intensity: number,
    direction: 'left' | 'right',
    depthVelocity?: number,
  ) => void;

  destroy: () => void;
};

type FishSegment = {
  mesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  >;

  normalizedX: number;
  baseX: number;
};

const SEGMENT_COUNT = 12;

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

  /*
   * Root controls world position,
   * vertical tilt and direction.
   */
  const group =
    new THREE.Group();

  /*
   * Body controls the subtle visual
   * turn toward/away from the camera.
   *
   * Keeping this separate from the
   * root makes it much easier to
   * preserve the readable drawing.
   */
  const body =
    new THREE.Group();

  group.add(body);

  const segmentWidth =
    width /
    SEGMENT_COUNT;

  const segments:
    FishSegment[] = [];

  for (
    let index = 0;
    index < SEGMENT_COUNT;
    index++
  ) {
    const normalizedX =
      index /
      (SEGMENT_COUNT - 1);

    /*
     * Slight overlap prevents tiny
     * seams between the slices.
     */
    const geometry =
      new THREE.PlaneGeometry(
        segmentWidth * 1.03,
        height,
      );

    const segmentTexture =
      texture.clone();

    segmentTexture.needsUpdate =
      true;

    segmentTexture.wrapS =
      THREE.ClampToEdgeWrapping;

    segmentTexture.wrapT =
      THREE.ClampToEdgeWrapping;

    segmentTexture.repeat.set(
      1 / SEGMENT_COUNT,
      1,
    );

    segmentTexture.offset.set(
      index / SEGMENT_COUNT,
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

    const baseX =
      -width / 2 +
      segmentWidth / 2 +
      index *
      segmentWidth;

    mesh.position.x =
      baseX;

    body.add(
      mesh,
    );

    segments.push({
      mesh,
      normalizedX,
      baseX,
    });
  }

  const update = (
    elapsed: number,
    intensity: number,
    direction:
      | 'left'
      | 'right',
    depthVelocity = 0,
  ) => {
    const clampedIntensity =
      Math.max(
        0.35,
        Math.min(
          intensity,
          1.8,
        ),
      );

    /*
     * The drawing itself only turns a
     * little in depth.
     *
     * This communicates Z movement
     * without ever showing the fish
     * completely edge-on.
     */
    const depthTurn =
      THREE.MathUtils.clamp(
        depthVelocity * 0.22,
        -0.22,
        0.22,
      );

    body.rotation.y +=
      (
        depthTurn -
        body.rotation.y
      ) * 0.08;

    for (
      const segment of
      segments
      ) {
      /*
       * The original drawing faces
       * right, so the left side is
       * always considered the tail.
       */
      const tailAmount =
        1 -
        segment.normalizedX;

      /*
       * A travelling wave through the
       * body. Head moves very little,
       * tail moves the most.
       */
      const wave =
        Math.sin(
          elapsed -
          tailAmount * 2.5,
        );

      const bendStrength =
        tailAmount *
        clampedIntensity;

      /*
       * Bend through actual Z depth.
       */
      segment.mesh.position.z =
        wave *
        bendStrength *
        0.13;

      /*
       * Small vertical component keeps
       * the motion organic without
       * distorting the drawing heavily.
       */
      segment.mesh.position.y =
        wave *
        bendStrength *
        0.018;

      /*
       * Each slice rotates slightly to
       * create the appearance of a
       * curved body.
       */
      segment.mesh.rotation.y =
        wave *
        bendStrength *
        0.2;

      segment.mesh.rotation.z =
        wave *
        bendStrength *
        0.012;

      /*
       * Keep original X positions.
       */
      segment.mesh.position.x =
        segment.baseX;
    }

    /*
     * Direction is handled at the root
     * so the body/tail relationship
     * never changes.
     */
    const desiredScaleX =
      direction === 'right'
        ? 1
        : -1;

    group.scale.x =
      desiredScaleX;
  };

  const destroy = () => {
    for (
      const segment of
      segments
      ) {
      segment.mesh.geometry.dispose();

      segment.mesh.material
        .map
        ?.dispose();

      segment.mesh.material.dispose();
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