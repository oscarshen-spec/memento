# Memento — Analog Scrapbook

A digital scrapbook app that recreates the tactile, meditative experience of making a physical collage. Every cut, tear, and glue placement is deliberate — intentional friction is the point.

## Core Philosophy

**"Intentional Friction."** Optimize for the *process* of making, not efficiency of output. If something feels too easy, it loses emotional value. This is a meditative, sensory experience — not a productivity tool.

## Features

- **Camera-first capture** — snap photos or import images into a messy scrap drawer
- **Cutting mat** — trace-to-cut with natural wobble, or two-finger tear with jagged paper fringe
- **Free-form canvas** — drag, rotate, scale with no grid snapping; paper textures: Kraft, White, Grid, Lined
- **Glue & peel** — long-press to glue items flat; pinch to peel, leaving a permanent residue mark
- **Washi tape** — draw-to-tape with semi-transparent patterns
- **Handwriting** — variable-width ink brush, no auto-smoothing
- **Page flip** — physical book navigation with page-flip animation
- **Sound design** — scissors snip, paper tear, glue thud, printer feed
- **Export** — save finished pages as images

## Tech Stack

- React 19, TypeScript, Vite 6
- Tailwind CSS v4
- Konva / react-konva (canvas rendering)
- Framer Motion (animations)
- WebGL (paper tear edge effects)
- `@google/genai` (Gemini — AI-generated wood textures)

## Project Structure

```
src/
  App.tsx                     # Top-level state & view routing
  types.ts                    # Core types: Scrap, JournalEntry, ScrapbookPage, RawMaterial
  components/
    HomeView.tsx               # Landing / home screen
    CameraView.tsx             # Photo capture
    CuttingRoom.tsx            # Cutting mat orchestrator
    ScissorsCutView.tsx        # Trace-to-cut interaction
    TearCutView.tsx            # Two-finger tear interaction
    Scrapbook.tsx              # Page canvas & composition
    MaterialDrawer.tsx         # Scrap drawer tray
    DrawerTray.tsx             # Drawer UI shell
    TapeLayer.tsx              # Washi tape drawing layer
    TapePatternPicker.tsx      # Tape pattern selector
    JournalModal.tsx           # Journal entry UI
    PageFlipContainer.tsx      # Page-flip book wrapper
    PrinterPaper.tsx           # Printer receipt animation
    Gallery.tsx                # Saved pages gallery
    ExportOverlay.tsx          # Export / share flow
    GlueAnimation.tsx          # Long-press glue feedback
  effects/
    PaperTearBorderEffect.ts   # CSS/canvas tear border
    webglPaperTear.ts          # WebGL tear edge renderer
  services/
    soundService.ts            # Audio: scissors, tear, glue, printer
  utils/
    scrapUtils.ts              # Scrap geometry helpers
    drawerScatter.ts           # Random drawer layout
    flipUtils.ts               # Page flip logic
    materialStatus.ts          # Material state transitions
    rasterizePolygon.ts        # Cut-path to masked image
    compressImage.ts           # Image compression before storage
```

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Add your Gemini API key to `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
