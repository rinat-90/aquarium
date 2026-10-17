import * as THREE from 'three';

import { createFish3DModel } from '../Fish3D/createFish3DModel';
import { createAngelfish3DModel } from '../Fish3D/createAngelfish3DModel';
import { createGuppy3DModel } from '../Fish3D/createGuppy3DModel';
import { createFinny3DModel } from '../Fish3D/createFinny3DModel';
import { createFinnyAnimationController } from '../Fish3D/finnyAnimation';

type FishDirection = 'left' | 'right';

export type ThreeModelFish = {
  group: THREE.Group;
  update: (
    time: number,
    speed: number,
    direction: FishDirection,
    depthVelocity: number,
    horizontalVelocity?: number,
  ) => void;
  destroy: () => void;
};

export function createThreeModelFish(
  bodyColor: string,
  finColor: string,
  paintImage?: string,
  size = 1,
  species: 'classic' | 'angelfish' | 'guppy' | 'finny' = 'classic',
): ThreeModelFish {
  const model =
    species === 'finny'
      ? createFinny3DModel()
      : species === 'angelfish'
        ? createAngelfish3DModel()
        : species === 'guppy'
          ? createGuppy3DModel()
          : createFish3DModel();

  const isAngelfish = species === 'angelfish';
  const isGuppy = species === 'guppy';
  const finnyAnimation = species === 'finny' ? createFinnyAnimationController(model) : null;

  model.setBodyColor(bodyColor);
  model.setFinColor(finColor);

  if (paintImage) {
    model.setPaintImage(paintImage);
  }

  model.group.scale.setScalar(0.38 * size);

  const baseLeftFinRotation = model.leftFin.rotation.z;
  const baseRightFinRotation = model.rightFin.rotation.z;

  let currentYaw = 0;
  let previousTargetYaw: number | null = null;
  let turnLean = 0;
  let smoothedSpeed = 0.5;
  let lastTime: number | null = null;
  let facingLeft = false;
  let visualYaw = 0;
  let tailSweep = 0;
  let smoothedLean = 0;
  let visualHeadingInitialized = false;

  const update = (
    time: number,
    speed: number,
    direction: FishDirection,
    depthVelocity: number,
    horizontalVelocity?: number,
  ) => {
    const deltaTime = lastTime === null ? 1 / 60 : THREE.MathUtils.clamp(time - lastTime, 0, 0.05);
    lastTime = time;

    const speedBlend = 1 - Math.exp(-4 * deltaTime);
    smoothedSpeed += (Math.max(0, speed) - smoothedSpeed) * speedBlend;
    const activity = THREE.MathUtils.clamp(smoothedSpeed, 0, 1.5);

    // Keep Finny's eye and fin animations, but let the aquarium control movement.
    if (finnyAnimation) {
      const worldY = model.group.position.y;
      const bankZ = model.group.rotation.z;
      finnyAnimation.update(time);
      model.group.position.y = worldY;
      model.group.rotation.z = bankZ;
    }

    // Aquarium-only tail motion: ease the sweep in/out with swim activity.
    // Keep the maximum angle at 0.18 so the tail never turns edge-on.
    const tailFrequency = species === 'finny' ? 3.2 : isAngelfish ? 1.8 : isGuppy ? 3.5 : 2.8;
    const tailAmplitude = THREE.MathUtils.lerp(0.1, 0.18, THREE.MathUtils.clamp(activity, 0, 1));
    const targetSweep = Math.sin(time * tailFrequency) * tailAmplitude;
    const tailBlend = 1 - Math.exp(-10 * deltaTime);
    tailSweep += (targetSweep - tailSweep) * tailBlend;
    model.tail.rotation.y = tailSweep;

    // Side fins paddle continuously on non-Finny species.
    const finFrequency = isAngelfish ? 1.7 : isGuppy ? 3.2 : 2.6;
    const finAmplitude = isAngelfish ? 0.11 : isGuppy ? 0.065 : 0.085;
    const finMovement = Math.sin(time * finFrequency) * finAmplitude * (0.45 + activity * 0.55);

    if (!finnyAnimation) {
      model.leftFin.rotation.z = baseLeftFinRotation + finMovement;
      model.rightFin.rotation.z = baseRightFinRotation - finMovement;
    }

    const velocityX = horizontalVelocity ?? (direction === 'right' ? 1 : -1);
    const horizontalSpeed = Math.hypot(velocityX, depthVelocity);

    if (horizontalSpeed > 0.03) {
      const targetYaw = Math.atan2(-depthVelocity, velocityX);
      const yawDifference = Math.atan2(
        Math.sin(targetYaw - currentYaw),
        Math.cos(targetYaw - currentYaw),
      );
      const turnResponsiveness = isAngelfish ? 2.1 : isGuppy ? 3.5 : 4.2;
      const turnAmount = 1 - Math.exp(-turnResponsiveness * deltaTime);
      currentYaw += yawDifference * turnAmount;

      if (previousTargetYaw !== null) {
        const headingChange = Math.atan2(
          Math.sin(targetYaw - previousTargetYaw),
          Math.cos(targetYaw - previousTargetYaw),
        );
        const desiredLean = THREE.MathUtils.clamp(
          -headingChange * (isAngelfish ? 0.08 : 0.12),
          -0.09,
          0.09,
        );
        const leanBlend = 1 - Math.exp(-3 * deltaTime);
        turnLean += (desiredLean - turnLean) * leanBlend;
      }
      previousTargetYaw = targetYaw;
    } else {
      turnLean *= Math.exp(-3 * deltaTime);
    }

    // Keep fish side-on for tail visibility, but animate direction changes
    // slowly enough to read as a deliberate swimming turn.
    // Hysteresis avoids repeated flips when moving mainly in depth.
    const headingX = Math.cos(currentYaw);
    if (headingX > 0.22) facingLeft = false;
    else if (headingX < -0.22) facingLeft = true;

    const targetVisualYaw = facingLeft ? Math.PI : 0;
    if (!visualHeadingInitialized) {
      // A newly created fish should start facing its travel direction,
      // not perform an artificial half-turn on its first frame.
      visualYaw = targetVisualYaw;
      visualHeadingInitialized = true;
    }

    const visualDifference = Math.atan2(
      Math.sin(targetVisualYaw - visualYaw),
      Math.cos(targetVisualYaw - visualYaw),
    );
    // 1.7 radians/sec means a full reversal takes about 1.85 seconds.
    // Ease near the end so the fish settles naturally instead of stopping hard.
    const turnRate = isAngelfish ? 1.45 : isGuppy ? 1.85 : 1.7;
    const maxStep = turnRate * deltaTime;
    const easedStep = visualDifference * (1 - Math.exp(-2.6 * deltaTime));
    const step = THREE.MathUtils.clamp(easedStep, -maxStep, maxStep);
    visualYaw += step;
    model.group.rotation.y = visualYaw;

    // Ease banking instead of snapping when the simulated direction changes.
    const bankBlend = 1 - Math.exp(-5 * deltaTime);
    smoothedLean += (turnLean - smoothedLean) * bankBlend;
    model.group.rotation.x = smoothedLean;
  };

  return {
    group: model.group,
    update,
    destroy: model.dispose,
  };
}
