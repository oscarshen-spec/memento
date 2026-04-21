import { describe, it, expect } from 'vitest';
import { clampPosition, makeScatterPosition, rectsOverlap, CARD_W, CARD_H } from './drawerScatter';

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
    expect(dist).toBeGreaterThan(10);
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
