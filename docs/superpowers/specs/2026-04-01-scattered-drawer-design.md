# Scattered Drawer Design

**Date:** 2026-04-01
**Status:** Approved

## Context

The material drawer currently displays photos in a tidy horizontal row with minimal rotation (±2.4°). This feels too organized for an app built around intentional friction and physical authenticity. The goal is to make the open drawer feel like a real messy pile of photos — something you rummage through — without changing any open/close behavior.

---

## Decisions

| Question | Decision |
|----------|----------|
| Drawer height | Keep 20vh (unchanged) |
| Scatter style | Gravity-anchored: evenly-spaced x, ±14px vertical jitter, ±15° rotation |
| Drag within drawer | Settles at drop position, z-index bump, persists |
| Position persistence | Survives open/close; resets on app restart (no localStorage) |
| Implementation | Self-contained in MaterialDrawer — no App.tsx or type changes |

---

## Design

### 1. Scatter Layout

Each photo gets a position assigned on first appearance, stored in `positionsMap` inside `MaterialDrawer`. Positions use a **gravity-anchored scatter** formula:

- **x**: evenly distributed across drawer width (same spacing as current), ensuring all photos are reachable
- **y**: vertical center of the strip + random jitter `(Math.random() - 0.5) * 28` → ±14px
- **rotation**: `(Math.random() - 0.5) * 30` → ±15°
- **zIndex**: insertion order (newer materials on top)

Photos are absolutely positioned within the drawer's inner container instead of using flex layout.

### 2. Drag to Rearrange

When a user drags a photo and releases **inside** the drawer bounds:

- Card immediately jumps to highest z-index on drag start
- On release, x/y updated in `positionsMap` to the drop coordinates
- No snap-back, no animation to origin — settles in place

Drag-out-to-page behavior is unchanged. Distinction: drag ending outside drawer bounds → existing `onDragMaterial` page-drop flow. Drag ending inside → rearrange.

### 3. Position Persistence

`MaterialDrawer` gains internal state:

```ts
type DrawerPosition = { x: number; y: number; rotation: number; zIndex: number }
const [positionsMap, setPositionsMap] = useState<Record<string, DrawerPosition>>({})
```

Lifecycle:
- **New material** → compute scatter position, add to map
- **Material removed** → remove from map
- **Drawer closes/reopens** → map unchanged (component stays mounted)
- **App restart** → map resets to fresh scatter

### 4. What Does NOT Change

- Drawer open/close: handle, drag gesture, velocity threshold, spring animation — all untouched
- `onSelect`, `onDragMaterial`, `onUpload` callbacks — unchanged
- `App.tsx` state — no new props or callbacks
- `RawMaterial` type — no new fields
- `MaterialCard` component — rotation/drag props passed from new position data instead of computed inline

---

## Files Affected

- `src/components/MaterialDrawer.tsx` — main changes: positionsMap state, absolute positioning, drag-within-drawer logic

---

## Verification

1. Open drawer — photos appear scattered with varied y-positions and rotations (not a neat row)
2. Close and reopen drawer — photos are in the same positions
3. Drag a photo within the drawer and release — it settles at the drop point, comes to top
4. Drag a photo out to the scrapbook page — existing behavior unchanged
5. Add a new material (camera/upload) — appears in the drawer at a scattered position
6. Tap a photo to select it for cutting — existing behavior unchanged
