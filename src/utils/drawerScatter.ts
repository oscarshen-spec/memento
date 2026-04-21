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
  const clampX = (v: number) =>
    Math.max(BOUNDARY_MARGIN, Math.min(v, containerWidth - CARD_W - BOUNDARY_MARGIN));
  const clampY = (v: number) =>
    Math.max(BOUNDARY_MARGIN, Math.min(v, containerHeight - CARD_H - BOUNDARY_MARGIN));

  let cx = clampX(x);
  let cy = clampY(y);

  for (const b of blocked) {
    // Try up to 4 axes in shortest-overlap order; break as soon as we escape.
    for (let iter = 0; iter < 4; iter++) {
      const card = { x: cx, y: cy, width: CARD_W, height: CARD_H };
      if (!rectsOverlap(card, b)) break;

      // Compute overlap on all four push-out directions.
      const overlapLeft = card.x + card.width - b.x;   // push card left
      const overlapRight = b.x + b.width - card.x;     // push card right
      const overlapTop = card.y + card.height - b.y;   // push card up
      const overlapBottom = b.y + b.height - card.y;   // push card down

      // Build an ordered list of axes shortest-overlap first.
      type Axis = { overlap: number; name: 'left' | 'right' | 'top' | 'bottom' };
      const axes: Axis[] = [
        { overlap: overlapLeft, name: 'left' },
        { overlap: overlapRight, name: 'right' },
        { overlap: overlapTop, name: 'top' },
        { overlap: overlapBottom, name: 'bottom' },
      ].sort((p, q) => p.overlap - q.overlap) as Axis[];

      // Use `iter` as the index so each iteration tries the next-shortest axis.
      const { name: axis } = axes[iter];

      let nx = cx;
      let ny = cy;
      if (axis === 'left') nx = b.x - CARD_W - 2;
      else if (axis === 'right') nx = b.x + b.width + 2;
      else if (axis === 'top') ny = b.y - CARD_H - 2;
      else ny = b.y + b.height + 2;

      // Re-clamp into container bounds after the push.
      cx = clampX(nx);
      cy = clampY(ny);

      // If after clamping we no longer overlap, we're done with this blocked rect.
      const after = { x: cx, y: cy, width: CARD_W, height: CARD_H };
      if (!rectsOverlap(after, b)) break;
      // Otherwise loop to try the next axis.
    }
    // If all 4 axes failed, leave cx/cy at the last clamped position (caller
    // verifies with rectsOverlap and may discard the result).
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
  let best: { x: number; y: number } | null = null;
  let bestDist = -1;

  for (let attempt = 0; attempt < 30; attempt++) {
    const rawX = Math.random() * containerWidth;
    const rawY = Math.random() * containerHeight;
    const { x, y } = clampPosition(rawX, rawY, containerWidth, containerHeight, blocked);

    // Skip candidates still overlapping a blocked rect (clamp may fail in tight corners).
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

  // Pathological fallback: no clean (non-blocked) candidate was ever found.
  // Clamp the container centre with no blocked rects so we at least land in-bounds.
  if (best === null) {
    const { x, y } = clampPosition(
      containerWidth / 2,
      containerHeight / 2,
      containerWidth,
      containerHeight,
      [], // ignore blocked — guarantee in-bounds
    );
    best = { x, y };
  }

  return {
    x: best.x,
    y: best.y,
    rotation: (Math.random() - 0.5) * 30,
    zIndex: baseZ,
  };
}
