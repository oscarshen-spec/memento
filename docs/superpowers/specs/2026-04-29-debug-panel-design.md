# Debug Panel Design

**Date:** 2026-04-29  
**Status:** Approved

## Goal

Add a small always-visible debug button fixed at the bottom-left corner of the screen. Clicking it opens a floating panel with developer toggles. Initial toggle: Window Light overlay on/off.

## Architecture

A new `DebugPanel` component is rendered unconditionally in `App.tsx`, at the top of the z-stack (`z-[100]`). It owns its own open/closed state internally. The controlled state for each debug flag lives in `App.tsx` and is passed down as props.

The `windowLight` boolean currently hardcoded into the `WindowLight` render condition at line 933 of `App.tsx` becomes a piece of state (`debugWindowLight`, default `true`) passed to `DebugPanel`.

## Component: `DebugPanel`

**File:** `src/components/DebugPanel.tsx`

**Props:**
```ts
interface DebugPanelProps {
  windowLight: boolean;
  onWindowLightChange: (v: boolean) => void;
}
```

**Trigger button:**
- `position: fixed`, `bottom: 16px`, `left: 16px`
- 32×32px, `bg-black/40`, rounded-lg, `⚙` icon (lucide `Settings` or a unicode `⚙`)
- `z-[100]`, `pointer-events: auto`

**Panel:**
- Slides up from the button via Framer Motion `AnimatePresence` + `y` translate (`y: 8 → 0`, `opacity: 0 → 1`)
- Positioned `bottom: 56px`, `left: 16px` (just above the button)
- `w-[160px]`, `bg-black/60`, `backdrop-blur-sm`, `rounded-lg`, `p-3`
- Closes on outside click via a transparent full-screen backdrop (`z-[99]`) behind the panel

**Toggle row:**
```
Window Light   [●  ]
```
- `flex justify-between items-center`, `text-white/80 text-xs`
- Small pill toggle (CSS-only or Tailwind): 28×16px, `bg-white/20` off / `bg-amber-400` on
- Calls `onWindowLightChange(!windowLight)` on click

## App.tsx changes

1. Add `const [debugWindowLight, setDebugWindowLight] = useState(true)`
2. Replace line 933 condition:
   - Before: `{(view === 'scrapbook' || view === 'drawer') && <WindowLight />}`
   - After: `{debugWindowLight && (view === 'scrapbook' || view === 'drawer') && <WindowLight />}`
3. Render `<DebugPanel windowLight={debugWindowLight} onWindowLightChange={setDebugWindowLight} />` unconditionally near the end of the JSX tree (after the `WindowLight` line, before the camera/cutting overlays).

## Z-index Budget

| Layer | z-index |
|---|---|
| Backdrop (closes panel) | 99 |
| Debug button + panel | 100 |

This puts the debug UI above everything else including modals (z-[60]) and camera/cutting views (z-50).

## Extensibility

New debug rows follow the same pattern: add a prop pair to `DebugPanelProps`, add state in `App.tsx`, add a toggle row in `DebugPanel`. No structural changes needed.
