
export async function removePaperBackground(
  file: File,
): Promise<string> {
  const bitmap = await createImageBitmap(file);

  try {
    const maxDimension = 1200;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!ctx) {
      throw new Error('Canvas is not supported');
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Estimate paper brightness locally to compensate for shadows.
    const blockSize = 32;
    const cols = Math.ceil(width / blockSize);
    const rows = Math.ceil(height / blockSize);
    const brightnessMap = new Float32Array(cols * rows);

    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        const values: number[] = [];

        const startX = bx * blockSize;
        const startY = by * blockSize;

        for (
          let y = startY;
          y < Math.min(startY + blockSize, height);
          y += 2
        ) {
          for (
            let x = startX;
            x < Math.min(startX + blockSize, width);
            x += 2
          ) {
            const i = (y * width + x) * 4;

            const brightness =
              pixels[i] * 0.299 +
              pixels[i + 1] * 0.587 +
              pixels[i + 2] * 0.114;

            values.push(brightness);
          }
        }

        values.sort((a, b) => a - b);

        // The upper percentile approximates the paper color.
        brightnessMap[by * cols + bx] =
          values[Math.floor(values.length * 0.85)] ?? 255;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const brightness =
          r * 0.299 + g * 0.587 + b * 0.114;

        const bx = Math.min(
          cols - 1,
          Math.floor(x / blockSize),
        );
        const by = Math.min(
          rows - 1,
          Math.floor(y / blockSize),
        );

        const paperBrightness =
          brightnessMap[by * cols + bx];

        const difference = Math.max(
          0,
          paperBrightness - brightness,
        );

        // Remove the estimated paper background.
        // Pencil strokes become increasingly opaque.
        const alpha = Math.max(
          0,
          Math.min(255, ((difference - 10) / 55) * 255),
        );

        pixels[i + 3] = Math.round(alpha);

        // Keep the original RGB values so colored drawings
        // retain their colors.
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
