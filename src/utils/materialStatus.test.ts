import { describe, it, expect } from 'vitest';
import { partitionByStatus, reclassify } from './materialStatus';
import type { RawMaterial } from '../types';

const make = (id: string, status: 'drawer' | 'gallery'): RawMaterial => ({
  id,
  image: 'data:image/png;base64,x',
  status,
});

describe('partitionByStatus', () => {
  it('separates drawer and gallery materials', () => {
    const all = [make('a', 'drawer'), make('b', 'gallery'), make('c', 'drawer')];
    const { drawer, gallery } = partitionByStatus(all);
    expect(drawer.map(m => m.id)).toEqual(['a', 'c']);
    expect(gallery.map(m => m.id)).toEqual(['b']);
  });
});

describe('reclassify', () => {
  it('updates the status of the matching material only', () => {
    const all = [make('a', 'drawer'), make('b', 'gallery')];
    const next = reclassify(all, 'a', 'gallery');
    expect(next.find(m => m.id === 'a')?.status).toBe('gallery');
    expect(next.find(m => m.id === 'b')?.status).toBe('gallery');
  });

  it('is a no-op when the id is not present', () => {
    const all = [make('a', 'drawer')];
    const next = reclassify(all, 'missing', 'gallery');
    expect(next).toEqual(all);
  });

  it('returns a new array (does not mutate)', () => {
    const all = [make('a', 'drawer')];
    const next = reclassify(all, 'a', 'gallery');
    expect(next).not.toBe(all);
  });
});
