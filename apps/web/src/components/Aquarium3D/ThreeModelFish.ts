import * as THREE from 'three';

import {
  createFish3DModel,
} from '../Fish3D/createFish3DModel';

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
  ) => void;

  destroy: () => void;
};

export function createThreeModelFish(
  bodyColor: string,
  finColor: string,
  paintImage?: string,
): ThreeModelFish {
  const model =
    createFish3DModel();

  model.setBodyColor(
    bodyColor,
  );

  model.setFinColor(
    finColor,
  );

  /**
   * Restore the child's painted texture
   * when this fish comes from storage.
   *
   * Undefined is valid for older 3D fish
   * that were created before painting
   * support existed.
   */
  if (paintImage) {
    model.setPaintImage(
      paintImage,
    );
  }

  /**
   * Creator preview uses the full-size
   * model. Scale it for the aquarium.
   */
  model.group.scale.setScalar(
    0.38,
  );

  const update = (
    time: number,
    speed: number,
    direction: FishDirection,
    depthVelocity: number,
  ) => {
    /**
     * Swimming rhythm.
     *
     * time already speeds up/slows down
     * based on the engine movement.
     */
    const swim =
      Math.sin(
        time * 1.6,
      );

    /**
     * Tail swings from its base pivot.
     *
     * Neutral is 0 now — not PI / 2.
     * This keeps the broad side of the
     * tail visible most of the time.
     */
    model.tail.rotation.y =
      swim *
      0.32 *
      speed;

    /**
     * Side fins move more gently than
     * the tail.
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

    /**
     * Small whole-body sway.
     *
     * Keep this subtle. The tail should
     * provide most of the movement.
     */
    const bodySway =
      swim *
      0.035 *
      speed;

    /**
     * Turn the whole fish depending on
     * its horizontal swimming direction.
     *
     * The model naturally faces +X.
     */
    const baseRotation =
      direction === 'right'
        ? -0.08
        : Math.PI + 0.08;

    /**
     * Turn slightly into/out of the
     * screen when moving through depth.
     */
    const depthTurn =
      THREE.MathUtils.clamp(
        depthVelocity * 0.12,
        -0.22,
        0.22,
      );

    model.group.rotation.y =
      baseRotation +
      depthTurn +
      bodySway;
  };

  return {
    group: model.group,
    update,
    destroy: model.dispose,
  };
}