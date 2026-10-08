import * as THREE from 'three';

import {
  createFish3DModel,
} from '../Fish3D/createFish3DModel';

import { createAngelfish3DModel } from '../Fish3D/createAngelfish3DModel';

type FishDirection =
  | 'left'
  | 'right';

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
  species: 'classic' | 'angelfish' = 'classic',
): ThreeModelFish {
  const model =
    species === 'angelfish'
      ? createAngelfish3DModel()
      : createFish3DModel();

  model.setBodyColor(
    bodyColor,
  );

  model.setFinColor(
    finColor,
  );

  if (paintImage) {
    model.setPaintImage(
      paintImage,
    );
  }

  model.group.scale.setScalar(
    0.38 * size,
  );

  /*
   * The model naturally faces +X.
   *
   * Keep track of yaw separately so
   * turns can smoothly cross the
   * -PI / +PI boundary.
   */
  let currentYaw = 0;

  const update = (
    time: number,
    speed: number,
    direction: FishDirection,
    depthVelocity: number,
    horizontalVelocity?: number,
  ) => {
    const swim =
      Math.sin(
        time * 1.6,
      );

    /*
     * Tail animation.
     */
    model.tail.rotation.y =
      swim *
      0.32 *
      speed;

    /*
     * Side fins.
     */
    const finMovement =
      Math.sin(
        time * 1.3,
      ) *
      0.08 *
      speed;

    model.leftFin.rotation.z =
      -Math.PI / 2.5 +
      finMovement;

    model.rightFin.rotation.z =
      -Math.PI / 2.5 -
      finMovement;

    /*
     * Small natural body sway.
     */
    const bodySway =
      swim *
      0.025 *
      speed;

    /*
     * Use the actual X/Z movement vector
     * to determine where the fish faces.
     *
     * +X = right
     * -X = left
     * +Z = toward the camera
     * -Z = away from the camera
     */
    const velocityX =
      horizontalVelocity ??
      (
        direction === 'right'
          ? 1
          : -1
      );

    const horizontalSpeed =
      Math.sqrt(
        velocityX *
        velocityX +
        depthVelocity *
        depthVelocity,
      );

    if (horizontalSpeed > 0.03) {
      const targetYaw =
        Math.atan2(
          -depthVelocity,
          velocityX,
        );

      /*
       * Find the shortest rotational path.
       * Without this, crossing PI can make
       * the fish spin almost 360 degrees.
       */
      const yawDifference =
        Math.atan2(
          Math.sin(
            targetYaw -
            currentYaw,
          ),
          Math.cos(
            targetYaw -
            currentYaw,
          ),
        );

      /*
       * Smooth turning.
       *
       * Higher visual swimming speed gives
       * a slightly more responsive turn.
       */
      const turnAmount =
        THREE.MathUtils.clamp(
          0.055 +
          speed * 0.025,
          0.055,
          0.11,
        );

      currentYaw +=
        yawDifference *
        turnAmount;
    }

    model.group.rotation.y =
      currentYaw +
      bodySway;
  };

  return {
    group: model.group,
    update,
    destroy: model.dispose,
  };
}