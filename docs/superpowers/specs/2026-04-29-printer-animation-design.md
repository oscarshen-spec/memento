# Printer Printing Animation — Design Spec

## Overview

When the user taps the printer button, the canvas image is captured immediately and a paper-printing animation plays in-place: the image slides out from the printer's paper slot (sandwiched between the upper and lower halves of the printer image using CSS clipping). After the animation completes, ExportOverlay appears.

---

## Visual Design

### Printer Layering (CSS split of `/Printer.png`)

The single `/Printer.png` (196×244px) is rendered as two overlapping `<img>` tags using `object-fit: none` and `clip-path` / `overflow: hidden` to create a top and bottom half. The paper image slides between them.

**Split point:** ~80% down the printer height (~195px from top), where the physical paper slot sits.

**Layer stack (top to bottom z-index):**
1. **Printer top half** — `clip`: rows 0–195px of the PNG, `z-index: 30`
2. **Printed paper** — slides downward from behind the slot, `z-index: 25`
3. **Printer bottom half** — `clip`: rows 195–244px of the PNG, `z-index: 20`

This creates the illusion that the paper physically emerges from inside the printer body.

---

## Animation Mechanics

**Paper size:** 196px wide × 260px tall (portrait print ratio, matching printer width)

**Position:** Fixed to the screen using `getBoundingClientRect()` on the printer button element. This is measured at animation start so it works at any screen size.

**Clip wrapper:** A `div` at `position: fixed`, `left: printerRect.left`, `top: printerRect.top + SLOT_OFFSET_Y`, `width: 196px`, `overflow: hidden`. Height expands from 0 to 260px as the paper slides out.

**Motion:** `framer-motion` `motion.div` inside the clip wrapper:
- `initial`: `y: -260` (fully hidden behind slot)
- `animate`: `y: 0` (fully revealed)
- `transition`: `duration: 2.5, ease: "linear"` (slow, mechanical printer feel)

**On animation complete:** `onComplete` callback fires → `printerPrinting` set to `false` → ExportOverlay mounts (image was already captured at tap time).

---

## State Changes in App

| State | Purpose |
|---|---|
| `printerPrinting: boolean` | controls PrinterPaper visibility |
| `exportedImageUrl: string \| null` | existing — controls ExportOverlay |

**`handleExport` (updated):**
1. Capture `stage.toDataURL()`
2. Set `exportedImageUrl` (but don't show ExportOverlay yet)
3. Set `printerPrinting: true` → triggers PrinterPaper

**`onPrintComplete`:**
1. Set `printerPrinting: false` → PrinterPaper unmounts
2. ExportOverlay is now visible (exportedImageUrl is already set)

---

## New Component: `PrinterPaper.tsx`

**Props:**
```ts
interface PrinterPaperProps {
  imageUrl: string;
  printerButtonEl: HTMLButtonElement | null; // ref to measure position
  onComplete: () => void;
}
```

**Behavior:**
- On mount: reads `printerButtonEl.getBoundingClientRect()` to get screen coords
- Renders the two printer halves (clipped) + animating paper between them
- Calls `onComplete` when paper animation finishes

---

## Printer Image Splitting

Both halves use the same `<img src="/Printer.png">` with CSS to show only the relevant portion:

```
Top half:  height: SLOT_Y, overflow: hidden
Bottom half: position trick — negative marginTop or translateY to offset into the bottom portion
```

`SLOT_Y = 195` (tunable constant — adjust to align with the real slot in the PNG).

---

## Changes to Existing Files

- **`App.tsx`**: add `printerPrinting` state; update `handleExport`; add `PrinterPaper` render; add `printerButtonRef` on the printer `<motion.button>`
- **`ExportOverlay.tsx`**: no changes
- **New**: `src/components/PrinterPaper.tsx`

---

## Out of Scope

- Sound effects (can be added later)
- Haptic feedback
- The ExportOverlay UI itself (already implemented)
