# Printer Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user taps the printer button, the canvas image slides out from the printer's paper slot (sandwiched between the upper and lower CSS-clipped halves of `/Printer.png`), then ExportOverlay appears.

**Architecture:** A new `PrinterPaper` component renders at `position: fixed`, anchored to the printer button's screen coordinates via `getBoundingClientRect()`. It splits `/Printer.png` into top and bottom halves using CSS clipping, with the canvas image animating between them using Framer Motion. App state gates ExportOverlay until the print animation completes.

**Tech Stack:** React 19, TypeScript, Framer Motion (`motion/react`), Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/PrinterPaper.tsx` | **Create** | In-place paper printing animation |
| `src/App.tsx` | **Modify** | Add `printerPrinting` state, `printerButtonRef`, update `handleExport`, gate ExportOverlay, render PrinterPaper |

---

## Constants (shared mental model)

```
PRINTER_W  = 196   // natural width of /Printer.png
PRINTER_H  = 244   // natural height of /Printer.png
SLOT_Y     = 190   // px from top of image where the paper slot sits (~78%)
PAPER_H    = 260   // height of the printed paper that slides out
BTN_PAD    =   4   // printer button has p-1 (4px padding); offset img origin
```

`SLOT_Y` is a tunable constant — adjust it until the paper appears to emerge from the correct location on the PNG.

---

## Task 1: Create `PrinterPaper` component

**Files:**
- Create: `src/components/PrinterPaper.tsx`

### Layer z-index plan

```
z: 30 — Printer top half   (rows 0 → SLOT_Y of Printer.png)
z: 25 — Printer bottom half (rows SLOT_Y → PRINTER_H, the slot strip)
z: 20 — Paper image         (slides from y = -PAPER_H to y = 0)
```

The paper clip container (`overflow: hidden`, `position: absolute`, `top: SLOT_Y`) prevents the paper from showing above the slot. The bottom-half slot strip (z:25) overlays the top of the emerging paper, creating the physical illusion of paper coming from inside the printer.

- [ ] **Step 1: Create the file with props and constants**

```tsx
// src/components/PrinterPaper.tsx
import React, { useLayoutEffect, useState } from 'react';
import { motion } from 'motion/react';

const PRINTER_W = 196;
const PRINTER_H = 244;
const SLOT_Y = 190;
const PAPER_H = 260;
const BTN_PAD = 4;

export interface PrinterPaperProps {
  imageUrl: string;
  printerButtonEl: HTMLButtonElement | null;
  onComplete: () => void;
}
```

- [ ] **Step 2: Add rect measurement with `useLayoutEffect`**

Measure synchronously before paint so the component never renders in the wrong position.

```tsx
export const PrinterPaper: React.FC<PrinterPaperProps> = ({
  imageUrl,
  printerButtonEl,
  onComplete,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (printerButtonEl) {
      setRect(printerButtonEl.getBoundingClientRect());
    }
  }, [printerButtonEl]);

  if (!rect) return null;

  // The printer img origin is BTN_PAD inside the button's bounding rect
  const imgLeft = rect.left + BTN_PAD;
  const imgTop  = rect.top  + BTN_PAD;
```

- [ ] **Step 3: Render the fixed container and three layers**

```tsx
  return (
    <div
      style={{
        position: 'fixed',
        left: imgLeft,
        top: imgTop,
        width: PRINTER_W,
        height: PRINTER_H + PAPER_H,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      {/* ── Top half of printer (above slot) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: SLOT_Y,
          overflow: 'hidden',
          zIndex: 30,
        }}
      >
        <img
          src="/Printer.png"
          width={PRINTER_W}
          height={PRINTER_H}
          alt=""
          draggable={false}
          style={{ display: 'block' }}
        />
      </div>

      {/* ── Paper clip container (paper slides out here) ── */}
      <div
        style={{
          position: 'absolute',
          top: SLOT_Y,
          left: 0,
          height: PAPER_H,
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        <motion.img
          src={imageUrl}
          alt="Printing…"
          draggable={false}
          style={{
            display: 'block',
            width: PRINTER_W,
            height: PAPER_H,
            objectFit: 'contain',
            background: '#fff8f1',
          }}
          initial={{ y: -PAPER_H }}
          animate={{ y: 0 }}
          transition={{ duration: 2.5, ease: 'linear' }}
          onAnimationComplete={onComplete}
        />
      </div>

      {/* ── Bottom half of printer (slot strip, overlays top of paper) ── */}
      <div
        style={{
          position: 'absolute',
          top: SLOT_Y,
          left: 0,
          height: PRINTER_H - SLOT_Y,
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        <img
          src="/Printer.png"
          width={PRINTER_W}
          height={PRINTER_H}
          alt=""
          draggable={false}
          style={{ display: 'block', marginTop: -SLOT_Y }}
        />
      </div>
    </div>
  );
};
```

Close the component: `};` (already closed above).

- [ ] **Step 4: Verify the file compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `PrinterPaper.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrinterPaper.tsx
git commit -m "feat: add PrinterPaper animation component"
```

---

## Task 2: Wire `PrinterPaper` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import `PrinterPaper` and add the two new state variables**

Add the import after the existing `ExportOverlay` import (around line 25):

```tsx
import { PrinterPaper } from './components/PrinterPaper';
```

Add inside `App()` after the `exportedImageUrl` state (around line 101):

```tsx
const [printerPrinting, setPrinterPrinting] = useState(false);
const printerButtonRef = useRef<HTMLButtonElement>(null);
```

- [ ] **Step 2: Update `handleExport` to start the animation before showing ExportOverlay**

Replace the existing `handleExport` (lines 499–505):

```tsx
const handleExport = () => {
  if (fallingOff || printerPrinting) return;
  const stage = scrapbookRef.current;
  if (!stage) return;
  const url = stage.toDataURL({ pixelRatio: 2 });
  setExportedImageUrl(url);
  setPrinterPrinting(true);
};
```

- [ ] **Step 3: Add `handlePrintComplete` below `handleExport`**

```tsx
const handlePrintComplete = () => {
  setPrinterPrinting(false);
};
```

- [ ] **Step 4: Gate ExportOverlay behind `!printerPrinting`**

Find the existing ExportOverlay render (around line 977–982):

```tsx
{exportedImageUrl && (
  <ExportOverlay
    imageUrl={exportedImageUrl}
    onClose={() => setExportedImageUrl(null)}
  />
)}
```

Replace with:

```tsx
{exportedImageUrl && !printerPrinting && (
  <ExportOverlay
    imageUrl={exportedImageUrl}
    onClose={() => setExportedImageUrl(null)}
  />
)}
```

- [ ] **Step 5: Add `ref` to the printer button**

Find the printer `<motion.button>` (around line 839). Add `ref={printerButtonRef}` to it:

```tsx
<motion.button
  key="printer-tool"
  ref={printerButtonRef}
  onClick={handleExport}
  style={{ position: 'absolute', top: -119, left: 350, zIndex: 20 }}
  className="p-1"
  title="Export"
  initial={{ y: -120, opacity: 0 }}
  animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.04 } }}
  exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.04 } }}
>
```

- [ ] **Step 6: Render `PrinterPaper` in the overlay section**

Add immediately before or after the GlueAnimation block (around line 984):

```tsx
{printerPrinting && exportedImageUrl && (
  <PrinterPaper
    imageUrl={exportedImageUrl}
    printerButtonEl={printerButtonRef.current}
    onComplete={handlePrintComplete}
  />
)}
```

- [ ] **Step 7: Verify the file compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire PrinterPaper animation into App — gates ExportOverlay until print completes"
```

---

## Task 3: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/oscarshen/Desktop/Memento && npm run dev
```

- [ ] **Step 2: Manual test — golden path**

1. Open app in browser (default `http://localhost:5173`)
2. Navigate to the editor view (select or create a scrapbook)
3. Tap the printer button
4. **Verify:** Paper slides downward from the printer slot over ~2.5 s
5. **Verify:** The upper printer body visually stays on top of the paper
6. **Verify:** The slot strip (bottom printer half) overlays the top edge of the paper as it emerges
7. **Verify:** After paper fully exits, ExportOverlay appears
8. **Verify:** Tapping "Save to Photos" downloads the image; tapping the backdrop dismisses ExportOverlay

- [ ] **Step 3: Tune `SLOT_Y` if needed**

If the paper appears to emerge from the wrong position on the printer image, adjust `SLOT_Y` in `src/components/PrinterPaper.tsx`. Common adjustments:

- Paper exits too high (from middle of body): increase `SLOT_Y`
- Paper exits too low (below the visible slot): decrease `SLOT_Y`

Re-run the dev server to preview changes.

- [ ] **Step 4: Final commit if `SLOT_Y` was tuned**

```bash
git add src/components/PrinterPaper.tsx
git commit -m "fix: tune SLOT_Y to align paper exit with printer slot"
```
