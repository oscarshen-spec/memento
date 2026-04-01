# Glue Feature — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Glue tool + fall-off animation (peel out of scope for this iteration)

---

## Overview

Users place photo scraps on the scrapbook page in a loose state. To permanently fix them, they must activate the Glue tool and physically rub their finger across each scrap. Scraps that aren't glued before turning the page shake, fall off the bottom, and return to the drawer.

This is intentional friction — gluing is a ritual, not a checkbox.

---

## 1. Glue Tool

### Toolbar

A glue bottle icon is added to the top toolbar alongside the existing tape and text tools. Tapping it toggles `activeTool === 'glue'`. Tapping it again deselects.

`activeTool` in `App.tsx` expands from `'tape' | 'text' | null` to `'tape' | 'text' | 'glue' | null`.

### Rubbing Gesture

While Glue Mode is active:

- Dragging a finger (or mouse) across a **loose** scrap triggers gluing.
- A single continuous pass is sufficient — no stroke count or coverage threshold.
- Detected via `onMouseMove` / `onTouchMove` on the Konva scrap group.
- Gluing fires immediately when the move event intersects the scrap while the pointer is held down.
- Glued scraps are ignored (no re-gluing needed).

### Visual Feedback During Rub

- A **wet sheen** — a semi-transparent highlight gradient — animates across the scrap surface while the finger is moving over it.
- Implemented as a Konva `Rect` overlay with a moving linear gradient or opacity pulse.

### Visual State After Gluing

- `updateScrap(id, { isGlued: true })` locks the scrap (already disables `draggable` in `ScrapItem`).
- Shadow transitions from loose → glued:
  - **Loose:** `shadowBlur: 14, shadowOffsetY: 10` (floating)
  - **Glued:** `shadowBlur: 3, shadowOffsetY: 2` (pressed flat)
- Shadow change animates via a short Konva tween (~200ms).

---

## 2. Fall-off Sequence

Triggered when the user taps the **page-turn arrow** (chevron left/right in `App.tsx`). If there are no unglued scraps, the page turns immediately with no animation.

### Sequence (~1.5s total)

| Step | What happens | Duration |
|------|-------------|----------|
| 1 | Unglued scraps **shudder** in place (rapid shake, ±4px, ±4°) | ~300ms |
| 2 | Each unglued scrap **falls off the bottom** with gravity + rotation. Staggered start: 0–150ms random delay per scrap. | ~600ms |
| 3 | Once all scraps are off-screen, the **page turns** | ~400ms (existing nav) |
| 4 | Fallen scraps are added back to `rawMaterials`. The **drawer bounces** subtly to signal new items. | immediate |

### Animation Details

- Fall implemented as a Konva tween: `y += stageHeight + 100`, random final rotation `+/- 20–35°`, easing `Konva.Easings.EaseIn`.
- Shake implemented as rapid sequential tweens or a CSS-style keyframe loop via `requestAnimationFrame` on the Konva node.
- Stagger: each scrap gets `delay = Math.random() * 150` ms before its fall begins.
- After tween completes, scrap is removed from `currentPage.scraps` and its `image` is pushed to `rawMaterials`.

### Drawer Bounce

A small scale pulse (`scale: 1.04 → 1.0`, ~200ms) on the drawer handle or tray, triggered after scraps land back.

---

## 3. Data Model

No changes to `types.ts`. `Scrap.isGlued: boolean` already exists.

```ts
// App.tsx — activeTool type update
type ActiveTool = 'tape' | 'text' | 'glue' | null;
```

---

## 4. Edge Cases

| Case | Behaviour |
|------|-----------|
| All scraps already glued | Page turns immediately, no animation |
| No scraps on page | Page turns immediately |
| Glue mode active, user tries to drag a scrap | `ScrapItem` receives an `isGlueActive` prop; `draggable` is set to `!scrap.isGlued && !isGlueActive`, so all scraps are non-draggable while glue tool is on |
| Scrap partially off the page edge | Glues in its current position |
| Unglued scraps when saving/sharing | Same fall-off sequence (to be wired up when save/share is implemented) |

---

## 5. Out of Scope (This Iteration)

- **Peel** — undoing a glue (pinch-and-lift gesture, residue marks)
- **Save / Share buttons** — fall-off will be wired to these when implemented
- **Haptics** — heavy "thud" on glue, deferred
- **Sound** — `glue_thud.wav`, `paper_rustle.wav`, deferred
