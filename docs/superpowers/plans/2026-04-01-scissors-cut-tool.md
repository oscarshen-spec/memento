# Scissors Cut Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scissors lasso-cut tool that clips scraps to a user-drawn polygon with velocity-based jagged edges, returning the leftover piece to the material drawer.

**Architecture:** A new `ScissorsCutView` modal component opens when the user taps the existing scissors button (already rendered as a placeholder in App.tsx). The modal presents the scrap's image on a cutting mat canvas where the user draws a single-finger lasso. On commit, the image is clipped using Canvas 2D `clip()` and `destination-out` compositing to produce inside and outside pieces.

**Tech Stack:** React 19, TypeScript, HTML5 Canvas 2D API, Web Audio API (synthesized sounds), Framer Motion (modal animation)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/ScissorsCutView.tsx` | **Create** | Full-screen modal: cutting mat canvas, lasso drawing, velocity tracking, image clipping |
| `src/App.tsx` | **Modify** | Wire scissors button to open modal, handle cut result (update scrap + create RawMaterial) |
| `src/services/soundService.ts` | **Modify** | Add `scissorTrace` and `scissorSnip` synthesized sounds |

No changes needed to `types.ts` (existing `Point[]` and `Scrap` suffice), `Scrapbook.tsx`, or `PageFlipContainer.tsx`.

---

### Task 1: Add Scissor Sounds to soundService

**Files:**
- Modify: `src/services/soundService.ts`

- [ ] **Step 1: Add `scissorTrace` and `scissorSnip` to the SoundName type**

In `src/services/soundService.ts`, add the new sound names to the union type:

```typescript
export type SoundName =
  | 'wobbleStart'
  | 'paperRustle'
  | 'cardFlip'
  | 'glueSpread'
  | 'glueThud'
  | 'settle'
  | 'peel'
  | 'sparkle'
  | 'tapeRip'
  | 'scissorTrace'
  | 'scissorSnip';
```

- [ ] **Step 2: Implement the `scissorTrace` function**

Add after the `tapeRip` function (before `wobbleStart`):

```typescript
function scissorTrace() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Short high-pitched metallic click — like scissor blades brushing
  const noise = whiteNoise(ctx, 0.03);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  filter.Q.value = 2.0;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.03);
}
```

- [ ] **Step 3: Implement the `scissorSnip` function**

Add right after `scissorTrace`:

```typescript
function scissorSnip() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Two overlapping metallic clicks — like scissor blades closing
  [0, 0.04].forEach((offset) => {
    const noise = whiteNoise(ctx, 0.06);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500 - offset * 5000;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    const start = t + offset;
    gain.gain.setValueAtTime(0.35, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
    noise.stop(start + 0.06);
  });
}
```

- [ ] **Step 4: Register both sounds in the `soundFns` map**

Add both entries to the `soundFns` record:

```typescript
const soundFns: Record<SoundName, () => void> = {
  wobbleStart,
  paperRustle,
  cardFlip,
  glueSpread,
  glueThud,
  settle,
  peel,
  sparkle,
  tapeRip,
  scissorTrace,
  scissorSnip,
};
```

- [ ] **Step 5: Verify sounds compile**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/services/soundService.ts
git commit -m "feat: add scissorTrace and scissorSnip sounds"
```

---

### Task 2: Create ScissorsCutView Component — Canvas & Image Display

**Files:**
- Create: `src/components/ScissorsCutView.tsx`

- [ ] **Step 1: Create the component file with props, state, and canvas setup**

Create `src/components/ScissorsCutView.tsx`:

```tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Point } from '../types';
import { playSound } from '../services/soundService';

interface ScissorsCutViewProps {
  image: string;
  onCut: (insideImage: string, insidePoints: Point[], outsideImage: string) => void;
  onCancel: () => void;
}

interface LassoPoint {
  x: number;
  y: number;
  jitter: number; // velocity-based jitter for this point
}

export const ScissorsCutView: React.FC<ScissorsCutViewProps> = ({ image, onCut, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const lassoPoints = useRef<LassoPoint[]>([]);
  const isDrawing = useRef(false);
  const velocitySamples = useRef<{ time: number; x: number; y: number }[]>([]);
  const pointCount = useRef(0);
  const animFrameId = useRef<number>(0);

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = image;
  }, [image]);

  // Calculate how the image fits in the canvas (aspect-fit with padding)
  const getImageDisplayRect = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return { x: 0, y: 0, width: 0, height: 0 };

    const padding = 40;
    const maxW = canvas.width - padding * 2;
    const maxH = canvas.height - padding * 2;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    return {
      x: (canvas.width - w) / 2,
      y: (canvas.height - h) / 2,
      width: w,
      height: h,
    };
  }, []);

  // Draw the canvas: image + lasso path
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const rect = getImageDisplayRect();
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);

    const points = lassoPoints.current;
    if (points.length < 2) return;

    // Draw lasso path
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Start point indicator
    const start = points[0];
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.fill();

    // Snap ring when near start
    const last = points[points.length - 1];
    const distToStart = Math.hypot(last.x - start.x, last.y - start.y);
    if (distToStart <= 20 && points.length > 5) {
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(start.x, start.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Scissors emoji at current tip
    if (isDrawing.current && points.length > 0) {
      const tip = points[points.length - 1];
      ctx.save();
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2702\uFE0F', tip.x + 12, tip.y - 12);
      ctx.restore();
    }
  }, [getImageDisplayRect]);

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw, imgLoaded]);

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: '#2a5a3a',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,0.05) 19px, rgba(255,255,255,0.05) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,0.05) 19px, rgba(255,255,255,0.05) 20px)',
      }}
    >
      {/* Close button */}
      <button
        onClick={() => { playSound('paperRustle'); onCancel(); }}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        ✕
      </button>

      {/* Instruction */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-sm"
        style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}
      >
        Trace around what you want to keep
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
    </motion.div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ScissorsCutView.tsx
git commit -m "feat: scaffold ScissorsCutView with canvas and image display"
```

---

### Task 3: Add Lasso Drawing Gesture to ScissorsCutView

**Files:**
- Modify: `src/components/ScissorsCutView.tsx`

- [ ] **Step 1: Add touch event handlers to the canvas**

Add these handler functions inside the `ScissorsCutView` component, after the `draw` callback and before the resize `useEffect`:

```tsx
  const getCanvasPoint = (touch: React.Touch): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const computeJitter = (): number => {
    const samples = velocitySamples.current;
    if (samples.length < 2) return 0.5;
    // Average speed from recent samples
    let totalSpeed = 0;
    for (let i = 1; i < samples.length; i++) {
      const dx = samples[i].x - samples[i - 1].x;
      const dy = samples[i].y - samples[i - 1].y;
      const dt = samples[i].time - samples[i - 1].time;
      if (dt > 0) totalSpeed += Math.hypot(dx, dy) / dt;
    }
    const avgSpeed = totalSpeed / (samples.length - 1);
    // Map speed to jitter: slow = 0.5 (clean), fast = 4.0 (jagged)
    return Math.max(0.5, Math.min(4.0, 0.5 + (avgSpeed - 0.3) * 2.5));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const pt = getCanvasPoint(e.touches[0]);
    lassoPoints.current = [{ ...pt, jitter: 0.5 }];
    velocitySamples.current = [{ time: Date.now(), ...pt }];
    pointCount.current = 0;
    isDrawing.current = true;
    draw();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing.current || e.touches.length !== 1) return;
    const pt = getCanvasPoint(e.touches[0]);
    const points = lassoPoints.current;
    const last = points[points.length - 1];

    // Min 3px spacing to avoid density issues
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3) return;

    // Track velocity (rolling window of 10)
    const now = Date.now();
    velocitySamples.current.push({ time: now, ...pt });
    if (velocitySamples.current.length > 10) velocitySamples.current.shift();

    const jitter = computeJitter();
    points.push({ ...pt, jitter });

    // Haptic tick every ~15 points
    pointCount.current++;
    if (pointCount.current % 15 === 0) {
      navigator.vibrate?.(5);
      playSound('scissorTrace');
    }

    // Request redraw
    cancelAnimationFrame(animFrameId.current);
    animFrameId.current = requestAnimationFrame(draw);
  };

  const handleTouchEnd = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const points = lassoPoints.current;
    if (points.length <= 5) {
      // Too few points — cancel
      lassoPoints.current = [];
      draw();
      return;
    }

    // Auto-close: check proximity to start
    const start = points[0];
    const end = points[points.length - 1];
    const distToStart = Math.hypot(end.x - start.x, end.y - start.y);

    if (distToStart > 20) {
      // Close with straight line to start (add the start point to close)
      points.push({ ...start, jitter: points[points.length - 1].jitter });
    }

    // Heavy snip haptic + sound
    navigator.vibrate?.(30);
    playSound('scissorSnip');

    // Apply the cut
    applyCut(points);
  };
```

- [ ] **Step 2: Attach touch handlers to the canvas element**

Replace the `<canvas>` JSX in the return statement:

```tsx
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
```

- [ ] **Step 3: Add a placeholder `applyCut` function**

Add after `handleTouchEnd`, before the return statement:

```tsx
  const applyCut = (_points: LassoPoint[]) => {
    // TODO: Task 4 will implement the actual clipping
    lassoPoints.current = [];
    draw();
  };
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ScissorsCutView.tsx
git commit -m "feat: add lasso drawing gesture with velocity tracking"
```

---

### Task 4: Implement Image Clipping Logic

**Files:**
- Modify: `src/components/ScissorsCutView.tsx`

- [ ] **Step 1: Implement the `jaggedPath` function**

Add this as a module-level function above the component (after the imports):

```tsx
/** Add perpendicular noise to each path segment based on per-point jitter. */
function jaggedPath(points: LassoPoint[], sx: number, sy: number): Point[] {
  const scale = Math.max(sx, sy);
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const scaledJitter = curr.jitter * scale;
    const offset = (Math.random() - 0.5) * 2 * scaledJitter;
    result.push({ x: curr.x + nx * offset, y: curr.y + ny * offset });
  }
  return result;
}
```

- [ ] **Step 2: Replace the placeholder `applyCut` with the real implementation**

Replace the `applyCut` function:

```tsx
  const applyCut = (points: LassoPoint[]) => {
    const img = imgRef.current;
    if (!img) return;

    const displayRect = getImageDisplayRect();
    if (displayRect.width === 0) return;

    // Transform view-space lasso points to image-space coordinates
    const sx = img.naturalWidth / displayRect.width;
    const sy = img.naturalHeight / displayRect.height;

    const imageSpacePoints: LassoPoint[] = points.map(p => ({
      x: (p.x - displayRect.x) * sx,
      y: (p.y - displayRect.y) * sy,
      jitter: p.jitter,
    }));

    // Generate jagged path from smooth lasso + velocity-based jitter
    const jagged = jaggedPath(imageSpacePoints, sx, sy);

    // --- Inside piece (stays on canvas) ---
    const insideCanvas = document.createElement('canvas');
    insideCanvas.width = img.naturalWidth;
    insideCanvas.height = img.naturalHeight;
    const ictx = insideCanvas.getContext('2d')!;
    ictx.beginPath();
    jagged.forEach((p, i) => (i === 0 ? ictx.moveTo(p.x, p.y) : ictx.lineTo(p.x, p.y)));
    ictx.closePath();
    ictx.clip();
    ictx.drawImage(img, 0, 0);
    const insideImage = insideCanvas.toDataURL('image/png');

    // --- Outside piece (returns to drawer) ---
    const outsideCanvas = document.createElement('canvas');
    outsideCanvas.width = img.naturalWidth;
    outsideCanvas.height = img.naturalHeight;
    const octx = outsideCanvas.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'destination-out';
    octx.beginPath();
    jagged.forEach((p, i) => (i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)));
    octx.closePath();
    octx.fill();
    const outsideImage = outsideCanvas.toDataURL('image/png');

    // Clean up
    lassoPoints.current = [];

    onCut(insideImage, jagged, outsideImage);
  };
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ScissorsCutView.tsx
git commit -m "feat: implement image clipping with jagged edges"
```

---

### Task 5: Wire Scissors Button in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import for ScissorsCutView**

Add to the imports section (after the GlueAnimation import):

```tsx
import { ScissorsCutView } from './components/ScissorsCutView';
```

- [ ] **Step 2: Add scissorTarget state**

Add after the `glueToolRect` state declaration (line 45):

```tsx
  const [scissorTarget, setScissorTarget] = useState<Scrap | null>(null);
```

- [ ] **Step 3: Wire the scissors button onClick**

Replace the scissors button's `onClick={() => {}}` (line 337) with:

```tsx
onClick={() => {
  const scrap = currentPage.scraps.find(s => s.id === selectedScrapId);
  if (scrap) setScissorTarget(scrap);
}}
```

- [ ] **Step 4: Add the handleScissorCut callback**

Add after `handlePeel` (around line 265):

```tsx
  const handleScissorCut = (insideImage: string, insidePoints: Point[], outsideImage: string) => {
    if (!scissorTarget) return;
    // Update the scrap with clipped image and new points
    updateScrap(scissorTarget.id, {
      image: insideImage,
      points: insidePoints,
    });
    // Create RawMaterial from leftover and add to drawer
    setRawMaterials(prev => [
      { id: Math.random().toString(36).substr(2, 9), image: outsideImage },
      ...prev,
    ]);
    setScissorTarget(null);
    setSelectedScrapId(null);
  };
```

- [ ] **Step 5: Render ScissorsCutView modal**

Add inside the `<AnimatePresence mode="wait">` block (after the `activeTool === 'text'` block, around line 612):

```tsx
        {scissorTarget && (
          <motion.div
            key="scissors"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50"
          >
            <ScissorsCutView
              image={scissorTarget.image}
              onCut={handleScissorCut}
              onCancel={() => setScissorTarget(null)}
            />
          </motion.div>
        )}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/ScissorsCutView.tsx
git commit -m "feat: wire scissors button to ScissorsCutView modal"
```

---

### Task 6: Manual End-to-End Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the full scissors flow**

1. Open the app in a browser (or mobile viewport)
2. Drag a material from the drawer onto the canvas (or use an existing scrap)
3. Tap the scrap to select it — verify scissors and tear buttons animate in from the top
4. Tap the scissors button — verify the ScissorsCutView modal opens with the green cutting mat background and the scrap's image
5. Draw a lasso around part of the image with one finger — verify:
   - White dashed line follows your finger
   - Green start-point indicator at first point
   - Scissors emoji at the touch tip
   - Light ticks play every ~15 points
6. Lift your finger near the start point — verify:
   - "Snip" sound plays
   - Modal closes
   - Scrap on canvas now shows only the clipped region
   - The leftover piece appears in the material drawer
7. Draw slowly vs quickly — verify slow produces cleaner edges, fast produces more jagged

- [ ] **Step 3: Test edge cases**

1. Draw fewer than 5 points (tiny gesture) — should cancel, nothing happens
2. Lift finger far from start — should auto-close with straight line and still cut
3. Tap the ✕ close button — should cancel and return to canvas unchanged
4. Cut an already-cut scrap — should work (clips the already-clipped image)

- [ ] **Step 4: Commit any fixes**

If any issues are found, fix and commit with descriptive messages.
