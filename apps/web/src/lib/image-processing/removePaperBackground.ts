export async function removePaperBackground(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  try {
    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

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

    const blockSize = 32;
    const cols = Math.ceil(width / blockSize);
    const rows = Math.ceil(height / blockSize);

    // Estimate the local paper color, not just brightness.
    // This helps compensate for shadows and warm lighting.
    const paperR = new Float32Array(cols * rows);
    const paperG = new Float32Array(cols * rows);
    const paperB = new Float32Array(cols * rows);

    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        const samples: {
          brightness: number;
          r: number;
          g: number;
          b: number;
        }[] = [];

        const startX = bx * blockSize;
        const startY = by * blockSize;

        for (let y = startY; y < Math.min(startY + blockSize, height); y += 2) {
          for (let x = startX; x < Math.min(startX + blockSize, width); x += 2) {
            const i = (y * width + x) * 4;

            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            const brightness = r * 0.299 + g * 0.587 + b * 0.114;

            samples.push({ brightness, r, g, b });
          }
        }

        samples.sort((a, b) => b.brightness - a.brightness);

        // Use the brightest 25% of each block as
        // candidates for the paper background.
        const sampleCount = Math.max(1, Math.ceil(samples.length * 0.25));

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;

        for (let i = 0; i < sampleCount; i++) {
          sumR += samples[i].r;
          sumG += samples[i].g;
          sumB += samples[i].b;
        }

        const index = by * cols + bx;

        paperR[index] = sumR / sampleCount;
        paperG[index] = sumG / sampleCount;
        paperB[index] = sumB / sampleCount;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const bx = Math.min(cols - 1, Math.floor(x / blockSize));
        const by = Math.min(rows - 1, Math.floor(y / blockSize));

        const blockIndex = by * cols + bx;

        const pr = paperR[blockIndex];
        const pg = paperG[blockIndex];
        const pb = paperB[blockIndex];

        const brightness = r * 0.299 + g * 0.587 + b * 0.114;

        const paperBrightness = pr * 0.299 + pg * 0.587 + pb * 0.114;

        const brightnessDifference = Math.max(0, paperBrightness - brightness);

        // Compare the pixel's color with the local paper.
        // This catches colored strokes that are relatively light.
        const colorDifference = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);

        // Measure chromatic differences separately from
        // overall brightness, reducing shadow sensitivity.
        const redGreenDifference = Math.abs(r - g - (pr - pg));

        const blueGreenDifference = Math.abs(b - g - (pb - pg));

        const chromaDifference = Math.sqrt(redGreenDifference ** 2 + blueGreenDifference ** 2);

        const brightnessAlpha = ((brightnessDifference - 12) / 45) * 255;

        const colorAlpha = ((colorDifference - 20) / 65) * 255;

        const chromaAlpha = ((chromaDifference - 8) / 35) * 255;

        // Combine evidence from dark pencil strokes and
        // colored pencil / marker strokes.
        const alpha = Math.max(brightnessAlpha, colorAlpha, chromaAlpha);

        pixels[i + 3] = Math.round(Math.max(0, Math.min(255, alpha)));

        // Preserve original RGB values.
        // createFishSilhouette() uses the original photograph
        // for final colors when it is supplied.
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
