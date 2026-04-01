# Wood Desk UI Design
**Date:** 2026-03-31

## Goal
Redesign the app's visual environment to feel like a real physical desktop: a dark-walled room, a cedar/mahogany desk surface sitting in front of it, a visible desk edge lip, and a recessed drawer front with a brass pull. Materials remain inside the drawer and are only visible when the drawer is open.

---

## Layout (App.tsx)

- The outer container (`div.wood-texture`) remains the desk surface.
- The `body` background becomes the dark wall — no desk texture on body.
- Add one new `<div class="desk-edge">` element between the desk area and the drawer area in `App.tsx`. This 8px strip simulates the physical front thickness of the desk.

```
┌─────────────────────────────┐
│  dark wall (body #0f0805)   │  ~14% height
├─────────────────────────────┤
│  desk-edge lip (8px strip)  │
├─────────────────────────────┤
│                             │
│  desk surface (wood-texture)│  ~80vh
│     [ scrapbook page ]      │
│                             │
├─────────────────────────────┤
│  drawer (20vh)              │
│  - closed: only brass handle visible
│  - open: materials grid visible inside
└─────────────────────────────┘
```

---

## CSS (`index.css`)

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Wall | `#0f0805` | `body` background |
| Desk surface | `#8b5e3c` | `.wood-texture` base |
| Desk edge | `#b07848 → #6b3f22` | `.desk-edge` gradient |
| Drawer front | `#5a2e10` | `.drawer-front` base |
| Brass | `#d4aa50 → #8a6020 → #d4aa50` | `.drawer-handle` |

### Class changes
- **`body`**: background color `#0f0805`, no background image.
- **`.wood-texture`**: base `#8b5e3c`, CSS grain lines, `var(--desk-texture)` from Gemini only. Remove Unsplash URL.
- **`.desk-edge`** *(new)*: 8px height, gradient `#b07848 → #6b3f22`, `box-shadow: 0 4px 12px rgba(0,0,0,0.6)`.
- **`.drawer-front`**: base `#5a2e10`, `var(--drawer-texture)` from Gemini only. Remove Unsplash URL. Add `inset 0 3px 12px rgba(0,0,0,0.3)` for recessed look.
- **`.drawer-handle`**: warm brass gradient (`#d4aa50 → #8a6020 → #d4aa50`). The existing `::before`/`::after` pseudo-elements (currently used for side brackets) are restyled as small dark screw circles at each end of the handle.

---

## Gemini Prompts (`TextureProvider.tsx`)

Only the prompt strings change — no structural changes.

- **Desk prompt:** `"A seamless top-down macro photograph of a polished cedar or mahogany wood desktop surface. Warm red-brown tones, visible wood grain, natural finish. No objects, no people."`
- **Drawer prompt:** `"A seamless top-down macro photograph of a cedar or mahogany wood surface, slightly darker and more matte than a desktop, suitable for a drawer front. Warm deep red-brown tones. No objects, no people."`

---

## What Does NOT Change
- `MaterialDrawer.tsx` structure — materials remain inside the drawer body, visible only when open.
- `TextureProvider.tsx` context API, loading state, CSS variable injection.
- `textureService.ts` — no changes.
- All other components (Scrapbook, CuttingRoom, CameraView, JournalModal).
