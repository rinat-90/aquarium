
import type { DrawingCrop } from './cropDrawing';

export async function createFishSilhouette(
  imageUrl: string,
  originalPhotoUrl?: string,
  crop?: DrawingCrop,
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

  // Detect drawing strokes from the background-removed image.
  const ink = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    ink[i] = pixels[i * 4 + 3] > 35 ? 1 : 0;
  }

  // Connect small gaps in the fish outline.
  const radius = Math.max(
    2,
    Math.min(6, Math.round(Math.min(width, height) * 0.004)),
  );

  const dilated = new Uint8Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!ink[y * width + x]) continue;

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

  // Find the background outside the fish.
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

  // Identify enclosed regions.
  const seen = new Uint8Array(total);
  const regions: number[][] = [];

  for (let start = 0; start < total; start++) {
    if (seen[start] || outside[start] || dilated[start]) {
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

  // Select the fish body.
  const selected = new Uint8Array(total);

  for (const index of mainBody) {
    selected[index] = 1;
  }

  // Include enclosed fins and tail regions near the body.
  const proximity = Math.max(
    6,
    Math.round(Math.min(width, height) * 0.035),
  );

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

  // Build a mask containing the body and connected strokes.
  const mask = new Uint8Array(total);

  const edgeMargin = Math.max(
    8,
    Math.round(Math.min(width, height) * 0.025),
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (selected[index]) {
        mask[index] = 1;
        continue;
      }

      if (!ink[index]) continue;

      // Ignore paper borders near the crop edges.
      if (
        x < edgeMargin ||
        y < edgeMargin ||
        x >= width - edgeMargin ||
        y >= height - edgeMargin
      ) {
        continue;
      }

      let neighbors = 0;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
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

          if (ink[ny * width + nx]) {
            neighbors++;
          }
        }
      }

      if (neighbors >= 3) {
        mask[index] = 1;
      }
    }
  }

  // Remove small disconnected artifacts.
  const visited = new Uint8Array(total);
  const components: number[][] = [];

  for (let start = 0; start < total; start++) {
    if (!mask[start] || visited[start]) continue;

    const component: number[] = [];
    const pending = [start];

    visited[start] = 1;

    while (pending.length > 0) {
      const index = pending.pop()!;
      component.push(index);

      const x = index % width;
      const y = Math.floor(index / width);

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

          const next = ny * width + nx;

          if (!mask[next] || visited[next]) continue;

          visited[next] = 1;
          pending.push(next);
        }
      }
    }

    components.push(component);
  }

  const minComponentSize = Math.max(
    12,
    Math.round(total * 0.0001),
  );

  for (const component of components) {
    if (component.length >= minComponentSize) continue;

    for (const index of component) {
      mask[index] = 0;
    }
  }

  // NEW: Close small gaps before filling the tail.
  const closingRadius = Math.max(
    2,
    Math.min(5, Math.round(Math.min(width, height) * 0.008)),
  );

  const expandedMask = new Uint8Array(total);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;

      for (let dy = -closingRadius; dy <= closingRadius; dy++) {
        for (let dx = -closingRadius; dx <= closingRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < width &&
            ny < height
          ) {
            expandedMask[ny * width + nx] = 1;
          }
        }
      }
    }
  }

  // Flood-fill the outside using the expanded outline.
  const background = new Uint8Array(total);
  const fillQueue = new Int32Array(total);

  let fillHead = 0;
  let fillTail = 0;

  const visitBackground = (index: number) => {
    if (expandedMask[index] || background[index]) return;

    background[index] = 1;
    fillQueue[fillTail++] = index;
  };

  for (let x = 0; x < width; x++) {
    visitBackground(x);
    visitBackground((height - 1) * width + x);
  }

  for (let y = 0; y < height; y++) {
    visitBackground(y * width);
    visitBackground(y * width + width - 1);
  }

  while (fillHead < fillTail) {
    const index = fillQueue[fillHead++];
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) visitBackground(index - 1);
    if (x < width - 1) visitBackground(index + 1);
    if (y > 0) visitBackground(index - width);
    if (y < height - 1) visitBackground(index + width);
  }

  // Preserve the original strokes and fill enclosed interiors.
  const filledMask = new Uint8Array(mask);

  for (let i = 0; i < total; i++) {
    if (!background[i]) {
      filledMask[i] = 1;
    }
  }

  // Restore colors from the original photograph.
  let colorPixels: Uint8ClampedArray = pixels;

  if (originalPhotoUrl && crop) {
    if (crop.width !== width || crop.height !== height) {
      throw new Error(
        'Original photo and fish crop dimensions differ.',
      );
    }

    const original = new Image();
    original.src = originalPhotoUrl;
    await original.decode();

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = crop.sourceWidth;
    originalCanvas.height = crop.sourceHeight;

    const originalCtx = originalCanvas.getContext('2d', {
      willReadFrequently: true,
    });

    if (!originalCtx) {
      throw new Error('Canvas is not supported');
    }

    originalCtx.drawImage(
      original,
      0,
      0,
      crop.sourceWidth,
      crop.sourceHeight,
    );

    colorPixels = originalCtx.getImageData(
      crop.x,
      crop.y,
      crop.width,
      crop.height,
    ).data;
  }

  // Render the fish with original drawing colors.
  const result = ctx.createImageData(width, height);

  for (let i = 0; i < total; i++) {
    if (!filledMask[i]) continue;

    const offset = i * 4;

    if (originalPhotoUrl && crop) {
      const r = colorPixels[offset];
      const g = colorPixels[offset + 1];
      const b = colorPixels[offset + 2];

      // Separate colored pencil strokes from the paper tone.
      // Subtracting the local brightness removes beige/gray
      // shading while preserving purple and yellow color.
      const brightness = (r + g + b) / 3;

      const chromaR = r - brightness;
      const chromaG = g - brightness;
      const chromaB = b - brightness;

      // Detect dark pencil marks independently of color.
      const darkness = Math.max(
        0,
        Math.min(1, (205 - brightness) / 110),
      );

      // Preserve colored-pencil saturation.
      const saturationBoost = 2.2;

      const clamp = (value: number) =>
        Math.max(0, Math.min(255, Math.round(value)));

      // White base, with restored color and dark pencil strokes.
      const base = 255 - darkness * 145;

      result.data[offset] = clamp(
        base + chromaR * saturationBoost,
      );

      result.data[offset + 1] = clamp(
        base + chromaG * saturationBoost,
      );

      result.data[offset + 2] = clamp(
        base + chromaB * saturationBoost,
      );
    } else {
      const alpha = pixels[offset + 3] / 255;
      const inkStrength = Math.min(1, alpha * 1.5);

      for (let channel = 0; channel < 3; channel++) {
        result.data[offset + channel] = Math.round(
          255 * (1 - inkStrength) +
          pixels[offset + channel] * inkStrength,
        );
      }
    }

    result.data[offset + 3] = 255;
  }

  // Smooth the silhouette edges.
  const edgeCanvas = document.createElement('canvas');
  edgeCanvas.width = width;
  edgeCanvas.height = height;

  const edgeCtx = edgeCanvas.getContext('2d');

  if (!edgeCtx) {
    throw new Error('Canvas is not supported');
  }

  edgeCtx.putImageData(result, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.filter = 'blur(0.7px)';
  ctx.drawImage(edgeCanvas, 0, 0);
  ctx.restore();

  // Find the visible fish bounds.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;

      if (result.data[offset + 3] === 0) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No visible fish found');
  }

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
