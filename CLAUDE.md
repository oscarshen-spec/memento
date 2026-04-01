# Analog Scrapbook — Development Guide

## What Is It
A scrapbook app that mimics the experience of making a physical scrapbook collage.

---

## Design Direction

**Authenticity**
- Visual imperfection
- Material sound design
- Gestures
- Haptic (maybe?)

**Camera-First Material Creation**
- Users have to take photos to make their own scrap materials

**Intentional Friction**
- Manual cutting or gluing gestures required

---

## Core Philosophy
**"Intentional Friction."** Optimize for the *process* of making, not efficiency of output. If something feels too easy, it loses emotional value. This is a meditative, sensory experience — not a productivity tool.

---

## Tech Stack
- React 19, TypeScript, Vite 6
- Tailwind CSS v4
- Konva / react-konva (canvas)
- Framer Motion (animations)
- `@google/genai` (Gemini — wood texture generation)
- canvas-confetti, lucide-react

## Project Structure
```
src/
  App.tsx                  # Top-level state & view routing
  types.ts                 # Core types: Scrap, JournalEntry, ScrapbookPage, RawMaterial, Point
  components/
    CameraView.tsx
    CuttingRoom.tsx
    Scrapbook.tsx
    MaterialDrawer.tsx
    JournalModal.tsx
    TextureProvider.tsx    # Gemini-powered wood texture context
  services/
    textureService.ts      # generateWoodTexture() via gemini-2.5-flash-image
```

## Environment
Requires `GEMINI_API_KEY` in `.env.local` for AI-generated wood textures.

---

## PRD: Feature Specifications

### User Flow (Phases)
1. **Capture** (Utility) — Frictionless photo/texture gathering into Scrap Drawer
2. **Prepare** (Craft) — Trace-to-cut or tear photos on Cutting Mat
3. **Compose** (Craft) — Free-form arrangement on textured Canvas
4. **Reflect** (Craft) — Handwriting and gluing elements down permanently
5. **Share** (Utility) — Export finished page as high-res image

### Detailed Step-by-Step Flow
**Capture & Gather Materials:**
Open camera and snap a photo / or upload photo → Add to scrap drawer (a messy tray of all the captured materials)

**Cut & Shape your scraps:**
Pick from drawer → Cut it out → Tear it

**Build Your Page:**
Open a scrapbook → Choose a Page → Place & Arrange → Glue it down

**Journal:**
Add a Title → Enter journal → Tag the date

**Share:**
Save Progress → Share it to social media

### 3.1 Scrap Drawer
- Persistent scrollable tray at bottom of screen
- Items appear as "messy pile" (random rotation −5° to +5°)
- Data model: `id`, `sourceUri`, `type: 'raw_photo' | 'cut_scrap' | 'torn_scrap'`, `geometry`

### 3.2 Cutting Mat
**Trace-to-Cut:**
- Input: single-finger touch drag
- Add 2–3px natural wobble to line (no pixel-perfect cuts)
- Auto-close path if finger lifts within 20px of start point
- Output: masked image from path

**Two-Finger Tear:**
- Input: two fingers pulling opposite directions
- Generate randomized jagged path between fingers
- Apply slight white "paper fringe" filter to tear edges

### 3.3 Page Canvas
- No grid snapping — 360° rotation, free scaling
- Paper textures: Kraft, White, Grid, Lined
- State: `loose_elements` (free, with shadow), `glued_elements` (locked, flat shadow), `residue_marks` (where items were peeled)

### 3.4 Glue & Peel (Core Differentiator)
**Glue:**
- Trigger: long-press 800ms on loose element
- Feedback: radial progress bar → "wet glue" pulse animation
- Effect: lock position, reduce shadow depth (now flat against page)

**Peel:**
- Trigger: pinch-and-lift on glued item
- Effect: returns to loose state
- Permanent side effect: `ResidueMark` (faint semi-transparent stain) left on background

### 3.5 Handwriting
- Variable-width brush mimicking real ink flow
- No auto-smoothing
- Pen types: Black ink, Pencil

### 3.6 Washi Tape
- Draw-to-tape tool with semi-transparent texture

---

## Visual & Interaction Rules

**Shadows:**
- Loose items: high blur/offset (lifted appearance)
- Glued items: sharp, low-offset shadow (flat against page)

**Haptics:**
- Light ticks while tracing
- Heavy "thud" for gluing
- "Rip" vibration for tearing

**Friction Mapping:**
- Low friction (instant): photo capture, saving, navigation
- High friction (intentional/manual): cutting, gluing, peeling — do NOT automate these

---

## MVP Checklist
- [ ] Camera/Import: photo capture to drawer
- [ ] Cutting Workspace: trace-to-cut
- [ ] Canvas: drag / drop / rotate / scale
- [ ] Glue System: long-press lock + peel residue
- [ ] Handwriting: black ink + pencil
- [ ] Washi Tape: draw-to-tape tool
- [ ] Auto-Save: local storage, every 2s of inactivity

---

## Required Assets
**Sounds:** `scissors_snip.wav`, `paper_tear.wav`, `glue_thud.wav`, `peel_sticky.wav`
**Textures:** High-res seamless Kraft paper, Grid paper
