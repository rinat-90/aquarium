
import * as THREE from 'three';

import {
  createFish3DModel,
} from '../Fish3D/createFish3DModel';

import {
  createAngelfish3DModel,
} from '../Fish3D/createAngelfish3DModel';
import { createGuppy3DModel } from '../Fish3D/createGuppy3DModel';

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
  species: 'classic' | 'angelfish' | 'guppy' = 'classic',
): ThreeModelFish {
  const model =
    species === 'angelfish'
      ? createAngelfish3DModel()
      : species === 'guppy'
        ? createGuppy3DModel()
        : createFish3DModel();

  const isAngelfish = species === 'angelfish';
  const isGuppy = species === 'guppy';

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

  const update = (
    time: number,
    speed: number,
    direction: FishDirection,
    depthVelocity: number,
    horizontalVelocity?: number,
  ) => {
    const deltaTime =
      lastTime === null
        ? 1 / 60
        : THREE.MathUtils.clamp(
          time - lastTime,
          0,
          0.05,
        );

    lastTime = time;

    const speedBlend =
      1 - Math.exp(-4 * deltaTime);

    smoothedSpeed +=
      (Math.max(0, speed) - smoothedSpeed) *
      speedBlend;

    const activity = THREE.MathUtils.clamp(
      smoothedSpeed,
      0,
      1.5,
    );

    // Different swimming rhythms for each species.
    const tailFrequency = isAngelfish ? 1.15 : isGuppy ? 2.5 : 1.9;
    const tailAmplitude = isAngelfish ? 0.16 : isGuppy ? 0.24 : 0.32;

    const swim = Math.sin(time * tailFrequency);

    // Keep the tail moving gently even when idling.
    model.tail.rotation.y =
      swim *
      tailAmplitude *
      (0.3 + activity * 0.7);

    // Side fins paddle continuously.
    const finFrequency = isAngelfish ? 1.7 : isGuppy ? 3.2 : 2.6;
    const finAmplitude = isAngelfish ? 0.11 : isGuppy ? 0.065 : 0.085;

    const finMovement =
      Math.sin(time * finFrequency) *
      finAmplitude *
      (0.45 + activity * 0.55);

    model.leftFin.rotation.z =
      baseLeftFinRotation + finMovement;

    model.rightFin.rotation.z =
      baseRightFinRotation - finMovement;

    // Gentle body sway.
    const bodySway =
      Math.sin(time * tailFrequency) *
      (isAngelfish ? 0.012 : isGuppy ? 0.018 : 0.025) *
      (0.3 + activity * 0.7);

    const velocityX =
      horizontalVelocity ??
      (direction === 'right' ? 1 : -1);

    const horizontalSpeed = Math.hypot(
      velocityX,
      depthVelocity,
    );

    if (horizontalSpeed > 0.03) {
      const targetYaw = Math.atan2(
        -depthVelocity,
        velocityX,
      );

      const yawDifference = Math.atan2(
        Math.sin(targetYaw - currentYaw),
        Math.cos(targetYaw - currentYaw),
      );

      // Angelfish rotate more gracefully.
      const turnResponsiveness =
        isAngelfish ? 2.1 : isGuppy ? 3.5 : 4.2;

      const turnAmount =
        1 - Math.exp(
          -turnResponsiveness * deltaTime,
        );

      currentYaw += yawDifference * turnAmount;

      // Subtle lean while changing direction.
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

        const leanBlend =
          1 - Math.exp(-3 * deltaTime);

        turnLean +=
          (desiredLean - turnLean) * leanBlend;
      }

      previousTargetYaw = targetYaw;
    } else {
      turnLean *= Math.exp(-3 * deltaTime);
    }

    model.group.rotation.y =
      currentYaw + bodySway;

    // Very small banking motion during turns.
    model.group.rotation.x = turnLean;
  };

  return {
    group: model.group,
    update,
    destroy: model.dispose,
  };
}