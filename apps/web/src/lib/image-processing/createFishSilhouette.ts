
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

  // Strong pencil strokes form the boundaries.
  const ink = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    ink[i] = pixels[i * 4 + 3] > 115 ? 1 : 0;
  }

  // Dilate the strokes to close small gaps.
  const radius = 2;
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

  if (!mainBody || mainBody.length < total * 0.01) {
    throw new Error(
      'Could not detect a closed fish outline.',
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

    result.data[offset] = Math.round(
      255 * (1 - alpha) + pixels[offset] * alpha,
    );

    result.data[offset + 1] = Math.round(
      255 * (1 - alpha) + pixels[offset + 1] * alpha,
    );

    result.data[offset + 2] = Math.round(
      255 * (1 - alpha) + pixels[offset + 2] * alpha,
    );

    result.data[offset + 3] = 255;
  }

  ctx.putImageData(result, 0, 0);

  return canvas.toDataURL('image/png');
}
