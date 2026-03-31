# CuttingRoom Gesture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CuttingRoom's explicit Cut/Tear mode toggle with a pure gesture-based state machine: 1-finger hold 400ms = anchor, 2nd finger swipe = rip tear, 2-finger immediate = pan/zoom.

**Architecture:** Single-file rewrite of `CuttingRoom.tsx`. A 7-state machine (`idle → pending → anchored/panning → ripping → torn`) driven entirely by `onTouchStart/Move/End/Cancel` handlers. Canvas overlays (amber trail, torn polygon) are drawn reactively via `useEffect` on state change. The anchored pulse ring is a CSS `animate-ping` div overlay — no RAF loop needed.

**Tech Stack:** React 19, TypeScript, raw Canvas 2D API, Tailwind CSS v4

---

## File Structure

**Modify only:** `src/components/CuttingRoom.tsx`

No new files. All changes within the single component.

---

### Task 1: Refactor `generateTearPolygon` to accept trail + roughness

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Replace the function body**

Replace the existing `generateTearPolygon` function (the entire function, lines 27–67) with:

```typescript
const generateTearPolygon = (trail: Point[], roughness: number, cw: number, ch: number): Point[] => {
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
  const tearPts: Point[] = [];
  for (let i = 0; i <= numSegs; i++) {
    const t = i / numSegs;
    const bx = t * cw;
    const by = leftY + (rightY - leftY) * t;
    const noise =
      (Math.random() - 0.5) * 50 * roughness +
      (Math.random() - 0.5) * 18 * roughness;
    tearPts.push({ x: bx, y: by + noise });
  }

  return [
    { x: 0, y: 0 },
    { x: cw, y: 0 },
    { x: cw, y: tearPts[tearPts.length - 1].y },
    ...tearPts.slice().reverse(),
    { x: 0, y: tearPts[0].y },
  ];
};
```

`trail[0]` and `trail[trail.length-1]` act as start/end anchors. `roughness` scales noise amplitude (0.3 = gentle, 2.0 = ragged).

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors may exist from the old `handleRetear` call site referencing the old signature — that's fine, will be deleted in Task 2. No errors on the function itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "refactor: update generateTearPolygon to accept trail array and roughness"
```

---

### Task 2: Replace state fields with new data model

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Add type declarations above the component function**

Add these above `export const CuttingRoom`:

```typescript
type GestureState = 'idle' | 'pending' | 'panning' | 'anchored' | 'ripping' | 'torn';

interface FingerA {
  id: number;
  pos: Point;
}

interface FingerB {
  id: number;
  pos: Point;
  trail: Point[];
}
```

- [ ] **Step 2: Replace all state and ref declarations inside the component**

Delete everything from the existing `const [mode, ...` through `const containerRef = ...` (lines 12–24) and replace with:

```typescript
const [gestureState, setGestureState] = useState<GestureState>('idle');
const [fingerA, setFingerA] = useState<FingerA | null>(null);
const [fingerB, setFingerB] = useState<FingerB | null>(null);
const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
const [tearPolygon, setTearPolygon] = useState<Point[] | null>(null);

const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const panRef = useRef<{ dist: number; mid: Point } | null>(null);
const ripSpeed = useRef<number[]>([]);
const lastRipTime = useRef<number>(0);
const lastRipPos = useRef<Point | null>(null);

const canvasRef = useRef<HTMLCanvasElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Delete the removed helper functions**

Delete these functions entirely — they depend on the old state model:
- `handleRetear`
- `handleMouseDown`
- `handleMouseMove`
- `handleMouseUp`
- `getPos`
- The `canFinish` derivation and `handleFinish` function (lines ~224–232 in the original — will be rewritten in Task 8 before the return statement)

- [ ] **Step 4: Add timer cleanup on unmount**

Add this effect immediately after the ref declarations:

```typescript
useEffect(() => {
  return () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
}, []);
```

- [ ] **Step 5: Add new `handleReset`**

```typescript
const handleReset = () => {
  if (longPressTimer.current) clearTimeout(longPressTimer.current);
  setGestureState('idle');
  setFingerA(null);
  setFingerB(null);
  setTearPolygon(null);
  ripSpeed.current = [];
  lastRipPos.current = null;
};
```

- [ ] **Step 6: Add stub event handlers (filled in Tasks 4–6)**

```typescript
const handleTouchStart = (_e: React.TouchEvent) => {};
const handleTouchMove = (_e: React.TouchEvent) => {};
const handleTouchEnd = (_e: React.TouchEvent) => {};
const handleTouchCancel = (_e: React.TouchEvent) => { handleReset(); };
```

- [ ] **Step 7: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors only for references in the JSX (old event handlers removed from JSX but not yet replaced). The state types should be clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "refactor: replace CuttingRoom state with gesture state machine data model"
```

---

### Task 3: Add touch helper functions

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Add helpers inside the component body, just before the event handler stubs**

```typescript
// Returns position relative to the canvas element (raw screen space — tear is screen-space)
const getTouchPos = (touch: Touch): Point => {
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
};

const pinchDistance = (t1: Touch, t2: Touch): number => {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const pinchMidpoint = (t1: Touch, t2: Touch): Point => ({
  x: (t1.clientX + t2.clientX) / 2,
  y: (t1.clientY + t2.clientY) / 2,
});
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: same errors as before, no new ones.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: add getTouchPos, pinchDistance, pinchMidpoint helpers to CuttingRoom"
```

---

### Task 4: Implement `handleTouchStart`

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Replace the stub `handleTouchStart` with the full implementation**

```typescript
const handleTouchStart = (e: React.TouchEvent) => {
  e.preventDefault();
  const allTouches = e.touches;
  const changedTouches = e.changedTouches;

  if (gestureState === 'idle' && allTouches.length === 1) {
    const touch = changedTouches[0];
    setFingerA({ id: touch.identifier, pos: getTouchPos(touch) });
    setGestureState('pending');
    longPressTimer.current = setTimeout(() => {
      setGestureState('anchored');
      // Haptic "thud" on anchor activation
      if (navigator.vibrate) navigator.vibrate(80);
    }, 400);

  } else if (gestureState === 'pending' && allTouches.length === 2) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    const t1 = allTouches[0];
    const t2 = allTouches[1];
    panRef.current = { dist: pinchDistance(t1, t2), mid: pinchMidpoint(t1, t2) };
    setGestureState('panning');

  } else if (gestureState === 'anchored' && allTouches.length === 2) {
    const newTouch = Array.from(changedTouches).find(t => t.identifier !== fingerA?.id);
    if (newTouch) {
      const pos = getTouchPos(newTouch);
      ripSpeed.current = [];
      lastRipTime.current = performance.now();
      lastRipPos.current = pos;
      setFingerB({ id: newTouch.identifier, pos, trail: [pos] });
      setGestureState('ripping');
    }

  } else if (gestureState === 'torn' && allTouches.length === 1) {
    // Implicit discard: new touch while torn clears the polygon and restarts
    const touch = changedTouches[0];
    setTearPolygon(null);
    setFingerB(null);
    setFingerA({ id: touch.identifier, pos: getTouchPos(touch) });
    setGestureState('pending');
    longPressTimer.current = setTimeout(() => {
      setGestureState('anchored');
      if (navigator.vibrate) navigator.vibrate(80);
    }, 400);
  }
};
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: implement handleTouchStart with all gesture state machine transitions"
```

---

### Task 5: Implement `handleTouchMove`

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Replace the stub `handleTouchMove` with the full implementation**

```typescript
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

  } else if (gestureState === 'ripping' && fingerB) {
    const touch = Array.from(e.touches).find(t => t.identifier === fingerB.id);
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
    setFingerB(prev => prev ? { ...prev, pos, trail: [...prev.trail, pos] } : null);
  }
};
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: implement handleTouchMove for panning pinch-zoom and ripping trail"
```

---

### Task 6: Implement `handleTouchEnd`

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

`handleTouchCancel` already delegates to `handleReset` (set in Task 2) — no changes needed there.

- [ ] **Step 1: Replace the stub `handleTouchEnd` with the full implementation**

```typescript
const handleTouchEnd = (e: React.TouchEvent) => {
  const endedIds = new Set(Array.from(e.changedTouches).map(t => t.identifier));

  if (gestureState === 'pending' && fingerA && endedIds.has(fingerA.id)) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setFingerA(null);
    setGestureState('idle');

  } else if (gestureState === 'panning' && e.touches.length === 0) {
    // Only go to idle when ALL fingers lift — dropping 2→1 stays in panning
    // (prevents accidental tear gestures at the end of zoom)
    setGestureState('idle');

  } else if (gestureState === 'anchored' && fingerA && endedIds.has(fingerA.id)) {
    setFingerA(null);
    setGestureState('idle');

  } else if (gestureState === 'ripping') {
    if (fingerA && endedIds.has(fingerA.id)) {
      // Anchor finger lifted mid-rip — cancel
      setFingerA(null);
      setFingerB(null);
      setGestureState('idle');

    } else if (fingerB && endedIds.has(fingerB.id)) {
      // Rip finger lifted — generate tear immediately
      const canvas = canvasRef.current;
      if (canvas && fingerB.trail.length >= 2) {
        const samples = ripSpeed.current;
        const avgSpeed =
          samples.length > 0
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0.5;
        // Linear map: 0.5 px/ms → roughness 0.3, 3.0 px/ms → roughness 2.0
        const roughness = Math.max(0.3, Math.min(2.0, 0.3 + (avgSpeed - 0.5) * 0.68));
        const polygon = generateTearPolygon(fingerB.trail, roughness, canvas.width, canvas.height);
        setTearPolygon(polygon);
        if (navigator.vibrate) navigator.vibrate([30, 20, 60]); // rip vibration
      }
      setFingerB(null);
      setGestureState('torn');
    }
  }
};
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: implement handleTouchEnd with tear polygon generation on Finger B lift"
```

---

### Task 7: Update `draw()` for pan/zoom and state-based overlays

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Replace the existing `draw` function**

```typescript
const draw = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  img.src = image;

  // Draw image with pan/zoom transform applied
  ctx.save();
  ctx.translate(canvasTransform.x, canvasTransform.y);
  ctx.scale(canvasTransform.scale, canvasTransform.scale);
  const imgScale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const imgX = (canvas.width - img.width * imgScale) / 2;
  const imgY = (canvas.height - img.height * imgScale) / 2;
  ctx.drawImage(img, imgX, imgY, img.width * imgScale, img.height * imgScale);
  ctx.restore();

  // All overlays are drawn in raw canvas space (no transform) so they
  // align with where the user's fingers actually touched the screen.

  if (gestureState === 'ripping' && fingerB && fingerB.trail.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(fingerB.trail[0].x, fingerB.trail[0].y);
    for (let i = 1; i < fingerB.trail.length; i++) {
      ctx.lineTo(fingerB.trail[i].x, fingerB.trail[i].y);
    }
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (gestureState === 'torn' && tearPolygon) {
    ctx.beginPath();
    tearPolygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();
  }
};
```

- [ ] **Step 2: Update the `useEffect` dependency array**

Replace the existing resize `useEffect` with:

```typescript
useEffect(() => {
  const handleResize = () => {
    if (containerRef.current && canvasRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      draw();
    }
  };
  window.addEventListener('resize', handleResize);
  handleResize();
  return () => window.removeEventListener('resize', handleResize);
}, [image, gestureState, fingerB, tearPolygon, canvasTransform]);
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: update draw() for canvasTransform pan/zoom and amber rip trail overlay"
```

---

### Task 8: Update JSX — remove mode toggle, add overlays, update hints and buttons

**Files:**
- Modify: `src/components/CuttingRoom.tsx`

- [ ] **Step 1: Remove unused imports**

Change the lucide-react import line to:

```typescript
import { RotateCcw, Check, X } from 'lucide-react';
```

(`Scissors` and `RefreshCw` are no longer used.)

- [ ] **Step 2: Add derived values and handlers before the `return` statement**

Add these in the component body, just before `return (`:

```typescript
const canFinish = gestureState === 'torn' && tearPolygon !== null;

const handleFinish = () => {
  if (tearPolygon) onCut(tearPolygon, true);
};

const hintText: Partial<Record<GestureState, string>> = {
  idle: 'Hold to anchor, swipe to tear',
  pending: 'Hold…',
  anchored: 'Now swipe to rip',
};
```

- [ ] **Step 3: Replace the entire `return (...)` block**

```tsx
return (
  <div className="fixed inset-0 z-50 bg-neutral-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 md:p-4">
    <div className="w-full h-full md:max-w-4xl flex flex-col gap-4 md:gap-6 p-4 md:p-0">

      {/* Header */}
      <div className="flex justify-between items-center text-white shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-serif italic">The Cutting Room</h2>
          {hintText[gestureState] && (
            <p className="text-[9px] md:text-sm text-white/40 uppercase tracking-widest">
              {hintText[gestureState]}
            </p>
          )}
        </div>
        <div className="flex gap-2 md:gap-4 items-center">
          <button
            onClick={handleReset}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={onCancel}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 md:aspect-video bg-black rounded-2xl overflow-hidden cursor-crosshair shadow-2xl border border-white/10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <canvas ref={canvasRef} className="w-full h-full" />

        {/* Anchored pulse ring — CSS animation, no RAF needed */}
        {gestureState === 'anchored' && fingerA && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: fingerA.pos.x,
              top: fingerA.pos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-12 h-12 rounded-full border-2 border-amber-400 animate-ping" />
          </div>
        )}

        {/* Idle / pending center hint */}
        {(gestureState === 'idle' || gestureState === 'pending') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-5xl mb-4 text-white/20 select-none">〜</p>
              <p className="text-white/40 font-medium text-sm">Hold to anchor, swipe to tear</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex justify-center gap-4 shrink-0 pb-4 md:pb-0">
        <button
          disabled={!canFinish}
          onClick={handleFinish}
          className={`
            flex items-center gap-3 px-10 py-5 rounded-full font-bold transition-all active:scale-95
            ${canFinish
              ? 'bg-white text-black shadow-2xl'
              : 'bg-white/10 text-white/20 cursor-not-allowed'}
          `}
        >
          <Check size={24} />
          KEEP PIECE
        </button>
      </div>

    </div>
  </div>
);
```

- [ ] **Step 4: Check TypeScript compiles with zero errors**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Start the dev server and do a visual check**

```bash
npm run dev
```

Open the app, navigate to CuttingRoom. Verify:
- No Cut/Tear toggle visible
- "Hold to anchor, swipe to tear" hint and `〜` icon visible in canvas center
- Reset (↺) and X buttons in header
- KEEP PIECE button dimmed (disabled) at the bottom

- [ ] **Step 6: Commit**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "feat: update CuttingRoom JSX — gesture hints, anchor ping overlay, confirm button"
```

---

### Task 9: Manual gesture test

Run on a real touch device or Chrome DevTools touch emulation (F12 → Toggle Device Toolbar → choose a mobile preset like iPhone 14 Pro).

- [ ] **Pan/Zoom**: Two fingers placed and moved immediately → image pans and scales. Release both fingers → returns to idle cleanly (no spurious pending state).

- [ ] **Tap (no-op)**: Single quick tap → nothing happens, returns to idle.

- [ ] **Anchor activation**: Single finger held for 400ms → amber `animate-ping` ring appears at finger position, hint changes to "Now swipe to rip". Lift anchor finger → ring disappears, back to idle.

- [ ] **Full rip — slow**: Anchor (400ms hold) → second finger swipes slowly across canvas → amber dashed trail follows → lift second finger → white jagged polygon appears with fine edges (low roughness), "KEEP PIECE" button becomes white/active.

- [ ] **Full rip — fast**: Same as above but swipe quickly → polygon has coarser/more jagged edges than slow rip.

- [ ] **KEEP PIECE**: After a rip, tap "KEEP PIECE" → `onCut` called → returns to Scrapbook with torn scrap in drawer.

- [ ] **Reset during rip**: Start a rip gesture, mid-way tap ↺ → everything clears, back to idle.

- [ ] **Anchor cancel (Finger A lifts during rip)**: Anchor → Rip starts → lift Finger A before Finger B → state resets to idle, no polygon generated.

- [ ] **Torn → implicit discard**: After a tear, touch canvas with 1 finger without confirming → previous polygon discarded, new anchor pending begins.

- [ ] **System interrupt**: On a real device, during `ripping`, pull down the notification shade and release → state resets to idle on return (no stuck ripping state).

- [ ] **Commit any fixes found during testing**

```bash
git add src/components/CuttingRoom.tsx
git commit -m "fix: address manual gesture test findings"
```
