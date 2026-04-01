import { describe, it, expect } from 'vitest';
import { shouldSnapForward } from './flipUtils';

describe('shouldSnapForward', () => {
  it('snaps when drag progress exceeds 35% of page width', () => {
    expect(shouldSnapForward(360, 1000, 0)).toBe(true);
    expect(shouldSnapForward(350, 1000, 0)).toBe(true);
    expect(shouldSnapForward(349, 1000, 0)).toBe(false);
  });

  it('snaps on velocity above 0.5 px/ms regardless of distance', () => {
    expect(shouldSnapForward(100, 1000, 0.51)).toBe(true);
    expect(shouldSnapForward(100, 1000, 0.5)).toBe(false);
  });

  it('does not snap when below both thresholds', () => {
    expect(shouldSnapForward(200, 1000, 0.2)).toBe(false);
  });

  it('returns false for zero drag', () => {
    expect(shouldSnapForward(0, 1000, 0)).toBe(false);
  });
});
