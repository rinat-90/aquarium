/** Increase colored-pencil vibrancy without changing transparency or fish shape. */
export async function enhanceScannedFish(imageUrl: string, boost: number): Promise<string> {
  if (boost <= 1.001) return imageUrl;
  const image = new Image();
  image.src = imageUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const strength = Math.max(0, Math.min(1, boost - 1));
    data[i] = Math.max(0, Math.min(255, gray + (r - gray) * (1 + strength)));
    data[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * (1 + strength)));
    data[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * (1 + strength)));
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}
