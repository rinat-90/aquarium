
export type GraphicsQuality = 'low' | 'high';

export type GraphicsQualityController = {
  update: (deltaTime: number) => GraphicsQuality;
  getQuality: () => GraphicsQuality;
};

export function createGraphicsQualityController(
  initialQuality: GraphicsQuality = 'high',
): GraphicsQualityController {
  let quality = initialQuality;

  let elapsed = 0;
  let frameCount = 0;

  let lowFpsWindows = 0;
  let highFpsWindows = 0;

  const sampleDuration = 3;

  const update = (
    deltaTime: number,
  ): GraphicsQuality => {
    if (
      !Number.isFinite(deltaTime) ||
      deltaTime <= 0
    ) {
      return quality;
    }

    // Ignore long pauses, such as background tabs.
    if (deltaTime > 2) {
      elapsed = 0;
      frameCount = 0;
      return quality;
    }

    elapsed += deltaTime;
    frameCount++;

    if (elapsed < sampleDuration) {
      return quality;
    }

    const fps = frameCount / elapsed;

    elapsed = 0;
    frameCount = 0;

    if (fps < 40) {
      lowFpsWindows++;
      highFpsWindows = 0;
    } else if (fps > 55) {
      highFpsWindows++;
      lowFpsWindows = 0;
    } else {
      lowFpsWindows = 0;
      highFpsWindows = 0;
    }

    // Drop quality after 6 seconds of low FPS.
    if (
      quality === 'high' &&
      lowFpsWindows >= 2
    ) {
      quality = 'low';
      lowFpsWindows = 0;
      highFpsWindows = 0;
    }

    // Restore quality only after 15 seconds
    // of consistently high FPS.
    if (
      quality === 'low' &&
      highFpsWindows >= 5
    ) {
      quality = 'high';
      lowFpsWindows = 0;
      highFpsWindows = 0;
    }

    return quality;
  };

  return {
    update,
    getQuality: () => quality,
  };
}
