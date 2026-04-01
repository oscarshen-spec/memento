# Tape Feature Design

**Date:** 2026-03-31
**Status:** Approved

---

## Overview

Add a masking tape tool to the scrapbook canvas. Users activate it via a toolbar icon, swipe to place a straight tape strip at any angle, and tear the tape by swiping in a direction that deviates significantly from the tape's axis.

---

## Visual Appearance

**Tape style:** Masking tape — cream/beige (~`rgba(240,225,190,0.88)`), matte, slightly translucent, 28px wide.

**Texture:** Subtle paper grain via repeating diagonal lines or an SVG filter overlay.

**Left end (start):** Torn appearance — randomized gentle zigzag.

**Right end (tear point):** Organic jagged tear with small fiber wisps extending outward. The exact jag pattern is seeded from `tearSeed` so it is stable across re-renders.

**Shadow:** Very low-offset, low-blur drop shadow (flat against page, not lifted).

**In-progress preview:** Same visual but at ~50% opacity, rendered live as the user drags.

---

## Interaction

### Activating tape mode
- Tape roll SVG icon added to the top bar in `App.tsx`, after the existing tools.
- Click/tap toggles `activeTool` state between `'tape'` and `null`.
- Active state shown with a small underline dot beneath the icon.
- While tape mode is active, normal scrap selection/dragging is disabled on the canvas.

### Placing a strip
1. `pointerdown` on the canvas records `startPoint`.
2. `pointermove` computes the current direction vector from `startPoint` to cursor. Renders a live preview strip.
3. The strip always renders as a straight line from `startPoint` to `currentPoint`, at the natural angle of the swipe.

### Tearing (ending the strip)
Tear is triggered when **either**:
- `pointerup` fires (user lifts finger/mouse) — finalizes strip at current cursor position.
- The movement vector deviates more than ~70° from the original tape direction:
  `dot(normalize(currentMovement), normalize(tapeDirection)) < 0.34`
  This covers both a full reversal (180°) and a perpendicular swipe (90°) to the tape axis.

When tear fires:
- Strip is locked at the current cursor position.
- Torn end is rendered with the organic jagged path + fiber wisps.
- `onStripAdded(strip)` callback fires, lifting the new strip into `ScrapbookPage` state.
- Tape mode remains active so the user can place another strip immediately.

---

## Data Model

### New type in `types.ts`

```ts
export interface TapeStrip {
  id: string;
  startPoint: Point;
  endPoint: Point;
  width: number;      // fixed at 28
  tearSeed: number;   // random float, seeded at creation, used for deterministic jagged edges
}
```

### Updated `ScrapbookPage`

```ts
export interface ScrapbookPage {
  id: string;
  scraps: Scrap[];
  journalEntries: JournalEntry[];
  tapeStrips: TapeStrip[];   // new
  background: string;
}
```

---

## Component Architecture

### New: `src/components/TapeLayer.tsx`

A Konva `<Layer>` component.

**Props:**
```ts
interface TapeLayerProps {
  isActive: boolean;
  strips: TapeStrip[];
  onStripAdded: (strip: TapeStrip) => void;
  stageWidth: number;
  stageHeight: number;
}
```

**Responsibilities:**
- Renders all existing `strips` as finalized masking tape visuals.
- When `isActive`, listens to `onMouseDown`/`onTouchStart`, `onMouseMove`/`onTouchMove`, `onMouseUp`/`onTouchEnd` on a transparent full-canvas `Rect` hit target.
- Manages `inProgress` local state: `{ startPoint, currentPoint, tapeDirection }`.
- Computes tear condition on each `pointermove`.
- On tear or `pointerup`: generates `tearSeed`, calls `onStripAdded`.

**Rendering helpers (internal):**
- `drawTapeBody(ctx, start, end, width)` — fills the cream rectangle.
- `drawTornEnd(ctx, point, angle, seed, side)` — draws the jagged torn end using `seed` for deterministic randomness.
- `drawFiberWisps(ctx, tearPoint, angle, seed)` — draws 3–5 short fiber lines at the tear end.

### Changes to `src/components/Scrapbook.tsx`

- Import and mount `<TapeLayer>` as a new `<Layer>` above the scraps layer.
- Pass `isActive`, `strips={page.tapeStrips}`, `onStripAdded`.
- When `isActive` is true, disable `draggable` and pointer events on the scraps layer (pass `listening={false}` to the scraps layer).

### Changes to `src/App.tsx`

- Add `activeTool: 'tape' | null` state (default `null`).
- Render tape roll SVG icon in the top bar. Toggle `activeTool` on click.
- Pass `activeTool === 'tape'` as `isTapeActive` to `<Scrapbook>`.
- Add `handleAddTapeStrip(strip: TapeStrip)` that appends to `pages[currentPageIndex].tapeStrips`.
- Initialize `INITIAL_PAGE` with `tapeStrips: []`.

### Changes to `src/types.ts`

- Add `TapeStrip` interface.
- Add `tapeStrips: TapeStrip[]` to `ScrapbookPage`.

---

## Tape Roll Icon

SVG drawn inline — a circle (roll cross-section) with concentric rings and a small pull-tab extending from the edge. No external icon library dependency.

---

## Out of Scope

- Coloring or width variants for the tape (single masking tape style only).
- Removing individual tape strips after placement.
- Tape persisting to localStorage (follows whatever auto-save strategy the app adds later).
