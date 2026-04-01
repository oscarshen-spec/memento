# Scrapbook Canvas — Left-Bound Leather Journal Design

**Date:** 2026-03-31
**Status:** Approved

---

## Goal

Replace the current plain white canvas with a realistic left-bound leather journal. The page should feel like a physical lined notebook lying open on the wooden desk.

---

## Visual Design

### Structure (left → right)

| Zone | Width | Implementation |
|---|---|---|
| Leather spine | 36px | CSS `div` |
| Page stack edge | 14px | CSS `div` |
| Gutter shadow | 18px | CSS `div` |
| Main page / canvas | flex: 1 | `div` wrapping Konva `Stage` |

### 1. Leather Spine (CSS)

- **Width:** 36px
- **Border-radius:** 6px on the left corners only (`border-radius: 6px 0 0 6px`)
- **Background:** dark brown gradient simulating leather depth:
  `linear-gradient(to right, #2a1208, #5c2a10, #8a4020, #6b3018, #3a1808)`
- **Grain:** `repeating-linear-gradient` of transparent + `rgba(255,255,255,0.04)` every 6–7px (horizontal)
- **Gold title band:** absolute pseudo-element (`::after`) centred vertically, thin `rgba(212,170,80,0.4)` border, ~48px tall

### 2. Page Stack Edge (CSS)

- **Width:** 14px
- **Purpose:** simulates visible page thickness at the binding
- **Background:** `repeating-linear-gradient(0deg, #e8e0d0 0px, #e8e0d0 1px, #f5f0e8 1px, #f5f0e8 3px)` — alternating thin lines suggesting paper edges
- **Shadow:** `inset -3px 0 8px rgba(0,0,0,0.15)` — darkens toward the gutter

### 3. Gutter Shadow (CSS)

- **Width:** 18px
- **Background:** `linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0.12) 60%, transparent)` — simulates page curve away from spine
- No content, purely atmospheric depth

### 4. Main Page (CSS + Konva)

The page `div` wraps the Konva `Stage`. It has:
- `border-radius: 0 6px 6px 0`
- `box-shadow: inset -4px 0 12px rgba(0,0,0,0.06)` — subtle right-edge curl

#### Konva Layer 0 — Lined Paper Background

Drawn at Stage initialization, never cleared. Contains:

- **Base fill:** cream rectangle `#fefcf5` covering full stage dimensions
- **Ruled lines:** horizontal lines every 28px, color `#ccc5b5`, stroke-width 0.8
- **Top header rule:** single line at y=34, color `#ccc5b5`, stroke-width 1.5, opacity 0.5
- **Red margin:** vertical line at x=44, color `#e8a0a0`, stroke-width 1, opacity 0.55

This layer is redrawn whenever `dimensions` change (resize).

#### Konva Layer 1 — Scraps & Journal Entries (existing)

No changes to scrap or journal entry logic. Layer 1 receives all existing `ScrapItem` and `TextItem` elements exactly as before.

---

## Component Changes

### `src/components/Scrapbook.tsx`

- Remove `paper-texture` and `scrapbook-container` from the outer `div`'s className (these are replaced by `.page` in the new book layout)
- Add a new `<Layer>` (Layer 0) before the existing `<Layer>` (Layer 1)
- Layer 0 renders: background rect + ruled lines + margin line + header rule, all as Konva `Line`/`Rect` shapes
- Layer 0 re-renders when `dimensions` prop changes
- Konva `Stage` background color set to `transparent` (default) — the `.page` div behind it provides the cream base as fallback

### `src/App.tsx`

- Replace the current `.scrapbook-container` wrapping `div` with a new `.book-container` flex layout
- `.book-container` contains: `.spine` + `.page-stack` + `.gutter` + `.page` (which wraps `<Scrapbook />`)

### `src/index.css`

Add CSS classes:

```
.book-container   — flex row, drop-shadow, border-radius 6px
.spine            — 36px, leather gradient, grain, gold band pseudo-element
.page-stack       — 14px, repeating paper-edge lines
.gutter           — 18px, gradient shadow
.page             — flex:1, border-radius 0 6px 6px 0, inset shadow
```

Remove or replace `.scrapbook-container` (no longer needed).

---

## What Does NOT Change

- Scrap cutting, gluing, peeling logic
- Journal entry placement
- MaterialDrawer, CameraView, CuttingRoom components
- App-level state management
- Dimensions calculation (`getScrapbookDimensions`)

---

## Open Questions / Out of Scope

- Page texture is **lined paper** only for now. Switching between Kraft / Dot Grid / Plain is a future feature.
- The leather cover color (`#5c2a10` family) is fixed. A color picker is out of scope.
- Export (Share feature) will naturally include Layer 0 since it's part of the Konva Stage.
