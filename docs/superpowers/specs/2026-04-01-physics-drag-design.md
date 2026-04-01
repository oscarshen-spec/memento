# Physics-Based Drag Interaction — Design Spec

## Overview

Enhance `ScrapItem` in `src/components/Scrapbook.tsx` so dragging a scrap feels like physically lifting, carrying, and dropping a piece of paper. All visual effects are applied imperatively to the Konva node to avoid React re-renders during drag. React state is only updated on drop.

---

## Architecture

All changes are contained within the `ScrapItem` component. No new files, no changes to parent components, no changes to the `Scrap` type.

### New Refs

| Ref | Type | Purpose |
|---|---|---|
| `lastDragPos` | `{x, y, t} \| null` | Previous drag position + timestamp for velocity calculation |
| `velocity` | `{vx: number, vy: number}` | Current drag velocity in px/ms |
| `baseRotation` | `number` | Scrap's rotation at drag start; tilt delta is relative to this |
| `activeTween` | `Konva.Tween \| null` | Reference to in-flight spring tween so it can be killed on re-drag |

---

## Shadow

Replace the existing hard-coded `Rect` shadow (4px offset, no blur) with Konva's native shadow properties on the `Group`:

```
shadowColor: 'rgba(0,0,0,0.35)'
shadowBlur: <dynamic>
shadowOffsetX: <dynamic>
shadowOffsetY: <dynamic>
```

**Resting state (not dragging):** `shadowBlur=4`, `shadowOffsetX=0`, `shadowOffsetY=3`

These are set as initial props on the Group and animated back to via Tween on drop.

---

## Velocity Tracking

On `onDragMove`:

```
vx = (currentX - lastX) / (currentT - lastT)   [px/ms]
vy = (currentY - lastY) / (currentT - lastT)
speed = clamp(sqrt(vx² + vy²), 0, 40)
```

Velocity is stored in the `velocity` ref. `lastDragPos` is updated to current position + timestamp.

---

## Visual Derivation (per drag-move frame)

Applied directly via `node.setAttrs()` — no React state:

| Property | Formula | Resting |
|---|---|---|
| `shadowBlur` | `8 + speed * 0.5` | 4 |
| `shadowOffsetY` | `6 + speed * 0.3` | 3 |
| `shadowOffsetX` | `vx * 0.15` | 0 |
| `skewX` | `vx * 0.012` | 0 |
| `rotation` | `baseRotation + vx * 0.04` | baseRotation |

`speed` is clamped to [0, 40] before use so max visual values are:
- `shadowBlur` ≤ 28
- `shadowOffsetY` ≤ 18
- `shadowOffsetX` ≤ ±6
- `skewX` ≤ ±~3°
- `rotation` delta ≤ ±~4°

---

## Lift State (onDragStart)

1. Snapshot `baseRotation = scrap.rotation`
2. Reset `velocity` to `{vx: 0, vy: 0}`
3. Kill any `activeTween` that's still running
4. `node.setAttrs({ shadowBlur: 12, shadowOffsetY: 8, shadowOffsetX: 0 })` — instant lift
5. `navigator.vibrate?.(10)` — light tick (no-op on unsupported platforms)

---

## Drop State (onDragEnd)

1. Kill `activeTween` if running
2. Capture final `{x, y}` from node
3. Check return-to-drawer condition (`y > stageHeight`) — if true, call `onReturn()` and skip animation
4. Otherwise, create and start a `Konva.Tween`:
   ```
   node: shapeRef.current
   duration: 0.5
   easing: Konva.Easings.ElasticEaseOut
   shadowBlur: 4
   shadowOffsetY: 3
   shadowOffsetX: 0
   skewX: 0
   rotation: baseRotation   // snap back to pre-drag rotation
   onFinish: () => {
     onChange({ x: node.x(), y: node.y(), rotation: baseRotation })
     activeTween.current = null
   }
   ```
5. Store tween in `activeTween` ref
6. `navigator.vibrate?.(30)` — thud

---

## Haptics

| Event | Pattern |
|---|---|
| Drag start | `navigator.vibrate(10)` — subtle tick |
| Drop | `navigator.vibrate(30)` — soft thud |

Both calls are guarded with optional chaining (`navigator.vibrate?.()`) to silently no-op on desktop.

---

## What Does Not Change

- `onTransformEnd` (scale/rotate via Transformer) — unchanged
- Pinch-to-zoom touch handling — unchanged
- Glued scraps (`isGlued: true`) — still non-draggable, no physics applied
- `TextItem` — not affected
- Parent components (`Scrapbook`, `App`) — no changes

---

## Constraints

- No new dependencies
- No changes to the `Scrap` type or data model
- All per-frame work happens in Konva's layer (no React re-renders during drag)
- `Konva` is imported directly from `'konva'` for `Tween` and `Easings`
