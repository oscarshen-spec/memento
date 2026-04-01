# Page Flip Animation — Design Spec
**Date:** 2026-04-01

---

## Overview

Replace the current instant page-index change with a gesture-driven 3D book-flip animation. The right page rotates around the spine (left edge) to reveal the next page underneath; the left edge does the mirror operation to return to the previous page. Implementation uses CSS 3D transforms driven by Framer Motion `useMotionValue`, with no new dependencies.

---

## Visual Character

- **Style:** CSS 3D book flip — `rotateY` hinge at the spine, not a corner curl
- **Back face:** Blank kraft paper (`#f0e8d8`) — no mirrored content, no rendering overhead
- **Shadow:** Dynamic gradient overlay on the underlying page, opacity peaks at 90° rotation then fades
- **Physics:** Framer Motion spring (`stiffness: 260, damping: 28`) for both snap-forward and snap-back

---

## Architecture

### Layer Stack (inside `PageFlipContainer`)

```
z-index 4 │ EdgeZone overlays (left 30px + right 30px) — own all pointer events
z-index 3 │ Current page div (front face) + back-face sibling — rotates on flip
z-index 2 │ Shadow overlay div — opacity tied to flip progress
z-index 1 │ Next/prev page (pre-rendered <Scrapbook>, pointerEvents: none)
```

### New Component: `PageFlipContainer`

**File:** `src/components/PageFlipContainer.tsx`

**Props:**
```ts
interface PageFlipContainerProps {
  currentPage: ScrapbookPage;
  prevPage: ScrapbookPage | null;          // null → left zone disabled
  nextPage: ScrapbookPage | 'add-page';    // 'add-page' → render AddPageView behind flip
  onFlipComplete: (direction: 'prev' | 'next') => void;
  onFlipStart: () => void;
  onFlipEnd: () => void;
  dimensions: { width: number; height: number };
  // pass-through props to the inner <Scrapbook> (same shape as ScrapbookProps minus `page` and `dimensions`)
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  fallingScrapIds: string[] | null;
  onFallComplete: (ids: string[]) => void;
}
```

**Internal state machine:**
```
idle → dragging → snapping-forward | snapping-back → idle
```

`onFlipStart` / `onFlipEnd` surface `isFlipping` to App.tsx to disable canvas interactions.

### Changes to `App.tsx`

- Replace the `<div ref={bookPageRef} className="book-page">` + `<Scrapbook>` block with `<PageFlipContainer>`.
- Add `isFlipping` state: while `true`, pass `isGlueActive={false}` and `isTapeActive={false}` to the inner Scrapbook (the overlay's z-index already blocks pointer events, this is belt-and-suspenders).
- `handlePageTurn` remains unchanged — called from `onFlipComplete` after the animation settles. The existing falling-scraps guard still fires first.
- The `+` button in the top bar is kept as a secondary affordance alongside the gesture.

---

## Gesture Zones

Two transparent absolute-positioned divs, each 30px wide, full height, sitting above the Konva canvas:

| Zone | Position | Direction | Disabled when |
|------|----------|-----------|---------------|
| Right edge | `right: 0` | Drag left → next page | Never disabled — last page shows `AddPageView` behind the flip |
| Left edge | `left: 0` | Drag right → prev page | `currentPageIndex === 0` (no previous page) |

Both zones use native `onPointerDown/Move/Up` — no Framer `drag` prop, no Konva involvement.

---

## Motion Value Pipeline

```
Right-edge drag:
  dragX (0 → -pageWidth)
    → rotateY = (dragX / pageWidth) * -180        (clamped [0, -180])
    → shadowOpacity = min(|rotateY|, 180 - |rotateY|) / 90 * 0.45
    → backFaceVisible = rotateY < -90

Left-edge drag (mirror):
  dragX (0 → +pageWidth)
    → rotateY = (dragX / pageWidth) * 180         (clamped [0, +180])
    → transform-origin: right center
```

**CSS on the flipping page div:**
```css
transform-origin: left center;   /* right-edge flip */
perspective: 1200px;              /* on the parent */
transform-style: preserve-3d;
```

**Back face sibling:**
```css
position: absolute; inset: 0;
background: #f0e8d8;
transform: rotateY(180deg);
backface-visibility: hidden;
```

---

## Snap Thresholds

On `pointerUp`:
```
velocity = (lastX - prevX) / dt   [px/ms]

if (dragX < -pageWidth * 0.35 || velocity < -0.5)
  → animate rotateY to -180 → onFlipComplete('next')
else
  → animate rotateY back to 0 (snap back)
```

Both branches use:
```js
animate(rotateY, targetValue, { type: 'spring', stiffness: 260, damping: 28 })
```

---

## Shadow Overlay

A `div` positioned absolutely over the pre-rendered next/prev page (z-index 2):
```css
background: linear-gradient(to right, rgba(0,0,0,0.4), transparent);
pointer-events: none;
```
Opacity is a `useTransform` from the `rotateY` motion value — peaks at 90° and returns to 0 at 180°.

---

## End State: "No More Pages"

When `currentPageIndex === pages.length - 1`:
- The right-edge zone remains active
- The layer at z-index 1 renders `<AddPageView>` instead of a `<Scrapbook>`
- `AddPageView` is a centered kraft-paper div with a `+` icon and "Start a new page" label
- Completing the flip calls `addPage()` then `setCurrentPageIndex(pages.length)` (the new page)

When `currentPageIndex === 0`:
- The left-edge zone is disabled (no previous page exists)

---

## Out of Scope

- Programmatic flip triggered by chevron buttons (easy future extension — fire `animate()` at full velocity)
- Haptic feedback on snap (could add `navigator.vibrate` call on snap completion)
- Page turn sound effect (would hook into `scissors_snip.wav` infrastructure when sounds are added)
