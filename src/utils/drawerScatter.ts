export interface DrawerPosition {
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CARD_W = 100;
export const CARD_H = 100;
const BOUNDARY_MARGIN = 64;

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function clampPosition(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  blocked: Rect[] = [],
): { x: number; y: number } {
  let cx = Math.max(BOUNDARY_MARGIN, Math.min(x, containerWidth - CARD_W - BOUNDARY_MARGIN));
  let cy = Math.max(BOUNDARY_MARGIN, Math.min(y, containerHeight - CARD_H - BOUNDARY_MARGIN));

  for (const b of blocked) {
    const card = { x: cx, y: cy, width: CARD_W, height: CARD_H };
    if (!rectsOverlap(card, b)) continue;

    // Push out along the shortest axis
    const overlapLeft = card.x + card.width - b.x;
    const overlapRight = b.x + b.width - card.x;
    const overlapTop = card.y + card.height - b.y;
    const overlapBottom = b.y + b.height - card.y;
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft) cx = b.x - CARD_W - 2;
    else if (minOverlap === overlapRight) cx = b.x + b.width + 2;
    else if (minOverlap === overlapTop) cy = b.y - CARD_H - 2;
    else cy = b.y + b.height + 2;

    cx = Math.max(BOUNDARY_MARGIN, Math.min(cx, containerWidth - CARD_W - BOUNDARY_MARGIN));
    cy = Math.max(BOUNDARY_MARGIN, Math.min(cy, containerHeight - CARD_H - BOUNDARY_MARGIN));
  }

  return { x: cx, y: cy };
}

export function makeScatterPosition(
  _index: number,
  containerWidth: number,
  containerHeight: number,
  baseZ: number,
  existingPositions: DrawerPosition[],
  blocked: Rect[] = [],
): DrawerPosition {
  const MIN_DIST = 60;
  let best = { x: 0, y: 0 };
  let bestDist = -1;

  for (let attempt = 0; attempt < 30; attempt++) {
    const rawX = Math.random() * containerWidth;
    const rawY = Math.random() * containerHeight;
    const { x, y } = clampPosition(rawX, rawY, containerWidth, containerHeight, blocked);

    // Skip candidates still overlapping a blocked rect (clamp may fail in tight corners)
    const card = { x, y, width: CARD_W, height: CARD_H };
    if (blocked.some(b => rectsOverlap(card, b))) continue;

    const minDist = existingPositions.reduce((min, p) => {
      const d = Math.hypot(p.x - x, p.y - y);
      return Math.min(min, d);
    }, Infinity);

    if (minDist > bestDist) {
      bestDist = minDist;
      best = { x, y };
      if (minDist >= MIN_DIST) break;
    }
  }

  return {
    x: best.x,
    y: best.y,
    rotation: (Math.random() - 0.5) * 30,
    zIndex: baseZ,
  };
}
