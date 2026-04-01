# Page Flip — Cylindrical Curl Design Spec
**Date:** 2026-04-01
**Supersedes:** `2026-04-01-page-flip-design.md` (CSS rotateY rigid-board approach)

---

## Overview

Replace the current CSS `rotateY` rigid-board flip with a true cylindrical paper curl using `react-pageflip` (which wraps StPageFlip). The page bends and curves as it turns, exactly like real paper. The effect is interactive: the curl deforms in real-time as the user drags, and snaps forward or back on release.

The Konva canvas owns all pointer events in the page center. Flip gestures are captured exclusively by 30px edge-zone overlays, which forward synthetic `MouseEvent`s to the react-pageflip container — bypassing the gesture conflict entirely.

---

## Visual Character

- **Style:** Cylindrical paper curl rendered on HTML5 Canvas by StPageFlip
- **Shadow:** Native StPageFlip shadow (`drawShadow: true`, `maxShadowOpacity: 0.5`) — dynamic, organic, peaks mid-curl
- **Back face:** StPageFlip renders its own back face from page content (the kraft back-face PNG)
- **Physics:** StPageFlip's built-in spring/easing on snap-forward and snap-back
- **Interactive:** Curl deforms live as the user drags; threshold-based snap on release

---

## Architecture

### Layer Stack (inside `PageFlipContainer`)

```
z-index 4  │  Edge zone overlays (left 30px + right 30px) — own all pointer events
z-index 3  │  HTMLFlipBook container — pointer-events: none; receives synthetic events only
z-index 2  │  Current page Scrapbook — opacity 1 when idle, 0 when flipping
z-index 1  │  Adjacent page Scrapbook — pre-rendered, opacity 0; used only for snapshot
```

### State Machine

```
IDLE → FLIPPING → IDLE
```

- `IDLE`: Konva visible, react-pageflip hidden (`opacity: 0`, `visibility: hidden`)
- `FLIPPING`: Konva hidden, react-pageflip visible with PNG snapshots; pointer events forwarded from edge zones

---

## Konva Stage Ref Exposure

`Scrapbook.tsx` is updated to use `React.forwardRef` so `PageFlipContainer` can hold refs to both the current and adjacent Konva stages and call `stage.toDataURL()` synchronously on gesture start.

```tsx
export const Scrapbook = React.forwardRef<Konva.Stage, ScrapbookProps>((props, ref) => {
  return (
    <div className="w-full h-full">
      <Stage ref={ref} ...>
```

---

## react-pageflip Configuration

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
  style={{ opacity: flipState === 'flipping' ? 1 : 0, visibility: flipState === 'flipping' ? 'visible' : 'hidden', pointerEvents: 'none' }}
>
  <div><img src={prevPng} width={dimensions.width} height={dimensions.height} /></div>
  <div><img src={currentPng} width={dimensions.width} height={dimensions.height} /></div>
  <div><img src={nextPng} width={dimensions.width} height={dimensions.height} /></div>
</HTMLFlipBook>
```

Three pages are provided: `[prevPage, currentPage, nextPage]`. react-pageflip starts at index 1 (currentPage). A synthetic `mousedown` from the right edge triggers a forward flip; from the left edge triggers backward. When `prevPage` is null (first page), the left edge zone is disabled and `pages[0]` is omitted — react-pageflip is initialized with `[currentPage, nextPage]` starting at index 0.

For the "add page" end state: `nextPng` is a rasterized kraft-paper PNG matching `AddPageView` (off-screen canvas render).

---

## Gesture Delegation

### Handoff Sequence

1. User presses edge zone → `onPointerDown` fires on the overlay
2. `setPointerCapture` ensures all subsequent pointer events go to the overlay
3. **Synchronously snapshot** both stages: `stageRef.current.toDataURL()`
4. Set `flipState = 'flipping'` → Konva fades out, react-pageflip becomes visible
5. `requestAnimationFrame(() => forwardToFlipBook('mousedown', clientX, clientY))` — one frame delay ensures react-pageflip's container is rendered before the mousedown fires
6. On every `onPointerMove` from the overlay: `forwardToFlipBook('mousemove', clientX, clientY)`
7. On `onPointerUp`: `forwardToFlipBook('mouseup', clientX, clientY)`
8. react-pageflip animates snap-forward or snap-back

### Event Forwarding Helper

```tsx
const forwardToFlipBook = (type: string, clientX: number, clientY: number) => {
  flipContainerRef.current?.dispatchEvent(
    new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true })
  );
};
```

`dispatchEvent` bypasses `pointer-events: none` CSS and reaches react-pageflip's internal `addEventListener` listeners directly. StPageFlip does not check `event.isTrusted`.

### Synthetic Event Coordinates

- Right edge zone gesture: `mousedown` dispatched at `{ clientX: containerRight - 1, clientY: e.clientY }` — placing it at the right edge so react-pageflip starts a forward curl
- Left edge zone gesture: `mousedown` dispatched at `{ clientX: containerLeft + 1, clientY: e.clientY }` — placing it at the left edge for backward curl

---

## Flip Completion & Snap-back

### Forward/backward flip completed

react-pageflip fires `onFlip` with `e.data` = new page index (0 = went backward, 2 = went forward):

```tsx
onFlip={(e) => {
  const dir = e.data === 0 ? 'prev' : 'next';
  setFlipState('idle');
  onFlipComplete(dir);
}}
```

### Snap-back (user releases before threshold)

react-pageflip returns to page 1 without firing `onFlip`. We detect this via `onChangeState`:

```tsx
onChangeState={(e) => {
  if (e.data === 'read' && flipState === 'flipping') {
    setFlipState('idle');
  }
}}
```

---

## Snapshots

Both stage snapshots are captured synchronously at gesture start (`stage.toDataURL()` is synchronous on the Konva canvas). The adjacent page Scrapbook is always pre-rendered at z-index 1 (as in the existing implementation), so its stage is ready immediately.

**Kraft back face:** In portrait mode, StPageFlip renders the back of the flipping page from `pages[2]` (the nextPage PNG). This means the back face and the revealed page are the same image — which is correct: the back of the curling page and the page being revealed are both the next page. No separate back-face element is needed.

---

## `App.tsx` Changes

None. `PageFlipContainer`'s props interface is unchanged. All changes are internal to `PageFlipContainer.tsx` and `Scrapbook.tsx`.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/Scrapbook.tsx` | Add `React.forwardRef` to expose `Konva.Stage` ref |
| `src/components/PageFlipContainer.tsx` | Full rewrite: replace CSS rotateY + shadow with react-pageflip + synthetic delegation |
| `src/components/AddPageView.tsx` | No change needed — its DOM can be snapshotted via off-screen canvas if needed; kraft PNG is the fallback |
| `package.json` | Add `react-pageflip` dependency |

---

## Out of Scope

- Haptic feedback on snap
- Page turn sound effect
- Programmatic flip triggered by chevron buttons
- Multi-page book layout (landscape mode)
