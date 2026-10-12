import * as THREE from 'three';
import { detectFishOrientation } from '../../lib/image-processing/detectFishOrientation';

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

const SEGMENT_COUNT = 18;

export async function createThreeFish(
  image: string,
  maxWidth = 1.3,
  headDirection?: 'left' | 'right' | null,
): Promise<ThreeFish> {
  const loader =
    new THREE.TextureLoader();

  const texture =
    await loader.loadAsync(image);

  // Detect the original drawing's head direction.
  let orientation: 'left' | 'right' = headDirection ?? 'right';

  if (!headDirection) {
    try {
      orientation = await detectFishOrientation(image);
    } catch (error) {
      console.warn('Fish orientation detection failed:', error);
    }
  }

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

  const width = maxWidth;

  const height =
    width / aspect;

  /*
   * Root controls world position.
   */
  const group =
    new THREE.Group();

  /*
   * Direction is separated from body
   * deformation so turning does not
   * interfere with swimming animation.
   */
  const directionGroup =
    new THREE.Group();

  /*
   * Body contains the actual segmented
   * drawing.
   */
  const body =
    new THREE.Group();

  group.add(directionGroup);
  directionGroup.add(body);

  const segmentWidth =
    width / SEGMENT_COUNT;

  const segments: FishSegment[] = [];

  for (
    let index = 0;
    index < SEGMENT_COUNT;
    index += 1
  ) {
    const normalizedX =
      index /
      (SEGMENT_COUNT - 1);

    /*
     * Small overlap prevents visible seams.
     */
    const geometry =
      new THREE.PlaneGeometry(
        segmentWidth * 1.06,
        height,
      );

    const segmentTexture =
      texture.clone();

    segmentTexture.needsUpdate = true;

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

        side: THREE.DoubleSide,

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
      index * segmentWidth;

    mesh.position.x = baseX;

    body.add(mesh);

    segments.push({
      mesh,
      normalizedX,
      baseX,
    });
  }

  let currentDirectionScale = 1;

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
     * Smoothly flip the fish instead of
     * instantly snapping between 1 and -1.
     */
// Match the drawing's original orientation
// to the direction of movement.
    const targetDirectionScale =
      direction === orientation
        ? 1
        : -1;

    currentDirectionScale =
      THREE.MathUtils.lerp(
        currentDirectionScale,
        targetDirectionScale,
        0.12,
      );

    directionGroup.scale.x =
      currentDirectionScale;

    /*
     * Slight perspective turn when the fish
     * moves through depth.
     *
     * Keep this subtle so a child's drawing
     * remains clearly readable.
     */
    const depthTurn =
      THREE.MathUtils.clamp(
        depthVelocity * 0.16,
        -0.16,
        0.16,
      );

    body.rotation.y =
      THREE.MathUtils.lerp(
        body.rotation.y,
        depthTurn,
        0.08,
      );

    /*
     * Very small whole-body floating motion.
     */
    body.position.y =
      Math.sin(
        elapsed * 0.55,
      ) * 0.012;

    for (
      const segment of segments
      ) {
      /*
       * The source drawing faces right.
       *
       * X=0 is therefore the tail and
       * X=1 is the head.
       */
      // The tail is opposite the detected head direction.
      const tailAmount =
        orientation === 'right'
          ? 1 - segment.normalizedX
          : segment.normalizedX;

      /*
       * Non-linear falloff keeps the head
       * almost stationary while allowing
       * much more motion near the tail.
       */
      const tailInfluence =
        tailAmount *
        tailAmount;

      /*
       * Travelling wave.
       */
      const wave =
        Math.sin(
          elapsed * 1.15 -
          tailAmount * 3.2,
        );

      const bendStrength =
        tailInfluence *
        clampedIntensity;

      /*
       * Move slices slightly through depth.
       */
      // Side-to-side tail movement, visible from the front.
      segment.mesh.position.y =
        wave *
        bendStrength *
        0.035;

      // Slight depth movement adds a 3D swimming effect.
      segment.mesh.position.z =
        wave *
        bendStrength *
        0.065;

      // Rotate each segment around its vertical axis.
      segment.mesh.rotation.y =
        wave *
        bendStrength *
        0.22;

      // Gentle visible bending of the tail.
      segment.mesh.rotation.z =
        wave *
        bendStrength *
        0.018;

      /*
       * Preserve the source drawing's
       * horizontal layout.
       */
      segment.mesh.position.x =
        segment.baseX;
    }
  };

  const destroy = () => {
    for (
      const segment of segments
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