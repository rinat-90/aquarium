import { getFishTemplateAssets, type FishTemplateId } from './fishTemplateRegistry';

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Color-guided first pass for straight-on photos of colored templates.
 * Unlike the previous implementation, we don't use paper-background removal
 * to choose the mask's bounding box: that included the surrounding paper.
 * A photo with little/no coloring or a skewed template needs a guided retake.
 */
export async function processFishTemplate(file: File, id: FishTemplateId): Promise<string> {
  const photoUrl = URL.createObjectURL(file);
  try {
    const { mask } = getFishTemplateAssets(id);
    const [photo, shape] = await Promise.all([loadImage(photoUrl), loadImage(mask)]);

    // Bound processing cost on mobile without distorting the image.
    const scale = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight));
    const width = Math.max(1, Math.round(photo.naturalWidth * scale));
    const height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(photo, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);

    // Detect saturated crayon/pencil marks. Ignore white paper, grey shadows,
    // and the monochrome printed outline. Sampling in a grid suppresses noise.
    let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
    const step = Math.max(1, Math.floor(Math.max(width, height) / 900));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        const saturation = hi ? (hi - lo) / hi : 0;
        // Require both substantial chroma and sufficient brightness.
        if (saturation < 0.22 || hi < 65 || hi - lo < 32) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        count++;
      }
    }
    if (maxX < minX || count * step * step < width * height * 0.002) {
      throw new Error('Could not locate the colored fish. Color the template more brightly, keep it flat, and scan again.');
    }

    // Expand just a little for uncolored outlines, eyes and fin tips.
    const colorW = maxX - minX + 1, colorH = maxY - minY + 1;
    const padX = Math.max(4, Math.round(colorW * 0.06));
    const padY = Math.max(4, Math.round(colorH * 0.06));
    const x0 = Math.max(0, minX - padX), y0 = Math.max(0, minY - padY);
    const x1 = Math.min(width, maxX + padX + 1), y1 = Math.min(height, maxY + padY + 1);
    const outW = x1 - x0, outH = y1 - y0;
    if (outW < 40 || outH < 40) throw new Error('Fish is too small in the photo. Move closer and try again.');

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = shape.naturalWidth;
    maskCanvas.height = shape.naturalHeight;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) throw new Error('Canvas is unavailable.');
    maskCtx.drawImage(shape, 0, 0);
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    let mx0 = maskCanvas.width, my0 = maskCanvas.height, mx1 = -1, my1 = -1;
    for (let y = 0; y < maskCanvas.height; y++) {
      for (let x = 0; x < maskCanvas.width; x++) {
        const i = (y * maskCanvas.width + x) * 4;
        if (maskData[i] < 128) continue;
        mx0 = Math.min(mx0, x); my0 = Math.min(my0, y);
        mx1 = Math.max(mx1, x); my1 = Math.max(my1, y);
      }
    }
    if (mx1 < mx0) throw new Error('Fish template mask is empty.');

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outW;
    outputCanvas.height = outH;
    const outCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) throw new Error('Canvas is unavailable.');
    outCtx.drawImage(canvas, x0, y0, outW, outH, 0, 0, outW, outH);

    // Mask PNGs are opaque grayscale images (white fish, black background).
    // Convert luminance to alpha BEFORE using destination-in. Drawing the
    // original image directly would keep its black background as opaque.
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = outW;
    alphaCanvas.height = outH;
    const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
    if (!alphaCtx) throw new Error('Canvas is unavailable.');
    alphaCtx.imageSmoothingEnabled = true;
    alphaCtx.imageSmoothingQuality = 'high';
    alphaCtx.drawImage(shape, mx0, my0, mx1 - mx0 + 1, my1 - my0 + 1, 0, 0, outW, outH);
    const alphaPixels = alphaCtx.getImageData(0, 0, outW, outH);
    for (let i = 0; i < alphaPixels.data.length; i += 4) {
      // Preserve antialiased edges and honor any existing source alpha.
      const brightness = alphaPixels.data[i];
      alphaPixels.data[i] = 255;
      alphaPixels.data[i + 1] = 255;
      alphaPixels.data[i + 2] = 255;
      alphaPixels.data[i + 3] = Math.round(brightness * alphaPixels.data[i + 3] / 255);
    }
    alphaCtx.putImageData(alphaPixels, 0, 0);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.drawImage(alphaCanvas, 0, 0);
    outCtx.globalCompositeOperation = 'source-over';
    return outputCanvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(photoUrl);
  }
}
