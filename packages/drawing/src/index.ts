export type CropDrawingOptions = {
  padding?: number;
  alphaThreshold?: number;
};

export function cropDrawing(
  source: HTMLCanvasElement,
  options: CropDrawingOptions = {},
): string | null {
  const {
    padding = 16,
    alphaThreshold = 5,
  } = options;

  const context = source.getContext('2d');

  if (!context) {
    return null;
  }

  const { width, height } = source;

  const imageData = context.getImageData(
    0,
    0,
    width,
    height,
  );

  const pixels = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const alpha = pixels[index + 3];

      if (alpha <= alphaThreshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  // Nothing was drawn.
  if (maxX === -1 || maxY === -1) {
    return null;
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);

  maxX = Math.min(
    width - 1,
    maxX + padding,
  );

  maxY = Math.min(
    height - 1,
    maxY + padding,
  );

  const croppedWidth =
    maxX - minX + 1;

  const croppedHeight =
    maxY - minY + 1;

  const croppedCanvas =
    document.createElement('canvas');

  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;

  const croppedContext =
    croppedCanvas.getContext('2d');

  if (!croppedContext) {
    return null;
  }

  croppedContext.drawImage(
    source,
    minX,
    minY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight,
  );

  return croppedCanvas.toDataURL(
    'image/png',
  );
}