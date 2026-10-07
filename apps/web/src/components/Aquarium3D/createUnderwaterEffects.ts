import * as THREE from 'three';

export type UnderwaterEffects = {
  update: (
    deltaTime: number,
    elapsed: number,
  ) => void;

  destroy: () => void;
};

type Bubble = {
  mesh: THREE.Mesh;
  speed: number;
  drift: number;
  phase: number;
};

export function createUnderwaterEffects(
  scene: THREE.Scene,
  tankWidth: number,
  tankHeight: number,
  tankDepth: number,
): UnderwaterEffects {
  /*
   * Bubbles
   */
  const bubbleGeometry =
    new THREE.SphereGeometry(
      0.055,
      8,
      8,
    );

  const bubbleMaterial =
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,

      transparent: true,
      opacity: 0.38,

      roughness: 0.1,

      transmission: 0.5,

      depthWrite: false,
    });

  const bubbles:
    Bubble[] = [];

  const resetBubble = (
    bubble: Bubble,
    initial = false,
  ) => {
    bubble.mesh.position.x =
      -tankWidth / 2 +
      0.4 +
      Math.random() *
      (
        tankWidth -
        0.8
      );

    bubble.mesh.position.y =
      initial
        ? -tankHeight / 2 +
        Math.random() *
        tankHeight
        : -tankHeight / 2 +
        0.35;

    bubble.mesh.position.z =
      -tankDepth / 2 +
      0.3 +
      Math.random() *
      (
        tankDepth -
        0.6
      );

    bubble.speed =
      0.25 +
      Math.random() *
      0.45;

    bubble.drift =
      0.04 +
      Math.random() *
      0.08;

    bubble.phase =
      Math.random() *
      Math.PI *
      2;

    const scale =
      0.55 +
      Math.random() *
      1.2;

    bubble.mesh.scale.setScalar(
      scale,
    );
  };

  for (
    let index = 0;
    index < 28;
    index++
  ) {
    const mesh =
      new THREE.Mesh(
        bubbleGeometry,
        bubbleMaterial,
      );

    const bubble: Bubble = {
      mesh,
      speed: 0,
      drift: 0,
      phase: 0,
    };

    resetBubble(
      bubble,
      true,
    );

    scene.add(
      mesh,
    );

    bubbles.push(
      bubble,
    );
  }

  /*
   * Tiny suspended particles.
   */
  const particleCount = 180;

  const particlePositions =
    new Float32Array(
      particleCount * 3,
    );

  for (
    let index = 0;
    index < particleCount;
    index++
  ) {
    const offset =
      index * 3;

    particlePositions[
      offset
      ] =
      (
        Math.random() -
        0.5
      ) *
      (
        tankWidth -
        0.5
      );

    particlePositions[
    offset + 1
      ] =
      (
        Math.random() -
        0.5
      ) *
      (
        tankHeight -
        0.5
      );

    particlePositions[
    offset + 2
      ] =
      (
        Math.random() -
        0.5
      ) *
      (
        tankDepth -
        0.4
      );
  }

  const particleGeometry =
    new THREE.BufferGeometry();

  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      particlePositions,
      3,
    ),
  );

  const particleMaterial =
    new THREE.PointsMaterial({
      color: 0xffffff,

      size: 0.025,

      transparent: true,
      opacity: 0.28,

      depthWrite: false,
    });

  const particles =
    new THREE.Points(
      particleGeometry,
      particleMaterial,
    );

  scene.add(
    particles,
  );

  const update = (
    deltaTime: number,
    elapsed: number,
  ) => {
    for (
      const bubble of
      bubbles
      ) {
      bubble.mesh.position.y +=
        bubble.speed *
        deltaTime;

      bubble.mesh.position.x +=
        Math.sin(
          elapsed * 1.3 +
          bubble.phase,
        ) *
        bubble.drift *
        deltaTime;

      bubble.mesh.position.z +=
        Math.cos(
          elapsed * 0.9 +
          bubble.phase,
        ) *
        bubble.drift *
        0.35 *
        deltaTime;

      if (
        bubble.mesh.position.y >
        tankHeight / 2 -
        0.15
      ) {
        resetBubble(
          bubble,
        );
      }
    }

    /*
     * Extremely slow particle drift.
     */
    particles.rotation.y =
      Math.sin(
        elapsed * 0.08,
      ) * 0.025;

    particles.position.y =
      Math.sin(
        elapsed * 0.15,
      ) * 0.03;
  };

  const destroy = () => {
    for (
      const bubble of
      bubbles
      ) {
      scene.remove(
        bubble.mesh,
      );
    }

    scene.remove(
      particles,
    );

    bubbleGeometry.dispose();
    bubbleMaterial.dispose();

    particleGeometry.dispose();
    particleMaterial.dispose();
  };

  return {
    update,
    destroy,
  };
}