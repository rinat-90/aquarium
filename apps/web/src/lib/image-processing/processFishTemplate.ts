import { getFishTemplateAssets, type FishTemplateId } from './fishTemplateRegistry';

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Extract the child's ACTUAL drawing, not the pre-printed template silhouette.
 * The selected template is retained as metadata; its mask is deliberately not
 * stretched onto the photo, because that leaves large white paper shapes.
 *
 * Works best for a single, outlined fish on plain white paper. The algorithm
 * fails explicitly if it cannot find a plausible closed silhouette.
 */
export async function processFishTemplate(file: File, id: FishTemplateId): Promise<string> {
  // Keep template selection validated even though we don't force its geometry.
  getFishTemplateAssets(id);
  const url = URL.createObjectURL(file);
  try {
    const photo = await loadImage(url);
    const scale = Math.min(1, 1100 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const width = Math.round(photo.naturalWidth * scale);
    const height = Math.round(photo.naturalHeight * scale);
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(photo, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    const n = width * height;

    // Locate colored pencil/crayon marks to identify the fish's rough position.
    // Sample a coarse grid and discard isolated chromatic background artifacts.
    const step = Math.max(1, Math.floor(Math.max(width, height) / 650));
    let minX = width, minY = height, maxX = -1, maxY = -1, colored = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        if (hi < 65 || hi - lo < 38 || (hi - lo) / Math.max(hi, 1) < 0.24) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        colored++;
      }
    }
    if (maxX < minX || colored * step * step < n * 0.002) {
      throw new Error('Could not find the colored fish. Use a plain background and scan again.');
    }

    // Only inspect the vicinity of the drawing: furniture and page edges must
    // never become part of the silhouette.
    const fishW = maxX - minX + 1, fishH = maxY - minY + 1;
    const margin = Math.max(14, Math.round(Math.max(fishW, fishH) * 0.16));
    const x0 = Math.max(0, minX - margin), y0 = Math.max(0, minY - margin);
    const x1 = Math.min(width, maxX + margin + 1), y1 = Math.min(height, maxY + margin + 1);
    const w = x1 - x0, h = y1 - y0, count = w * h;
    if (w < 50 || h < 50) throw new Error('Move closer to the fish and scan again.');

    // Ink map: dark outlines OR saturated colored marks. The white eye is
    // retained later by filling enclosed areas rather than deleting white pixels.
    const ink = new Uint8Array(count);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((y + y0) * width + x + x0) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        const dark = (r * 0.299 + g * 0.587 + b * 0.114) < 118;
        const chromatic = hi - lo > 37 && (hi - lo) / Math.max(hi, 1) > 0.23 && hi > 65;
        ink[y * w + x] = dark || chromatic ? 1 : 0;
      }
    }

    // Morphological closing connects pencil-outline gaps of a few pixels.
    // Radius scales with the fish, not with the full camera image.
    const radius = Math.max(2, Math.min(5, Math.round(Math.min(fishW, fishH) / 140)));
    const dilated = new Uint8Array(count);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && dx * dx + dy * dy <= radius * radius) dilated[yy * w + xx] = 1;
        }
      }
    }
    const closed = new Uint8Array(count);
    for (let y = radius; y < h - radius; y++) for (let x = radius; x < w - radius; x++) {
      let filled = true;
      for (let dy = -radius; dy <= radius && filled; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius && !dilated[(y + dy) * w + x + dx]) {
            filled = false; break;
          }
        }
      }
      if (filled) closed[y * w + x] = 1;
    }

    // Flood-fill the outside. A genuinely closed fish outline traps its interior
    // (including white eyes / uncolored regions) away from the flood.
    const outside = new Uint8Array(count);
    const queue = new Int32Array(count);
    let head = 0, tail = 0;
    const enqueue = (p: number) => {
      if (!closed[p] && !outside[p]) { outside[p] = 1; queue[tail++] = p; }
    };
    for (let x = 0; x < w; x++) { enqueue(x); enqueue((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { enqueue(y * w); enqueue(y * w + w - 1); }
    while (head < tail) {
      const p = queue[head++], x = p % w;
      if (x > 0) enqueue(p - 1);
      if (x < w - 1) enqueue(p + 1);
      if (p >= w) enqueue(p - w);
      if (p < count - w) enqueue(p + w);
    }

    // Largest connected foreground component only. This rejects specks and
    // loose strokes outside the fish without deleting white details inside it.
    const seen = new Uint8Array(count);
    const componentQueue = new Int32Array(count);
    let best: number[] = [];
    for (let p = 0; p < count; p++) {
      if (outside[p] || seen[p]) continue;
      let start = 0, end = 0;
      componentQueue[end++] = p; seen[p] = 1;
      const component: number[] = [];
      while (start < end) {
        const q = componentQueue[start++]; component.push(q);
        const x = q % w;
        const visit = (v: number) => {
          if (!outside[v] && !seen[v]) { seen[v] = 1; componentQueue[end++] = v; }
        };
        if (x > 0) visit(q - 1);
        if (x < w - 1) visit(q + 1);
        if (q >= w) visit(q - w);
        if (q < count - w) visit(q + w);
      }
      if (component.length > best.length) best = component;
    }
    if (best.length < fishW * fishH * 0.13) {
      throw new Error('Could not isolate the fish outline. Keep the full fish in frame, use dark outlines, and try again.');
    }

    const keep = new Uint8Array(count);
    let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
    for (const p of best) {
      keep[p] = 1;
      const x = p % w, y = Math.floor(p / w);
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    }
    // Reject implausible extraction (usually a page edge or a large paper area).
    if ((bx1 - bx0 + 1) > fishW * 1.4 || (by1 - by0 + 1) > fishH * 1.5) {
      throw new Error('The outline includes background. Move closer, flatten the paper, and scan again.');
    }

    const pad = 5;
    bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad);
    bx1 = Math.min(w - 1, bx1 + pad); by1 = Math.min(h - 1, by1 + pad);
    const outW = bx1 - bx0 + 1, outH = by1 - by0 + 1;
    const result = document.createElement('canvas');
    result.width = outW; result.height = outH;
    const outCtx = result.getContext('2d');
    if (!outCtx) throw new Error('Canvas is unavailable.');
    const output = outCtx.createImageData(outW, outH);
    for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
      const sx = bx0 + x, sy = by0 + y;
      if (!keep[sy * w + sx]) continue;
      const from = ((sy + y0) * width + sx + x0) * 4;
      const to = (y * outW + x) * 4;
      output.data[to] = data[from];
      output.data[to + 1] = data[from + 1];
      output.data[to + 2] = data[from + 2];
      output.data[to + 3] = 255;
    }
    outCtx.putImageData(output, 0, 0);
    return result.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
