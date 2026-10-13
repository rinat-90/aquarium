
export type FishOrientation = 'left' | 'right';

export async function detectFishOrientation(
  imageUrl: string,
): Promise<FishOrientation> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  const width = 120;
  const height = Math.max(
    1,
    Math.round((image.height / image.width) * width),
  );

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  });

  if (!context) {
    return 'right';
  }

  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(
    0,
    0,
    width,
    height,
  ).data;

  // Estimate which end is wider near the horizontal tips.
  // The head tends to be thicker than the tail tip.
  const columnWeights = new Float32Array(width);

  for (let x = 0; x < width; x += 1) {
    let count = 0;

    for (let y = 0; y < height; y += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];

      if (alpha > 100) {
        count += 1;
      }
    }

    columnWeights[x] = count;
  }

  // Compare thickness in the left and right outer quarters.
  const sampleStart = Math.floor(width * 0.08);
  const sampleEnd = Math.floor(width * 0.3);

  let leftWeight = 0;
  let rightWeight = 0;

  for (let i = sampleStart; i < sampleEnd; i += 1) {
    leftWeight += columnWeights[i];
    rightWeight += columnWeights[width - 1 - i];
  }

  // Thicker end is assumed to be the head.
  return leftWeight > rightWeight ? 'left' : 'right';
}
