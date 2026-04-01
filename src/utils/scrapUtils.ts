import type { Scrap } from '../types';

export function partitionScraps(scraps: Scrap[]): { staying: Scrap[]; falling: Scrap[] } {
  return {
    staying: scraps.filter(s => s.isGlued),
    falling: scraps.filter(s => !s.isGlued),
  };
}
