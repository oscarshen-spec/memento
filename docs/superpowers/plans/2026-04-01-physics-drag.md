# Physics-Based Drag Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add physics-based lift, velocity-driven tilt/skew, and spring-release animation to draggable scraps in the scrapbook canvas.

**Architecture:** All changes are in the `ScrapItem` component in `src/components/Scrapbook.tsx`. Visual effects are applied imperatively via `node.setAttrs()` during drag to avoid React re-renders. React state is synced only once, in the Tween's `onFinish` callback.

**Tech Stack:** react-konva, konva (Tween + Easings), Web Vibration API

---

### Task 1: Add Konva import and new refs to ScrapItem

**Files:**
- Modify: `src/components/Scrapbook.tsx` (top of file + inside `ScrapItem`)

- [ ] **Step 1: Add the Konva default import at the top of the file**

The file currently has:
```tsx
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
```

Add this line directly after it:
```tsx
import Konva from 'konva';
```

- [ ] **Step 2: Add four new refs inside ScrapItem, after the existing refs**

The existing refs end at:
```tsx
const wasPinching = useRef(false);
```

Add after that line:
```tsx
const lastDragPos = useRef<{ x: number; y: number; t: number } | null>(null);
const velocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
const baseRotation = useRef<number>(scrap.rotation);
const activeTween = useRef<Konva.Tween | null>(null);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npm run lint
```

Expected: no errors. If you see "Cannot find module 'konva'", it's already bundled with react-konva — check that `import Konva from 'konva'` is at the top level of the file (not inside a component).

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: add velocity/tween refs for physics drag in ScrapItem"
```

---

### Task 2: Replace Rect-based shadow with native Konva Group shadow

**Files:**
- Modify: `src/components/Scrapbook.tsx` (ScrapItem render)

The current shadow is a static `Rect` (rect path) or a static `Shape` (custom path), neither of which supports blur. We replace both with Konva's native shadow props on the `Group`, which support animated blur.

- [ ] **Step 1: Remove the shadow Rect from the isRect branch**

Find this block inside the `isRect ? (` branch and delete it:
```tsx
{image && (
  <Rect
    x={4}
    y={4}
    width={image.width}
    height={image.height}
    fill="rgba(0,0,0,0.2)"
    listening={false}
  />
)}
```

- [ ] **Step 2: Remove the shadow Shape from the non-rect branch**

Find this block (the first `<Shape>` in the non-rect branch) and delete it:
```tsx
<Shape
  sceneFunc={(ctx, shape) => {
    drawJaggedPath(ctx, scrap.points);
    ctx.fillStrokeShape(shape);
  }}
  fill="rgba(0,0,0,0.2)"
  offsetX={-4}
  offsetY={4}
  listening={false}
/>
```

- [ ] **Step 3: Add native shadow props to the Group**

The `<Group` opening tag currently looks like:
```tsx
<Group
  draggable={!scrap.isGlued}
  x={scrap.x}
  y={scrap.y}
  rotation={scrap.rotation}
  scaleX={scrap.scale}
  scaleY={scrap.scale}
  onClick={onSelect}
  onTap={handleTap}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
```

Add these four props after `scaleY={scrap.scale}`:
```tsx
  shadowColor="rgba(0,0,0,0.35)"
  shadowBlur={4}
  shadowOffsetX={0}
  shadowOffsetY={3}
```

- [ ] **Step 4: Verify visually**

Run `npm run dev`, open the app, add a scrap to the page. Confirm it has a soft blurred shadow instead of the previous hard-edge Rect shadow. Both rect and custom-path scraps should show the shadow.

- [ ] **Step 5: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: replace Rect shadow with native Konva Group shadow"
```

---

### Task 3: Add drag start handler (lift + haptic tick)

**Files:**
- Modify: `src/components/Scrapbook.tsx` (ScrapItem)

- [ ] **Step 1: Write the handleDragStart function**

Add this function inside `ScrapItem`, after `handleTap`:
```tsx
const handleDragStart = (e: any) => {
  const node = e.target;
  baseRotation.current = scrap.rotation;
  velocity.current = { vx: 0, vy: 0 };
  lastDragPos.current = { x: node.x(), y: node.y(), t: Date.now() };
  activeTween.current?.destroy();
  activeTween.current = null;
  node.setAttrs({ shadowBlur: 12, shadowOffsetY: 8, shadowOffsetX: 0 });
  navigator.vibrate?.(10);
};
```

- [ ] **Step 2: Wire it to the Group**

Add `onDragStart={handleDragStart}` to the `<Group` props, after `onTouchEnd={handleTouchEnd}`:
```tsx
  onDragStart={handleDragStart}
```

- [ ] **Step 3: Verify visually**

Run the dev server, drag a scrap. The shadow should visibly grow (more blur, more offset) the moment you begin dragging. On a phone, you should feel a faint tick vibration.

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: add drag start lift effect and haptic tick"
```

---

### Task 4: Add drag move handler (velocity tracking + live visual derivation)

**Files:**
- Modify: `src/components/Scrapbook.tsx` (ScrapItem)

- [ ] **Step 1: Write the handleDragMove function**

Add this function inside `ScrapItem`, after `handleDragStart`:
```tsx
const handleDragMove = (e: any) => {
  const node = e.target;
  const now = Date.now();
  const x = node.x();
  const y = node.y();

  if (lastDragPos.current) {
    const dt = now - lastDragPos.current.t;
    if (dt > 0) {
      velocity.current = {
        vx: (x - lastDragPos.current.x) / dt,
        vy: (y - lastDragPos.current.y) / dt,
      };
    }
  }
  lastDragPos.current = { x, y, t: now };

  const { vx, vy } = velocity.current;
  const speed = Math.min(Math.sqrt(vx * vx + vy * vy), 40);

  node.setAttrs({
    shadowBlur: 8 + speed * 0.5,
    shadowOffsetY: 6 + speed * 0.3,
    shadowOffsetX: vx * 0.15,
    skewX: vx * 0.012,
    rotation: baseRotation.current + vx * 0.04,
  });
};
```

- [ ] **Step 2: Wire it to the Group**

Add `onDragMove={handleDragMove}` to the `<Group` props, after `onDragStart={handleDragStart}`:
```tsx
  onDragMove={handleDragMove}
```

- [ ] **Step 3: Verify visually**

Run the dev server. Drag a scrap quickly left and right. You should see:
- Shadow shifts sideways in the direction of drag
- Scrap leans (skews and rotates) slightly in the direction of horizontal motion
- Fast drag = larger shadow; slow drag = smaller shadow
- Shadow blur and skew reset somewhat when you slow down mid-drag

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: add velocity-driven tilt and shadow during drag"
```

---

### Task 5: Update drag end handler (spring return + haptic thud)

**Files:**
- Modify: `src/components/Scrapbook.tsx` (ScrapItem — existing `onDragEnd`)

- [ ] **Step 1: Replace the existing onDragEnd handler on the Group**

The current handler is:
```tsx
onDragEnd={(e) => {
  const y = e.target.y();
  if (y > stageHeight) {
    onReturn();
  } else {
    onChange({ x: e.target.x(), y });
  }
}}
```

Replace it entirely with:
```tsx
onDragEnd={(e) => {
  const node = e.target;
  const x = node.x();
  const y = node.y();

  if (y > stageHeight) {
    node.setAttrs({
      shadowBlur: 4,
      shadowOffsetY: 3,
      shadowOffsetX: 0,
      skewX: 0,
      rotation: baseRotation.current,
    });
    onReturn();
    return;
  }

  activeTween.current?.destroy();

  const tween = new Konva.Tween({
    node,
    duration: 0.5,
    easing: Konva.Easings.ElasticEaseOut,
    shadowBlur: 4,
    shadowOffsetY: 3,
    shadowOffsetX: 0,
    skewX: 0,
    rotation: baseRotation.current,
    onFinish: () => {
      onChange({ x: node.x(), y: node.y(), rotation: baseRotation.current });
      activeTween.current = null;
    },
  });

  tween.play();
  activeTween.current = tween;
  navigator.vibrate?.(30);
}}
```

- [ ] **Step 2: Verify the spring animation**

Run the dev server. Drag a scrap and release it. You should see:
- Shadow smoothly shrinks back to a small soft shadow
- Scrap skew and rotation lean spring back with a slight elastic overshoot
- On a phone, you should feel a heavier thud vibration on release

- [ ] **Step 3: Verify the return-to-drawer path**

Drag a scrap down off the bottom edge of the canvas. It should still return to the drawer (no spring animation fires, visuals reset immediately).

- [ ] **Step 4: Verify rapid re-grab**

While the spring is playing, grab the scrap again and start dragging. The spring should stop immediately and the lift effect should kick in. No leftover skew or shadow from the previous tween.

- [ ] **Step 5: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: add spring release animation and haptic thud on drop"
```

---

## Self-Review

**Spec coverage:**
- ✓ Lift on pickup (shadowBlur 4→12 on dragStart) — Task 3
- ✓ Trailing rotation during drag (`baseRotation + vx * 0.04`) — Task 4
- ✓ 3D tilt via skewX based on velocity — Task 4
- ✓ Shadow blur/offset vary with speed — Task 4
- ✓ Spring animation on release (ElasticEaseOut Tween) — Task 5
- ✓ Haptic tick on grab, thud on release — Tasks 3 & 5
- ✓ Return-to-drawer path resets visuals without spring — Task 5
- ✓ Rapid re-grab kills in-flight tween — Tasks 3 & 5
- ✓ Glued scraps unaffected (draggable={!scrap.isGlued} unchanged)

**Placeholder scan:** None found.

**Type consistency:**
- `activeTween` typed as `Konva.Tween | null` — matches `new Konva.Tween(...)` in Task 5
- `lastDragPos` typed as `{ x, y, t } | null` — fields used consistently in Tasks 3 & 4
- `baseRotation.current` (number) — set in Task 3, read in Tasks 4 & 5 ✓
