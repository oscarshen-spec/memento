# Editor Toolbar & Drawer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the editor screen's toolbar (remove tape, reposition tools, add Printer) and material drawer (collapsed zones → expands to MaterialDrawer), and add an ExportOverlay triggered by the Printer tool.

**Architecture:** Three independent pieces wired into `App.tsx`. `DrawerTray` wraps `MaterialDrawer` with internal zone state; `ExportOverlay` receives a dataURL and shows save/share actions; toolbar changes are surgical edits to `App.tsx` JSX. `MaterialDrawer` is never modified.

**Tech Stack:** React 19, TypeScript, Framer Motion (`motion/react`), Konva (`konva` / `react-konva`), Tailwind CSS v4.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/DrawerTray.tsx` | Collapsed zones view + MaterialDrawer toggle |
| Create | `src/components/ExportOverlay.tsx` | Dark overlay with exported canvas, Save + Share |
| Modify | `src/App.tsx` | Wire `scrapbookRef`, swap toolbar, swap drawer, mount overlay |
| Add asset | `public/Printer.png` | Printer tool image (download from Figma) |

---

## Task 1: Download Printer Asset and Wire scrapbookRef

**Files:**
- Add asset: `public/Printer.png`
- Modify: `src/App.tsx`

The Konva `Stage` ref needs to exist in `App.tsx` so `handleExport` can call `stage.toDataURL()`. The `Scrapbook` component already uses `React.forwardRef<Konva.Stage>` — this just wires the call site.

- [ ] **Step 1: Download the Printer asset**

Run this from the project root to fetch the Figma asset:

```bash
curl -L "https://www.figma.com/api/mcp/asset/7fc49e62-9dea-4bd9-b3b0-fef15be25485" -o public/Printer.png
```

Verify it saved:
```bash
ls -lh public/Printer.png
```
Expected: file exists, size > 0.

- [ ] **Step 2: Add the Konva import to App.tsx**

At the top of `src/App.tsx`, `konva` is already a dependency. Add the type import. Find the existing imports block and add:

```ts
import Konva from 'konva';
```

Place it near the other library imports (after the React import line).

- [ ] **Step 3: Add scrapbookRef in App.tsx**

Find the block of `useRef` declarations in `App.tsx` (near `const glueButtonRef = useRef<HTMLButtonElement>(null)`). Add directly after it:

```ts
const scrapbookRef = useRef<Konva.Stage>(null);
```

- [ ] **Step 4: Pass the ref to `<Scrapbook />`**

Find the `<Scrapbook` JSX in `App.tsx` (inside the `"Scrapbook on Desk"` section, around line 906). It currently has no `ref` prop. Add it:

```tsx
<Scrapbook
  ref={scrapbookRef}
  page={currentPage}
  dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
  onUpdateScrap={updateScrap}
  onUpdateEntry={updateEntry}
  onReturnScrap={handleReturnScrap}
  onAddTapeStrip={handleAddTapeStrip}
  isTapeActive={activeTool === 'tape'}
  isGlueActive={activeTool === 'glue'}
  fallingScrapIds={fallingOff?.scrapIds ?? null}
  onFallComplete={handleFallComplete}
  selectedScrapId={selectedScrapId}
  onSelectScrap={handleSelectScrap}
  gluingScrapId={gluingScrapId}
  onGlueTap={handleGlueTap}
  onPeel={handlePeel}
  onUpdateEnvelope={updateEnvelope}
  onTuckScrap={handleTuckScrap}
  onUntuckScrap={handleUntuckScrap}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit
```
Expected: no errors related to the ref type.

- [ ] **Step 6: Commit**

```bash
git add public/Printer.png src/App.tsx
git commit -m "feat: add Printer asset and wire scrapbookRef to Scrapbook stage"
```

---

## Task 2: Toolbar Changes in App.tsx

**Files:**
- Modify: `src/App.tsx`

Remove the tape tool button, reposition text and glue tools, add the Printer tool button.

- [ ] **Step 1: Remove the tape tool button**

In `src/App.tsx`, find the `motion.button` with `key="tape-tool"` (the block that sets `activeTool === 'tape'`). It looks like:

```tsx
<motion.button
  key="tape-tool"
  onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
  style={{ position: 'absolute', top: -40, left: -40, rotate: '-14deg', zIndex: 20 }}
  ...
>
  <img src="/Tape.png" ... />
</motion.button>
```

Delete this entire `<motion.button>` block (opening tag through closing `</motion.button>`).

- [ ] **Step 2: Reposition the text tool**

Find the `motion.button` with `key="text-tool"`. Its current `style` prop is:
```tsx
style={{ position: 'absolute', top: -32, left: '52%', translateX: '-50%', rotate: '-6deg', zIndex: 20 }}
```

Replace that `style` prop with:
```tsx
style={{ position: 'absolute', top: -15, left: -38, rotate: '-6deg', zIndex: 20 }}
```

- [ ] **Step 3: Reposition the glue tool**

Find the `motion.button` with `key="glue-tool"`. Its current `style` prop is:
```tsx
style={{ position: 'absolute', top: -32, right: -24, rotate: '12deg', zIndex: 20, opacity: isGlueBottleAway ? 0 : 1, pointerEvents: isGlueBottleAway ? 'none' : 'auto', transition: 'opacity 0.1s' }}
```

Replace with (note: `right` → `left`, rotation changes):
```tsx
style={{ position: 'absolute', top: -53, left: 119, rotate: '105deg', zIndex: 20, opacity: isGlueBottleAway ? 0 : 1, pointerEvents: isGlueBottleAway ? 'none' : 'auto', transition: 'opacity 0.1s' }}
```

Also update the `animate` prop on the same button — it currently references `isGlueBottleAway` for opacity:
```tsx
animate={{ y: 0, opacity: isGlueBottleAway ? 0 : 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0 } }}
```
Leave this animate prop unchanged — it still works correctly.

- [ ] **Step 4: Add the Printer tool button**

Inside the same `AnimatePresence` block that contains the text and glue tools (the one rendered when `selectedScrapId === null`), add the Printer button after the glue button:

```tsx
<motion.button
  key="printer-tool"
  onClick={handleExport}
  style={{ position: 'absolute', top: -119, left: 227, zIndex: 20 }}
  className="p-1"
  title="Export"
  initial={{ y: -120, opacity: 0 }}
  animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.04 } }}
  exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.04 } }}
>
  <img
    src="/Printer.png"
    width="174"
    height="217"
    alt="Export"
    className="transition-all duration-150 opacity-100 hover:scale-105"
    style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
  />
</motion.button>
```

`handleExport` does not exist yet — it will be added in Task 4. TypeScript will complain until then. Proceed.

- [ ] **Step 5: Verify visually**

```bash
cd /Users/oscarshen/Desktop/Memento && npm run dev
```

Open the app, navigate to the editor. Confirm:
- No tape tool visible above the notebook
- Text card is positioned upper-left
- Glue bottle is positioned center, rotated ~105°
- Printer is positioned upper-right (it will show a broken image until `handleExport` is wired — that's OK)

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: reposition toolbar tools and add Printer button stub"
```

---

## Task 3: Create DrawerTray Component

**Files:**
- Create: `src/components/DrawerTray.tsx`

This component owns `activeZone` state. When `null`, renders three collapsed zones. When `'photos'`, renders `MaterialDrawer` with `isOpen={true}`.

- [ ] **Step 1: Create the file**

Create `src/components/DrawerTray.tsx` with this full content:

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';
import { MaterialDrawer } from './MaterialDrawer';

type Zone = null | 'photos' | 'tape' | 'papers';

// Fixed rotations for the photo pile — seeded so they never re-randomise on render
const PHOTO_ROTATIONS = [-17, 14, -5];
const PHOTO_OFFSETS: { left: number; top: number }[] = [
  { left: 0, top: 10 },
  { left: 20, top: 0 },
  { left: 8, top: 18 },
];

// Paper pile colour stack matching the Figma drawer spec
const PAPER_STACK = [
  { bg: '#d4a017' },
  { bg: '#c0392b' },
  { bg: '#95a5a6' },
  { bg: '#1a5276' },
  { bg: '#145a32' },
];

export interface DrawerTrayProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragMaterial: (material: RawMaterial, info: PanInfo) => void;
  onCardDragging?: (dragging: boolean) => void;
  galleryOpen: boolean;
  onOpenGallery: () => void;
  onReclassifyToGallery: (id: string) => void;
  galleryRectRef: React.RefObject<DOMRect | null>;
  onAddEnvelope?: () => void;
}

export const DrawerTray: React.FC<DrawerTrayProps> = ({
  materials,
  onSelect,
  onClose,
  onUpload,
  onDragMaterial,
  onCardDragging,
  galleryOpen,
  onOpenGallery,
  onReclassifyToGallery,
  galleryRectRef,
  onAddEnvelope,
}) => {
  const [activeZone, setActiveZone] = useState<Zone>(null);

  const previewPhotos = materials.slice(0, 3);

  return (
    <div className="relative w-full h-full">
      <AnimatePresence>
        {activeZone === null && (
          <motion.div
            key="zones"
            className="absolute inset-0 flex items-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* ── Photos zone ─────────────────────────────────────── */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => setActiveZone('photos')}
            >
              <div className="relative w-[90px] h-[80px]">
                {previewPhotos.map((m, i) => (
                  <img
                    key={m.id}
                    src={m.image}
                    alt=""
                    className="absolute w-[52px] h-[70px] object-cover rounded-[2px] pointer-events-none"
                    style={{
                      left: PHOTO_OFFSETS[i].left,
                      top: PHOTO_OFFSETS[i].top,
                      transform: `rotate(${PHOTO_ROTATIONS[i]}deg)`,
                      zIndex: i,
                      boxShadow: '3px 3px 6px rgba(0,0,0,0.35)',
                    }}
                  />
                ))}
                {previewPhotos.length === 0 && (
                  <div className="absolute inset-0 rounded-[2px] bg-[rgba(255,255,255,0.15)]" />
                )}
              </div>
            </button>

            {/* ── Tape zone (placeholder) ──────────────────────────── */}
            {/* TODO: implement tape zone expand */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => { /* no-op: tape zone not yet implemented */ }}
            >
              <img
                src="/Tape.png"
                alt="Tape"
                className="w-[90px] h-[90px] object-contain pointer-events-none"
                style={{
                  transform: 'rotate(12.5deg)',
                  filter: 'drop-shadow(5px 5px 6px rgba(0,0,0,0.3))',
                }}
              />
            </button>

            {/* ── Papers zone (placeholder) ────────────────────────── */}
            {/* TODO: implement papers zone expand */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => { /* no-op: papers zone not yet implemented */ }}
            >
              <div className="relative w-[80px] h-[90px]">
                {PAPER_STACK.map((p, i) => (
                  <div
                    key={i}
                    className="absolute rounded-[1px] pointer-events-none"
                    style={{
                      width: 66,
                      height: 99,
                      backgroundColor: p.bg,
                      left: 4 + i * 4,
                      top: 2 + i * 5,
                      transform: 'rotate(-90deg)',
                      transformOrigin: 'center',
                      opacity: 0.9,
                      boxShadow: '2px 2px 4px rgba(0,0,0,0.25)',
                      zIndex: i,
                    }}
                  />
                ))}
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeZone === 'photos' && (
          <motion.div
            key="photos-drawer"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <MaterialDrawer
              materials={materials}
              onSelect={onSelect}
              isOpen={true}
              onToggle={(open) => { if (!open) setActiveZone(null); }}
              onClose={() => setActiveZone(null)}
              onUpload={onUpload}
              onDragMaterial={onDragMaterial}
              onCardDragging={onCardDragging}
              galleryOpen={galleryOpen}
              onOpenGallery={onOpenGallery}
              onReclassifyToGallery={onReclassifyToGallery}
              galleryRectRef={galleryRectRef}
              onAddEnvelope={onAddEnvelope}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit
```
Expected: no errors in `DrawerTray.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/DrawerTray.tsx
git commit -m "feat: add DrawerTray component with collapsed zones and photo expand"
```

---

## Task 4: Wire DrawerTray into App.tsx

**Files:**
- Modify: `src/App.tsx`

Replace `<MaterialDrawer />` in the drawer section with `<DrawerTray />`, add `handleExport`, add `exportedImageUrl` state.

- [ ] **Step 1: Import DrawerTray in App.tsx**

Find the existing `import { MaterialDrawer }` line in `src/App.tsx`. Add `DrawerTray` below it:

```ts
import { DrawerTray } from './components/DrawerTray';
```

- [ ] **Step 2: Add exportedImageUrl state**

Find the block of `useState` declarations. Add after the last one (`debugWindowLight`):

```ts
const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
```

- [ ] **Step 3: Add handleExport function**

Find `const handleGlueTap` in `App.tsx`. Add `handleExport` directly before it:

```ts
const handleExport = () => {
  const stage = scrapbookRef.current;
  if (!stage) return;
  const url = stage.toDataURL({ pixelRatio: 2 });
  setExportedImageUrl(url);
};
```

- [ ] **Step 4: Replace MaterialDrawer with DrawerTray in drawer section**

Find the drawer `<motion.div>` section (the one with `ref={drawerAreaRef}` and `h-[20vh]`). Replace its `<MaterialDrawer ... />` child with `<DrawerTray />`:

```tsx
<motion.div
  ref={drawerAreaRef}
  className="relative w-full h-[20vh] overflow-hidden z-20"
  style={{ backgroundImage: 'url(/Background.png)', backgroundSize: 'cover', backgroundPosition: 'bottom center' }}
  animate={drawerBounce ? { y: [0, -6, 0] } : {}}
  transition={{ duration: 0.25, ease: 'easeOut' }}
>
  <DrawerTray
    materials={drawerMaterials}
    onSelect={noop}
    onClose={() => {}}
    onDragMaterial={handleDragMaterial}
    onUpload={handleFileUpload}
    onCardDragging={handleCardDragging}
    galleryOpen={galleryOpen}
    onOpenGallery={() => {
      if (fallingOff) return;
      setGalleryOpen(true);
    }}
    onReclassifyToGallery={(id) => handleReclassify(id, 'gallery')}
    galleryRectRef={galleryRectRef}
    onAddEnvelope={handleAddEnvelope}
  />
</motion.div>
```

Note: `isOpen` and `onToggle` are no longer passed — DrawerTray manages zone state internally.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Verify visually**

```bash
npm run dev
```

Open the editor. Check:
- Drawer shows three zones: photo pile (left), tape roll (center), paper stack (right)
- Tapping the photo pile expands into the full material drawer
- Closing the material drawer (tap handle / toggle) returns to the three zones
- Tape and papers zones are visible but tapping does nothing

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire DrawerTray and handleExport into App"
```

---

## Task 5: Create ExportOverlay Component

**Files:**
- Create: `src/components/ExportOverlay.tsx`

Renders the dark overlay, printed canvas image with spring entrance, and Save/Share buttons.

- [ ] **Step 1: Create the file**

Create `src/components/ExportOverlay.tsx` with this full content:

```tsx
import React from 'react';
import { motion } from 'motion/react';

export interface ExportOverlayProps {
  imageUrl: string;
  onClose: () => void;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
}

export const ExportOverlay: React.FC<ExportOverlayProps> = ({ imageUrl, onClose }) => {
  const handleShare = async () => {
    try {
      const file = await dataUrlToFile(imageUrl, 'memento-page.png');
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Memento Page' });
      } else {
        await navigator.clipboard.writeText(imageUrl);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Share failed', err);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      {/* Printed canvas — spring up from below, centred with slight upward offset */}
      <motion.div
        style={{
          width: 354,
          height: 528,
          background: '#fff8f1',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: -66, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Exported page"
          className="w-full h-full object-contain"
        />
      </motion.div>

      {/* Action row — fixed near bottom */}
      <div
        className="fixed bottom-6 left-0 right-0 flex items-center gap-4"
        style={{ paddingLeft: 19, paddingRight: 19 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Save to Photos */}
        <a
          href={imageUrl}
          download="memento-page.png"
          className="flex flex-1 items-center justify-center rounded-[8px]"
          style={{
            border: '2px solid white',
            paddingTop: 16,
            paddingBottom: 16,
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'Caveat, cursive',
              fontWeight: 700,
              fontSize: 24,
              color: 'white',
              whiteSpace: 'nowrap',
            }}
          >
            Save to Photos
          </span>
        </a>

        {/* Share — circular icon button */}
        <button
          onClick={handleShare}
          className="flex items-center justify-center shrink-0 rounded-full"
          style={{
            width: 56,
            height: 56,
            border: '2px solid white',
            background: 'transparent',
          }}
        >
          {/* iOS-style share arrow */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit
```
Expected: no errors in `ExportOverlay.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportOverlay.tsx
git commit -m "feat: add ExportOverlay component with save and share actions"
```

---

## Task 6: Wire ExportOverlay into App.tsx

**Files:**
- Modify: `src/App.tsx`

Mount the overlay when `exportedImageUrl` is non-null.

- [ ] **Step 1: Import ExportOverlay**

In `src/App.tsx`, add after the `DrawerTray` import:

```ts
import { ExportOverlay } from './components/ExportOverlay';
```

- [ ] **Step 2: Mount ExportOverlay in JSX**

Find the line:
```tsx
{debugWindowLight && (view === 'scrapbook' || view === 'drawer') && <WindowLight />}
```

Add the overlay render directly after it:

```tsx
{exportedImageUrl && (
  <ExportOverlay
    imageUrl={exportedImageUrl}
    onClose={() => setExportedImageUrl(null)}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/oscarshen/Desktop/Memento && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Verify the full flow visually**

```bash
npm run dev
```

Test the complete export flow:
1. Open the editor, place any scrap on the canvas
2. Tap the Printer tool (upper right above notebook)
3. Confirm the dark overlay appears with the canvas image centred and springing up
4. Confirm "Save to Photos" and the share icon button are visible at the bottom
5. Tap "Save to Photos" — browser should prompt to download `memento-page.png`
6. Tap the share icon — iOS share sheet appears (or clipboard write on desktop)
7. Tap the dark backdrop — overlay dismisses, returns to editor
8. Confirm tapping the photo pile in the drawer expands correctly
9. Confirm tape and paper zones are visual-only (no expand)

Stop the dev server.

- [ ] **Step 5: Final commit**

```bash
git add src/App.tsx
git commit -m "feat: mount ExportOverlay in App — complete toolbar and drawer redesign"
```
