import type { Scrap, TapeStrip } from '../types';

export function partitionScraps(scraps: Scrap[]): { staying: Scrap[]; falling: Scrap[] } {
  return {
    staying: scraps.filter(s => s.isGlued),
    falling: scraps.filter(s => !s.isGlued),
  };
}

/**
 * Returns true if a tape strip's centerline passes within the scrap's
 * approximate bounding circle. Uses bounding box of cut points for shaped
 * scraps, or a 400×300 approximation for full-photo rect scraps.
 */
export function tapeTouchesScrap(strip: TapeStrip, scrap: Scrap): boolean {
  let cx: number, cy: number, radius: number;

  if (scrap.points.length > 0) {
    const xs = scrap.points.map(p => p.x);
    const ys = scrap.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bboxW = (maxX - minX) * scrap.scale;
    const bboxH = (maxY - minY) * scrap.scale;
    cx = scrap.x + ((minX + maxX) / 2) * scrap.scale;
    cy = scrap.y + ((minY + maxY) / 2) * scrap.scale;
    radius = Math.sqrt(bboxW * bboxW + bboxH * bboxH) / 2;
  } else {
    const approxW = 400 * scrap.scale;
    const approxH = 300 * scrap.scale;
    cx = scrap.x + approxW / 2;
    cy = scrap.y + approxH / 2;
    radius = Math.sqrt(approxW * approxW + approxH * approxH) / 2;
  }

  const dx = strip.endPoint.x - strip.startPoint.x;
  const dy = strip.endPoint.y - strip.startPoint.y;
  const lenSq = dx * dx + dy * dy;
  let closestX: number, closestY: number;

  if (lenSq < 0.0001) {
    closestX = strip.startPoint.x;
    closestY = strip.startPoint.y;
  } else {
    const t = Math.max(0, Math.min(1,
      ((cx - strip.startPoint.x) * dx + (cy - strip.startPoint.y) * dy) / lenSq
    ));
    closestX = strip.startPoint.x + t * dx;
    closestY = strip.startPoint.y + t * dy;
  }

  const dist = Math.sqrt((closestX - cx) ** 2 + (closestY - cy) ** 2);
  return dist < radius + strip.width / 2;
}
