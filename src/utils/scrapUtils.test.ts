import { describe, it, expect } from 'vitest';
import { partitionScraps } from './scrapUtils';
import type { Scrap } from '../types';

const makeScrap = (id: string, isGlued: boolean): Scrap => ({
  id,
  image: 'data:image/png;base64,abc',
  points: [],
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  zIndex: 0,
  isGlued,
});

describe('partitionScraps', () => {
  it('splits scraps into staying (glued) and falling (loose)', () => {
    const scraps = [
      makeScrap('a', true),
      makeScrap('b', false),
      makeScrap('c', true),
      makeScrap('d', false),
    ];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying.map(s => s.id)).toEqual(['a', 'c']);
    expect(falling.map(s => s.id)).toEqual(['b', 'd']);
  });

  it('returns all staying when all are glued', () => {
    const scraps = [makeScrap('a', true), makeScrap('b', true)];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying).toHaveLength(2);
    expect(falling).toHaveLength(0);
  });

  it('returns all falling when none are glued', () => {
    const scraps = [makeScrap('a', false), makeScrap('b', false)];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying).toHaveLength(0);
    expect(falling).toHaveLength(2);
  });

  it('returns empty arrays for empty input', () => {
    const { staying, falling } = partitionScraps([]);
    expect(staying).toHaveLength(0);
    expect(falling).toHaveLength(0);
  });
});
