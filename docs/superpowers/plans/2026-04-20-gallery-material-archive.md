# Gallery — Material Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gallery archive for raw materials, entered via a tin box pinned to the drawer; the gallery reveals below the drawer, supports drag-between-zones reclassification, and supports tear-editing a material in place.

**Architecture:** Raw materials gain a `status: 'drawer' | 'gallery'` field. A single `rawMaterials` array is filtered by status for each zone. A `TinBox` entry point lives in a fixed corner of the existing drawer; tapping it sets `galleryOpen: true` in `App`, which triggers a coordinated slide-up animation of the desk + drawer and reveals a new `Gallery` panel at the bottom. Cross-zone drag changes status via a single reducer. Tapping a gallery material opens the existing `CuttingRoom`; output polygons are rasterized against the source image into new gallery materials.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Motion (Framer Motion), vitest. Canvas 2D for rasterizing polygon masks.

**Scope clarification:** v1 ships with **tear-only** gallery edits (reusing `CuttingRoom`). Cut-in-gallery (via `ScissorsCutView`) is out of scope for this plan and should be added as a separate plan once v1 ships.

---

## File Structure

### New files

- `src/utils/drawerScatter.ts` — pure helpers for scattering materials; accepts blocked rects so pinned props (the tin) never get covered.
- `src/utils/drawerScatter.test.ts` — unit tests for the scatter utility.
- `src/utils/materialStatus.ts` — pure helpers for partitioning materials by status and reclassifying.
- `src/utils/materialStatus.test.ts` — unit tests for status helpers.
- `src/utils/rasterizePolygon.ts` — utility that clips a source image to a polygon and returns a data URL.
- `src/components/TinBox.tsx` — the tin-box entry point with lid-open animation.
- `src/components/Gallery.tsx` — the gallery zone revealed below the drawer.
- `src/components/GalleryMaterialCard.tsx` — scatter-positioned draggable material card used inside `Gallery`; near-duplicate of the drawer's `MaterialCard` but wired to gallery-specific drop logic. Kept separate to avoid coupling the drawer card to gallery concerns.

### Modified files

- `src/types.ts` — add `RawMaterialStatus` and `status` field on `RawMaterial`.
- `src/components/MaterialDrawer.tsx` — use `drawerScatter` utility; host `TinBox`; pass tin rect as a blocked rect; extend drop logic to forward cross-zone drops to a new `onReclassify` callback.
- `src/App.tsx` — seed samples with `status: 'drawer'`; new materials from capture/upload default to `status: 'gallery'`; add `galleryOpen` state and opening/closing animation; render `Gallery` when open; wire `handleReclassify` and `handleEditGalleryMaterial`.

### Unchanged

- `src/components/CuttingRoom.tsx` — consumed as-is for gallery edits.
- `src/components/ScissorsCutView.tsx`, `src/components/TearCutView.tsx` — unchanged (they operate on placed scraps).
- `src/components/Scrapbook.tsx` and page logic — unchanged.

---

## Task 1: Add `status` field to `RawMaterial`

**Files:**
- Modify: `src/types.ts:6-9`
- Modify: `src/App.tsx:32-42` (seed materials)
- Modify: `src/App.tsx:92-100` (`handleCapture`)
- Modify: `src/App.tsx:102-121` (`handleFileUpload` path → goes via `handleCapture`)
- Modify: `src/App.tsx:224-231` (`handleReturnScrap`)
- Modify: `src/App.tsx:326-340` (`handleScissorCut`)
- Modify: `src/App.tsx:393-410` (`handleFallComplete`)

- [ ] **Step 1: Add status type and field to `RawMaterial`**

In `src/types.ts`, replace lines 6–9:

```ts
export type RawMaterialStatus = 'drawer' | 'gallery';

export interface RawMaterial {
  id: string;
  image: string;
  status: RawMaterialStatus;
}
```

- [ ] **Step 2: Run typecheck to surface all broken call sites**

Run: `npm run lint`
Expected: TypeScript errors at every `RawMaterial` creation site (seed list, `handleCapture`, `handleReturnScrap`, `handleScissorCut`, `handleFallComplete`). Confirm the errors match the list in the Files section above; any unexpected site means a creation path was missed.

- [ ] **Step 3: Seed samples default to `drawer`**

In `src/App.tsx`, update the initial `rawMaterials` state (around line 32):

```tsx
const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([
  { id: 'sample-1', image: '/Japan scraps/web/scrap_01.webp', status: 'drawer' },
  { id: 'sample-2', image: '/Japan scraps/web/scrap_02.webp', status: 'drawer' },
  { id: 'sample-3', image: '/Japan scraps/web/scrap_03.webp', status: 'drawer' },
  { id: 'sample-4', image: '/Japan scraps/web/scrap_04.webp', status: 'drawer' },
  { id: 'sample-5', image: '/Japan scraps/web/scrap_05.webp', status: 'drawer' },
  { id: 'sample-6', image: '/Japan scraps/web/scrap_06.webp', status: 'drawer' },
  { id: 'sample-7', image: '/Japan scraps/web/scrap_07.webp', status: 'drawer' },
  { id: 'sample-8', image: '/Japan scraps/web/scrap_08.webp', status: 'drawer' },
  { id: 'sample-9', image: '/Japan scraps/web/scrap_09.webp', status: 'drawer' },
]);
```

- [ ] **Step 4: Capture/upload default to `gallery`**

In `src/App.tsx`, replace the body of `handleCapture`:

```tsx
const handleCapture = (image: string) => {
  const newMaterial: RawMaterial = {
    id: Math.random().toString(36).substr(2, 9),
    image,
    status: 'gallery',
  };
  setRawMaterials(prev => [newMaterial, ...prev]);
  setSelectedScrapId(null);
  setView('drawer');
};
```

Note: `handleFileUpload` already calls `handleCapture`, so no change needed there.

- [ ] **Step 5: Return/fall paths default to `drawer`**

In `handleReturnScrap`, replace the `setRawMaterials` call:

```tsx
setRawMaterials(prev => [
  { id: Math.random().toString(36).substr(2, 9), image: scrap.image, status: 'drawer' },
  ...prev,
]);
```

In `handleScissorCut`, replace the `setRawMaterials` call:

```tsx
setRawMaterials(prev => [
  { id: Math.random().toString(36).substr(2, 9), image: outsideImage, status: 'drawer' },
  ...prev,
]);
```

In `handleFallComplete`, replace the `setRawMaterials` call:

```tsx
setRawMaterials(prev => [
  ...fallen.map(s => ({ id: Math.random().toString(36).substr(2, 9), image: s.image, status: 'drawer' as const })),
  ...prev,
]);
```

- [ ] **Step 6: Verify typecheck and app load**

Run: `npm run lint`
Expected: no errors.

Run: `npm run dev` and open the app. Verify the nine seed samples still appear in the bottom drawer as before.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "feat(gallery): add status field to RawMaterial and wire default statuses"
```

---

## Task 2: Extract scatter logic into a reusable utility with blocked-rect support

**Files:**
- Create: `src/utils/drawerScatter.ts`
- Create: `src/utils/drawerScatter.test.ts`
- Modify: `src/components/MaterialDrawer.tsx:7-57` (remove inline helpers; import from utility)

- [ ] **Step 1: Write failing tests for the scatter utility**

Create `src/utils/drawerScatter.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/drawerScatter.test.ts`
Expected: FAIL with "Cannot find module './drawerScatter'".

- [ ] **Step 3: Implement the utility**

Create `src/utils/drawerScatter.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/drawerScatter.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Update `MaterialDrawer.tsx` to use the utility**

In `src/components/MaterialDrawer.tsx`:

1. Remove lines 7–57 (the inline `DrawerPosition`, `CARD_W`, `CARD_H`, `BOUNDARY_MARGIN`, `clampPosition`, `makeScatterPosition`).

2. Add import at the top:

```ts
import { DrawerPosition, clampPosition, makeScatterPosition, CARD_W, CARD_H } from '../utils/drawerScatter';
```

3. The existing calls to `makeScatterPosition(index, w, h, z, existing)` and `clampPosition(x, y, w, h)` now pass an empty blocked list by default (signatures are backward-compatible since `blocked` defaults to `[]`). No call-site change required yet.

- [ ] **Step 6: Verify nothing regressed**

Run: `npm run lint`
Expected: no errors.

Run: `npm run dev`. Open the app; open the drawer; verify scraps scatter as before with no visible change.

- [ ] **Step 7: Commit**

```bash
git add src/utils/drawerScatter.ts src/utils/drawerScatter.test.ts src/components/MaterialDrawer.tsx
git commit -m "refactor(drawer): extract scatter helpers into drawerScatter utility with blocked-rect support"
```

---

## Task 3: Build the `TinBox` component

**Files:**
- Create: `src/components/TinBox.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/TinBox.tsx`:

```tsx
import React from 'react';
import { motion } from 'motion/react';

export const TIN_W = 88;
export const TIN_H = 72;

interface TinBoxProps {
  isOpen: boolean;
  onOpen: () => void;
}

export const TinBox: React.FC<TinBoxProps> = ({ isOpen, onOpen }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isOpen) onOpen();
      }}
      aria-label="Open gallery"
      className="absolute"
      style={{
        width: TIN_W,
        height: TIN_H,
        top: 12,
        right: 12,
        zIndex: 50,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: isOpen ? 'default' : 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {/* Tin body */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-[6px]"
        style={{
          height: TIN_H * 0.78,
          background:
            'linear-gradient(180deg, #c9c9cc 0%, #8c8c92 40%, #60606a 100%)',
          boxShadow:
            '0 6px 10px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.3)',
          border: '1px solid rgba(20,20,25,0.6)',
        }}
      >
        {/* Printed label */}
        <div
          className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center text-[8px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: 'rgba(30,25,20,0.75)' }}
        >
          Photos
        </div>
      </div>

      {/* Tin lid */}
      <motion.div
        className="absolute left-0 right-0 rounded-[6px]"
        style={{
          top: 0,
          height: TIN_H * 0.3,
          background:
            'linear-gradient(180deg, #dcdce0 0%, #a8a8ae 70%, #7a7a82 100%)',
          boxShadow:
            '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
          border: '1px solid rgba(20,20,25,0.55)',
          transformOrigin: '50% 100%',
        }}
        animate={isOpen ? { rotateX: -105, y: -4 } : { rotateX: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      />
    </button>
  );
};
```

- [ ] **Step 2: Verify the component compiles**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TinBox.tsx
git commit -m "feat(gallery): add TinBox entry-point component with lid-open animation"
```

---

## Task 4: Host `TinBox` in `MaterialDrawer` and exclude its footprint from scatter

**Files:**
- Modify: `src/components/MaterialDrawer.tsx` (props + render + scatter blocked-rect)

- [ ] **Step 1: Extend `MaterialDrawerProps`**

In `src/components/MaterialDrawer.tsx`, update the interface (around line 239):

```ts
interface MaterialDrawerProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onDragMaterial: (material: RawMaterial, info: PanInfo) => void;
  onCardDragging?: (dragging: boolean) => void;
  galleryOpen: boolean;
  onOpenGallery: () => void;
}
```

Destructure `galleryOpen` and `onOpenGallery` in the component signature.

- [ ] **Step 2: Compute the tin's blocked rect**

At the top of the `MaterialDrawer` body (after the existing refs), add:

```tsx
import { TinBox, TIN_W, TIN_H } from './TinBox';

// ...

const TIN_BLOCKED_RECT = React.useMemo(() => {
  // Must match the TinBox positioning (top: 12, right: 12)
  const containerW = containerRef.current?.offsetWidth ?? 320;
  return {
    x: containerW - TIN_W - 12,
    y: 12,
    width: TIN_W,
    height: TIN_H,
  };
}, [containerRef.current?.offsetWidth]);
```

Because `useMemo` cannot depend on a ref's current width reliably, fall back to re-computing inside the scatter effect instead. Replace the `useEffect` at lines 274–298 with:

```tsx
React.useEffect(() => {
  setPositionsMap(prev => {
    const containerW = containerRef.current?.offsetWidth ?? 320;
    const containerH = containerRef.current?.offsetHeight ?? 80;
    const blocked = [{
      x: containerW - TIN_W - 12,
      y: 12,
      width: TIN_W,
      height: TIN_H,
    }];
    const maxZ = Object.values(prev).reduce((acc, p) => Math.max(acc, p.zIndex), 0);
    const next = { ...prev };
    let added = 0;
    materials.forEach((m) => {
      if (!next[m.id]) {
        next[m.id] = makeScatterPosition(
          Object.keys(next).length + added,
          containerW,
          containerH,
          maxZ + 1,
          Object.values(next),
          blocked,
        );
        added++;
      }
    });
    const ids = new Set(materials.map(m => m.id));
    Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
    return next;
  });
}, [materials]);
```

- [ ] **Step 3: Pass blocked rect to `clampPosition` in `onRearrange`**

Replace the body of `onRearrange` (around lines 300–311):

```tsx
const onRearrange = React.useCallback((material: RawMaterial, newX: number, newY: number) => {
  setPositionsMap(prev => {
    const maxZ = Object.values(prev).reduce((m, p) => Math.max(m, p.zIndex), 0);
    const containerW = containerRef.current?.offsetWidth ?? 320;
    const containerH = containerRef.current?.offsetHeight ?? 80;
    const blocked = [{
      x: containerW - TIN_W - 12,
      y: 12,
      width: TIN_W,
      height: TIN_H,
    }];
    const { x, y } = clampPosition(newX, newY, containerW, containerH, blocked);
    return {
      ...prev,
      [material.id]: { ...prev[material.id], x, y, zIndex: maxZ + 1 },
    };
  });
}, []);
```

- [ ] **Step 4: Render `TinBox` in the drawer interior**

Inside the `containerRef` div in the return (around line 357, the one with `className="flex-1 relative ..."`), after the materials render, add:

```tsx
<TinBox isOpen={galleryOpen} onOpen={onOpenGallery} />
```

- [ ] **Step 5: Pass new props from `App.tsx` (temporary stub)**

In `src/App.tsx`, add temporary state so the drawer compiles:

```tsx
const [galleryOpen, setGalleryOpen] = useState(false);
```

Pass to `MaterialDrawer`:

```tsx
<MaterialDrawer
  // ...existing props...
  galleryOpen={galleryOpen}
  onOpenGallery={() => setGalleryOpen(true)}
/>
```

- [ ] **Step 6: Verify nothing regressed**

Run: `npm run lint`
Expected: no errors.

Run: `npm run dev`. Open the drawer; verify:
- The tin is visible in the top-right corner.
- Scraps never overlap the tin (even after many scraps are seeded).
- Tapping the tin animates the lid open (lid flips backward). Nothing else happens yet — that's expected.
- Close and reopen the drawer; verify scraps still scatter cleanly and do not overlap the tin.

- [ ] **Step 7: Commit**

```bash
git add src/components/MaterialDrawer.tsx src/components/TinBox.tsx src/App.tsx
git commit -m "feat(drawer): host TinBox in drawer and exclude its footprint from scatter"
```

---

## Task 5: Build `materialStatus` utility (partition + reclassify)

**Files:**
- Create: `src/utils/materialStatus.ts`
- Create: `src/utils/materialStatus.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/materialStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/materialStatus.test.ts`
Expected: FAIL with "Cannot find module './materialStatus'".

- [ ] **Step 3: Implement the utility**

Create `src/utils/materialStatus.ts`:

```ts
import type { RawMaterial, RawMaterialStatus } from '../types';

export function partitionByStatus(
  materials: RawMaterial[],
): { drawer: RawMaterial[]; gallery: RawMaterial[] } {
  return {
    drawer: materials.filter(m => m.status === 'drawer'),
    gallery: materials.filter(m => m.status === 'gallery'),
  };
}

export function reclassify(
  materials: RawMaterial[],
  id: string,
  status: RawMaterialStatus,
): RawMaterial[] {
  return materials.map(m => (m.id === id ? { ...m, status } : m));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/materialStatus.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/materialStatus.ts src/utils/materialStatus.test.ts
git commit -m "feat(gallery): add materialStatus partition/reclassify utility"
```

---

## Task 6: Build the `GalleryMaterialCard` and `Gallery` components

**Files:**
- Create: `src/components/GalleryMaterialCard.tsx`
- Create: `src/components/Gallery.tsx`

- [ ] **Step 1: Implement `GalleryMaterialCard`**

Create `src/components/GalleryMaterialCard.tsx`:

```tsx
import React from 'react';
import { RawMaterial } from '../types';
import { motion, useMotionValue, useSpring } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { playSound } from '../services/soundService';
import { DrawerPosition, CARD_W, CARD_H } from '../utils/drawerScatter';

interface GalleryMaterialCardProps {
  material: RawMaterial;
  position: DrawerPosition;
  containerRef: React.RefObject<HTMLDivElement>;
  onTap: (m: RawMaterial) => void;
  onDragEnd: (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

export const GalleryMaterialCard = React.memo(({
  material, position, containerRef, onTap, onDragEnd, onDragStateChange,
}: GalleryMaterialCardProps) => {
  const scaleValue = useMotionValue(1);
  const springScale = useSpring(scaleValue, { stiffness: 350, damping: 12 });
  const rotValue = useMotionValue(position.rotation);
  const springRot = useSpring(rotValue, { stiffness: 280, damping: 18 });

  const [isDragging, setIsDragging] = React.useState(false);
  const cardRectRef = React.useRef<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={cardRef}
      drag
      dragSnapToOrigin
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={() => {
        cardRectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
        setIsDragging(true);
        onDragStateChange?.(true);
        scaleValue.set(1.04);
        playSound('paperRustle');
        navigator.vibrate?.(10);
      }}
      onDrag={(_, info) => {
        const targetRot = Math.max(-15, Math.min(15, position.rotation + info.velocity.x * -0.02));
        rotValue.set(targetRot);
      }}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        onDragStateChange?.(false);
        scaleValue.set(1);
        rotValue.set(position.rotation);
        navigator.vibrate?.(30);
        onDragEnd(material, info, cardRectRef.current);
        cardRectRef.current = null;
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTap(material);
      }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: CARD_W,
        height: CARD_H,
        scale: springScale,
        rotate: springRot,
        zIndex: isDragging ? 9999 : position.zIndex,
        touchAction: 'none',
        boxShadow: isDragging
          ? '0 24px 40px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.4)'
          : undefined,
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <img
        src={material.image}
        className="w-full h-full object-cover pointer-events-none rounded-[2px]"
        alt="Gallery material"
      />
    </motion.div>
  );
});
```

- [ ] **Step 2: Implement `Gallery`**

Create `src/components/Gallery.tsx`:

```tsx
import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';
import {
  DrawerPosition,
  clampPosition,
  makeScatterPosition,
} from '../utils/drawerScatter';
import { GalleryMaterialCard } from './GalleryMaterialCard';

interface GalleryProps {
  materials: RawMaterial[];
  isOpen: boolean;
  onClose: () => void;
  onTapMaterial: (m: RawMaterial) => void;
  onDragEnd: (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => void;
  onContainerRectChange?: (rect: DOMRect | null) => void;
  onCardDragging?: (dragging: boolean) => void;
}

export const Gallery: React.FC<GalleryProps> = ({
  materials,
  isOpen,
  onClose,
  onTapMaterial,
  onDragEnd,
  onContainerRectChange,
  onCardDragging,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [positionsMap, setPositionsMap] = React.useState<Record<string, DrawerPosition>>({});

  // Seed positions for newly-added materials; drop positions for removed ones.
  React.useEffect(() => {
    setPositionsMap(prev => {
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 120;
      const maxZ = Object.values(prev).reduce((acc, p) => Math.max(acc, p.zIndex), 0);
      const next = { ...prev };
      let added = 0;
      materials.forEach((m) => {
        if (!next[m.id]) {
          next[m.id] = makeScatterPosition(
            Object.keys(next).length + added,
            containerW,
            containerH,
            maxZ + 1,
            Object.values(next),
          );
          added++;
        }
      });
      const ids = new Set(materials.map(m => m.id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [materials]);

  // Publish container rect to parent for cross-zone drop detection.
  React.useEffect(() => {
    if (!onContainerRectChange) return;
    const rect = containerRef.current?.getBoundingClientRect() ?? null;
    onContainerRectChange(rect);
    if (!isOpen) return;
    const id = window.setInterval(() => {
      onContainerRectChange(containerRef.current?.getBoundingClientRect() ?? null);
    }, 500);
    return () => window.clearInterval(id);
  }, [isOpen, onContainerRectChange]);

  const handleRearrange = React.useCallback((m: RawMaterial, newX: number, newY: number) => {
    setPositionsMap(prev => {
      const maxZ = Object.values(prev).reduce((z, p) => Math.max(z, p.zIndex), 0);
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 120;
      const { x, y } = clampPosition(newX, newY, containerW, containerH);
      return {
        ...prev,
        [m.id]: { ...prev[m.id], x, y, zIndex: maxZ + 1 },
      };
    });
  }, []);

  const handleCardDragEnd = React.useCallback(
    (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => {
      const container = containerRef.current?.getBoundingClientRect();
      if (container && cardRect) {
        const centerX = cardRect.left + info.offset.x + cardRect.width / 2;
        const centerY = cardRect.top + info.offset.y + cardRect.height / 2;
        const inside =
          centerX > container.left && centerX < container.right &&
          centerY > container.top && centerY < container.bottom;
        if (inside) {
          handleRearrange(m, cardRect.left + info.offset.x - container.left,
            cardRect.top + info.offset.y - container.top);
          return;
        }
      }
      onDragEnd(m, info, cardRect);
    },
    [onDragEnd, handleRearrange],
  );

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{
        height: '30vh',
        backgroundImage: 'url(/Drawer.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        touchAction: 'none',
      }}
      initial={{ y: '100%' }}
      animate={{ y: isOpen ? '0%' : '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className="flex items-center justify-between px-4 h-10 shrink-0">
        <span
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: 'rgba(232,213,184,0.6)', fontWeight: 600 }}
        >
          Gallery
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="flex items-center gap-1 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(232,213,184,0.12)',
            color: 'rgba(232,213,184,0.85)',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          <X size={14} />
          Close
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative bg-[#1e1008]/70 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]"
      >
        {materials.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-white/20 font-serif italic text-sm tracking-wide">
              Gallery is empty
            </span>
            <span className="text-white/10 text-[10px] uppercase tracking-[0.2em]">
              new photos land here by default
            </span>
          </div>
        ) : (
          materials.map((m) => {
            const pos = positionsMap[m.id];
            if (!pos) return null;
            return (
              <GalleryMaterialCard
                key={m.id}
                material={m}
                position={pos}
                containerRef={containerRef}
                onTap={onTapMaterial}
                onDragEnd={handleCardDragEnd}
                onDragStateChange={onCardDragging}
              />
            );
          })
        )}
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 3: Verify compile**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Gallery.tsx src/components/GalleryMaterialCard.tsx
git commit -m "feat(gallery): add Gallery and GalleryMaterialCard components"
```

---

## Task 7: Wire gallery open/close into `App` with the slide-up animation

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Derive drawer/gallery materials via partition**

At the top of the `App` function (after `rawMaterials` state), add:

```tsx
import { partitionByStatus, reclassify } from './utils/materialStatus';

// inside App:
const { drawer: drawerMaterials, gallery: galleryMaterials } = React.useMemo(
  () => partitionByStatus(rawMaterials),
  [rawMaterials],
);
```

Update the `MaterialDrawer` props to pass `drawerMaterials` instead of `rawMaterials`:

```tsx
<MaterialDrawer
  materials={drawerMaterials}
  // ...
/>
```

- [ ] **Step 2: Wrap desk + drawer in a motion group for the slide-up**

In `src/App.tsx`, find the outermost flex container (around line 419):

```tsx
<div className="relative w-full h-screen overflow-hidden select-none flex flex-col bg-[#0f0805]">
```

Wrap the desk area (the `<div className="relative w-full h-[80vh] ...">` block) and the drawer `<motion.div>` together inside a new `motion.div` that translates upward when `galleryOpen`:

```tsx
<motion.div
  className="flex flex-col w-full"
  animate={{ y: galleryOpen ? '-30vh' : 0 }}
  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
>
  {/* existing desk area 80vh block */}
  {/* existing drawer motion.div 20vh block */}
</motion.div>
```

Verify the existing `desk-edge` div stays inside the group (otherwise the lip detaches during the slide).

- [ ] **Step 3: Render `Gallery` below everything**

Still inside the outer `div`, after the wrapper group you just added, render:

```tsx
<Gallery
  materials={galleryMaterials}
  isOpen={galleryOpen}
  onClose={() => setGalleryOpen(false)}
  onTapMaterial={noop}            // wired in Task 9
  onDragEnd={() => {}}             // wired in Task 8
/>
```

Add the import:

```tsx
import { Gallery } from './components/Gallery';
```

- [ ] **Step 4: Gate scrapbook interactions during animation**

Wrap the `Scrapbook` render (`<Scrapbook ... />`) with `pointer-events` disabled while `galleryOpen`:

```tsx
<div style={{ pointerEvents: galleryOpen ? 'none' : 'auto' }}>
  <Scrapbook
    page={currentPage}
    // ...existing props
  />
</div>
```

- [ ] **Step 5: Verify the open/close animation**

Run: `npm run dev`. Open the bottom drawer, tap the tin:
- The tin lid flips open.
- The desk + drawer slide up together by ~30vh.
- A wood-textured gallery panel rises from the bottom.
- The gallery shows the empty-state message (no gallery materials yet).
- Tap the "Close" button: the gallery slides back down and the desk/drawer return to their original positions. The tin lid closes.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(gallery): open/close gallery with coordinated desk+drawer slide animation"
```

---

## Task 8: Cross-zone drag reclassification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MaterialDrawer.tsx` (extend drop logic)

- [ ] **Step 1: Add `handleReclassify` in `App`**

In `src/App.tsx`:

```tsx
const handleReclassify = React.useCallback((id: string, status: 'drawer' | 'gallery') => {
  setRawMaterials(prev => reclassify(prev, id, status));
}, []);
```

Add a ref to store the gallery container rect (published by `Gallery` via `onContainerRectChange`):

```tsx
const galleryRectRef = React.useRef<DOMRect | null>(null);
```

Pass it down:

```tsx
<Gallery
  // ...
  onContainerRectChange={(rect) => { galleryRectRef.current = rect; }}
  onDragEnd={(m, info, cardRect) => {
    // Dragged up out of gallery → did it land in the drawer?
    const drawerEl = drawerAreaRef.current;
    if (drawerEl && cardRect) {
      const dr = drawerEl.getBoundingClientRect();
      const cx = cardRect.left + info.offset.x + cardRect.width / 2;
      const cy = cardRect.top + info.offset.y + cardRect.height / 2;
      if (cx > dr.left && cx < dr.right && cy > dr.top && cy < dr.bottom) {
        handleReclassify(m.id, 'drawer');
      }
    }
  }}
/>
```

- [ ] **Step 2: Extend the drawer's drop logic**

In `src/components/MaterialDrawer.tsx`, extend `MaterialDrawerProps`:

```ts
interface MaterialDrawerProps {
  // ...existing...
  onReclassifyToGallery: (id: string) => void;
  galleryRectRef: React.RefObject<DOMRect | null>;
}
```

In the `MaterialCard`'s `onDragEnd` (inside `MaterialDrawer.tsx`), replace the drop precedence:

Find the current logic that decides between scrapbook drop and rearrange:

```tsx
if (drawerEl && rect && rect.width > 0) {
  const db = drawerEl.getBoundingClientRect();
  const dropCenterX = rect.left + info.offset.x + rect.width / 2;
  const dropCenterY = rect.top + info.offset.y + rect.height / 2;
  const insideDrawer =
    dropCenterX > db.left && dropCenterX < db.right &&
    dropCenterY > db.top && dropCenterY < db.bottom;
  if (insideDrawer) {
    onRearrange(material, rect.left + info.offset.x - db.left, rect.top + info.offset.y - db.top);
    return;
  }
}
onDragMaterial(material, info);
```

Replace with precedence: scrapbook → gallery → self → spring back. But `onDragMaterial` already handles the scrapbook rect via `App.handleDragMaterial`, so we only need to interpose a gallery check *before* calling `onDragMaterial`:

```tsx
if (drawerEl && rect && rect.width > 0) {
  const db = drawerEl.getBoundingClientRect();
  const dropCenterX = rect.left + info.offset.x + rect.width / 2;
  const dropCenterY = rect.top + info.offset.y + rect.height / 2;
  const insideDrawer =
    dropCenterX > db.left && dropCenterX < db.right &&
    dropCenterY > db.top && dropCenterY < db.bottom;
  if (insideDrawer) {
    onRearrange(material, rect.left + info.offset.x - db.left, rect.top + info.offset.y - db.top);
    return;
  }
  const galleryRect = galleryRectRef.current;
  if (galleryRect) {
    const inGallery =
      dropCenterX > galleryRect.left && dropCenterX < galleryRect.right &&
      dropCenterY > galleryRect.top && dropCenterY < galleryRect.bottom;
    if (inGallery) {
      onReclassifyToGallery(material.id);
      return;
    }
  }
}
onDragMaterial(material, info);
```

This requires threading `onReclassifyToGallery` and `galleryRectRef` into `MaterialCard`. Add them to `MaterialCardProps` and pass them when rendering each card.

- [ ] **Step 3: Pass props from `App` to `MaterialDrawer`**

In `App.tsx`:

```tsx
<MaterialDrawer
  // ...
  onReclassifyToGallery={(id) => handleReclassify(id, 'gallery')}
  galleryRectRef={galleryRectRef}
/>
```

- [ ] **Step 4: Manually verify cross-zone drag**

Run: `npm run dev`.

1. With drawer open and gallery closed: drag a drawer material upward into the scrapbook — it should place as a scrap (unchanged behavior).
2. Tap the tin to open gallery.
3. Drag a drawer material downward into the gallery zone → on release the material disappears from the drawer and appears in the gallery.
4. Drag that gallery material upward into the drawer zone → it returns to the drawer.
5. Drag a gallery material, release outside both zones → it springs back to origin.
6. Capture a photo from the camera → verify it appears in the gallery (not the drawer).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/MaterialDrawer.tsx
git commit -m "feat(gallery): cross-zone drag reclassifies materials between drawer and gallery"
```

---

## Task 9: Rasterize polygons and wire tap-to-tear in gallery

**Files:**
- Create: `src/utils/rasterizePolygon.ts`
- Create: `src/utils/rasterizePolygon.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a failing test for `rasterizePolygon`**

Create `src/utils/rasterizePolygon.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/rasterizePolygon.test.ts`
Expected: FAIL with "Cannot find module './rasterizePolygon'".

- [ ] **Step 3: Implement `rasterizePolygon`**

Create `src/utils/rasterizePolygon.ts`:

```ts
import type { Point } from '../types';

/**
 * Clips `sourceImage` to `polygon` (coordinates expressed in the canvas-space
 * used by CuttingRoom: the polygon is sized to `canvasW x canvasH`, and the
 * image fills that canvas with `object-fit: contain` centering). Returns a
 * PNG data URL cropped to the polygon's bounding box.
 */
export async function rasterizePolygon(
  sourceImage: string,
  polygon: Point[],
  canvasW: number,
  canvasH: number,
): Promise<string> {
  if (polygon.length < 3) throw new Error('Polygon must have at least 3 points');

  const img = await loadImage(sourceImage);

  // Compute bbox in canvas-space
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.max(0, Math.min(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxX = Math.min(canvasW, Math.max(...xs));
  const maxY = Math.min(canvasH, Math.max(...ys));
  const outW = Math.max(1, Math.round(maxX - minX));
  const outH = Math.max(1, Math.round(maxY - minY));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, outW, outH);

  // Build the clip path in output-local coordinates
  ctx.save();
  ctx.beginPath();
  polygon.forEach((p, i) => {
    const lx = p.x - minX;
    const ly = p.y - minY;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  });
  ctx.closePath();
  ctx.clip();

  // Mirror CuttingRoom's object-fit: contain draw
  const imgScale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  const imgX = (canvasW - img.naturalWidth * imgScale) / 2 - minX;
  const imgY = (canvasH - img.naturalHeight * imgScale) / 2 - minY;
  ctx.drawImage(
    img,
    imgX,
    imgY,
    img.naturalWidth * imgScale,
    img.naturalHeight * imgScale,
  );
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/rasterizePolygon.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Wire tap-to-tear in `App`**

In `src/App.tsx`, add state:

```tsx
const [editingGalleryMaterial, setEditingGalleryMaterial] = useState<RawMaterial | null>(null);
```

Pass `onTapMaterial` to `Gallery`:

```tsx
<Gallery
  materials={galleryMaterials}
  isOpen={galleryOpen}
  onClose={() => setGalleryOpen(false)}
  onTapMaterial={(m) => setEditingGalleryMaterial(m)}
  // ...other props unchanged
/>
```

Add a new handler and the editor modal. Place the modal inside the `AnimatePresence` block, alongside `view === 'cutting'`:

```tsx
const handleGalleryCut = async (
  points: Point[],
  _isTorn: boolean | undefined,
  secondPoints?: Point[],
) => {
  if (!editingGalleryMaterial) return;
  // CuttingRoom produces polygons whose extreme x/y equal the cutting-room
  // canvas width/height by construction (corners pinned to 0/cw and 0/ch).
  // Derive the canvas dimensions from the polygon bounds so the rasterizer
  // reproduces the same object-fit: contain draw.
  const allPoints = secondPoints ? [...points, ...secondPoints] : points;
  const canvasW = Math.max(...allPoints.map(p => p.x));
  const canvasH = Math.max(...allPoints.map(p => p.y));
  try {
    const firstUrl = await rasterizePolygon(
      editingGalleryMaterial.image, points, canvasW, canvasH,
    );
    const leftovers: RawMaterial[] = [];
    if (secondPoints) {
      const secondUrl = await rasterizePolygon(
        editingGalleryMaterial.image, secondPoints, canvasW, canvasH,
      );
      leftovers.push({
        id: Math.random().toString(36).substr(2, 9),
        image: secondUrl,
        status: 'gallery',
      });
    }
    setRawMaterials(prev => {
      const replaced = prev.map(m =>
        m.id === editingGalleryMaterial.id ? { ...m, image: firstUrl } : m,
      );
      return [...leftovers, ...replaced];
    });
  } finally {
    setEditingGalleryMaterial(null);
  }
};
```

Inside the `AnimatePresence`:

```tsx
{editingGalleryMaterial && (
  <motion.div
    key="gallery-edit"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="fixed inset-0 z-[60]"
  >
    <CuttingRoom
      image={editingGalleryMaterial.image}
      onCut={handleGalleryCut}
      onCancel={() => setEditingGalleryMaterial(null)}
    />
  </motion.div>
)}
```

Add the import:

```tsx
import { rasterizePolygon } from './utils/rasterizePolygon';
```

Note: the editor uses `z-[60]` so it sits above the gallery (`z-20`) and the existing modals (`z-50`). The gallery stays open behind it and is shown again on close.

- [ ] **Step 6: Manually verify tear-to-edit**

Run: `npm run dev`.

1. Capture a photo (or upload) → material appears in the gallery.
2. Open the gallery; tap the new material → `CuttingRoom` opens with that image.
3. Swipe across to tear; confirm "KEEP BOTH".
4. Verify: the edited material replaces the original in the gallery; a second (leftover) material appears as a new gallery entry; the editor closes back to the gallery view (gallery is still open).
5. Tap the `X` / cancel in the editor → returns to gallery unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/utils/rasterizePolygon.ts src/utils/rasterizePolygon.test.ts src/App.tsx
git commit -m "feat(gallery): tap-to-tear gallery materials with polygon rasterization"
```

---

## Task 10: Edge-case hardening + final verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MaterialDrawer.tsx` (page-turn-guard on tin tap)

- [ ] **Step 1: Prevent opening the gallery during page-turn animations**

In `src/App.tsx`, change the `onOpenGallery` prop:

```tsx
<MaterialDrawer
  // ...
  onOpenGallery={() => {
    if (fallingOff) return;
    setGalleryOpen(true);
  }}
/>
```

- [ ] **Step 2: Disable tin tap while gallery is already open**

`TinBox` already guards `if (!isOpen) onOpen()`, so no change needed. Verify by re-reading `src/components/TinBox.tsx:14-18`.

- [ ] **Step 3: Run the full test suite and lint**

```bash
npm run lint
npm run test
```

Expected: both pass with no errors and no failing tests.

- [ ] **Step 4: Run through the full manual test plan**

Run: `npm run dev`. Walk through every scenario in the spec's "Testing Plan":

- [ ] Capture a photo → lands in gallery, not drawer.
- [ ] Upload a file → lands in gallery.
- [ ] Open gallery → drag a gallery material up into the drawer → drawer gains it, gallery loses it, status persists across drawer open/close.
- [ ] Drag a drawer material down into the gallery → reverse works.
- [ ] Tap a gallery material → tear editor opens → confirm tear → edited material replaces the original, leftover appears as a new gallery entry, editor returns to the gallery view.
- [ ] Close gallery → desk/drawer return to original positions, tin lid closes.
- [ ] Seed samples: on fresh app load, the nine samples still appear in the drawer.
- [ ] Peel a glued scrap → returns to drawer (unchanged).
- [ ] Page-turn with loose scraps → fallen scraps return to drawer (unchanged).
- [ ] With drawer full of scraps: scatter + rearrange never drops a scrap on the tin.
- [ ] Attempt to tap the tin mid-page-turn → no-op; gallery only opens after the page-turn animation completes.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "chore(gallery): guard gallery open during page-turn animations"
```

---

## Out of Scope

These are explicitly not part of this plan and should be planned separately when/if needed:

- **Cut-in-gallery:** requires either a combined cut+tear editor or a tool picker overlay. The v1 gallery edit is tear-only via the existing `CuttingRoom`. Adding cut via `ScissorsCutView` (which already emits raster images, so it would not need the rasterizer) is a follow-up.
- **Persistence of material status across reloads:** the app currently does not persist `rawMaterials` — a separate concern.
- **Deleting materials from the gallery.**
- **Bulk operations** (select-all, multi-drag) in either zone.
- **Search / tags / any organization beyond the two-zone split.**
