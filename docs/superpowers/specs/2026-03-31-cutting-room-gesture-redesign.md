# CuttingRoom Gesture Redesign

**Date:** 2026-03-31
**Scope:** Replace explicit Cut/Tear mode toggle with a pure gesture-based state machine. Cut mode removed from this version. Tear is the only output gesture.

---

## Overview

The CuttingRoom interaction model switches from explicit UI mode buttons to a touch-driven state machine. The user never taps a button to choose "tear" — the gesture itself determines intent. A short touch = pan/zoom; a held touch = anchor for tear; a second finger while anchored = rip.

---

## State Machine

Seven states. All transitions are touch-event driven except `touchcancel` which is a global override.

```
idle
  → pending         1 finger touches down (start 400ms timer)

pending
  → anchored        400ms timer fires without movement
  → panning         2nd finger arrives (cancel timer)
  → idle            finger lifts before timer fires (tap, no-op)

panning             2-finger pan/zoom
  → idle            returns to 0 fingers (forced fresh start)
                    NOTE: dropping from 2→1 finger does NOT enter pending —
                    prevents accidental cut paths at the end of zoom gestures.

anchored            Finger A locked, waiting for Finger B
  → ripping         2nd finger touches down
  → idle            Finger A lifts (cancel)

ripping             Finger B swiping, amber trail preview live
  → torn            Finger B lifts (generate tear polygon immediately)
  → idle            Finger A lifts (cancel)

torn                tear polygon exists, confirm button visible
  → idle            Cancel button / Reset button
  → pending         1 finger touches down (implicit discard of previous tear)

ANY STATE → idle    touchcancel fires (system interruption: phone call, home swipe, etc.)
```

---

## Data Model

### Remove
- `mode: 'cut' | 'tear'`
- `isDraggingTear`, `tearStart`, `tearEnd`, `isDrawing`
- `points: Point[]` (cut path — cut removed from this version)

### Add

| Field | Type | Purpose |
|---|---|---|
| `gestureState` | `'idle' \| 'pending' \| 'panning' \| 'anchored' \| 'ripping' \| 'torn'` | Active state machine node |
| `fingerA` | `{ id: number; pos: Point } \| null` | The anchoring touch (Finger A) |
| `fingerB` | `{ id: number; pos: Point; trail: Point[] } \| null` | The ripping touch + full historical path |
| `longPressTimer` | `useRef<ReturnType<typeof setTimeout>>` | 400ms anchor timer |
| `panRef` | `useRef<{ dist: number; mid: Point }>` | Initial pinch snapshot for zoom math |
| `canvasTransform` | `{ x: number; y: number; scale: number }` | Pan/zoom state applied to canvas ctx |
| `ripSpeed` | `useRef<number[]>` | Finger B velocity samples in px/ms |
| `tearPolygon` | `Point[] \| null` | Finalized tear polygon |

### Speed → Roughness Mapping
Velocity computed live during each `touchmove` while `ripping`: take `distance(prevPos, newPos) / (performance.now() - prevTimestamp)` and push the result to `ripSpeed` ref. `fingerB.trail` stays `Point[]` — no timestamps stored there.

- `< 0.5 px/ms` → roughness `0.3` (gentle, clean tear)
- `> 3.0 px/ms` → roughness `2.0` (fast, ragged tear)
- Linearly interpolated, clamped at both ends
- Final roughness = average of all `ripSpeed` samples at Finger B lift

`generateTearPolygon` signature changes from `(start, end, cw, ch)` to `(trail: Point[], roughness: number, cw: number, ch: number)`. Internally it still uses `trail[0]` and `trail[trail.length-1]` as the start/end anchor points for the polygon boundary — the trail is used for live preview drawing and speed computation, not for reshaping the polygon path itself. Roughness scales the noise amplitude coefficient.

---

## Touch Event Handlers

### `onTouchStart`
- **In `idle`**, 1 new touch: record `fingerA`, set `gestureState = 'pending'`, start 400ms timer
- **In `pending`**, 2nd touch arrives: cancel timer, snapshot pinch for `panRef`, set `gestureState = 'panning'`
- **In `anchored`**, 2nd touch arrives: record `fingerB` with empty trail, set `gestureState = 'ripping'`
- **In `torn`**, 1 new touch: discard `tearPolygon`, set `gestureState = 'pending'`, start timer

### `onTouchMove`
- **`pending`**: no movement threshold check needed — 400ms hold determines intent
- **`panning`**: recompute scale from new pinch distance vs `panRef.dist`, recompute translation from midpoint delta, update `canvasTransform`
- **`anchored`**: no action (Finger A is locked)
- **`ripping`**: update `fingerB.pos`, append to `fingerB.trail`, compute velocity sample into `ripSpeed`

### `onTouchEnd`
- **`pending`**, Finger A lifts: cancel timer, `gestureState = 'idle'`
- **`panning`**, touch count reaches 0: `gestureState = 'idle'`
- **`anchored`**, Finger A lifts: cancel, `gestureState = 'idle'`
- **`ripping`**, Finger B lifts: compute avg roughness from `ripSpeed`, call `generateTearPolygon(fingerB.trail, roughness)`, set `tearPolygon`, `gestureState = 'torn'`
- **`ripping`**, Finger A lifts: cancel rip, `gestureState = 'idle'`

### `onTouchCancel`
- Any state: cancel timer, clear all finger refs, `gestureState = 'idle'`

---

## Canvas Rendering

| State | Overlay |
|---|---|
| `idle` / `pending` | None. Image at current `canvasTransform`. |
| `panning` | None. Image redraws as transform updates. |
| `anchored` | Amber pulsing ring at `fingerA.pos`. Requires a `requestAnimationFrame` loop started on entering `anchored` and cancelled on exit — the reactive `draw()` alone cannot drive animation. |
| `ripping` | Amber dashed polyline along `fingerB.trail` (`#F59E0B`, lineWidth 2, dash `[10, 6]`). |
| `torn` | White jagged polygon outline over the torn region. |

All canvas drawing applies `ctx.setTransform(scale, 0, 0, scale, x, y)` before rendering so the image and overlays respect pan/zoom state.

---

## Hint Text

Replaces the old mode toggle label under the title:

| State | Text |
|---|---|
| `idle` | "Hold to anchor, swipe to tear" |
| `pending` | "Hold…" |
| `anchored` | "Now swipe to rip" |
| `ripping` / `torn` | — |

---

## UI Changes

- **Remove:** Cut/Tear toggle buttons
- **Remove:** "FINISH CUT" button path
- **Keep:** Reset button (always visible), Cancel/X button (always visible)
- **Add:** "KEEP PIECE" confirm button — visible only in `torn` state
- No confirm button during `ripping` — tear finalizes immediately on Finger B lift
