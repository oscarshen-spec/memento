# Tape Sound Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuous pull rasp + tear rip sound to the washi tape tool.

**Architecture:** Two new sound functions in the existing `soundService.ts` — a startable/stoppable continuous noise for the pull, and a one-shot rip burst. `TapeLayer.tsx` wires them into its existing gesture handlers via a stop-function ref.

**Tech Stack:** Native Web Audio API (no new dependencies)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/soundService.ts` | Modify | Add `startTapePull()` export + `'tapeRip'` sound |
| `src/components/TapeLayer.tsx` | Modify | Wire sound start/stop into gesture handlers |

---

### Task 1: Add tape sounds to soundService

**Files:**
- Modify: `src/services/soundService.ts`

- [ ] **Step 1: Add `'tapeRip'` to SoundName union**

```typescript
export type SoundName =
  | 'wobbleStart'
  | 'paperRustle'
  | 'cardFlip'
  | 'glueSpread'
  | 'glueThud'
  | 'settle'
  | 'peel'
  | 'sparkle'
  | 'tapeRip';
```

- [ ] **Step 2: Add `tapeRip` function (before `wobbleStart`)**

```typescript
function tapeRip() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const noise = whiteNoise(ctx, 0.12);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2800, t);
  filter.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.12);
}
```

- [ ] **Step 3: Add `tapeRip` to `soundFns` map**

```typescript
const soundFns: Record<SoundName, () => void> = {
  wobbleStart,
  paperRustle,
  cardFlip,
  glueSpread,
  glueThud,
  settle,
  peel,
  sparkle,
  tapeRip,
};
```

- [ ] **Step 4: Add `startTapePull` export (after `playSound`)**

```typescript
/**
 * Starts a continuous tape-pull rasp sound. Returns a function to stop it.
 * The stop function fades out over 40ms to prevent audio clicks.
 */
export function startTapePull(): () => void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Looping white noise buffer (1 second, looped)
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04);
      source.stop(now + 0.05);
    };
  } catch {
    return () => {};
  }
}
```

- [ ] **Step 5: Verify file compiles**

Run: `npx tsc --noEmit src/services/soundService.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/soundService.ts
git commit -m "feat: add tape pull rasp and rip sounds to soundService"
```

---

### Task 2: Wire sounds into TapeLayer

**Files:**
- Modify: `src/components/TapeLayer.tsx`

- [ ] **Step 1: Add imports**

Change the existing import line at the top of the file:

```typescript
import React, { useState, useRef, useEffect } from 'react';
```

Add a new import after the existing imports:

```typescript
import { startTapePull, playSound } from '../services/soundService';
```

- [ ] **Step 2: Add stop ref inside the component**

Inside the `TapeLayer` component, right after the existing `ipRef` declaration (line 202), add:

```typescript
const stopPullRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 3: Start pull sound in `handleDown`**

Add at the end of `handleDown`, after `setInProgress({ ...ip });` (line 232):

```typescript
    stopPullRef.current = startTapePull();
```

- [ ] **Step 4: Stop pull + play rip in `finalize`**

Add at the very beginning of `finalize`, before `ipRef.current = null;` (line 210):

```typescript
    stopPullRef.current?.();
    stopPullRef.current = null;
```

Add after the `onStripAdded(...)` call (after line 219), before the closing brace of finalize:

```typescript
    playSound('tapeRip');
```

This ensures the pull sound always stops (even for too-short gestures), but the rip only plays when a strip is actually placed.

- [ ] **Step 5: Add cleanup effect**

Add after the `stopPullRef` declaration:

```typescript
useEffect(() => {
  return () => { stopPullRef.current?.(); };
}, []);
```

- [ ] **Step 6: Verify build compiles**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/TapeLayer.tsx
git commit -m "feat: wire tape pull/rip sounds into TapeLayer gesture handlers"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Test tape sound in browser**

Run: `npx vite dev`

1. Open the app, activate the tape tool.
2. Press and hold on the canvas — faint continuous rasp should start.
3. Drag across — rasp continues steadily.
4. Lift finger — rasp stops cleanly, crisp papery rip plays.
5. Place 3-4 strips quickly — no audio overlap/artifacts.
6. Start drawing tape, then deviate direction sharply (auto-tear) — rasp stops, rip plays.
7. Start drawing tape, barely move, lift — rasp stops, no rip (gesture too short).
