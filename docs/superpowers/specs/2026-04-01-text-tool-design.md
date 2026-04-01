# Text Tool — Design Spec
**Date:** 2026-04-01

## Overview

A text tool that lets users type text onto the scrapbook canvas using a full-screen overlay inspired by Instagram Stories. Activated by a toolbar icon, the overlay opens immediately with the keyboard, the user picks font style and color inline, then taps Done to place the text as a draggable/rotatable element on the canvas.

---

## Entry Point

A text icon (`T` with serifs — using the lucide `Type` icon or equivalent SVG) is added to the top-left toolbar in `App.tsx`, immediately to the right of the existing tape roll icon. Icon-only, no label. Same active/inactive styling as the tape icon:

- **Inactive**: `text-white/50 hover:bg-white/10 hover:text-white/70`
- **Active**: `bg-white/15 text-white/90`

`activeTool` state in `App.tsx` gains a new value: `'text'`. Selecting it deactivates tape (and vice versa).

---

## Text Overlay

When `activeTool === 'text'`, a full-screen dark overlay renders over everything (z-50). It consists of three vertical zones:

### 1. Top Bar
- **Done** button — top-right, white text. Tapping it commits the current text and settings, places a `JournalEntry` at the center of the canvas, and closes the overlay. Disabled/hidden if text is empty.
- Background: `bg-black/80 backdrop-blur-sm`

### 2. Text Display Area (center)
- A transparent `<textarea>` with `autoFocus` so the keyboard opens immediately on mount.
- Text renders centered, large (font size determined by size control, default medium = 28px).
- Font family and color update live as controls change.
- No visible input border — text appears to float on the dark background.
- Cursor blink is visible.

### 3. Controls (pinned above keyboard)
Two-row control area, `position: fixed; bottom: 0` so it stays above the native keyboard.

#### Bottom row — icon toggle (always visible)
Two icons only:
- **Aa** — activates font panel in upper row (default active state on open)
- **Color wheel** — activates color panel in upper row

Active icon has a dim white background pill; inactive is muted opacity.

#### Upper row — contextual panel (switches based on active icon)

**When Aa is active — Font Tiles:**
Four tiles in a horizontal strip:
| Label | Font family | Style |
|---|---|---|
| Serif | Cormorant Garamond | italic bold |
| Sans | Inter | normal 600 |
| Mono | Courier New / monospace | normal |
| Hand | Caveat (Google Font — must be added to the `@import` in `src/index.css`) | normal |

Selected tile: white background, dark text. Unselected: `rgba(255,255,255,0.1)` background, white text. Default: Serif.

**When color wheel is active — Color Picker:**
Two sub-rows:
1. **Gradient strip** — full-width horizontal bar, `border-radius: 14px`, gradient from white → red → orange → yellow → green → cyan → blue → purple → magenta → black. A circular thumb (24px, white border, colored fill) slides along it. Dragging updates text color live.
2. **Quick-pick swatches** — 8 preset circles below the strip: white, red, orange, yellow, green, blue, purple, black. Tapping a swatch snaps the thumb and updates color instantly.

---

## Data Model Changes

`JournalEntry` in `src/types.ts` gains two optional fields:

```ts
fontFamily?: string  // e.g. 'Cormorant Garamond', 'Inter', 'Courier New', 'Caveat'
color?: string       // CSS color string, e.g. '#e8a87c', '#000000'
```

Existing entries without these fields default to current behavior (Cormorant Garamond italic, `#1a1a1a`).

---

## Canvas Rendering

`TextItem` in `src/components/Scrapbook.tsx` reads `entry.fontFamily` and `entry.color` if present, falling back to current defaults. No other changes to `TextItem`.

---

## Placement on Done

`handleAddJournal` in `App.tsx` is updated (or a new handler added) to accept `fontFamily` and `color`. The placed entry:
- `x`: center of canvas (`(bookDims.width - 68) / 2 - estimated_text_width / 2`)
- `y`: center of canvas (`bookDims.height / 2`)
- `rotation`: slight random tilt `(Math.random() - 0.5) * 5`
- `type`: `'body'` (semantic type unused in new tool)
- `fontSize`: driven by size selection (small=16, medium=28, large=44)

---

## New Component

`src/components/TextOverlay.tsx` — self-contained component. Props:

```ts
interface TextOverlayProps {
  onAdd: (text: string, fontFamily: string, color: string, fontSize: number) => void;
  onClose: () => void;
}
```

No dependency on `JournalModal` — that component is untouched.

---

## What Is NOT in Scope

- Text alignment toggle (not requested)
- Multi-line wrapping control
- Editing existing text elements (tap-to-edit on canvas)
- Undo/redo
