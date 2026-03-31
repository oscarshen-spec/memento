# Wood Texture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Gemini AI prompts and CSS fallback colors so the desk shows rustic horizontal wood planks and the drawer shows a smooth seamless grain.

**Architecture:** Three surgical edits — the default prompt in `textureService.ts`, both call-site prompts in `TextureProvider.tsx`, and the two fallback `background-color` values in `index.css`. No new files, no new dependencies, no logic changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, `@google/genai` (Gemini)

---

### Task 1: Update default prompt in textureService.ts

**Files:**
- Modify: `src/services/textureService.ts:5`

This file holds the fallback prompt used when `generateWoodTexture()` is called without an argument. Update it to the new desk plank description so it stays in sync with the explicit call in `TextureProvider`.

- [ ] **Step 1: Open the file and locate the default parameter**

The default prompt is the string literal on line 5 of `src/services/textureService.ts`:

```ts
export const generateWoodTexture = async (prompt: string = "A seamless top-down macro photograph of a polished cedar or mahogany wood desktop surface. Warm red-brown tones, visible wood grain, natural finish. No objects, no people.") => {
```

- [ ] **Step 2: Replace the default prompt**

Change the default parameter string to:

```ts
export const generateWoodTexture = async (prompt: string = "A seamless top-down photograph of a rustic hardwood floor or workbench made of horizontal wood planks. Warm medium brown tones — honey to sienna, not too dark. Visible plank seams running left to right. Natural wood grain along each board, scattered knots, subtle aging and color variation between planks. No objects, no people, no furniture, matte finish.") => {
```

- [ ] **Step 3: Commit**

```bash
git add src/services/textureService.ts
git commit -m "feat: update default wood texture prompt to horizontal planks"
```

---

### Task 2: Update call-site prompts in TextureProvider.tsx

**Files:**
- Modify: `src/components/TextureProvider.tsx:29-33`

`fetchTextures()` calls `generateWoodTexture()` twice with explicit prompts — one for the desk, one for the drawer. Both need updating.

- [ ] **Step 1: Replace the desk prompt (line 29)**

Find:
```ts
const desk = await generateWoodTexture("A seamless top-down macro photograph of a polished cedar or mahogany wood desktop surface. Warm red-brown tones, visible wood grain, natural finish. No objects, no people.");
```

Replace with:
```ts
const desk = await generateWoodTexture("A seamless top-down photograph of a rustic hardwood floor or workbench made of horizontal wood planks. Warm medium brown tones — honey to sienna, not too dark. Visible plank seams running left to right. Natural wood grain along each board, scattered knots, subtle aging and color variation between planks. No objects, no people, no furniture, matte finish.");
```

- [ ] **Step 2: Replace the drawer prompt (line 32)**

Find:
```ts
const drawer = await generateWoodTexture("A seamless top-down macro photograph of a cedar or mahogany wood surface, slightly darker and more matte than a desktop, suitable for a drawer front. Warm deep red-brown tones. No objects, no people.");
```

Replace with:
```ts
const drawer = await generateWoodTexture("A seamless close-up macro photograph of smooth hardwood veneer or solid wood surface. Warm reddish-brown tones, slightly darker than a honey-sienna desk. Fine, continuous wood grain running horizontally, no plank seams, no knots. Matte, slightly shadowed finish as if lit from above. No objects, no people.");
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TextureProvider.tsx
git commit -m "feat: update desk and drawer Gemini texture prompts"
```

---

### Task 3: Update CSS fallback colors in index.css

**Files:**
- Modify: `src/index.css:22` (`.wood-texture`) and `src/index.css:39` (`.drawer-front`)

These `background-color` values show while Gemini loads. They should approximate the new target aesthetics.

- [ ] **Step 1: Update desk fallback color**

In `.wood-texture`, find:
```css
background-color: #8b5e3c;
```

Replace with:
```css
background-color: #8B6B3A;
```

- [ ] **Step 2: Update drawer fallback color**

In `.drawer-front`, find:
```css
background-color: #5a2e10;
```

Replace with:
```css
background-color: #5C3520;
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: update wood texture CSS fallback colors to match new target"
```

---

### Task 4: Manual visual verification

No automated tests exist for AI-generated texture output — correctness is visual.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server starts at `http://localhost:5173` (or similar port shown in output).

- [ ] **Step 2: Open the app and observe on load**

While Gemini generates:
- Desk background should show `#8B6B3A` — a warm honey-brown (not the old dark red-brown)
- Drawer should show `#5C3520` — a slightly darker warm brown

- [ ] **Step 3: Wait for textures to load and verify**

Once Gemini returns:
- **Desk**: should show horizontal wood planks with warm medium brown tones, visible seams running left-to-right, knots visible
- **Drawer**: should show a seamless close-up grain, same warm color family, darker, no plank lines

- [ ] **Step 4: If either texture misses the mark, trigger a refresh**

The app exposes a `refresh()` function via `TextureContext`. Gemini's output is non-deterministic — running again often yields a better result. If the visual is consistently wrong, revisit the prompt wording in Task 2.
