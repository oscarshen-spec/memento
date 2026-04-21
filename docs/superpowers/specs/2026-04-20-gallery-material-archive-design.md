# Gallery — Material Archive

## Summary

Add a persistent archive for raw materials, accessed via a tin-box entry point in the bottom drawer. Materials gain a `status` that places them either in the active bottom drawer or in a separate gallery zone. When the gallery is open, both zones are visible and the user reorganizes materials by dragging between them. Materials can also be cut/torn from inside the gallery; they cannot be dragged directly onto the scrapbook from the gallery — they must first be moved to the drawer.

## Motivation

Today, every raw material the user captures or imports scatters into the bottom drawer. There is no way to put a material aside without deleting it, and the drawer has finite visual space before the pile becomes unreadable. The gallery gives the user a second, larger storage space for materials they want to keep but not currently work with, while preserving the drawer's role as the active workbench surface.

Defaulting newly captured/uploaded materials to the gallery (rather than the drawer) reinforces the "intentional friction" philosophy: the user promotes a material into the drawer when they're ready to use it, rather than having every photo immediately clutter the active surface.

## User-Facing Behavior

### Entry Point: The Tin Box

- A metal cookie tin with a lid sits pinned to the **top-right corner** of the drawer interior.
- The tin is only visible when the drawer is open.
- The tin renders above scraps (higher z-index), and the scatter / rearrange logic treats its footprint as blocked so materials are never placed on top of it.
- Tapping the tin opens the gallery: the lid animates open (hinge flip), and the gallery zone is revealed beneath the drawer.

### Opening Animation

On tap:

1. The tin lid animates open.
2. The desk (top 80vh) and drawer slide upward together as a group, shrinking the visible desk area.
3. A new gallery zone is revealed at the bottom of the screen in the space vacated by the drawer.

Approximate final layout while gallery is open:

- Desk: ~50vh
- Drawer: ~20vh (unchanged height, shifted up)
- Gallery: ~30vh (new, appears at the bottom)

The gallery zone uses the same wooden-drawer texture (`/Drawer.png`) as the drawer interior, for visual continuity.

### Layout Semantics

- **Drawer zone** (top, unchanged in role) shows only materials with `status: 'drawer'`.
- **Gallery zone** (bottom, revealed) shows only materials with `status: 'gallery'`.
- Both zones use the same messy-scatter presentation as the existing drawer (random rotation, stacking).

### Interactions in Gallery Mode

**Drag between zones changes status.**

- Dragging a material from the drawer down into the gallery sets its status to `'gallery'`.
- Dragging a material from the gallery up into the drawer sets its status to `'drawer'`.
- On successful cross-zone drop, the material takes a fresh scatter position inside its new zone.
- On drop outside both zones, the material springs back to its origin (no status change).

**Tap a material in the gallery → cut/tear editor.**

- Opens a CuttingRoom-style full-screen editor that exposes both cut and tear tools.
- Output: the edited material replaces the original in the gallery (same `id`).
- Any leftover pieces produced by cut or tear (e.g., the "outside" from a scissor cut, or the second half of a tear) are added as new materials with `status: 'gallery'`.
- Closing the editor returns to the **gallery view**, not the scrapbook.

**No drag-to-scrapbook from the gallery.**

- The only way to place a gallery material on the scrapbook is: gallery → drag to drawer → close gallery → drag from drawer onto page.

### Closing the Gallery

- A dedicated close affordance (styled as a lid-handle) sits in the gallery zone.
- Tapping it reverses the opening animation: the desk and drawer slide back down to their original positions; the gallery zone slides off-screen; the tin lid closes.

### Default Placement for New Materials

- Camera capture → new material with `status: 'gallery'`.
- File upload → new material with `status: 'gallery'`.
- Scraps returned from the scrapbook (via the existing "return to drawer" gesture) continue to go to the **drawer** (status `'drawer'`). This preserves the current in-session workflow where a user peels something back and immediately sees it in the drawer.
- Scraps that fall off the page during a page turn also return with `status: 'drawer'` (consistent with the above).

## Data Model Changes

### `RawMaterial` gains a `status` field

```ts
type RawMaterialStatus = 'drawer' | 'gallery';

interface RawMaterial {
  id: string;
  image: string;
  status: RawMaterialStatus;
}
```

All existing call sites that create a `RawMaterial` must set `status`:

- Seed samples in `App.tsx` → existing nine samples keep `status: 'drawer'` so the default app state looks unchanged.
- `handleCapture` (camera) → `status: 'gallery'`.
- `handleFileUpload` → `status: 'gallery'`.
- `handleReturnScrap` → `status: 'drawer'`.
- `handleFallComplete` (fallen scraps) → `status: 'drawer'`.
- `handleScissorCut` leftover in-scrapbook cut → `status: 'drawer'` (unchanged behavior; the leftover appears in the drawer as today).
- Cut/tear leftovers produced **inside the gallery** → `status: 'gallery'`.

### Derived lists

Rather than introducing two arrays, keep a single `rawMaterials: RawMaterial[]` and derive zone membership at render time:

- `drawerMaterials = rawMaterials.filter(m => m.status === 'drawer')`
- `galleryMaterials = rawMaterials.filter(m => m.status === 'gallery')`

This keeps reclassification a single field update and avoids move/merge bugs across two arrays.

## Component / File Plan

### New components

- **`src/components/Gallery.tsx`** — the gallery zone. Responsibilities:
  - Renders the wooden interior with scatter-positioned gallery materials.
  - Handles drag-out (upward, into drawer) of its materials → calls `onReclassify(id, 'drawer')`.
  - Handles drag-in (downward, from drawer) acceptance: relies on the parent to detect drop target.
  - Renders the lid-handle close button; emits `onClose`.
  - Renders tap-to-edit by forwarding `onEditMaterial(material)` up to `App`.

- **`src/components/TinBox.tsx`** — the entry-point tin.
  - Renders a closed / open state (two visual assets or a two-frame animation).
  - Emits `onOpen` on tap.
  - Exposes its footprint (size + corner anchor) so the drawer's scatter logic can exclude it.

### Modified components

- **`src/components/MaterialDrawer.tsx`**:
  - Accepts a `tin` render prop (or renders `TinBox` internally) pinned top-right.
  - Scatter logic (`makeScatterPosition` / `clampPosition`) takes a list of "blocked rectangles" so the tin's footprint is excluded when seeding positions.
  - Exposes its drop-target bounds so materials dragged from the gallery can reclassify into the drawer.
  - Its drag-end handler must distinguish: (a) dropped onto scrapbook → existing `onDragMaterial`; (b) dropped into gallery zone → `onReclassify(id, 'gallery')`; (c) dropped back inside drawer → `onRearrange` as today.

- **`src/App.tsx`**:
  - Adds `galleryOpen: boolean` state.
  - Replaces `view === 'drawer'` branching where needed with `galleryOpen`-aware layout.
  - Adds the slide-up animation group containing the desk + drawer.
  - Renders the `Gallery` component below the drawer when `galleryOpen === true`.
  - Implements `handleReclassify(id, status)`.
  - Implements `handleEditGalleryMaterial(material)` which opens the existing `CuttingRoom` in a gallery-return mode (see next bullet).
  - Passes seed `status: 'drawer'` on the nine sample materials.
  - Adds `status: 'gallery'` on capture and upload.

- **`src/components/CuttingRoom.tsx`** (reused, lightly extended):
  - Today, `CuttingRoom` feeds `handleCut` which places a new scrap onto the page and removes the source raw material.
  - A new invocation mode is needed for gallery edits where the output stays as a raw material: same tracing UX, but on completion the resulting masked image replaces the original material in place, and leftover pieces become new gallery materials. Implementation can either add an `onCutInGallery` prop to `CuttingRoom`, or create a small wrapper component that reuses `CuttingRoom`'s interaction code.

### Unchanged (confirmed in brainstorming)

- Drag-from-drawer onto scrapbook: identical to today.
- Scissor / tear on already-placed scraps (`ScissorsCutView`, `TearCutView`): unchanged.

## Interaction Details

### Cross-zone drag

The drawer and the gallery are sibling DOM containers when the gallery is open. Each is a drop target for the other's cards. The existing `MaterialCard` already exposes `onDragEnd(material, info)` with pointer coordinates; extending the drop logic in `App.tsx` to consider both the scrapbook rect and the gallery rect is sufficient. The precedence at drop time is:

1. Inside scrapbook rect → place as a scrap (drawer materials only; gallery materials never hit this path because they can't be dragged through the scrapbook area in practice — the drawer sits between the two, and gallery materials drag upward into the drawer first).
2. Inside the opposite zone's rect → reclassify.
3. Inside own zone's rect → rearrange (existing behavior).
4. Otherwise → spring back.

### Tin footprint handling

`TinBox` has a fixed corner anchor and a known width/height. The drawer passes the tin's rect (in drawer-local coordinates) into `makeScatterPosition`, which rejects candidate positions that intersect the tin rect. The scatter function already tries multiple candidates and keeps the furthest-from-neighbors choice; rejecting tin-intersecting candidates fits naturally. For rearranging (drop in own zone), `clampPosition` must also push the drop point out of the tin's rect.

### Gallery open/close animation

The desk and drawer form an animation group that translates upward by ~30vh on open, downward by the same amount on close. The gallery itself slides in from the bottom edge. Spring timing should match the existing drawer open/close feel (the `spring, damping: 25, stiffness: 200` used in `MaterialDrawer`).

During the animation, scrapbook interactions should be disabled (scraps can't be dragged, etc.) to avoid partial-state bugs. Simplest approach: gate scrapbook interactions on `!galleryOpen`.

### Tin lid animation

The tin renders as two visual elements — body and lid — with the lid rotating around its back-edge hinge. Target rotation: approximately −100° on open (lid flips backward). If a single-image solution is preferred, the tin can be a sprite with two frames (closed, open) cross-faded during the transition. Either is fine; the data/API contract is the same.

## Edge Cases

- **Gallery open while scrapbook is mid-animation (e.g., page turn with falling scraps):** block gallery open until the page-turn animation completes. Tapping the tin during that window is a no-op.
- **Zero gallery materials:** show an empty-state message in the gallery zone ("Gallery is empty — new photos land here by default"), matching the existing drawer empty-state styling.
- **Zero drawer materials while gallery is open:** the drawer shows its existing empty-state; the tin remains visible in the top-right.
- **Tin-tap while capture/upload is in progress:** allow; the newly captured material will appear in the gallery on completion.
- **Cut/tear in gallery produces degenerate output (empty path):** same behavior as existing cutting-room — the editor cancels without writing changes.
- **Material dragged exactly onto the tin:** treat as a drop outside any accepting zone → spring back.

## Testing Plan

- **Manual:**
  - Capture a photo → verify it lands in the gallery, not the drawer.
  - Upload a file → verify it lands in the gallery.
  - Open gallery → drag a gallery material up into the drawer → verify drawer count increases, gallery count decreases, status is persisted.
  - Drag a drawer material down into the gallery → verify the reverse.
  - Tap a gallery material → edit via cut → verify edited result replaces original, leftover appears in gallery, editor returns to gallery view.
  - Tap a gallery material → edit via tear → same verification.
  - Close gallery → verify desk/drawer return to original positions, tin lid closes.
  - Seed sample materials: verify the nine samples still appear in the drawer on app load.
  - Peel a glued scrap → verify it returns to the drawer (unchanged behavior).
  - Page-turn with loose scraps → verify fallen scraps return to the drawer (unchanged behavior).
  - Fill the drawer heavily → verify the tin is never covered by scraps (scatter & rearrange both).

## Out of Scope

- Persistence of material status across app reloads (the app currently does not persist `rawMaterials`; persistence is a separate project-wide concern).
- Deleting materials from the gallery (not requested).
- Bulk operations (select-all, multi-drag).
- Search, tags, or any form of organization beyond the two-zone split.
- Changing the existing cut/tear flow for scraps already placed on the scrapbook.
