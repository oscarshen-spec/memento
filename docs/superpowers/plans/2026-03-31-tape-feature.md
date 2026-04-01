# Tape Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a masking tape tool to the scrapbook canvas — users swipe to place straight cream-coloured tape strips, and tear them by swiping sideways or reversing direction.

**Architecture:** A self-contained `TapeLayer` Konva component manages all gesture detection and rendering as a dedicated `<Layer>` inside the existing `Stage`. Strip data is lifted into `ScrapbookPage` state via an `onStripAdded` callback. The toolbar tape-roll icon in `App.tsx` toggles `activeTool`, which gates the layer's interactivity.

**Tech Stack:** React 19, TypeScript, react-konva (Konva canvas), Tailwind CSS v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `TapeStrip` interface; add `tapeStrips` to `ScrapbookPage` |
| Create | `src/components/TapeLayer.tsx` | All tape gesture logic, drawing helpers, Konva Layer |
| Modify | `src/components/Scrapbook.tsx` | Mount `TapeLayer`; disable scraps layer when tape is active |
| Modify | `src/App.tsx` | `activeTool` state, tape icon, `handleAddTapeStrip`, init page |

---

## Task 1: Add `TapeStrip` type and update `ScrapbookPage`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the `TapeStrip` interface and update `ScrapbookPage`**

Open `src/types.ts`. Add `TapeStrip` after `JournalEntry`, and add `tapeStrips` to `ScrapbookPage`:

```ts
export interface TapeStrip {
  id: string;
  startPoint: Point;
  endPoint: Point;
  width: number;
  tearSeed: number;
}

export interface ScrapbookPage {
  id: string;
  scraps: Scrap[];
  journalEntries: JournalEntry[];
  tapeStrips: TapeStrip[];   // ← new
  background: string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npm run lint
```

Expected: no errors. If you see "Property 'tapeStrips' does not exist", the type wasn't saved correctly.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TapeStrip type and tapeStrips field to ScrapbookPage"
```

---

## Task 2: Create `TapeLayer` — drawing utilities

**Files:**
- Create: `src/components/TapeLayer.tsx`

- [ ] **Step 1: Create the file with math helpers and the `drawTapeShape` function**

Create `src/components/TapeLayer.tsx` with the following content. This step covers only the drawing utilities — no React yet.

```tsx
import React, { useState, useRef } from 'react';
import { Layer, Shape, Rect } from 'react-konva';
import { TapeStrip, Point } from '../types';

// ── Math helpers ────────────────────────────────────────────────────────────

function vecLen(v: Point): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecNorm(v: Point): Point {
  const len = vecLen(v);
  return len < 0.0001 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function vecDot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** Deterministic pseudo-random number generator seeded with `seed`. */
function seededRng(seed: number): () => number {
  let s = (Math.abs(seed * 1000) | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const TAPE_COLOR = 'rgba(240,225,190,0.88)';
const TAPE_EDGE_COLOR = 'rgba(170,145,100,0.75)';
const TAPE_GRAIN_COLOR = 'rgba(200,180,140,0.22)';
const WISP_COLOR = 'rgba(190,165,120,0.55)';

/**
 * Draws a masking tape strip from `start` to `end` directly onto a Konva
 * sceneFunc context. Pass `tearSeed` for a finalized strip (draws jagged torn
 * right end + fiber wisps). Pass `null` for the in-progress preview (clean end).
 */
function drawTapeShape(
  ctx: any,
  start: Point,
  end: Point,
  width: number,
  tearSeed: number | null,
  alpha = 1,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  // Unit vectors along and perpendicular to the tape axis
  const ax = dx / len;
  const ay = dy / len;
  const px = (-dy / len) * (width / 2);
  const py = (dx / len) * (width / 2);

  // Four corners: top-left (tl), bottom-left (bl), bottom-right (br), top-right (tr)
  const tl = { x: start.x + px, y: start.y + py };
  const bl = { x: start.x - px, y: start.y - py };
  const br = { x: end.x - px, y: end.y - py };
  const tr = { x: end.x + px, y: end.y + py };

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Shadow ──
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.13)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = ax * 1 + px * 0.05;
  ctx.shadowOffsetY = ay * 1 + py * 0.05;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.fillStyle = TAPE_COLOR;
  ctx.fill();
  ctx.restore();

  // ── Tape body (no shadow) ──
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.fillStyle = TAPE_COLOR;
  ctx.fill();

  // ── Paper grain lines (clipped to tape body) ──
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = TAPE_GRAIN_COLOR;
  ctx.lineWidth = 0.5;
  for (let i = 6; i < len; i += 8) {
    ctx.beginPath();
    ctx.moveTo(start.x + ax * i + px * 0.85, start.y + ay * i + py * 0.85);
    ctx.lineTo(start.x + ax * i - px * 0.85, start.y + ay * i - py * 0.85);
    ctx.stroke();
  }
  ctx.restore();

  // ── Left torn end (start side) — always shown ──
  const leftRng = seededRng((tearSeed ?? 99999) + 1);
  const steps = 7;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mx = tl.x + (bl.x - tl.x) * t;
    const my = tl.y + (bl.y - tl.y) * t;
    const jag = (leftRng() - 0.5) * 7;
    ctx.lineTo(mx - ax * Math.abs(jag), my - ay * Math.abs(jag));
  }
  ctx.strokeStyle = TAPE_EDGE_COLOR;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // ── Right torn end — only on finalized strips ──
  if (tearSeed !== null) {
    const rightRng = seededRng(tearSeed);
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = tr.x + (br.x - tr.x) * t;
      const my = tr.y + (br.y - tr.y) * t;
      const jag = (rightRng() - 0.5) * 10;
      ctx.lineTo(mx + ax * jag, my + ay * jag);
    }
    ctx.strokeStyle = TAPE_EDGE_COLOR;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // ── Fiber wisps at tear end ──
    const wispRng = seededRng(tearSeed + 77);
    ctx.strokeStyle = WISP_COLOR;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.3 + wispRng() * 0.4) / 4;
      const wx = tr.x + (br.x - tr.x) * t;
      const wy = tr.y + (br.y - tr.y) * t;
      const wlen = 5 + wispRng() * 5;
      const angle = (wispRng() - 0.5) * 0.9;
      const wdx = ax * Math.cos(angle) - ay * Math.sin(angle);
      const wdy = ax * Math.sin(angle) + ay * Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + wdx * wlen, wy + wdy * wlen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── Component (stub — gestures added in Task 3) ──────────────────────────────

export interface TapeLayerProps {
  isActive: boolean;
  strips: TapeStrip[];
  onStripAdded: (strip: TapeStrip) => void;
  stageWidth: number;
  stageHeight: number;
}

export const TapeLayer: React.FC<TapeLayerProps> = ({
  isActive,
  strips,
  onStripAdded: _onStripAdded,
  stageWidth,
  stageHeight,
}) => {
  return (
    <Layer>
      {isActive && (
        <Rect
          x={0} y={0}
          width={stageWidth} height={stageHeight}
          fill="transparent"
        />
      )}
      {strips.map((strip) => (
        <Shape
          key={strip.id}
          sceneFunc={(ctx) => {
            drawTapeShape(ctx, strip.startPoint, strip.endPoint, strip.width, strip.tearSeed);
          }}
          listening={false}
        />
      ))}
    </Layer>
  );
};
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TapeLayer.tsx
git commit -m "feat: add TapeLayer with masking tape drawing utilities"
```

---

## Task 3: Add gesture handling to `TapeLayer`

**Files:**
- Modify: `src/components/TapeLayer.tsx`

- [ ] **Step 1: Replace the component body with full gesture logic**

The constants for gesture detection:
- `DIRECTION_LOCK_DIST = 5` — px of movement before the tape direction is locked
- `TEAR_THRESHOLD = 0.34` — cos(~70°); movement deviating more than 70° from tape axis tears it

Replace the entire component (from `// ── Component` to the end of the file) with:

```tsx
// ── Constants ────────────────────────────────────────────────────────────────

const TAPE_WIDTH = 28;
const DIRECTION_LOCK_DIST = 5;
const TEAR_THRESHOLD = 0.34; // cos(~70°)

// ── Component ────────────────────────────────────────────────────────────────

export interface TapeLayerProps {
  isActive: boolean;
  strips: TapeStrip[];
  onStripAdded: (strip: TapeStrip) => void;
  stageWidth: number;
  stageHeight: number;
}

interface InProgress {
  startPoint: Point;
  currentPoint: Point;
  prevPoint: Point;
  tapeDirection: Point | null;
}

export const TapeLayer: React.FC<TapeLayerProps> = ({
  isActive,
  strips,
  onStripAdded,
  stageWidth,
  stageHeight,
}) => {
  const [inProgress, setInProgress] = useState<InProgress | null>(null);
  const ipRef = useRef<InProgress | null>(null);

  const getPos = (e: any): Point => {
    const pos = e.target.getStage().getPointerPosition();
    return { x: pos.x, y: pos.y };
  };

  const finalize = (start: Point, end: Point) => {
    ipRef.current = null;
    setInProgress(null);
    if (vecLen({ x: end.x - start.x, y: end.y - start.y }) < DIRECTION_LOCK_DIST) return;
    onStripAdded({
      id: Math.random().toString(36).substr(2, 9),
      startPoint: start,
      endPoint: end,
      width: TAPE_WIDTH,
      tearSeed: Math.random() * 100000,
    });
  };

  const handleDown = (e: any) => {
    const pos = getPos(e);
    const ip: InProgress = {
      startPoint: pos,
      currentPoint: pos,
      prevPoint: pos,
      tapeDirection: null,
    };
    ipRef.current = ip;
    setInProgress({ ...ip });
  };

  const handleMove = (e: any) => {
    if (!ipRef.current) return;
    const pos = getPos(e);
    const ip = ipRef.current;

    const totalMovement = { x: pos.x - ip.startPoint.x, y: pos.y - ip.startPoint.y };
    const stepMovement  = { x: pos.x - ip.prevPoint.x,  y: pos.y - ip.prevPoint.y };

    // Lock tape direction once the user has moved far enough
    let tapeDirection = ip.tapeDirection;
    if (!tapeDirection && vecLen(totalMovement) > DIRECTION_LOCK_DIST) {
      tapeDirection = vecNorm(totalMovement);
    }

    // Check tear: current step deviates > 70° from locked direction
    if (tapeDirection && vecLen(stepMovement) > 1.5) {
      const d = vecDot(vecNorm(stepMovement), tapeDirection);
      if (d < TEAR_THRESHOLD) {
        finalize(ip.startPoint, ip.prevPoint);
        return;
      }
    }

    const updated: InProgress = {
      startPoint: ip.startPoint,
      currentPoint: pos,
      prevPoint: pos,
      tapeDirection,
    };
    ipRef.current = updated;
    setInProgress({ ...updated });
  };

  const handleUp = (e: any) => {
    if (!ipRef.current) return;
    const pos = getPos(e);
    finalize(ipRef.current.startPoint, pos);
  };

  return (
    <Layer>
      {/* Transparent hit target — only active in tape mode */}
      {isActive && (
        <Rect
          x={0} y={0}
          width={stageWidth} height={stageHeight}
          fill="transparent"
          onMouseDown={handleDown}
          onTouchStart={handleDown}
          onMouseMove={handleMove}
          onTouchMove={handleMove}
          onMouseUp={handleUp}
          onTouchEnd={handleUp}
        />
      )}

      {/* Finalized strips */}
      {strips.map((strip) => (
        <Shape
          key={strip.id}
          sceneFunc={(ctx) => {
            drawTapeShape(ctx, strip.startPoint, strip.endPoint, strip.width, strip.tearSeed);
          }}
          listening={false}
        />
      ))}

      {/* Live preview */}
      {inProgress && inProgress.tapeDirection && (
        <Shape
          sceneFunc={(ctx) => {
            drawTapeShape(
              ctx,
              inProgress.startPoint,
              inProgress.currentPoint,
              TAPE_WIDTH,
              null,
              0.5,
            );
          }}
          listening={false}
        />
      )}
    </Layer>
  );
};
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint
```

Expected: no errors. Common issue: if TypeScript complains about `useState`/`useRef` not being imported, ensure the import line at the top of the file is:
```ts
import React, { useState, useRef } from 'react';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TapeLayer.tsx
git commit -m "feat: add tape gesture detection with direction-lock and tear trigger"
```

---

## Task 4: Mount `TapeLayer` in `Scrapbook`

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add `isTapeActive` and `tapeStrips`/`onStripAdded` props**

Update the `ScrapbookProps` interface (around line 327):

```tsx
import { TapeLayer } from './TapeLayer';
import { TapeStrip, Scrap, Point, JournalEntry, ScrapbookPage } from '../types';

interface ScrapbookProps {
  page: ScrapbookPage;
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  dimensions: { width: number; height: number };
}
```

- [ ] **Step 2: Destructure new props and mount `TapeLayer`**

Update the `Scrapbook` component signature and Stage contents. Replace the existing `export const Scrapbook` function signature and its return value:

```tsx
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  dimensions,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const checkDeselect = (e: any) => {
    if (isTapeActive) return; // tape mode captures all events
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);
  };

  return (
    <div className="w-full h-full">
      <Stage
        width={dimensions.width}
        height={dimensions.height + DRAG_OVERFLOW}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
        {/* Layer 0: lined paper background */}
        <Layer listening={false}>
          <LinedPaper width={dimensions.width} height={dimensions.height} />
        </Layer>

        {/* Layer 1: scraps and journal entries */}
        <Layer listening={!isTapeActive}>
          {[...page.scraps].sort((a, b) => a.zIndex - b.zIndex).map((scrap) => (
            <ScrapItem
              key={scrap.id}
              scrap={scrap}
              isSelected={scrap.id === selectedId}
              onSelect={() => setSelectedId(scrap.id)}
              onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
              onReturn={() => onReturnScrap(scrap)}
              stageHeight={dimensions.height}
            />
          ))}
          {page.journalEntries.map((entry) => (
            <TextItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedId}
              onSelect={() => setSelectedId(entry.id)}
              onChange={(newAttrs) => onUpdateEntry(entry.id, newAttrs)}
            />
          ))}
        </Layer>

        {/* Layer 2: tape */}
        <TapeLayer
          isActive={isTapeActive}
          strips={page.tapeStrips}
          onStripAdded={onAddTapeStrip}
          stageWidth={dimensions.width}
          stageHeight={dimensions.height + DRAG_OVERFLOW}
        />
      </Stage>
    </div>
  );
};
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run lint
```

Expected: errors about missing `onAddTapeStrip` and `isTapeActive` props in `App.tsx` — that is expected and will be fixed in Task 5. The errors should only be in `App.tsx`, not in `Scrapbook.tsx` or `TapeLayer.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: mount TapeLayer in Scrapbook, disable scraps layer when tape active"
```

---

## Task 5: Add tape icon and state to `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `activeTool` state and update `INITIAL_PAGE`**

In `App.tsx`, add `activeTool` state after the existing state declarations (around line 29):

```tsx
const [activeTool, setActiveTool] = useState<'tape' | null>(null);
```

Update `INITIAL_PAGE` to include `tapeStrips`:

```tsx
const INITIAL_PAGE: ScrapbookPage = {
  id: 'page-1',
  scraps: [],
  journalEntries: [],
  tapeStrips: [],
  background: '#fdfaf3',
};
```

Also update `addPage` to include `tapeStrips: []`:

```tsx
const addPage = () => {
  const newPage: ScrapbookPage = {
    id: `page-${pages.length + 1}`,
    scraps: [],
    journalEntries: [],
    tapeStrips: [],
    background: '#fdfaf3',
  };
  setPages([...pages, newPage]);
  setCurrentPageIndex(pages.length);
};
```

- [ ] **Step 2: Add `handleAddTapeStrip`**

Add this handler after `handleReturnScrap`:

```tsx
const handleAddTapeStrip = (strip: TapeStrip) => {
  const updatedPages = [...pages];
  updatedPages[currentPageIndex].tapeStrips.push(strip);
  setPages(updatedPages);
};
```

Add the `TapeStrip` import to the existing import line:

```tsx
import { Scrap, Point, RawMaterial, ScrapbookPage, JournalEntry, TapeStrip } from './types';
```

- [ ] **Step 3: Add the tape roll icon to the top bar**

In the top bar JSX (the `<div className="flex gap-8">` that's currently empty, around line 195), add the tape icon button:

```tsx
<div className="flex gap-8">
  <button
    onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
      activeTool === 'tape'
        ? 'bg-white/15 text-white/90'
        : 'text-white/50 hover:bg-white/10 hover:text-white/70'
    }`}
    title="Tape tool"
  >
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      {/* Tape roll outer ring */}
      <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="2.2" fill="currentColor" fillOpacity="0.1"/>
      {/* Inner hole */}
      <circle cx="13" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="rgba(30,20,10,0.7)"/>
      {/* Grain lines */}
      <path d="M3.5,10.5 Q13,8.5 22.5,10.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
      <path d="M3,13 Q13,11 23,13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
      <path d="M3.5,15.5 Q13,13.5 22.5,15.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
      {/* Pull tab */}
      <path d="M21,9.5 L24.5,7 L26,9.5 L22.5,12 Z" fill="currentColor" fillOpacity="0.8"/>
    </svg>
    {/* Active indicator */}
    {activeTool === 'tape' && (
      <div className="w-1 h-1 rounded-full bg-white/80" />
    )}
  </button>
</div>
```

- [ ] **Step 4: Pass new props to `<Scrapbook>`**

Find the `<Scrapbook ... />` usage (around line 240) and add the two new props:

```tsx
<Scrapbook
  page={currentPage}
  onUpdateScrap={updateScrap}
  onUpdateEntry={updateEntry}
  onReturnScrap={handleReturnScrap}
  onAddTapeStrip={handleAddTapeStrip}
  isTapeActive={activeTool === 'tape'}
  dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
/>
```

- [ ] **Step 5: Verify everything compiles cleanly**

```bash
npm run lint
```

Expected: **zero errors**.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
1. Tape roll icon appears in the top bar.
2. Clicking it highlights the icon with underline dot; clicking again deactivates.
3. While active, swiping across the scrapbook page draws a live cream-coloured strip preview.
4. Lifting the finger/mouse finalizes the strip with jagged torn ends.
5. Swiping sideways (perpendicular) mid-stroke tears the tape at that point.
6. Reversing direction mid-stroke also tears the tape.
7. Scraps cannot be selected or dragged while tape mode is on.
8. Switching pages shows that tape strips are per-page.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add tape tool icon and wire TapeLayer into app state"
```

---

## Self-Review

**Spec coverage:**
- ✅ Masking tape style (cream colour, grain, shadow)
- ✅ Straight strip at any angle
- ✅ Organic jagged torn ends with fiber wisps (seeded, deterministic)
- ✅ Toolbar icon with active/inactive state
- ✅ Swipe back (180°) triggers tear
- ✅ Perpendicular swipe (~90°) triggers tear — unified as `dot < 0.34` (>70° deviation)
- ✅ TapeStrip data model with `tearSeed`
- ✅ `tapeStrips` added to `ScrapbookPage` and initialized in `INITIAL_PAGE` and `addPage`
- ✅ Scraps layer disabled (`listening={false}`) when tape is active
- ✅ Preview strip at 50% opacity while dragging

**Placeholder scan:** None found — all code blocks are complete.

**Type consistency:**
- `TapeStrip` defined in Task 1, used in Tasks 2, 3, 4, 5 — consistent.
- `onAddTapeStrip` prop name matches `handleAddTapeStrip` callback name — consistent.
- `TapeLayerProps` exported from `TapeLayer.tsx` — not needed externally but harmless.
- `TAPE_WIDTH = 28` in `TapeLayer.tsx` matches spec value — consistent.
