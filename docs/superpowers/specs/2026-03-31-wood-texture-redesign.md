---
title: Wood Texture Redesign
date: 2026-03-31
status: approved
---

# Wood Texture Redesign

## Goal

Update the desk and drawer wood textures to better match the aesthetic of the reference image: rustic horizontal wood planks for the desk surface, and a smooth seamless grain for the drawer interior.

## Approach

Update the Gemini AI prompts in `TextureProvider.tsx` (and the default prompt in `textureService.ts`) to produce the target aesthetics. Also update the CSS fallback colors in `index.css` to approximate the target while textures load.

---

## 1. Desk Texture Prompt

**New prompt:**
> "A seamless top-down photograph of a rustic hardwood floor or workbench made of horizontal wood planks. Warm medium brown tones — honey to sienna, not too dark. Visible plank seams running left to right. Natural wood grain along each board, scattered knots, subtle aging and color variation between planks. No objects, no people, no furniture, matte finish."

**Rationale:** Matches the reference image — horizontal planks with warm honey-sienna tones, visible seams, knots, and natural aging. Replaces the current "polished cedar macro" prompt which produced a single-surface close-up without plank structure.

---

## 2. Drawer Texture Prompt

**New prompt:**
> "A seamless close-up macro photograph of smooth hardwood veneer or solid wood surface. Warm reddish-brown tones, slightly darker than a honey-sienna desk. Fine, continuous wood grain running horizontally, no plank seams, no knots. Matte, slightly shadowed finish as if lit from above. No objects, no people."

**Rationale:** A drawer's interior is typically a single sheet of veneer or plywood — no plank seams. Staying in the same warm color family as the desk maintains cohesion, while the seamless grain and darker value communicate visual depth ("beneath the desk surface"). Items placed in the drawer will read more clearly against the uncluttered background.

---

## 3. CSS Fallback Colors

Updated in `index.css`:

| Surface | Old fallback | New fallback |
|---------|-------------|-------------|
| `.wood-texture` (desk) | `#8b5e3c` | `#8B6B3A` |
| `.drawer-front` | `#5a2e10` | `#5C3520` |

The new desk fallback shifts from a cool red-brown toward a warmer honey-brown to better approximate the target while Gemini loads. The drawer fallback is a minor warm-shift.

Existing CSS post-processing (`filter: contrast(1.05) brightness(0.95)` on `.wood-texture`, inset box-shadows on `.drawer-front`) is unchanged — it remains appropriate for both textures.

---

## Files Changed

- `src/components/TextureProvider.tsx` — update both `generateWoodTexture()` call prompts
- `src/services/textureService.ts` — update the default prompt parameter
- `src/index.css` — update `.wood-texture` and `.drawer-front` fallback `background-color` values
