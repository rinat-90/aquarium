
export async function createFishSilhouette(
  imageUrl: string,
): Promise<string> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const total = width * height;

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

  const source = ctx.getImageData(0, 0, width, height);
  const pixels = source.data;

  // Detect both dark and light pencil strokes.
// Background removal has already made paper transparent.
  const ink = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const alpha = pixels[i * 4 + 3];

    ink[i] = alpha > 35 ? 1 : 0;
  }

  // Scale gap closing to the image resolution.
  // Helps connect thin pencil strokes and small breaks.
  const radius = Math.max(
    2,
    Math.min(6, Math.round(Math.min(width, height) * 0.004)),
  );
  const dilated = new Uint8Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (!ink[index]) continue;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < width &&
            ny < height
          ) {
            dilated[ny * width + nx] = 1;
          }
        }
      }
    }
  }

  // Morphological closing:
// Shrink the dilated strokes back toward their original
// thickness while keeping small gaps connected.
  const closed = new Uint8Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let filled = true;

      for (let dy = -radius; dy <= radius && filled; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx < 0 ||
            ny < 0 ||
            nx >= width ||
            ny >= height ||
            !dilated[ny * width + nx]
          ) {
            filled = false;
            break;
          }
        }
      }

      closed[y * width + x] = filled ? 1 : 0;
    }
  }

  // Find enclosed transparent regions.
  const outside = new Uint8Array(total);
  const queue = new Int32Array(total);

  let head = 0;
  let tail = 0;

  const visit = (index: number) => {
    if (
      index < 0 ||
      index >= total ||
      dilated[index] ||
      outside[index]
    ) {
      return;
    }

    outside[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }

  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }

  // Label all enclosed regions.
  const seen = new Uint8Array(total);
  const regions: number[][] = [];

  for (let start = 0; start < total; start++) {
    if (
      seen[start] ||
      outside[start] ||
      dilated[start]
    ) {
      continue;
    }

    const region: number[] = [];
    const pending = [start];
    seen[start] = 1;

    while (pending.length) {
      const index = pending.pop()!;
      region.push(index);

      const x = index % width;
      const y = Math.floor(index / width);

      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];

      for (const next of neighbors) {
        if (
          next < 0 ||
          seen[next] ||
          outside[next] ||
          dilated[next]
        ) {
          continue;
        }

        seen[next] = 1;
        pending.push(next);
      }
    }

    regions.push(region);
  }

  regions.sort((a, b) => b.length - a.length);

  const mainBody = regions[0];

  if (!mainBody || mainBody.length < total * 0.003) {
    throw new Error(
      'Could not detect a sufficiently closed fish outline.',
    );
  }

  // Start with the main body.
  const selected = new Uint8Array(total);

  for (const index of mainBody) {
    selected[index] = 1;
  }

  // Include nearby enclosed regions such as fins.
  // The distance scales with the image size.
  const proximity = Math.max(
    6,
    Math.round(Math.min(width, height) * 0.035),
  );

  // Build a proximity mask around the main body.
  const nearby = new Uint8Array(total);

  for (const index of mainBody) {
    const x = index % width;
    const y = Math.floor(index / width);

    for (let dy = -proximity; dy <= proximity; dy++) {
      for (let dx = -proximity; dx <= proximity; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height
        ) {
          nearby[ny * width + nx] = 1;
        }
      }
    }
  }

  // Keep smaller regions that touch the body neighborhood.
  for (let i = 1; i < regions.length; i++) {
    const region = regions[i];

    const touchesBody = region.some(
      (index) => nearby[index] === 1,
    );

    if (!touchesBody) continue;

    for (const index of region) {
      selected[index] = 1;
    }
  }

  // Expand the selected regions to include their outlines.
  const mask = new Uint8Array(total);
  const outlinePadding = radius + 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (!selected[index]) continue;

      for (
        let dy = -outlinePadding;
        dy <= outlinePadding;
        dy++
      ) {
        for (
          let dx = -outlinePadding;
          dx <= outlinePadding;
          dx++
        ) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < width &&
            ny < height
          ) {
            mask[ny * width + nx] = 1;
          }
        }
      }
    }
  }

  // Draw the original pencil strokes on a solid white fish.
  const result = ctx.createImageData(width, height);

  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;

    const offset = i * 4;
    const alpha = pixels[offset + 3] / 255;

    // Reconstruct dark pencil strokes on clean white paper.
    const inkStrength = Math.min(1, alpha * 1.5);

    const color = Math.round(
      255 - inkStrength * 225,
    );

    result.data[offset] = color;
    result.data[offset + 1] = color;
    result.data[offset + 2] = color;
    result.data[offset + 3] = 255;
  }

  ctx.putImageData(result, 0, 0);

// Find the visible fish bounds in the final silhouette.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      if (result.data[index + 3] === 0) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No visible fish found');
  }

// Keep a little transparent padding around the fish.
  const padding = 12;

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropRight = Math.min(width, maxX + padding + 1);
  const cropBottom = Math.min(height, maxY + padding + 1);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropRight - cropX;
  croppedCanvas.height = cropBottom - cropY;

  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Canvas is not supported');
  }

  croppedCtx.drawImage(
    canvas,
    cropX,
    cropY,
    croppedCanvas.width,
    croppedCanvas.height,
    0,
    0,
    croppedCanvas.width,
    croppedCanvas.height,
  );

  return croppedCanvas.toDataURL('image/png');
}
