# Window Light Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a golden-hour window light ambient overlay to the scrapbook/desk view — warm flood from upper-left, two slow-drifting light shafts, and a right/bottom vignette — using a fixed CSS overlay animated by sine oscillators.

**Architecture:** A new `WindowLight` component renders a `position: fixed` div in `App.tsx` (not inside `Scrapbook.tsx`) because `PageFlipContainer` applies a CSS `transform: rotate(-2deg)` which breaks fixed positioning for children. The overlay is at `z-[25]` — above the desk and drawer (z-20) but below camera/cutting room views (z-50) and modals (z-[60]). Three sine oscillators at irrational frequency ratios drive CSS custom properties each rAF frame for an organic, non-repeating drift.

**Tech Stack:** React 19, TypeScript, CSS custom properties, `requestAnimationFrame`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/components/WindowLight.tsx` | Create | The overlay component with animation loop |
| `src/App.tsx` | Modify | Import and render `<WindowLight />` conditionally |

---

### Task 1: Create `WindowLight` component

**Files:**
- Create: `src/components/WindowLight.tsx`

- [ ] **Step 1: Write the component file**

```tsx
import { useEffect, useRef } from 'react';

export function WindowLight() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const shaftARef = useRef<HTMLDivElement>(null);
  const shaftBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const shaftA = shaftARef.current;
    const shaftB = shaftBRef.current;
    if (!overlay || !shaftA || !shaftB) return;

    let raf: number;

    const tick = () => {
      const t = Date.now();
      const o1 = Math.sin(t * 0.00008);
      const o2 = Math.sin(t * 0.000051);
      const o3 = Math.sin(t * 0.000073);

      const floodX = 10 + o1 * 4;
      const floodY = -10 + o1 * 3;
      overlay.style.setProperty('--flood-x', `${floodX}%`);
      overlay.style.setProperty('--flood-y', `${floodY}%`);

      shaftA.style.opacity = String(0.07 + o2 * 0.03);
      shaftA.style.transform = `rotate(${30 + o2 * 1.5}deg)`;

      shaftB.style.opacity = String(0.055 + o3 * 0.025);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
        ['--flood-x' as string]: '10%',
        ['--flood-y' as string]: '-10%',
      }}
    >
      {/* Flood: warm radial light from upper-left */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 120% 100% at var(--flood-x) var(--flood-y), rgba(255,195,80,0.55) 0%, rgba(255,175,60,0.2) 35%, transparent 65%)',
        }}
      />

      {/* Shaft A: wide blurred diagonal strip */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftARef}
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-10px',
            width: '160px',
            height: '200%',
            background: 'rgba(255,220,120,0.08)',
            transform: 'rotate(30deg)',
            transformOrigin: 'top left',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Shaft B: narrower blurred strip, offset */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftBRef}
          style={{
            position: 'absolute',
            top: '-50%',
            left: '60px',
            width: '80px',
            height: '200%',
            background: 'rgba(255,230,140,0.06)',
            transform: 'rotate(30deg)',
            transformOrigin: 'top left',
            filter: 'blur(8px)',
          }}
        />
      </div>

      {/* Vignette: static dark gradient, right + bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(145deg, transparent 30%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the file saved correctly**

Run: `cat src/components/WindowLight.tsx | head -5`  
Expected: `import { useEffect, useRef } from 'react';`

- [ ] **Step 3: Commit**

```bash
git add src/components/WindowLight.tsx
git commit -m "feat: add WindowLight ambient overlay component"
```

---

### Task 2: Mount `WindowLight` in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Context:** `WindowLight` must live in `App.tsx` (not inside `Scrapbook.tsx`) because `PageFlipContainer` applies `transform: rotate(-2deg)`, which breaks `position: fixed` for any descendant. The overlay should only appear when the scrapbook/desk is the active view — i.e., when `view` is `'scrapbook'` or `'drawer'`. Camera and cutting room render at z-50 and would visually cover it anyway, but conditionally rendering avoids a running rAF loop during those views.

- [ ] **Step 1: Add the import**

At the top of `src/App.tsx`, add alongside the other component imports:

```tsx
import { WindowLight } from './components/WindowLight';
```

- [ ] **Step 2: Render the component**

In `src/App.tsx`, find the `{/* Glue animation overlay */}` comment block (around line 932). Add `<WindowLight />` immediately before it, conditional on the view:

```tsx
{(view === 'scrapbook' || view === 'drawer') && <WindowLight />}

{/* Glue animation overlay — rendered outside Konva, fixed over the scrap */}
{gluingScrapId && glueAnimRect && glueToolRect && (
```

- [ ] **Step 3: Start the dev server and visually verify**

Run: `npm run dev`

Open the app. You should see:
- A warm golden-amber glow from the upper-left of the screen
- Two faint diagonal light shafts drifting slowly across the scene
- A darker shadow gradient toward the lower-right
- All elements (scraps, toolbar, drawer) remain fully interactive
- The effect disappears when opening camera or cutting room views

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount WindowLight overlay on scrapbook/desk view"
```
