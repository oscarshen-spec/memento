import type { Point } from '../types';

/**
 * Clips `sourceImage` to `polygon` (coordinates expressed in the canvas-space
 * used by CuttingRoom: the polygon is sized to `canvasW x canvasH`, and the
 * image fills that canvas with `object-fit: contain` centering). Returns a
 * PNG data URL cropped to the polygon's bounding box.
 */
export async function rasterizePolygon(
  sourceImage: string,
  polygon: Point[],
  canvasW: number,
  canvasH: number,
): Promise<string> {
  if (polygon.length < 3) throw new Error('Polygon must have at least 3 points');

  const img = await loadImage(sourceImage);

  // Compute bbox in canvas-space
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.max(0, Math.min(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxX = Math.min(canvasW, Math.max(...xs));
  const maxY = Math.min(canvasH, Math.max(...ys));
  const outW = Math.max(1, Math.round(maxX - minX));
  const outH = Math.max(1, Math.round(maxY - minY));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, outW, outH);

  // Build the clip path in output-local coordinates
  ctx.save();
  ctx.beginPath();
  polygon.forEach((p, i) => {
    const lx = p.x - minX;
    const ly = p.y - minY;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  });
  ctx.closePath();
  ctx.clip();

  // Mirror CuttingRoom's object-fit: contain draw
  const imgScale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  const imgX = (canvasW - img.naturalWidth * imgScale) / 2 - minX;
  const imgY = (canvasH - img.naturalHeight * imgScale) / 2 - minY;
  ctx.drawImage(
    img,
    imgX,
    imgY,
    img.naturalWidth * imgScale,
    img.naturalHeight * imgScale,
  );
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}
