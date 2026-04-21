import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rasterizePolygon } from './rasterizePolygon';

// Minimal offscreen-canvas mock: captures clip/drawImage calls and returns a stub data URL.
beforeEach(() => {
  const ctx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  };
  const toDataURL = vi.fn(() => 'data:image/png;base64,STUB');
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL };
  // @ts-ignore
  global.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return canvas;
      throw new Error('unexpected tag');
    },
  };
  // @ts-ignore
  global.Image = class {
    width = 200;
    height = 150;
    naturalWidth = 200;
    naturalHeight = 150;
    onload: (() => void) | null = null;
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  };
});

describe('rasterizePolygon', () => {
  it('resolves with a data URL when given a valid polygon and image', async () => {
    const result = await rasterizePolygon(
      'data:image/png;base64,SRC',
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
      200,
      150,
    );
    expect(result).toBe('data:image/png;base64,STUB');
  });

  it('rejects when the polygon is empty', async () => {
    await expect(rasterizePolygon('data:image/png;base64,SRC', [], 200, 150))
      .rejects.toThrow();
  });
});
