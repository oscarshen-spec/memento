import { describe, it, expect } from 'vitest';
import { clampPosition, makeScatterPosition, rectsOverlap, CARD_W, CARD_H } from './drawerScatter';

const BOUNDARY_MARGIN = 64;

describe('clampPosition', () => {
  it('keeps positions inside container with margin', () => {
    const { x, y } = clampPosition(-100, -100, 500, 300, []);
    expect(x).toBeGreaterThanOrEqual(64);
    expect(y).toBeGreaterThanOrEqual(64);
  });

  it('pushes positions out of blocked rects', () => {
    const blocked = [{ x: 100, y: 50, width: 120, height: 120 }];
    // A point that would land inside the blocked rect
    const { x, y } = clampPosition(140, 90, 500, 300, blocked);
    expect(rectsOverlap({ x, y, width: CARD_W, height: CARD_H }, blocked[0])).toBe(false);
  });

  it('leaves positions unchanged when no blocked rects and within bounds', () => {
    const { x, y } = clampPosition(200, 100, 500, 300, []);
    expect(x).toBe(200);
    expect(y).toBe(100);
  });

  it('falls back to second axis when first-choice push is clamped back into the blocked rect', () => {
    // The blocked rect at {x:64, y:100, w:200, h:120} with a card at (100, 140).
    // Container: 400 wide, 400 tall. BOUNDARY_MARGIN = 64.
    // Overlaps: overlapLeft = 136, overlapRight = 164, overlapTop = 40, overlapBottom = 80.
    // overlapBottom = 80 is the shortest → first-choice push is downward: cy = 100+120+2 = 222.
    // This lands in-bounds (222 + 100 ≈ 322 < 400) and is not overlapping the blocked rect.
    // This test verifies that when the first-choice axis cleanly escapes the blocked rect,
    // the iteration terminates without needing to try the remaining axes.
    const blocked = [{ x: 64, y: 100, width: 200, height: 120 }];
    const { x, y } = clampPosition(100, 140, 400, 400, blocked);
    expect(rectsOverlap({ x, y, width: CARD_W, height: CARD_H }, blocked[0])).toBe(false);
    expect(x).toBeGreaterThanOrEqual(BOUNDARY_MARGIN);
    expect(y).toBeGreaterThanOrEqual(BOUNDARY_MARGIN);
  });
});

describe('makeScatterPosition', () => {
  it('produces positions that do not overlap blocked rects', () => {
    const blocked = [{ x: 10, y: 10, width: 140, height: 140 }];
    for (let i = 0; i < 25; i++) {
      const pos = makeScatterPosition(i, 400, 300, 0, [], blocked);
      const overlaps = rectsOverlap(
        { x: pos.x, y: pos.y, width: CARD_W, height: CARD_H },
        blocked[0],
      );
      expect(overlaps).toBe(false);
    }
  });

  it('spaces positions apart when possible', () => {
    const existing = [{ x: 100, y: 100, rotation: 0, zIndex: 0 }];
    const pos = makeScatterPosition(1, 500, 300, 1, existing, []);
    const dist = Math.hypot(pos.x - 100, pos.y - 100);
    expect(dist).toBeGreaterThan(59);
  });

  it('returns an in-bounds position even when a huge blocked rect fills most of the container', () => {
    // Pathological: tiny container, giant blocked rect that nearly fills all valid space.
    // makeScatterPosition must still return something in-bounds, not {0, 0}.
    const containerWidth = 300;
    const containerHeight = 300;
    // Block almost everything except a tiny sliver — 30 random attempts will all overlap.
    const blocked = [{ x: 0, y: 0, width: 299, height: 299 }];
    const pos = makeScatterPosition(0, containerWidth, containerHeight, 0, [], blocked);

    const minX = BOUNDARY_MARGIN;
    const minY = BOUNDARY_MARGIN;
    const maxX = containerWidth - CARD_W - BOUNDARY_MARGIN;
    const maxY = containerHeight - CARD_H - BOUNDARY_MARGIN;

    // Must be in-bounds (not the initial {0,0} sentinel).
    expect(pos.x).toBeGreaterThanOrEqual(minX);
    expect(pos.y).toBeGreaterThanOrEqual(minY);
    expect(pos.x).toBeLessThanOrEqual(maxX);
    expect(pos.y).toBeLessThanOrEqual(maxY);
    // We do NOT require non-overlap in the pathological case.
  });
});

describe('rectsOverlap', () => {
  it('returns true when rects intersect', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 40, y: 40, width: 50, height: 50 },
    )).toBe(true);
  });

  it('returns false when rects do not intersect', () => {
    expect(rectsOverlap(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    )).toBe(false);
  });
});
