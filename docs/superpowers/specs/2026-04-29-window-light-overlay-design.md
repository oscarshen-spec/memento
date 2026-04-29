# Window Light Overlay — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

---

## Summary

Add a CSS+JS ambient light overlay to the main scrapbook view that simulates sitting at a real desk beside a window. The effect is "Golden Hour" in character: strong directional sunlight from the upper-left, visible soft light shafts, and a deep vignette shadow on the right and bottom. The light drifts slowly and organically using sine wave oscillators — never looping in a detectable pattern.

---

## Scope

- **Applies to:** scrapbook/desk view only (`Scrapbook.tsx`)
- **Excluded views:** camera, cutting room, gallery, journal modal
- **Performance target:** ≤ 0.1 ms per animation frame
- **Interaction:** `pointer-events: none` — the overlay is fully transparent to touch/mouse

---

## Component: `WindowLight`

New file: `src/components/WindowLight.tsx`

A single functional component that renders a fixed full-screen overlay div containing four absolutely-positioned child layers. Accepts no props.

### Mounting

Rendered inside `Scrapbook.tsx`, unconditionally (it's already only mounted when the scrapbook view is active).

### DOM Structure

```
<div ref={overlayRef} style="position:fixed;inset:0;pointer-events:none;z-index:50">
  <div class="layer-flood" />     <!-- radial gradient, upper-left warm light -->
  <div class="layer-shaft-a" />   <!-- wide blurred diagonal strip -->
  <div class="layer-shaft-b" />   <!-- narrower blurred diagonal strip, offset -->
  <div class="layer-vignette" />  <!-- static dark gradient, right + bottom -->
</div>
```

### Layer Definitions

**Flood** (`layer-flood`)
- `background: radial-gradient(ellipse 120% 100% at var(--flood-x) var(--flood-y), rgba(255,195,80,0.55) 0%, rgba(255,175,60,0.2) 35%, transparent 65%)`
- Default `--flood-x: 10%`, `--flood-y: -10%`
- Animated: center wanders ±4% x, ±3% y

**Shaft A** (`layer-shaft-a`)
- Blurred rotated strip: `width: 160px; height: 200%; top: -50%; left: -10px; background: rgba(255,220,120,0.08); transform: rotate(30deg); transform-origin: top left; filter: blur(6px)`
- Opacity animated: 0.04–0.10
- Rotation animated: 30° ± 1.5°

**Shaft B** (`layer-shaft-b`)
- Same structure, `left: 60px`, narrower (`width: 80px`), `background: rgba(255,230,140,0.06)`
- Opacity animated independently: 0.03–0.08

**Vignette** (static)
- `background: linear-gradient(145deg, transparent 30%, rgba(0,0,0,0.35) 100%)`
- Not animated

---

## Animation System

A `useEffect` starts a `requestAnimationFrame` loop on mount and cancels it via the cleanup return.

### Oscillators

Three sine oscillators driven by `Date.now()`. Frequencies are irrational ratios so they never re-synchronise:

| Oscillator | Frequency factor | Controls |
|---|---|---|
| O1 | 0.00008 | Flood center x/y |
| O2 | 0.000051 | Shaft A opacity + rotation offset |
| O3 | 0.000073 | Shaft B opacity |

Each frame:
```
t = Date.now()
o1 = Math.sin(t * 0.00008)
o2 = Math.sin(t * 0.000051)
o3 = Math.sin(t * 0.000073)

floodX = 10 + o1 * 4          // 6%–14%
floodY = -10 + o1 * 3         // -13%–-7%
shaftAOpacity = 0.07 + o2 * 0.03
shaftARotation = 30 + o2 * 1.5
shaftBOpacity = 0.055 + o3 * 0.025
```

Values written via `el.style.setProperty('--prop', value)` on the overlay element. Shaft opacity and rotation are set directly on the child element's style.

---

## Integration

In `Scrapbook.tsx`, import and render `<WindowLight />` as the first child inside the outermost container div, before the canvas/konva layer.

---

## Non-Goals

- No animation on other views
- No user controls (intensity slider, on/off toggle)
- No WebGL or canvas rendering
- No time-of-day variation
