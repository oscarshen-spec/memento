# Page Flip — Cylindrical Curl Design Spec
**Date:** 2026-04-01
**Supersedes:** `2026-04-01-page-flip-design.md` (CSS rotateY rigid-board approach)

---

## Overview

Replace the current CSS `rotateY` rigid-board flip with a true cylindrical paper curl using `react-pageflip` (which wraps StPageFlip). The page bends and curves as it turns, exactly like real paper. The effect is interactive: the curl deforms in real-time as the user drags, and snaps forward or back on release.

The Konva canvas owns all pointer events in the page center. Flip gestures are captured exclusively by 30px edge-zone overlays, which forward synthetic events to the react-pageflip container — bypassing the gesture conflict entirely.

---

## Visual Character

- **Style:** Cylindrical paper curl rendered on HTML5 Canvas by StPageFlip
- **Shadow:** Native StPageFlip shadow (`drawShadow: true`, `maxShadowOpacity: 0.5`) — dynamic, organic, peaks mid-curl
- **Back face:** A dedicated kraft paper `<div>` (`#f0e8d8`) — always blank, never shows page content
- **Physics:** StPageFlip's built-in spring/easing on snap-forward and snap-back
- **Interactive:** Curl deforms live as the user drags; threshold-based snap on release

---

## Architecture

### Layer Stack (inside `PageFlipContainer`)

```
z-index 4  │  Edge zone overlays (left 30px + right 30px) — own all pointer events
z-index 3  │  HTMLFlipBook — pointer-events: none; receives synthetic events only
             │  Contains: [currentPagePng, kraftPage] (forward) or [kraftPage, currentPagePng] (backward)
z-index 2  │  Static adjacent page <img> (nextPng or prevPng) — revealed underneath the curl
z-index 1  │  Current page Scrapbook — opacity 1 when idle, 0 when flipping
             │  Adjacent page Scrapbook — opacity 0, pre-rendered for snapshot only
```

### State Machine

```
IDLE → FLIPPING → IDLE
```

- `IDLE`: Konva visible, react-pageflip and static adjacent img hidden
- `FLIPPING`: Konva hidden, react-pageflip + static adjacent img visible; pointer events forwarded from edge zones

---

## Snapshot Caching (Fix: no blocking on gesture start)

`stage.toDataURL()` on a complex Konva scene can block the main thread for 50–200ms. Calling it on `onPointerDown` causes a visible stutter before the curl starts. Instead, snapshots are pre-cached.

`PageFlipContainer` maintains `currentPageSnapshot: string | null` and `adjacentPageSnapshot: string | null` in state. These are updated via a debounced effect:

```tsx
// Re-snapshot 500ms after any page content change, after Konva has rendered
useEffect(() => {
  const timeout = setTimeout(() => {
    const png = currentStageRef.current?.toDataURL() ?? null;
    setCurrentSnapshot(png);
  }, 500);
  return () => clearTimeout(timeout);
}, [currentPage]); // fires on every immutable page update

useEffect(() => {
  const timeout = setTimeout(() => {
    const png = adjacentStageRef.current?.toDataURL() ?? null;
    setAdjacentSnapshot(png);
  }, 500);
  return () => clearTimeout(timeout);
}, [adjacentPage]);
```

On `onPointerDown`, both snapshots already exist in state. The transition to `FLIPPING` is instantaneous — no computation, no stutter.

**Initial snapshot:** Each snapshot is also taken on first mount (and on `currentPage.id` change) via a separate `useEffect` with `requestAnimationFrame` to allow Konva's first render to complete.

---

## Konva Stage Ref Exposure

`Scrapbook.tsx` is updated to use `React.forwardRef` to expose its `Konva.Stage` ref:

```tsx
export const Scrapbook = React.forwardRef<Konva.Stage, ScrapbookProps>((props, ref) => {
  return (
    <div className="w-full h-full">
      <Stage ref={ref} width={...} height={...} ...>
```

`PageFlipContainer` holds two forwarded refs: `currentStageRef` and `adjacentStageRef` (the latter pointing to the off-screen pre-rendered adjacent Scrapbook).

---

## react-pageflip Page Model (Fix: correct back face)

StPageFlip in portrait mode renders the back of a flipping page from the *next item* in its pages array. To ensure the back face is always blank kraft paper — never a copy of the next page content — StPageFlip is given only **two pages**:

**Forward flip:** `[currentPagePng, kraftPage]`, starting at index 0
- Page curls from index 0 (current) → back face is index 1 (kraft) ✓
- Next page content is shown as a separate static `<img>` at z-index 2 (below the flip)

**Backward flip:** `[kraftPage, currentPagePng]`, starting at index 1
- Page curls from index 1 (current) → back face is index 0 (kraft) ✓
- Prev page content is shown as a separate static `<img>` at z-index 2 (below the flip)

The `flipDir` set at gesture start ('next' | 'prev') determines which configuration to mount.

```tsx
<HTMLFlipBook
  ref={flipBookRef}
  width={dimensions.width}
  height={dimensions.height}
  size="fixed"
  usePortrait={true}
  useMouseEvents={true}
  drawShadow={true}
  maxShadowOpacity={0.5}
  showCover={false}
  flippingTime={700}
  style={{
    position: 'absolute', inset: 0,
    opacity: flipState === 'flipping' ? 1 : 0,
    visibility: flipState === 'flipping' ? 'visible' : 'hidden',
    pointerEvents: 'none',
  }}
>
  {flipDir === 'next'
    ? [
        <div key="current"><img src={currentSnapshot} width={w} height={h} /></div>,
        <div key="kraft" style={{ background: '#f0e8d8', width: w, height: h }} />,
      ]
    : [
        <div key="kraft" style={{ background: '#f0e8d8', width: w, height: h }} />,
        <div key="current"><img src={currentSnapshot} width={w} height={h} /></div>,
      ]
  }
</HTMLFlipBook>
```

For the "add page" end state: the static `<img>` at z-index 2 is replaced with an `AddPageView` component.

---

## Gesture Delegation

### Handoff Sequence

1. User presses edge zone → `onPointerDown` fires on the overlay
2. `setPointerCapture` ensures all subsequent pointer events go to the overlay
3. Set `flipDir` ('next' | 'prev') and `flipState = 'flipping'`
4. Pre-cached snapshots are already in state — no computation needed
5. `requestAnimationFrame(() => forwardToFlipBook('down', e))` — one frame ensures the react-pageflip container is rendered and visible before the first event fires
6. On every `onPointerMove`: `forwardToFlipBook('move', e)`
7. On `onPointerUp`: `forwardToFlipBook('up', e)`
8. react-pageflip animates snap-forward or snap-back

### Event Forwarding Helper (Fix: mobile support)

`dispatchEvent` bypasses `pointer-events: none` and reaches StPageFlip's internal listeners. StPageFlip listens to both `mouse*` and `touch*` events. We dispatch based on `e.pointerType`:

```tsx
const forwardToFlipBook = (phase: 'down' | 'move' | 'up', e: React.PointerEvent) => {
  const el = flipContainerRef.current;
  if (!el) return;

  if (e.pointerType === 'touch') {
    // Dispatch TouchEvent for mobile — StPageFlip uses touch velocity for physics
    const touchEventType =
      phase === 'down' ? 'touchstart' : phase === 'move' ? 'touchmove' : 'touchend';
    const touch = new Touch({
      identifier: e.pointerId,
      target: el,
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      screenX: e.screenX,
      screenY: e.screenY,
      radiusX: e.width / 2,
      radiusY: e.height / 2,
    });
    el.dispatchEvent(new TouchEvent(touchEventType, {
      changedTouches: [touch],
      touches: phase === 'up' ? [] : [touch],
      bubbles: true,
      cancelable: true,
    }));
  } else {
    // Dispatch MouseEvent for mouse and stylus
    const mouseEventType =
      phase === 'down' ? 'mousedown' : phase === 'move' ? 'mousemove' : 'mouseup';
    el.dispatchEvent(new MouseEvent(mouseEventType, {
      clientX: e.clientX,
      clientY: e.clientY,
      bubbles: true,
      cancelable: true,
    }));
  }
};
```

### Synthetic Event Coordinates for Corner Detection

StPageFlip detects which corner to curl from based on where the `mousedown`/`touchstart` lands relative to its container:

- Right edge gesture (forward flip): `mousedown` coordinates are the actual pointer position (on the right edge) — StPageFlip correctly identifies right corner → forward curl
- Left edge gesture (backward flip): `mousedown` coordinates are the actual pointer position (on the left edge) → left corner → backward curl

No coordinate adjustment needed: the pointer's real position is already at the correct edge.

---

## Flip Completion & Snap-back

### Forward/backward flip completed

StPageFlip fires `onFlip` when the page settles. Since StPageFlip is configured with exactly 2 pages and we track `flipDir` ourselves, we don't need to inspect `e.data` to determine direction:

```tsx
onFlip={() => {
  setFlipState('idle');
  onFlipComplete(flipDir!);
}}
```

### Snap-back (user releases before threshold)

StPageFlip returns to the starting page without firing `onFlip`. We detect idle via `onChangeState`:

```tsx
onChangeState={(e) => {
  if (e.data === 'read' && flipState === 'flipping') {
    setFlipState('idle');
  }
}}
```

---

## `App.tsx` Changes

None. `PageFlipContainer`'s props interface is unchanged. All changes are internal to `PageFlipContainer.tsx` and `Scrapbook.tsx`.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/Scrapbook.tsx` | Add `React.forwardRef` to expose `Konva.Stage` ref |
| `src/components/PageFlipContainer.tsx` | Full rewrite: replace CSS rotateY + shadow with react-pageflip + synthetic delegation + snapshot caching |
| `package.json` | Add `react-pageflip` dependency |

---

## Out of Scope

- Haptic feedback on snap
- Page turn sound effect
- Programmatic flip triggered by chevron buttons
- Multi-page book layout (landscape mode)
