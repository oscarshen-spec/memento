# Editor Toolbar & Drawer Redesign

**Date:** 2026-04-29  
**Figma refs:** node 177-2823 (Editor open drawer), node 78-1484 (Export overlay)

---

## Overview

Redesign the editor screen's two peripheral areas to match the Figma spec:

1. **Toolbar (top)** — remove the tape tool, add a Printer/Export tool, reposition tools to match Figma layout
2. **Material Drawer (bottom)** — replace the raw MaterialDrawer with a new `DrawerTray` that shows three collapsed material zones; tapping Photos expands into the existing MaterialDrawer unchanged
3. **Export Overlay** — new full-screen overlay triggered by the Printer tool, showing the exported canvas with Save and Share actions

---

## 1. Toolbar Changes (App.tsx)

### Tool positions (relative to the notebook container `div`)

| Tool | top | left/right | rotate |
|------|-----|-----------|--------|
| Text | −15px | left: −38px | −6deg |
| Glue | −53px | left: 119px | 105deg |
| Printer | −119px | left: 227px | 0deg |

### Removed
- **Tape tool button** is removed from the toolbar entirely.
- The `TapeLayer` component and `isTapeActive` prop on `Scrapbook` remain in the codebase untouched — wired up again when the drawer tape zone is implemented later.
- `activeTool === 'tape'` can no longer be set from the toolbar; the type stays in the union for future use.

### Added: Printer tool
- Asset: `/Printer.png` (to be added to `public/`)
- Tap handler: calls `handleExport()` in App.tsx
- No active/selected state — it's a one-shot action, not a toggle
- Uses the same AnimatePresence spring-in/out as other tools (same `initial`, `animate`, `exit` pattern)
- Hidden while a scrap is selected (same condition as other primary tools)

### Scissors / Tear tools
Unchanged — appear via AnimatePresence when `selectedScrapId !== null`.

---

## 2. DrawerTray Component

**File:** `src/components/DrawerTray.tsx`

### Props
All props that were previously passed directly to `MaterialDrawer` from App.tsx, plus no new props — `DrawerTray` owns the zone selection state internally.

**`isOpen` / `onToggle` contract:** DrawerTray does NOT pass `isOpen` / `onToggle` from App.tsx straight through to MaterialDrawer. Instead:
- It passes `isOpen={true}` to MaterialDrawer whenever `activeZone === 'photos'` (MaterialDrawer is always fully open when shown).
- When MaterialDrawer calls `onClose` or `onToggle(false)`, DrawerTray intercepts and resets `activeZone` to `null` — it does not propagate up to App.tsx.
- App.tsx `view` state and its `onToggle` prop to DrawerTray can be simplified or removed since the zone state lives inside DrawerTray.

### Internal state
```ts
activeZone: null | 'photos' | 'tape' | 'papers'
```

### Collapsed view (`activeZone === null`)
Three horizontal zones filling the drawer area, matching Figma node 177-2823 drawer section:

**Left — Photos zone**
- Shows 2–3 photo thumbnails sampled from `drawerMaterials` (or placeholder silhouettes if drawer is empty)
- Fixed random rotations: −17°, +14°, −5° (seeded, not re-randomised on render)
- Overlapping pile layout, absolute-positioned within the zone
- Tappable — sets `activeZone` to `'photos'`

**Center — Tape zone**
- Static `/Tape.png` image at 12.5° rotation, drop shadow matching Figma
- Tappable — no-op for now (placeholder)

**Right — Papers zone**
- 4–5 colored paper sheet images stacked, each rotated −90°, offset slightly to simulate a pile
- Use existing washi tape pattern images or colored placeholder rects if assets aren't available
- Tappable — no-op for now (placeholder)

### Collapsed → expanded transition
- Tap Photos zone → zones fade out (opacity 0, duration 150ms), MaterialDrawer fades/slides in
- Uses `AnimatePresence` + Framer Motion for the transition

### Expanded view (`activeZone === 'photos'`)
- Renders `<MaterialDrawer />` with all props passed through — **zero changes** to MaterialDrawer itself
- When MaterialDrawer calls `onClose` or `onToggle(false)` → `activeZone` resets to `null`, zones animate back in

### Tape and Papers zones (deferred)
- Render as visual-only elements with `cursor: pointer` but no expand behavior
- No-op `onClick` handlers, clearly marked with `// TODO: implement tape zone expand` comments

---

## 3. ExportOverlay Component

**File:** `src/components/ExportOverlay.tsx`

### Props
```ts
interface ExportOverlayProps {
  imageUrl: string;       // dataURL from Konva stage export
  onClose: () => void;
}
```

### Trigger (App.tsx)
New `handleExport()` function:
```ts
const handleExport = () => {
  const stage = scrapbookRef.current; // existing Konva stage ref
  if (!stage) return;
  const url = stage.toDataURL({ pixelRatio: 2 });
  setExportedImageUrl(url);
};
```
New state: `exportedImageUrl: string | null` (null = overlay unmounted).

### Visual layout (Figma node 78:1484)
- **Backdrop:** fixed, full-screen, `rgba(0,0,0,0.8)`, tapping closes overlay
- **Canvas image:** centered (both axes), 354×528px, `background: #fff8f1`, drop shadow. The exported `imageUrl` is rendered as an `<img>` filling this container.
- **Entrance animation:** image slides up from ~60px below center with a spring ease, simulating paper feeding out of a printer
- **Bottom action row** (fixed near bottom of screen, ~24px from bottom edge, full-width with 19px horizontal padding):
  - **"Save to Photos"** button: white 2px border, rounded-8px, Caveat Bold 24px white text, flex-1. Triggers download via `<a download="memento-page.png" href={imageUrl}>` click.
  - **Share** button: circular, white 2px border, 56×56px, iOS share icon. Calls `navigator.share({ files: [pngFile] })` where `pngFile` is built from the dataURL. Falls back to `navigator.clipboard.writeText(imageUrl)` if Web Share API is unavailable.

### State cleanup
When `onClose` is called → `App.tsx` sets `exportedImageUrl` to `null`, unmounting the overlay.

---

## 4. App.tsx Changes Summary

| Change | Detail |
|--------|--------|
| Remove tape tool button | Delete the `motion.button` with `key="tape-tool"` |
| Reposition text, glue | Update `style` props to match new coordinates |
| Add printer tool button | New `motion.button` with `key="printer-tool"`, calls `handleExport` |
| Replace `<MaterialDrawer />` | Replace with `<DrawerTray />` passing through all same props |
| Add `exportedImageUrl` state | `const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null)` |
| Add `handleExport` function | Captures Konva stage as dataURL, sets `exportedImageUrl` |
| Mount `<ExportOverlay />` | Conditionally render when `exportedImageUrl !== null` |
| Add `scrapbookRef` | `const scrapbookRef = useRef<Konva.Stage>(null)` — new ref, not yet present. Pass as `ref={scrapbookRef}` to `<Scrapbook />`. The component already uses `React.forwardRef<Konva.Stage>` so this just needs the call-site wiring. |

---

## 5. Assets Required

| Asset | Status | Notes |
|-------|--------|-------|
| `/Printer.png` | **Missing** | Needs to be added to `public/`. Can use Figma asset URL temporarily. |
| Paper pile images | Potentially missing | Use washi tape pattern images or simple colored rects as fallback |

---

## 6. Out of Scope

- Tape zone expand behavior (deferred)
- Papers zone expand behavior (deferred)
- Printer animation (the physical printer printing motion) — the entrance slide of the overlay image is sufficient for now
- Persistence of exported images
