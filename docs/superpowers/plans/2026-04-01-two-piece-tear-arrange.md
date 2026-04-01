# Two-Piece Tear with Arrange Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-finger anchor+swipe tear gesture with a single-finger drawn path that splits the image into two separately arrangeable pieces before placing both on the scrapbook.

**Architecture:** Simplify `CuttingRoom`'s FSM from 6 states to 4 (`idle→drawing→torn→arranging`); replace `generateTearPolygon` with `generateTearPair` that produces two complementary polygons sharing the same jagged edge; add an arrange mode overlay where both pieces can be dragged apart; extend `App.handleCut` to place two scraps; bump fiber jitter on torn scraps in `Scrapbook`.

**Tech Stack:** React 19, TypeScript, HTML5 Canvas (existing), Konva / react-konva (existing)

> **No test infrastructure exists in this project.** Each task includes a manual verification step instead of automated tests.

---

## File Map

| File | Change |
|------|--------|
| `src/components/CuttingRoom.tsx` | Major rewrite: new FSM, `generateTearPair`, arrange mode |
| `src/App.tsx` | Extend `handleCut` + `onCut` prop type for two scraps |
| `src/components/Scrapbook.tsx` | Increase fiber jitter multiplier for `isTorn` scraps |

---

## Task 1: Add `TearPair` interface and `generateTearPair` function

**Files:**
- Modify: `src/components/CuttingRoom.tsx` (replace lines 58–99)

**What this replaces:** The old `generateTearPolygon` function (lines 58–99) returned a single polygon. The new function returns two complementary polygons sharing the exact same `tearLine` array so their edges align perfectly when overlaid.

- [ ] **Step 1: Add the `TearPair` interface** just above `export const CuttingRoom`:

```ts
interface TearPair {
  tearLine: Point[];      // 61 points spanning x=0 to x=cw (generated once)
  topPolygon: Point[];    // upper half — shares tearLine
  bottomPolygon: Point[]; // lower half — shares tearLine
}
```

- [ ] **Step 2: Replace `generateTearPolygon` with `generateTearPair`**

Delete lines 58–99 entirely and insert:

```ts
const TEAR_JITTER_BOOST = 1.5; // heavier fiber effect vs. scissors cuts

const generateTearPair = (
  trail: Point[],
  roughness: number,
  cw: number,
  ch: number,
): TearPair => {
  const start = trail[0];
  const end = trail[trail.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let leftY: number;
  let rightY: number;

  if (Math.abs(dx) < 5) {
    const midY = (start.y + end.y) / 2;
    leftY = midY;
    rightY = midY;
  } else {
    const slope = dy / dx;
    leftY = start.y - slope * start.x;
    rightY = start.y + slope * (cw - start.x);
  }

  leftY = Math.max(10, Math.min(ch - 10, leftY));
  rightY = Math.max(10, Math.min(ch - 10, rightY));

  const numSegs = 60;
  const tearLine: Point[] = [];
  for (let i = 0; i <= numSegs; i++) {
    const t = i / numSegs;
    const bx = t * cw;
    const by = leftY + (rightY - leftY) * t;
    const noise =
      ((Math.random() - 0.5) * 50 * roughness +
        (Math.random() - 0.5) * 18 * roughness) *
      TEAR_JITTER_BOOST;
    tearLine.push({ x: bx, y: by + noise });
  }

  // CRITICAL: use [...tearLine] copies — never mutate tearLine itself
  const topPolygon: Point[] = [
    { x: 0, y: 0 },
    { x: cw, y: 0 },
    { x: cw, y: tearLine[tearLine.length - 1].y },
    ...[...tearLine].reverse(),
    { x: 0, y: tearLine[0].y },
  ];

  const bottomPolygon: Point[] = [
    { x: 0, y: tearLine[0].y },
    ...tearLine,
    { x: cw, y: tearLine[tearLine.length - 1].y },
    { x: cw, y: ch },
    { x: 0, y: ch },
  ];

  return { tearLine, topPolygon, bottomPolygon };
};
```

- [ ] **Step 3: Verify** — `npm run dev`, open app, no TypeScript errors in the terminal. (The function isn't called yet, so no visual change.)

- [ ] **Step 4: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "refactor: replace generateTearPolygon with generateTearPair returning two complementary polygons"
```

---

## Task 2: Simplify state declarations — remove old gesture vars, add new ones

**Files:**
- Modify: `src/components/CuttingRoom.tsx` (lines 11–49)

The old FSM had 6 states and 7 state/ref variables for the two-finger gesture. The new FSM has 4 states and a simpler draw-path approach.

- [ ] **Step 1: Replace the `GestureState` type** (line 11):

```ts
type GestureState = 'idle' | 'drawing' | 'panning' | 'torn' | 'arranging';
```

- [ ] **Step 2: Replace state/ref declarations** inside `CuttingRoom` (roughly lines 25–39). Delete everything from `const [gestureState...` through `const lastRipPos...` and replace with:

```ts
const [gestureState, setGestureState] = useState<GestureState>('idle');
const [tearPair, setTearPair] = useState<TearPair | null>(null);
const [tearPath, setTearPath] = useState<Point[]>([]); // drives canvas redraw during drawing
const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
const [pieceAOffset, setPieceAOffset] = useState({ x: 0, y: 0 });
const [pieceBOffset, setPieceBOffset] = useState({ x: 0, y: 0 });

// refs — not state, updated during touch moves without triggering re-render
const drawTouchId = useRef<number | null>(null);
const drawPath = useRef<Point[]>([]); // authoritative path during drawing
const panRef = useRef<{ dist: number; mid: Point } | null>(null);
const ripSpeed = useRef<number[]>([]);
const lastRipTime = useRef<number>(0);
const lastRipPos = useRef<Point | null>(null);
const arrangeDragRef = useRef<{
  piece: 'A' | 'B';
  touchId: number;
  startTouchX: number;
  startTouchY: number;
  startOffsetX: number;
  startOffsetY: number;
} | null>(null);

const canvasRef = useRef<HTMLCanvasElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
const imgRef = useRef<HTMLImageElement | null>(null);
const arrangePieceARef = useRef<HTMLCanvasElement>(null);
const arrangePieceBRef = useRef<HTMLCanvasElement>(null);
```

- [ ] **Step 3: Remove the `longPressTimer` cleanup `useEffect`** (lines 52–56 in old file). It's no longer needed.

- [ ] **Step 4: Update `handleReset`** (was lines 162–170):

```ts
const handleReset = () => {
  drawTouchId.current = null;
  drawPath.current = [];
  setGestureState('idle');
  setTearPath([]);
  setTearPair(null);
  setPieceAOffset({ x: 0, y: 0 });
  setPieceBOffset({ x: 0, y: 0 });
  ripSpeed.current = [];
  lastRipPos.current = null;
  arrangeDragRef.current = null;
};
```

- [ ] **Step 5: Verify** — `npm run dev`, TypeScript should compile (some functions still reference old vars — errors are expected until Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "refactor: simplify CuttingRoom state to 4-state FSM for single-finger draw"
```

---

## Task 3: Rewrite touch handlers for single-finger draw

**Files:**
- Modify: `src/components/CuttingRoom.tsx` (replace all of `handleTouchStart`, `handleTouchMove`, `handleTouchEnd`, `handleTouchCancel`)

- [ ] **Step 1: Replace `handleTouchStart`** (old lines 190–236):

```ts
const handleTouchStart = (e: React.TouchEvent) => {
  e.preventDefault();
  const allTouches = e.touches;
  const changedTouches = e.changedTouches;

  if (gestureState === 'idle' && allTouches.length === 2) {
    // Two fingers → pan/zoom
    const t1 = allTouches[0];
    const t2 = allTouches[1];
    panRef.current = { dist: pinchDistance(t1, t2), mid: pinchMidpoint(t1, t2) };
    setGestureState('panning');

  } else if (gestureState === 'idle' && allTouches.length === 1) {
    // Single finger → start drawing the tear line
    const touch = changedTouches[0];
    const pos = getTouchPos(touch);
    drawTouchId.current = touch.identifier;
    drawPath.current = [pos];
    ripSpeed.current = [];
    lastRipTime.current = performance.now();
    lastRipPos.current = pos;
    setTearPath([pos]);
    setGestureState('drawing');

  } else if (gestureState === 'torn' && allTouches.length === 1) {
    // Tap in torn state → start a new draw
    handleReset();
  }
};
```

- [ ] **Step 2: Replace `handleTouchMove`** (old lines 238–279):

```ts
const handleTouchMove = (e: React.TouchEvent) => {
  e.preventDefault();

  if (gestureState === 'panning' && e.touches.length === 2) {
    if (!panRef.current) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const newDist = pinchDistance(t1, t2);
    const newMid = pinchMidpoint(t1, t2);
    const scaleFactor = panRef.current.dist > 0 ? newDist / panRef.current.dist : 1;
    setCanvasTransform(prev => ({
      scale: Math.max(0.5, Math.min(4, prev.scale * scaleFactor)),
      x: prev.x + (newMid.x - panRef.current!.mid.x),
      y: prev.y + (newMid.y - panRef.current!.mid.y),
    }));
    panRef.current = { dist: newDist, mid: newMid };

  } else if (gestureState === 'drawing') {
    const touch = Array.from(e.touches).find(t => t.identifier === drawTouchId.current);
    if (!touch) return;
    const pos = getTouchPos(touch);
    const now = performance.now();
    const dt = now - lastRipTime.current;
    if (dt > 0 && lastRipPos.current) {
      const dx = pos.x - lastRipPos.current.x;
      const dy = pos.y - lastRipPos.current.y;
      ripSpeed.current.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    lastRipTime.current = now;
    lastRipPos.current = pos;
    drawPath.current = [...drawPath.current, pos];
    setTearPath([...drawPath.current]); // triggers canvas redraw
  }
};
```

- [ ] **Step 3: Replace `handleTouchEnd`** (old lines 281–319):

```ts
const handleTouchEnd = (e: React.TouchEvent) => {
  e.preventDefault();
  const endedIds = new Set(Array.from(e.changedTouches).map(t => t.identifier));

  if (gestureState === 'panning' && e.touches.length === 0) {
    setGestureState('idle');

  } else if (
    gestureState === 'drawing' &&
    drawTouchId.current !== null &&
    endedIds.has(drawTouchId.current)
  ) {
    const canvas = canvasRef.current;
    if (canvas && drawPath.current.length >= 3) {
      const samples = ripSpeed.current;
      const avgSpeed =
        samples.length > 0
          ? samples.reduce((a, b) => a + b, 0) / samples.length
          : 0.5;
      const roughness = Math.max(0.3, Math.min(2.0, 0.3 + (avgSpeed - 0.5) * 0.68));
      const pair = generateTearPair(drawPath.current, roughness, canvas.width, canvas.height);
      setTearPair(pair);
      if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
    }
    drawTouchId.current = null;
    setGestureState('torn');
  }
};
```

- [ ] **Step 4: Keep `handleTouchCancel`** unchanged (still calls `handleReset`).

- [ ] **Step 5: Verify manually** — `npm run dev`, open app, go to cutting room. Single finger draw should now record a path. No crash.

- [ ] **Step 6: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: replace two-finger anchor+swipe with single-finger draw for tear path"
```

---

## Task 4: Update `draw()` canvas rendering and `useEffect` dependencies

**Files:**
- Modify: `src/components/CuttingRoom.tsx` (`draw` function + resize `useEffect`)

- [ ] **Step 1: Replace the overlay section of `draw()`** (old lines 122–146 — the ripping trail and torn polygon sections). Keep everything above line 122 (image drawing with pan/zoom transform) unchanged. Replace only the overlay section:

```ts
// Overlays drawn in raw canvas space (no transform)

// During drawing: show the live tear path
if (gestureState === 'drawing' && tearPath.length >= 2) {
  ctx.beginPath();
  ctx.moveTo(tearPath[0].x, tearPath[0].y);
  for (let i = 1; i < tearPath.length; i++) {
    ctx.lineTo(tearPath[i].x, tearPath[i].y);
  }
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// After drawing: show topPolygon preview
if (gestureState === 'torn' && tearPair) {
  ctx.beginPath();
  tearPair.topPolygon.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.stroke();
}
```

- [ ] **Step 2: Update the resize `useEffect` dependencies** (old line 160):

```ts
}, [image, gestureState, tearPath, tearPair, canvasTransform]);
```

- [ ] **Step 3: Update `canFinish` and `hintText`** (old lines 326–336):

```ts
const canFinish = gestureState === 'torn' && tearPair !== null;

const hintText: Partial<Record<GestureState, string>> = {
  idle: 'Swipe across to tear',
  drawing: 'Draw the tear line…',
  arranging: 'Drag pieces apart, then confirm',
};
```

- [ ] **Step 4: Update `handleFinish`** (old lines 328–330):

```ts
const handleFinish = () => {
  if (tearPair) {
    setPieceAOffset({ x: 0, y: 0 });
    setPieceBOffset({ x: 0, y: 0 });
    setGestureState('arranging');
  }
};
```

- [ ] **Step 5: Verify manually** — draw a line across the image, lift finger. The top polygon should flash as a white-outlined shape. "KEEP PIECE" button lights up.

- [ ] **Step 6: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: update canvas draw() for single-finger draw path and torn preview"
```

---

## Task 5: Build the arrange mode overlay

**Files:**
- Modify: `src/components/CuttingRoom.tsx` (add `useEffect` for piece canvases, drag handlers, update JSX)

- [ ] **Step 1: Add `drawArrangePieces` useEffect** — insert after the resize `useEffect`:

```ts
// Render both torn pieces onto their arrange-mode canvases
useEffect(() => {
  if (gestureState !== 'arranging' || !tearPair || !imgRef.current || !canvasRef.current) return;

  const cw = canvasRef.current.width;
  const ch = canvasRef.current.height;
  const img = imgRef.current;
  const imgScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const imgX = (cw - img.naturalWidth * imgScale) / 2;
  const imgY = (ch - img.naturalHeight * imgScale) / 2;

  const drawPiece = (ref: React.RefObject<HTMLCanvasElement>, polygon: Point[]) => {
    const pieceCanvas = ref.current;
    if (!pieceCanvas) return;
    pieceCanvas.width = cw;
    pieceCanvas.height = ch;
    const ctx = pieceCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);

    // Clip to polygon and draw image
    ctx.save();
    ctx.beginPath();
    polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    ctx.translate(canvasTransform.x, canvasTransform.y);
    ctx.scale(canvasTransform.scale, canvasTransform.scale);
    ctx.drawImage(img, imgX, imgY, img.naturalWidth * imgScale, img.naturalHeight * imgScale);
    ctx.restore();

    // Torn-edge stroke (on top of clip, in raw canvas space)
    ctx.beginPath();
    polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  drawPiece(arrangePieceARef, tearPair.topPolygon);
  drawPiece(arrangePieceBRef, tearPair.bottomPolygon);
}, [gestureState, tearPair, canvasTransform]);
```

- [ ] **Step 2: Add drag handlers** — insert after the `drawArrangePieces` useEffect:

```ts
const handleArrangeTouchStart = (piece: 'A' | 'B') => (e: React.TouchEvent) => {
  e.stopPropagation();
  const t = e.changedTouches[0];
  const offset = piece === 'A' ? pieceAOffset : pieceBOffset;
  arrangeDragRef.current = {
    piece,
    touchId: t.identifier,
    startTouchX: t.clientX,
    startTouchY: t.clientY,
    startOffsetX: offset.x,
    startOffsetY: offset.y,
  };
};

const handleArrangeTouchMove = (e: React.TouchEvent) => {
  const drag = arrangeDragRef.current;
  if (!drag) return;
  const t = Array.from(e.changedTouches).find(t => t.identifier === drag.touchId);
  if (!t) return;
  const newOffset = {
    x: drag.startOffsetX + (t.clientX - drag.startTouchX),
    y: drag.startOffsetY + (t.clientY - drag.startTouchY),
  };
  if (drag.piece === 'A') setPieceAOffset(newOffset);
  else setPieceBOffset(newOffset);
};

const handleArrangeTouchEnd = () => {
  arrangeDragRef.current = null;
};

const handleConfirmArrange = () => {
  if (tearPair) onCut(tearPair.topPolygon, true, tearPair.bottomPolygon);
};
```

- [ ] **Step 3: Add arrange overlay JSX** inside the canvas container `<div>` (the `ref={containerRef}` div), after the `<canvas ref={canvasRef} .../>` line:

```tsx
{gestureState === 'arranging' && (
  <div
    className="absolute inset-0 z-10"
    style={{ background: 'rgba(10,6,4,0.88)' }}
  >
    {/* Piece A — top half */}
    <div
      className="absolute inset-0"
      style={{
        transform: `translate(${pieceAOffset.x}px, ${pieceAOffset.y}px)`,
        touchAction: 'none',
      }}
      onTouchStart={handleArrangeTouchStart('A')}
      onTouchMove={handleArrangeTouchMove}
      onTouchEnd={handleArrangeTouchEnd}
    >
      <canvas ref={arrangePieceARef} className="w-full h-full" />
    </div>

    {/* Piece B — bottom half */}
    <div
      className="absolute inset-0"
      style={{
        transform: `translate(${pieceBOffset.x}px, ${pieceBOffset.y}px)`,
        touchAction: 'none',
      }}
      onTouchStart={handleArrangeTouchStart('B')}
      onTouchMove={handleArrangeTouchMove}
      onTouchEnd={handleArrangeTouchEnd}
    >
      <canvas ref={arrangePieceBRef} className="w-full h-full" />
    </div>
  </div>
)}
```

- [ ] **Step 4: Replace the bottom action bar** (old lines 424–439 — the single "KEEP PIECE" button):

```tsx
{/* Bottom actions */}
<div className="flex justify-center gap-4 shrink-0 pb-4 md:pb-0">
  {gestureState === 'arranging' ? (
    <>
      <button
        onClick={() => setGestureState('torn')}
        className="flex items-center gap-2 px-6 py-4 rounded-full font-bold tracking-wider text-sm transition-all active:scale-95"
        style={{
          background: 'rgba(196,112,75,0.15)',
          color: '#c4704b',
        }}
      >
        <RotateCcw size={18} />
        RETEAR
      </button>
      <button
        onClick={handleConfirmArrange}
        className="flex items-center gap-3 px-10 py-4 rounded-full font-bold tracking-wider text-sm transition-all active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #e8d5b8 0%, #d4aa50 100%)',
          color: '#2c1810',
          boxShadow: '0 8px 24px rgba(212,170,80,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        <Check size={20} />
        KEEP BOTH
      </button>
    </>
  ) : (
    <button
      disabled={!canFinish}
      onClick={handleFinish}
      className="flex items-center gap-3 px-10 py-4 rounded-full font-bold tracking-wider text-sm transition-all active:scale-95"
      style={{
        background: canFinish
          ? 'linear-gradient(135deg, #e8d5b8 0%, #d4aa50 100%)'
          : 'rgba(255,255,255,0.06)',
        color: canFinish ? '#2c1810' : 'rgba(255,255,255,0.15)',
        boxShadow: canFinish
          ? '0 8px 24px rgba(212,170,80,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
          : 'none',
        cursor: canFinish ? 'pointer' : 'not-allowed',
      }}
    >
      <Check size={20} />
      TEAR & ARRANGE
    </button>
  )}
</div>
```

- [ ] **Step 5: Also remove the idle/pending hint overlay** (old lines 413–420) that checks for `gestureState === 'idle' || gestureState === 'pending'`. Update it for the new states:

```tsx
{gestureState === 'idle' && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="text-center">
      <p className="text-5xl mb-4 select-none" style={{ color: 'rgba(196,112,75,0.2)' }}>✂</p>
      <p className="font-medium text-sm" style={{ color: 'rgba(232,213,184,0.35)' }}>
        Swipe across to tear
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 6: Remove the `anchored` pulse ring overlay** (old lines 398–410 — the `gestureState === 'anchored' && fingerA &&` block). It's no longer needed.

- [ ] **Step 7: Verify manually** — draw a line, lift finger, tap "TEAR & ARRANGE". Both pieces should appear overlaid. Drag each piece. Tap "RETEAR" returns to torn preview. Tap "KEEP BOTH" (no crash — `onCut` call with 3 args, App not yet updated, may cause TS error).

- [ ] **Step 8: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: add arrange mode with two draggable piece canvases and KEEP BOTH flow"
```

---

## Task 6: Extend `App.tsx` to handle two scraps from `onCut`

**Files:**
- Modify: `src/App.tsx` (~line 7 in CuttingRoom props, ~line 98 `handleCut`)

- [ ] **Step 1: Update the `onCut` prop type in `CuttingRoomProps`** (`src/components/CuttingRoom.tsx` line 7):

```ts
onCut: (points: Point[], isTorn?: boolean, secondPoints?: Point[]) => void;
```

- [ ] **Step 2: Update `handleCut` in `src/App.tsx`** (replace the existing `handleCut` function body):

```ts
const handleCut = (points: Point[], isTorn?: boolean, secondPoints?: Point[]) => {
  if (!currentMaterial) return;

  const centerX = (bookDims.width - 68) / 2;
  const centerY = bookDims.height / 2;

  const baseProps = {
    image: currentMaterial.image,
    rotation: (Math.random() - 0.5) * 20,
    scale: 0.5,
    isGlued: false,
    isTorn: isTorn ?? false,
  };

  const scraps: Scrap[] = [
    {
      id: Math.random().toString(36).substr(2, 9),
      points,
      x: secondPoints ? centerX - 60 : centerX - 100,
      y: secondPoints ? centerY - 80 : centerY - 100,
      zIndex: currentPage.scraps.length,
      ...baseProps,
    },
  ];

  if (secondPoints) {
    scraps.push({
      id: Math.random().toString(36).substr(2, 9),
      points: secondPoints,
      x: centerX + 60,
      y: centerY + 80,
      zIndex: currentPage.scraps.length + 1,
      ...baseProps,
    });
  }

  const updatedPages = [...pages];
  updatedPages[currentPageIndex].scraps.push(...scraps);
  setPages(updatedPages);
  setRawMaterials(prev => prev.filter(m => m.id !== currentMaterial!.id));
  setCurrentMaterial(null);
  setView('scrapbook');

  confetti({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#e8d5b8', '#d4aa50', '#c4704b'],
  });
};
```

- [ ] **Step 3: Verify `currentMaterial` non-null assertion** — The existing code uses `currentMaterial.id` after the null check. The destructuring in `baseProps` is safe since we guard with `if (!currentMaterial) return`. The `setRawMaterials` filter references `currentMaterial` which TypeScript may flag — use `currentMaterial!.id` if needed.

- [ ] **Step 4: Verify manually** — full flow: draw a line → TEAR & ARRANGE → drag pieces → KEEP BOTH. Both scraps should appear on the scrapbook page. Each should be independently draggable.

- [ ] **Step 5: Commit**

```bash
git add src/components/CuttingRoom.tsx src/App.tsx
git commit -m "feat: extend handleCut to place two torn scraps from single tear gesture"
```

---

## Task 7: Increase fiber jitter on torn scraps in Scrapbook

**Files:**
- Modify: `src/components/Scrapbook.tsx` (`drawJaggedPath` + its two call sites)

- [ ] **Step 1: Add `jitterMultiplier` parameter to `drawJaggedPath`** (line 303):

```ts
const drawJaggedPath = (ctx: any, points: Point[], jitterMultiplier = 1) => {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const jitter = dist * 0.05 * jitterMultiplier;

    ctx.lineTo(
      midX + (Math.random() - 0.5) * jitter,
      midY + (Math.random() - 0.5) * jitter,
    );
  }
  ctx.closePath();
};
```

- [ ] **Step 2: Update the clip call site** — The `Group clipFunc` should use multiplier `1` (clean clip boundary):

```tsx
<Group
  clipFunc={(ctx) => {
    drawJaggedPath(ctx, scrap.points, 1);
  }}
>
```

- [ ] **Step 3: Update the stroke call site** — The `Shape sceneFunc` should use `2.5` for torn scraps to create visible fiber fringe beyond the clip edge:

```tsx
<Shape
  sceneFunc={(ctx, shape) => {
    drawJaggedPath(ctx, scrap.points, scrap.isTorn ? 2.5 : 1);
    ctx.fillStrokeShape(shape);
  }}
  stroke="white"
  strokeWidth={scrap.isTorn ? 4.5 : 1}
  opacity={scrap.isTorn ? 0.7 : 0.3}
  listening={false}
/>
```

- [ ] **Step 4: Verify manually** — torn scraps should have a noticeably rougher white edge than scissors-cut scraps. The fringe should extend slightly beyond the image boundary (intentional — this is the fiber effect from the stroke being jaggier than the clip).

- [ ] **Step 5: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: increase fiber jitter on torn scrap edges in Scrapbook rendering"
```

---

## End-to-End Verification Checklist

- [ ] Open the app → select a photo → enter cutting room
- [ ] **Single-finger draw** traces a dashed amber line across the image
- [ ] **Lifting finger** shows the torn polygon preview + "TEAR & ARRANGE" button activates
- [ ] **Two-finger pinch** still pan/zooms the image (check before drawing)
- [ ] **Tapping while torn** resets to `idle` for a fresh draw
- [ ] **TEAR & ARRANGE** → both pieces appear perfectly overlaid (original image looks intact)
- [ ] **Dragging Piece A** slides the top half independently
- [ ] **Dragging Piece B** slides the bottom half independently
- [ ] **The torn edges align** when pieces are overlaid (same jagged line, no gap or overlap)
- [ ] **RETEAR** returns to torn preview state
- [ ] **KEEP BOTH** → two scraps appear on the scrapbook page, placed slightly offset
- [ ] Both scraps are individually draggable, rotatable, scalable on the canvas
- [ ] Both scraps show the **thicker white torn-edge stroke** (`isTorn: true`)
- [ ] **Scissors cut** (existing feature) still works — single scrap placed as before
- [ ] **RotateCcw reset button** clears all state and returns to idle
