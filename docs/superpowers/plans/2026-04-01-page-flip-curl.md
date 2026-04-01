# Cylindrical Page Curl (react-pageflip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS rotateY rigid-board flip in `PageFlipContainer` with a true cylindrical paper curl using `react-pageflip`, with synthetic event delegation from edge zones to avoid Konva pointer-event conflicts.

**Architecture:** Edge-zone overlays (30px, z-index 6) capture all flip gestures and forward synthetic mouse/touch events to a react-pageflip container (z-index 5, pointer-events: none). Konva stages are snapshotted to PNG in the background via debounced effects; on gesture start the pre-cached PNGs are fed to react-pageflip instantly. StPageFlip renders the cylindrical curl with its own shadow; the adjacent page is shown as a static PNG at z-index 4, underneath the curl.

**Tech Stack:** React 19, TypeScript, react-pageflip v2.0.3 (wraps StPageFlip), react-konva / Konva, Vitest

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `react-pageflip` dependency |
| `src/types/react-pageflip.d.ts` | Create — TypeScript module declaration (no official types) |
| `src/components/Scrapbook.tsx` | Minimal: add `React.forwardRef` to expose `Konva.Stage` ref |
| `src/utils/flipDelegation.ts` | Create — `buildFlipEvent` / `extractPointerCoords` utilities |
| `src/utils/flipDelegation.test.ts` | Create — unit tests for `buildFlipEvent` |
| `src/components/PageFlipContainer.tsx` | Full rewrite |

---

### Task 1: Install react-pageflip and add TypeScript declaration

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/types/react-pageflip.d.ts`

- [ ] **Step 1: Install the package**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npm install react-pageflip
```

Expected: ends with `added 1 package` (or similar), no errors.

- [ ] **Step 2: Create the TypeScript declaration**

Create `src/types/react-pageflip.d.ts`:

```typescript
declare module 'react-pageflip' {
  import { Component, CSSProperties, ReactNode } from 'react';

  interface HTMLFlipBookProps {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
    startPage?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
    onFlip?: (e: { data: number }) => void;
    onChangeOrientation?: (e: { data: 'portrait' | 'landscape' }) => void;
    onChangeState?: (e: { data: 'user_fold' | 'fold_corner' | 'flipping' | 'read' }) => void;
    onInit?: (e: { data: unknown }) => void;
    onUpdate?: (e: { data: unknown }) => void;
  }

  export class HTMLFlipBook extends Component<HTMLFlipBookProps> {
    pageFlip(): {
      flipNext: (corner?: 'top' | 'bottom') => void;
      flipPrev: (corner?: 'top' | 'bottom') => void;
      flip: (pageNum: number, corner?: 'top' | 'bottom') => void;
      turnToPage: (pageNum: number) => void;
      turnToNextPage: () => void;
      turnToPrevPage: () => void;
      getCurrentPageIndex: () => number;
      getPageCount: () => number;
      getOrientation: () => 'portrait' | 'landscape';
      destroy: () => void;
    };
  }
}
```

- [ ] **Step 3: Verify TypeScript accepts the declaration**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors (any pre-existing errors are fine).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/types/react-pageflip.d.ts
git commit -m "feat: install react-pageflip and add TypeScript declaration"
```

---

### Task 2: Add forwardRef to Scrapbook to expose Konva Stage ref

**Files:**
- Modify: `src/components/Scrapbook.tsx` lines 540–628

`PageFlipContainer` needs to call `stage.toDataURL()` on up to three Konva stages (current, next, prev). `Scrapbook` currently uses `React.FC` with no ref. This task converts it to `React.forwardRef<Konva.Stage, ScrapbookProps>` and passes the ref to `<Stage>`.

- [ ] **Step 1: Open the file and locate the component definition**

Read `src/components/Scrapbook.tsx` lines 538–575. The component is:

```tsx
const DRAG_OVERFLOW = 180;

export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  dimensions,
  selectedScrapId,
  onSelectScrap,
}) => {
```

- [ ] **Step 2: Replace the component signature**

Replace:
```tsx
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  dimensions,
  selectedScrapId,
  onSelectScrap,
}) => {
```

With:
```tsx
export const Scrapbook = React.forwardRef<Konva.Stage, ScrapbookProps>(({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  dimensions,
  selectedScrapId,
  onSelectScrap,
}, ref) => {
```

- [ ] **Step 3: Pass the ref to the Konva Stage**

Find `<Stage` (currently around line 572):
```tsx
      <Stage
        width={dimensions.width}
        height={dimensions.height + DRAG_OVERFLOW}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
```

Replace with:
```tsx
      <Stage
        ref={ref}
        width={dimensions.width}
        height={dimensions.height + DRAG_OVERFLOW}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
```

- [ ] **Step 4: Close the forwardRef call**

The component currently closes with `};` (the last line before `export`). Replace the closing `};` of the Scrapbook component with `});`.

The file ends with:
```tsx
  return (
    <div className="w-full h-full">
      <Stage
        ...
      </Stage>
    </div>
  );
};
```

Change the final `};` to `});`.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: expose Konva Stage ref from Scrapbook via forwardRef"
```

---

### Task 3: Create flipDelegation utility (TDD)

**Files:**
- Create: `src/utils/flipDelegation.ts`
- Create: `src/utils/flipDelegation.test.ts`

`buildFlipEvent` converts a captured `PointerEvent`'s coordinates into either a `MouseEvent` (mouse/pen) or `TouchEvent` (touch) for forwarding to StPageFlip's internal event listeners. This is extracted as a pure utility so it can be unit-tested without a component.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/flipDelegation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildFlipEvent, extractPointerCoords } from './flipDelegation';

const coords = {
  clientX: 100, clientY: 200,
  pageX: 100, pageY: 200,
  screenX: 100, screenY: 200,
  pointerId: 1, width: 1, height: 1,
};

describe('buildFlipEvent — mouse', () => {
  it('creates mousedown for phase down', () => {
    const event = buildFlipEvent('down', 'mouse', coords, document.createElement('div'));
    expect(event instanceof MouseEvent).toBe(true);
    expect(event.type).toBe('mousedown');
    expect((event as MouseEvent).clientX).toBe(100);
    expect((event as MouseEvent).clientY).toBe(200);
  });

  it('creates mousemove for phase move', () => {
    const event = buildFlipEvent('move', 'mouse', coords, document.createElement('div'));
    expect(event.type).toBe('mousemove');
  });

  it('creates mouseup for phase up', () => {
    const event = buildFlipEvent('up', 'mouse', coords, document.createElement('div'));
    expect(event.type).toBe('mouseup');
  });

  it('treats pen as mouse', () => {
    const event = buildFlipEvent('down', 'pen', coords, document.createElement('div'));
    expect(event instanceof MouseEvent).toBe(true);
    expect(event.type).toBe('mousedown');
  });
});

describe('extractPointerCoords', () => {
  it('extracts the six coordinate fields', () => {
    const fakeEvent = {
      clientX: 10, clientY: 20,
      pageX: 10, pageY: 20,
      screenX: 10, screenY: 20,
      pointerId: 3, width: 2, height: 2,
      pointerType: 'mouse',
    } as React.PointerEvent;
    const result = extractPointerCoords(fakeEvent);
    expect(result.clientX).toBe(10);
    expect(result.pointerId).toBe(3);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npx vitest run src/utils/flipDelegation.test.ts 2>&1 | tail -8
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the utility**

Create `src/utils/flipDelegation.ts`:

```typescript
import React from 'react';

export type FlipPhase = 'down' | 'move' | 'up';

export interface PointerCoords {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  pointerId: number;
  width: number;
  height: number;
}

const MOUSE_TYPE: Record<FlipPhase, string> = {
  down: 'mousedown',
  move: 'mousemove',
  up: 'mouseup',
};

const TOUCH_TYPE: Record<FlipPhase, string> = {
  down: 'touchstart',
  move: 'touchmove',
  up: 'touchend',
};

/**
 * Builds a synthetic MouseEvent or TouchEvent for forwarding to StPageFlip.
 * StPageFlip listens to mouse* and touch* events internally.
 * pointerType 'touch' → TouchEvent; everything else → MouseEvent.
 */
export function buildFlipEvent(
  phase: FlipPhase,
  pointerType: string,
  coords: PointerCoords,
  target: EventTarget,
): MouseEvent | TouchEvent {
  if (pointerType === 'touch') {
    const touch = new Touch({
      identifier: coords.pointerId,
      target: target as EventTarget & Element,
      clientX: coords.clientX,
      clientY: coords.clientY,
      pageX: coords.pageX,
      pageY: coords.pageY,
      screenX: coords.screenX,
      screenY: coords.screenY,
      radiusX: coords.width / 2,
      radiusY: coords.height / 2,
    });
    return new TouchEvent(TOUCH_TYPE[phase], {
      changedTouches: [touch],
      touches: phase === 'up' ? [] : [touch],
      bubbles: true,
      cancelable: true,
    });
  }

  return new MouseEvent(MOUSE_TYPE[phase], {
    clientX: coords.clientX,
    clientY: coords.clientY,
    bubbles: true,
    cancelable: true,
  });
}

/** Pull the coords needed by buildFlipEvent out of a React PointerEvent. */
export function extractPointerCoords(e: React.PointerEvent): PointerCoords {
  return {
    clientX: e.clientX,
    clientY: e.clientY,
    pageX: e.pageX,
    pageY: e.pageY,
    screenX: e.screenX,
    screenY: e.screenY,
    pointerId: e.pointerId,
    width: e.width,
    height: e.height,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/utils/flipDelegation.test.ts 2>&1 | tail -8
```

Expected: PASS — 5 tests pass. (The touch path is not tested here because `Touch` constructor is not available in jsdom; that path is covered by manual device testing.)

- [ ] **Step 5: Commit**

```bash
git add src/utils/flipDelegation.ts src/utils/flipDelegation.test.ts
git commit -m "feat: add buildFlipEvent / extractPointerCoords utilities for StPageFlip delegation"
```

---

### Task 4: Rewrite PageFlipContainer

**Files:**
- Modify: `src/components/PageFlipContainer.tsx` (full rewrite)

**Layer stack:**
```
z-index 6  │  Edge zones (30px left + 30px right) — own all pointer events
z-index 5  │  HTMLFlipBook — pointer-events: none; receives synthetic events; visible only when flipping
z-index 4  │  Static adjacent page PNG <img> (or AddPageView) — visible only when flipping
z-index 3  │  Current page Scrapbook — visible when idle, hidden when flipping
z-index 2  │  Next page Scrapbook — opacity 0, always rendered for nextSnapshot
z-index 1  │  Prev page Scrapbook — opacity 0, always rendered for prevSnapshot
```

**react-pageflip page model:**
- Forward flip: `<HTMLFlipBook key="next" startPage={0}>` with children `[currentPagePng, kraft]`
  - Page 0 (currentPage) curls; back face = page 1 (kraft) ✓
- Backward flip: `<HTMLFlipBook key="prev" startPage={1}>` with children `[kraft, currentPagePng]`
  - Page 1 (currentPage) curls; back face = page 0 (kraft) ✓
- `key` prop forces remount when direction changes so `startPage` takes effect.

**Snapshot caching:**
Three `useEffect`s with 500ms debounce maintain `currentSnapshot`, `nextSnapshot`, `prevSnapshot`. A separate initial `useEffect` on `currentPage.id` uses `requestAnimationFrame` to take the first snapshot after Konva's first render.

**Flip completion detection:**
- `onFlip` fires when a page fully flips → call `onFlipComplete(flipDir)`, reset to idle.
- `onChangeState` with `data === 'read'` fires on both completion AND snap-back. We distinguish by clearing `flipDirRef` in `onFlip` first; if `onChangeState` sees `flipDirRef.current !== null`, it's a snap-back.

- [ ] **Step 1: Write the new PageFlipContainer**

Replace all of `src/components/PageFlipContainer.tsx` with:

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HTMLFlipBook } from 'react-pageflip';
import Konva from 'konva';
import { Scrap, JournalEntry, ScrapbookPage, TapeStrip } from '../types';
import { Scrapbook } from './Scrapbook';
import { AddPageView } from './AddPageView';
import { buildFlipEvent, extractPointerCoords, FlipPhase } from '../utils/flipDelegation';

interface PageFlipContainerProps {
  currentPage: ScrapbookPage;
  prevPage: ScrapbookPage | null;
  nextPage: ScrapbookPage | 'add-page';
  onFlipComplete: (direction: 'next' | 'prev') => void;
  onAddPage: () => void;
  dimensions: { width: number; height: number };
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  fallingScrapIds: string[] | null;
  onFallComplete: (ids: string[]) => void;
  selectedScrapId: string | null;
  onSelectScrap: (id: string | null) => void;
}

const EDGE_ZONE_WIDTH = 30;
const SNAPSHOT_DEBOUNCE_MS = 500;

export const PageFlipContainer: React.FC<PageFlipContainerProps> = ({
  currentPage,
  prevPage,
  nextPage,
  onFlipComplete,
  onAddPage,
  dimensions,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  selectedScrapId,
  onSelectScrap,
}) => {
  const [flipState, setFlipState] = useState<'idle' | 'flipping'>('idle');
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  // Ref mirrors flipDir for use inside callbacks without stale closures
  const flipDirRef = useRef<'next' | 'prev' | null>(null);

  const [currentSnapshot, setCurrentSnapshot] = useState<string | null>(null);
  const [nextSnapshot, setNextSnapshot] = useState<string | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<string | null>(null);

  const currentStageRef = useRef<Konva.Stage>(null);
  const nextStageRef = useRef<Konva.Stage>(null);
  const prevStageRef = useRef<Konva.Stage>(null);
  const flipContainerRef = useRef<HTMLDivElement>(null);
  // Coords captured on pointerdown, dispatched as synthetic mousedown after render
  const pendingCoordsRef = useRef<(ReturnType<typeof extractPointerCoords> & { pointerType: string }) | null>(null);

  // ── Reset when navigating to a new page ──────────────────────────────────
  useEffect(() => {
    setFlipState('idle');
    setFlipDir(null);
    flipDirRef.current = null;
  }, [currentPage.id]);

  // ── Initial snapshot after Konva first renders on page change ─────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCurrentSnapshot(currentStageRef.current?.toDataURL() ?? null);
    });
    return () => cancelAnimationFrame(raf);
  }, [currentPage.id]);

  // ── Debounced snapshot refresh on content changes ─────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentSnapshot(currentStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [currentPage]);

  useEffect(() => {
    if (!prevPage) return;
    const t = setTimeout(() => {
      setPrevSnapshot(prevStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [prevPage]);

  useEffect(() => {
    if (nextPage === 'add-page') return;
    const t = setTimeout(() => {
      setNextSnapshot(nextStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nextPage]);

  // ── Dispatch synthetic mousedown after HTMLFlipBook mounts ────────────────
  // flipState changes to 'flipping' → React renders HTMLFlipBook → double rAF
  // gives StPageFlip time to register its internal event listeners.
  useEffect(() => {
    if (flipState !== 'flipping' || !pendingCoordsRef.current) return;
    const coords = pendingCoordsRef.current;
    pendingCoordsRef.current = null;

    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = flipContainerRef.current;
        if (!el) return;
        el.dispatchEvent(buildFlipEvent('down', coords.pointerType, coords, el));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [flipState]);

  // ── Forward subsequent pointer events to StPageFlip ───────────────────────
  const dispatchFlipEvent = useCallback((phase: FlipPhase, e: React.PointerEvent) => {
    const el = flipContainerRef.current;
    if (!el) return;
    el.dispatchEvent(buildFlipEvent(phase, e.pointerType, extractPointerCoords(e), el));
  }, []);

  // ── Edge zone handlers ────────────────────────────────────────────────────
  const handleEdgePointerDown = (e: React.PointerEvent<HTMLDivElement>, dir: 'next' | 'prev') => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pendingCoordsRef.current = { ...extractPointerCoords(e), pointerType: e.pointerType };
    flipDirRef.current = dir;
    setFlipDir(dir);
    setFlipState('flipping');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flipState !== 'flipping') return;
    dispatchFlipEvent('move', e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flipState !== 'flipping') return;
    dispatchFlipEvent('up', e);
  };

  // ── Shared props passed to every Scrapbook instance ───────────────────────
  const sharedScrapbookProps = {
    onUpdateScrap,
    onUpdateEntry,
    onReturnScrap,
    onAddTapeStrip,
    isTapeActive: isTapeActive && flipState === 'idle',
    isGlueActive: isGlueActive && flipState === 'idle',
    fallingScrapIds,
    onFallComplete,
    dimensions,
    selectedScrapId,
    onSelectScrap,
  };

  const adjacentSnapshot = flipDir === 'prev' ? prevSnapshot : nextSnapshot;
  const { width: w, height: h } = dimensions;

  return (
    <div className="relative w-full h-full">

      {/* z-index 1: Prev page — invisible, kept alive solely for prevSnapshot */}
      {prevPage && (
        <div className="absolute inset-0" style={{ zIndex: 1, opacity: 0, pointerEvents: 'none' }}>
          <Scrapbook ref={prevStageRef} page={prevPage} {...sharedScrapbookProps} />
        </div>
      )}

      {/* z-index 2: Next page — invisible, kept alive solely for nextSnapshot */}
      {nextPage !== 'add-page' && (
        <div className="absolute inset-0" style={{ zIndex: 2, opacity: 0, pointerEvents: 'none' }}>
          <Scrapbook ref={nextStageRef} page={nextPage} {...sharedScrapbookProps} />
        </div>
      )}

      {/* z-index 3: Current page — live Konva canvas, hidden during flip */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 3,
          opacity: flipState === 'flipping' ? 0 : 1,
          pointerEvents: flipState === 'flipping' ? 'none' : 'auto',
        }}
      >
        <Scrapbook ref={currentStageRef} page={currentPage} {...sharedScrapbookProps} />
      </div>

      {/* z-index 4: Static adjacent page revealed under the curl */}
      {flipState === 'flipping' && (
        <div className="absolute inset-0" style={{ zIndex: 4, pointerEvents: 'none' }}>
          {adjacentSnapshot ? (
            <img
              src={adjacentSnapshot}
              style={{ display: 'block', width: w, height: h }}
              alt=""
            />
          ) : nextPage === 'add-page' ? (
            <AddPageView onAdd={onAddPage} />
          ) : (
            <div style={{ background: '#fdfaf3', width: '100%', height: '100%' }} />
          )}
        </div>
      )}

      {/* z-index 5: react-pageflip cylindrical curl — visible only when flipping */}
      <div
        ref={flipContainerRef}
        className="absolute inset-0"
        style={{
          zIndex: 5,
          opacity: flipState === 'flipping' ? 1 : 0,
          visibility: flipState === 'flipping' ? 'visible' : 'hidden',
          pointerEvents: 'none',
        }}
      >
        {flipState === 'flipping' && currentSnapshot && (
          <HTMLFlipBook
            key={flipDir ?? 'idle'}
            width={w}
            height={h}
            size="fixed"
            usePortrait={true}
            useMouseEvents={true}
            drawShadow={true}
            maxShadowOpacity={0.5}
            showCover={false}
            flippingTime={700}
            startPage={flipDir === 'prev' ? 1 : 0}
            style={{ pointerEvents: 'none' } as React.CSSProperties}
            onFlip={() => {
              // Clear flipDirRef FIRST — onChangeState checks it to detect snap-back
              const dir = flipDirRef.current;
              flipDirRef.current = null;
              setFlipState('idle');
              setFlipDir(null);
              if (dir) onFlipComplete(dir);
            }}
            onChangeState={(e: { data: string }) => {
              // 'read' fires on both completion and snap-back.
              // If flipDirRef is still set, onFlip didn't fire → snap-back.
              if (e.data === 'read' && flipDirRef.current !== null) {
                flipDirRef.current = null;
                setFlipState('idle');
                setFlipDir(null);
              }
            }}
          >
            {/* Forward flip: currentPage curls away; back face = kraft */}
            {flipDir === 'next' ? (
              <>
                <div>
                  <img src={currentSnapshot} style={{ display: 'block', width: w, height: h }} alt="" />
                </div>
                <div style={{ background: '#f0e8d8', width: w, height: h }} />
              </>
            ) : (
              /* Backward flip: currentPage curls away from left; back face = kraft */
              <>
                <div style={{ background: '#f0e8d8', width: w, height: h }} />
                <div>
                  <img src={currentSnapshot} style={{ display: 'block', width: w, height: h }} alt="" />
                </div>
              </>
            )}
          </HTMLFlipBook>
        )}
      </div>

      {/* z-index 6: Right edge — drag left to flip next */}
      <div
        className="absolute top-0 right-0 h-full"
        style={{ width: EDGE_ZONE_WIDTH, zIndex: 6, cursor: 'ew-resize' }}
        onPointerDown={(e) => handleEdgePointerDown(e, 'next')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* z-index 6: Left edge — drag right to flip prev (disabled on first page) */}
      {prevPage && (
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: EDGE_ZONE_WIDTH, zIndex: 6, cursor: 'ew-resize' }}
          onPointerDown={(e) => handleEdgePointerDown(e, 'prev')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors. If you see errors about `Konva.Stage` ref type mismatch with `React.forwardRef`, ensure `src/components/Scrapbook.tsx` was updated in Task 2.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: All tests pass (existing tests + 5 new flipDelegation tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/PageFlipContainer.tsx
git commit -m "feat: cylindrical page curl via react-pageflip with synthetic event delegation and snapshot caching"
```
