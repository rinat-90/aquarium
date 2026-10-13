
export type DrawingCrop = {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
};

export async function cropDrawingWithBounds(
  imageUrl: string,
  padding = 12,
): Promise<DrawingCrop> {
  const image = new Image();
  image.src = imageUrl;

  await image.decode();

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error('Canvas is not supported');
  }

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const alphaThreshold = 160;
  const minNeighbors = 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];

      if (alpha <= alphaThreshold) continue;

      let neighbors = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (
            nx < 0 ||
            ny < 0 ||
            nx >= width ||
            ny >= height
          ) {
            continue;
          }

          const neighborIndex = (ny * width + nx) * 4;
          const neighborAlpha = pixels[neighborIndex + 3];

          if (neighborAlpha > alphaThreshold) {
            neighbors++;
          }
        }
      }

      // Ignore isolated pixels and small background noise.
      if (neighbors < minNeighbors) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No drawing detected');
  }

  const safePadding = Math.max(0, Math.floor(padding));

  const cropX = Math.max(0, minX - safePadding);
  const cropY = Math.max(0, minY - safePadding);
  const cropRight = Math.min(width, maxX + safePadding + 1);
  const cropBottom = Math.min(height, maxY + safePadding + 1);

  const cropWidth = cropRight - cropX;
  const cropHeight = cropBottom - cropY;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;

  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Canvas is not supported');
  }

  croppedCtx.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return {
    image: croppedCanvas.toDataURL('image/png'),
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
    sourceWidth: width,
    sourceHeight: height,
  };
}

// Backward-compatible function for existing callers.
export async function cropDrawing(
  imageUrl: string,
  padding = 12,
): Promise<string> {
  const result = await cropDrawingWithBounds(imageUrl, padding);
  return result.image;
}
