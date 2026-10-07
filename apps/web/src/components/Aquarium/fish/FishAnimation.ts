export type FishAnimationState = {
  /**
   * Main swimming clock.
   * Each fish starts at a random phase
   * so they do not move in sync.
   */
  elapsed: number;

  /**
   * Separate phase used for slower
   * vertical drifting.
   */
  driftPhase: number;
};

export type FishAnimationResult = {
  /**
   * Gentle up/down movement applied
   * to the whole fish.
   */
  yOffset: number;

  /**
   * Very small whole-body rotation.
   * The stronger movement rotation is
   * still calculated from velocity.
   */
  rotation: number;

  /**
   * Passed to AnimatedFish to control
   * how strongly the body bends.
   */
  swimIntensity: number;
};

export function createFishAnimationState(): FishAnimationState {
  return {
    elapsed:
      Math.random() *
      Math.PI *
      2,

    driftPhase:
      Math.random() *
      Math.PI *
      2,
  };
}

export function updateFishAnimation(
  state: FishAnimationState,
  deltaTime: number,
  speedRatio: number,
): FishAnimationResult {
  /**
   * Prevent extremely slow or
   * extremely fast animation.
   */
  const normalizedSpeed =
    Math.max(
      0.35,
      Math.min(
        speedRatio,
        1.8,
      ),
    );

  /**
   * Tail beat frequency.
   *
   * Slow cruising:
   * ~3.5 rad/sec
   *
   * Faster movement / chasing:
   * up to ~7 rad/sec
   */
  const swimFrequency =
    2.8 +
    normalizedSpeed *
    2.4;

  state.elapsed +=
    deltaTime *
    swimFrequency;

  /**
   * Slow independent drift.
   *
   * This keeps the entire fish from
   * looking mechanically locked to
   * its engine position.
   */
  const drift =
    Math.sin(
      state.elapsed *
      0.35 +
      state.driftPhase,
    );

  /**
   * Tiny whole-body movement.
   *
   * Most visible animation should now
   * come from AnimatedFish rather than
   * rotating/scaling the complete fish.
   */
  const bodyMotion =
    Math.sin(
      state.elapsed,
    );

  /**
   * Scale deformation intensity based
   * on how fast the fish is moving.
   */
  const swimIntensity =
    0.55 +
    normalizedSpeed *
    0.45;

  return {
    yOffset:
      drift * 2,

    rotation:
      bodyMotion *
      0.008 *
      normalizedSpeed,

    swimIntensity,
  };
}