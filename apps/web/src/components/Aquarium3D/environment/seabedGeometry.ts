
/**
 * Matches the duneHeight() function in createSandCaustics.ts.
 *
 * x is normalized screen position:
 * 0 = left, 1 = right.
 *
 * Returns the dune height measured upward from
 * the bottom of the viewport.
 */
export function getSeabedHeight(x: number): number {
  return (
    0.155 +
    0.018 * Math.sin(x * 8.0 + 0.3) +
    0.014 * Math.sin(x * 15.0 - 0.8) +
    0.009 * Math.sin(x * 24.0 + 1.4)
  );
}

/**
 * Convert seabed height to a top-down screen position.
 *
 * 0 = top of screen
 * 1 = bottom of screen
 */
export function getSeabedScreenY(x: number): number {
  return 1 - getSeabedHeight(x);
}
