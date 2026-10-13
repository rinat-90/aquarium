import * as THREE from 'three';
import { detectFishOrientation } from '../../lib/image-processing/detectFishOrientation';

export type ThreeFish = {
  group: THREE.Group;

  update: (
    elapsed: number,
    intensity: number,
    direction: 'left' | 'right',
    depthVelocity?: number,
    nibbleProgress?: number,
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
        segmentWidth * 1.12,
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

  const swimPhaseOffset = Math.random() * Math.PI * 2;

  const update = (
    elapsed: number,
    intensity: number,
    direction:
      | 'left'
      | 'right',
    depthVelocity = 0,
    nibbleProgress = 0,
  ) => {
    const clampedIntensity = THREE.MathUtils.clamp(
      intensity,
      0.35,
      1.8,
    );

// Each fish gets its own swimming rhythm.
    const glideCycle = elapsed * 0.65 + swimPhaseOffset;

// Smooth transition between active swimming and gliding.
    const glideFactor =
      0.5 + 0.5 * Math.sin(glideCycle);

// 1 = active swimming, 0.35 = gentle gliding.
    const swimEffort =
      THREE.MathUtils.lerp(0.35, 1, glideFactor);

    const effectiveIntensity =
      clampedIntensity * swimEffort;

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

    // Preserve the existing 3D depth movement.
    body.rotation.y = THREE.MathUtils.lerp(
      body.rotation.y,
      depthTurn,
      0.08,
    );

// Add a subtle nibbling movement.
    // Three quick bites, fading out naturally.
    const nibbleEnvelope = Math.sin(
      Math.PI * THREE.MathUtils.clamp(nibbleProgress, 0, 1),
    );

    const nibble =
      Math.sin(elapsed * 12) *
      nibbleEnvelope *
      0.09;

// Slight head dip while eating.
    body.rotation.z = nibble;
    body.position.x = -Math.abs(nibble) * 0.12;

    body.rotation.z = nibble;

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

      // The head remains stable while movement increases
      // progressively toward the tail.
      const tailInfluence = Math.pow(tailAmount, 2.5);

      // A wave traveling from head to tail.
      // Swimming faster increases the tail-beat frequency.
      const swimFrequency = 1.8 + effectiveIntensity * 1.2;

      const wave = Math.sin(
        elapsed * swimFrequency -
        tailAmount * 4.2,
      );

      const bendStrength =
        tailInfluence * effectiveIntensity;

      /*
       * Move slices slightly through depth.
       */
      // Gentle vertical movement toward the tail.
      segment.mesh.position.y =
        wave * bendStrength * 0.025;

      // Side-to-side movement through depth.
      segment.mesh.position.z =
        wave * bendStrength * 0.09;

      // The tail twists more than the body.
      segment.mesh.rotation.y =
        wave * bendStrength * 0.3;

      // Keep vertical rotation subtle.
      segment.mesh.rotation.z =
        wave * bendStrength * 0.012;

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