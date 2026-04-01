# Wood Desk UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the app's visual environment to look like a real physical cedar/mahogany desktop — dark wall behind, visible desk edge lip, recessed drawer front with a brass pull.

**Architecture:** Three targeted file edits: (1) `index.css` replaces the color palette and removes external image URLs, (2) `App.tsx` adds one `desk-edge` div between the desk and drawer, (3) `TextureProvider.tsx` updates the Gemini prompts to cedar/mahogany. No structural or logic changes anywhere.

**Tech Stack:** React 19, Tailwind CSS v4, Framer Motion, Gemini AI (texture generation via `@google/genai`)

---

## File Map

| File | Change |
|------|--------|
| `src/index.css` | Update color palette, remove Unsplash URLs, add `.desk-edge`, restyle `.drawer-handle` |
| `src/App.tsx` | Add `<div className="desk-edge">` between desk and drawer areas |
| `src/components/TextureProvider.tsx` | Update desk and drawer Gemini prompt strings |

---

### Task 1: Update CSS palette and desk surface

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace `body` styles**

Replace the existing `body` block with:

```css
body {
  background-color: #0f0805;
  font-family: var(--font-sans);
  overflow: hidden;
}
```

- [ ] **Step 2: Replace `.wood-texture` styles**

Replace the existing `.wood-texture` block with:

```css
.wood-texture {
  background-color: #8b5e3c;
  background-image: var(--desk-texture);
  background-size: cover;
  background-position: center;
  box-shadow: inset 0 0 100px rgba(0,0,0,0.3);
  filter: contrast(1.05) brightness(0.95);
}
```

- [ ] **Step 3: Add `.desk-edge` class**

Add after `.wood-texture`:

```css
.desk-edge {
  height: 8px;
  background: linear-gradient(to bottom, #b07848, #6b3f22);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  flex-shrink: 0;
  width: 100%;
  z-index: 15;
}
```

- [ ] **Step 4: Replace `.drawer-front` styles**

Replace the existing `.drawer-front` block with:

```css
.drawer-front {
  background-color: #5a2e10;
  background-image: var(--drawer-texture);
  background-size: cover;
  background-position: bottom;
  box-shadow: inset 0 3px 12px rgba(0,0,0,0.3), inset 0 1px 3px rgba(255,255,255,0.06);
}
```

- [ ] **Step 5: Replace `.drawer-handle` styles**

Replace the entire `.drawer-handle` block (including `::before` and `::after`) with:

```css
.drawer-handle {
  width: 80px;
  height: 10px;
  background: linear-gradient(to bottom, #d4aa50, #8a6020, #d4aa50);
  border-radius: 5px;
  box-shadow: 0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.4);
  position: relative;
}

.drawer-handle::before,
.drawer-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: #4a2e08;
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
}

.drawer-handle::before { left: -2px; }
.drawer-handle::after { right: -2px; }
```

- [ ] **Step 6: Start dev server and verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Check:
- Background behind the desk is near-black (`#0f0805`)
- Desk surface is warm red-brown (cedar tones)
- Drawer front is darker red-brown
- Drawer handle is gold/brass colored with two small dark screw dots

- [ ] **Step 7: Commit**

```bash
git add src/index.css
git commit -m "feat: cedar/mahogany desk palette with brass drawer handle"
```

---

### Task 2: Add desk edge lip in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the desk-edge div**

In `src/App.tsx`, locate the comment `{/* Drawer Area (Bottom 20%) */}` (around line 244). Insert `<div className="desk-edge" />` directly before the drawer area div:

```tsx
      {/* Desk Edge Lip */}
      <div className="desk-edge" />

      {/* Drawer Area (Bottom 20%) */}
      <div className="relative w-full h-[20vh] overflow-hidden">
```

- [ ] **Step 2: Verify visually**

With dev server running at http://localhost:3000, check:
- An 8px warm brown strip with a downward shadow is visible between the desk surface and the drawer
- It spans the full width of the screen
- The drawer brass handle appears just below it

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add desk edge lip between desk surface and drawer"
```

---

### Task 3: Update Gemini texture prompts

**Files:**
- Modify: `src/components/TextureProvider.tsx`

- [ ] **Step 1: Update the desk texture prompt**

In `src/components/TextureProvider.tsx`, locate the `generateWoodTexture` call for the desk (around line 29). Replace the prompt string:

```ts
    const desk = await generateWoodTexture(
      "A seamless top-down macro photograph of a polished cedar or mahogany wood desktop surface. Warm red-brown tones, visible wood grain, natural finish. No objects, no people."
    );
```

- [ ] **Step 2: Update the drawer texture prompt**

Locate the `generateWoodTexture` call for the drawer (around line 33). Replace the prompt string:

```ts
    const drawer = await generateWoodTexture(
      "A seamless top-down macro photograph of a cedar or mahogany wood surface, slightly darker and more matte than a desktop, suitable for a drawer front. Warm deep red-brown tones. No objects, no people."
    );
```

- [ ] **Step 3: Verify Gemini texture loads**

With dev server running at http://localhost:3000:
- Wait for the AI texture to generate (spinner on the refresh icon in the top bar while loading)
- Once loaded, the desk surface should show a photorealistic cedar/mahogany grain
- The drawer front should show a slightly darker version of the same grain
- If `GEMINI_API_KEY` is not set in `.env.local`, the desk falls back to the CSS base color (#8b5e3c) — this is acceptable

- [ ] **Step 4: Commit**

```bash
git add src/components/TextureProvider.tsx
git commit -m "feat: update Gemini prompts to cedar/mahogany wood style"
```
