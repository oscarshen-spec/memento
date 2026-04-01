# Scissors Cut Tool — Design Spec

## Context

The scrapbook app currently only supports two-finger tearing in the CuttingRoom. The PRD specifies a "Trace-to-Cut" feature (single-finger lasso) as a core cutting method. A Swift reference implementation (`applyScissorCut()`) demonstrates the target behavior: draw a freeform lasso around part of an image, clip to that polygon with natural jagged edges, and discard or repurpose the remainder.

This spec adds a scissors tool that works on selected scraps via a focused modal view, producing a clipped inside piece (stays on canvas) and an outside piece (returns to the material drawer).

---

## User Flow

1. **Select scissors** — Tap ✂️ in the canvas toolbar (mutual exclusion with tape/text/glue)
2. **Tap a scrap** — With scissors active, tapping any scrap opens the ScissorsCutView modal
3. **Draw lasso** — Single-finger trace around the region to keep. Dashed white line follows the finger. Scissors emoji at the touch tip. Light haptic ticks every ~15 points.
4. **Auto-close & cut** — Lifting the finger near the start point (≤20px) auto-closes the path. If far from start but >5 points, a straight line closes it. If ≤5 points, the gesture is cancelled. Heavy "snip" haptic on commit.
5. **Result** — Inside piece replaces the scrap on canvas (with `points[]` for torn-edge rendering). Outside piece becomes a new `RawMaterial` in the drawer. Modal closes automatically.

---

## Component: ScissorsCutView

New file: `src/components/ScissorsCutView.tsx`

### Props

```typescript
interface ScissorsCutViewProps {
  image: string              // source image URL (the scrap's current image)
  existingPoints: Point[]    // if scrap was already cut, its current polygon (used only for visual preview — the image already has prior cuts baked in, so the new lasso clips the already-clipped image)
  onCut: (insideImage: string, insidePoints: Point[], outsideImage: string) => void
  onCancel: () => void
}
```

### Internal State

- `lassoPoints: Point[]` — accumulated touch points
- `velocitySamples: { time: number, pos: Point }[]` — rolling window of last 10 samples
- `isNearStart: boolean` — whether finger is within 20px of the first point
- `scissorTip: Point | null` — current touch position for scissors icon

### Visual Design

- **Background**: Green cutting mat with subtle grid lines (`#2a5a3a` base, repeating 20px grid at 5% white opacity)
- **Image**: Centered and scaled to fit with padding, maintaining aspect ratio
- **Lasso path**: White dashed line (`stroke-dasharray: 6,4`), 2px width
- **Start indicator**: Green circle (`#00ff88`) at first point, with 20px snap ring
- **Scissors cursor**: ✂️ emoji at current touch position
- **Close button**: Top-left, circular, semi-transparent black with ✕
- **Instruction**: Bottom-center, "Trace around what you want to keep", 50% white opacity

---

## Lasso Gesture State Machine

```
idle → drawing → committed
              → cancelled (< 5 points or too small)
```

### Touch Events

**Touch Start:**
- Record first point as anchor
- Begin velocity tracking (timestamp + position)
- Show scissors icon at touch point

**Touch Move:**
- Add point to `lassoPoints[]` with minimum 3px spacing (prevents density issues)
- Record timestamp for velocity calculation
- Draw dashed line segment from previous point
- Check proximity to start: if ≤20px, set `isNearStart = true` and show snap indicator
- Play haptic tick every ~15 new points

**Touch End:**
- If within 20px of start AND `lassoPoints.length > 5` → auto-close → apply cut
- If far from start AND `lassoPoints.length > 5` → close with straight line to start → apply cut
- If `lassoPoints.length ≤ 5` → cancel (gesture too small)

---

## Velocity-Based Edge Wobble

The cut edge wobble is proportional to drawing speed — slow and careful produces cleaner edges, fast and rushed produces more jagged edges.

### Speed Tracking

```typescript
// Rolling window of last 10 position+timestamp samples
speed = distance(prevPoint, currPoint) / (currTime - prevTime)  // px/ms
avgSpeed = average(recentSpeeds)
```

### Jitter Mapping

Per-point jitter — each lasso point gets its own jitter radius based on the drawing speed at that moment. The `jaggedPath` function accepts an array of jitter values (one per point), not a single global value.

```typescript
// For each point during touch move, compute and store its jitter:
jitterForPoint = clamp(
  0.5 + (instantSpeed - 0.3) * 2.5,   // jitterScale = 2.5
  min: 0.5,   // always some imperfection (no pixel-perfect cuts)
  max: 4.0    // maximum wobble at high speed
)
// Store alongside the point: { x, y, jitter }

// Scale to image resolution (from Swift reference):
scaledJitter = jitterForPoint * Math.max(sx, sy)
```

---

## Image Clipping (ported from Swift `applyScissorCut`)

### Step 1: Coordinate Transform

Transform view-space lasso points to image-space coordinates:

```typescript
const rect = imageDisplayRect(imageSize, canvasSize)
const sx = image.naturalWidth / rect.width
const sy = image.naturalHeight / rect.height

const imagePoints = lassoPoints.map(p => ({
  x: (p.x - rect.x) * sx,
  y: (p.y - rect.y) * sy
}))
```

### Step 2: Jagged Path Generation

Add perpendicular noise to each path segment. Each point carries its own jitter radius from the velocity tracking phase:

```typescript
function jaggedPath(points: { x: number; y: number; jitter: number }[]): Point[] {
  const result: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const curr = points[i]
    const next = points[(i + 1) % points.length]
    const dx = next.x - curr.x, dy = next.y - curr.y
    const len = Math.hypot(dx, dy)
    if (len === 0) continue
    const nx = -dy / len, ny = dx / len
    const offset = (Math.random() - 0.5) * 2 * curr.jitter
    result.push({ x: curr.x + nx * offset, y: curr.y + ny * offset })
  }
  return result
}
```

### Step 3: Canvas Clip — Inside Piece

```typescript
const insideCanvas = document.createElement('canvas')
insideCanvas.width = image.naturalWidth
insideCanvas.height = image.naturalHeight
const ctx = insideCanvas.getContext('2d')!
ctx.beginPath()
jaggedPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
ctx.closePath()
ctx.clip()
ctx.drawImage(sourceImage, 0, 0)
// → toDataURL() for the new scrap image
```

### Step 4: Canvas Clip — Outside Piece

```typescript
const outsideCanvas = document.createElement('canvas')
outsideCanvas.width = image.naturalWidth
outsideCanvas.height = image.naturalHeight
const octx = outsideCanvas.getContext('2d')!
octx.drawImage(sourceImage, 0, 0)
octx.globalCompositeOperation = 'destination-out'
octx.beginPath()
jaggedPoints.forEach((p, i) => i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y))
octx.closePath()
octx.fill()
// → toDataURL() for the new RawMaterial
```

The clipping runs in an async task to avoid blocking the UI (matching Swift's `Task.detached`).

---

## App.tsx Integration

### State Changes

```typescript
// Extend activeTool type
activeTool: 'scissors' | 'tape' | 'text' | 'glue' | null

// New state
scissorTarget: Scrap | null   // which scrap is being cut
```

### Toolbar

Add ✂️ button alongside existing tape/text/glue buttons. Selecting scissors deselects other tools (mutual exclusion — same as existing tool switching).

### Callbacks

```typescript
// When scissors active and user taps a scrap in Scrapbook
handleScrapTapForScissors(scrap: Scrap) {
  setScissorTarget(scrap)
}

// When ScissorsCutView completes
handleScissorCut(insideImage: string, insidePoints: Point[], outsideImage: string) {
  // Update scrap with clipped image and new points
  updateScrap(scissorTarget.id, {
    image: insideImage,
    points: insidePoints
  })
  // Create RawMaterial from leftover
  addRawMaterial({ id: nanoid(), image: outsideImage })
  // Close modal
  setScissorTarget(null)
}

// Cancel
handleScissorCancel() {
  setScissorTarget(null)
}
```

### Scrapbook Component

When `activeTool === 'scissors'`, scrap tap behavior changes from "select for transform" to "open ScissorsCutView". This is handled by passing a callback prop that checks the active tool.

---

## Sound Design

Two new sounds added to `src/services/soundService.ts`:

| Sound | Trigger | Synthesis |
|-------|---------|-----------|
| `scissorTrace` | Every ~15 lasso points | High-pass filtered click at 3000Hz, ~30ms |
| `scissorSnip` | On cut commit | Two overlapping metallic clicks (like scissor blades), ~100ms |

Reuse existing `paperRustle` for cancel.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/ScissorsCutView.tsx` | **Create** — new modal component |
| `src/App.tsx` | **Modify** — add scissors tool state, toolbar button, callbacks |
| `src/components/Scrapbook.tsx` | **Modify** — handle scissors-mode tap on scraps |
| `src/services/soundService.ts` | **Modify** — add `scissorTrace` and `scissorSnip` sounds |
| `src/types.ts` | No changes needed — existing `Point[]` and `Scrap` types are sufficient |

---

## Verification

1. **Lasso drawing**: Open scissors tool, tap a scrap, draw a lasso — verify dashed line follows finger with scissors cursor
2. **Auto-close**: Lift finger near start point — verify path closes and cut triggers
3. **Edge wobble**: Draw slowly vs quickly — verify slow = cleaner edges, fast = more jagged
4. **Inside piece**: Verify clipped scrap appears on canvas with correct torn-edge rendering
5. **Outside piece**: Verify leftover appears in the material drawer as a new RawMaterial
6. **Sound**: Verify tick sounds during trace and snip sound on commit
7. **Cancel**: Tap close button or draw too few points — verify nothing changes
8. **Re-cut**: Cut an already-cut scrap — verify the existing points are respected
