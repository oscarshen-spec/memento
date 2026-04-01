# Tape Sound Effect Design

**Date:** 2026-04-01
**Status:** Approved

---

## Context

The app has a growing sound design system (`src/services/soundService.ts`) built on the native Web Audio API with fully procedural synthesis. Glue and peel sounds are already implemented. The washi tape tool (`TapeLayer.tsx`) is currently silent — adding sound completes the tactile loop for the tape gesture and aligns with the project's "material sound design" philosophy.

---

## Sound Design

### Pull Rasp (continuous, while dragging)

A gentle, low-level white noise filtered to the papery frequency range of washi tape being pulled off a roll.

| Parameter | Value |
|-----------|-------|
| Source | White noise (looping AudioBuffer) |
| Filter | BiquadFilter — bandpass, frequency 1200 Hz, Q 1.5 |
| Gain | 0.04 (quiet, subtle) |
| Duration | Runs from drag start until drag end |
| Fade-out | 40ms linear gain ramp to 0 on stop (prevents click) |

### Tape Rip (one-shot, on lift)

A short burst capturing the high-to-mid frequency sweep of tape tearing off the roll.

| Parameter | Value |
|-----------|-------|
| Source | White noise (short AudioBuffer ~120ms) |
| Filter | BiquadFilter — bandpass, frequency sweeps 2800 Hz → 1400 Hz over 100ms |
| Gain envelope | 0.35 → 0 exponential decay over 100ms |
| Total duration | ~100ms |

---

## API

### soundService.ts additions

```typescript
// New export — start continuous pull rasp, returns stop function
export function startTapePull(): () => void

// New SoundName entry
export type SoundName = ... | 'tapeRip'

// tapeRip added to soundFns map internally
```

`startTapePull()` creates the noise source, filter, and gain chain; starts playback; and returns a closure that fades out and disconnects all nodes. Follows the same `getCtx()` + silent-fail pattern as existing sounds.

---

## Component Changes

### TapeLayer.tsx

- Add `const stopPullRef = useRef<(() => void) | null>(null)`
- `handleDown` → `stopPullRef.current = startTapePull()`
- `handleUp` → `stopPullRef.current?.(); stopPullRef.current = null; playSound('tapeRip')`
- `useEffect` cleanup → `return () => stopPullRef.current?.()` (guards unmount mid-gesture)

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/soundService.ts` | Add `startTapePull()` export + `'tapeRip'` to `SoundName` + rip synthesis in `soundFns` |
| `src/components/TapeLayer.tsx` | Import `startTapePull` + `playSound`; add stop ref; hook into `handleDown`, `handleUp`, and effect cleanup |

No other files need changes.

---

## Verification

1. Open the app with the tape tool active.
2. Press and hold on the canvas — you should hear a faint continuous rasp.
3. Drag across the canvas — rasp continues steadily.
4. Lift finger — rasp stops cleanly, followed immediately by a short papery rip.
5. Place several strips in rapid succession — no audio artifacts, no overlapping nodes.
6. Interrupt mid-gesture (component unmount or tool switch) — no hanging audio nodes (verify via browser AudioContext inspector).
