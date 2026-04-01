# Paper Scrap Text Tool

## Context

The current text tool is overly aggressive — tapping it opens a full-screen `TextOverlay` modal with font pickers, color pickers, and a textarea. This breaks the analog, craft-oriented flow of the scrapbook. The redesign replaces it with a gentle inline experience: a torn paper scrap appears on the canvas, you type directly on it in handwriting, and it becomes part of the page.

## Design

### Interaction Flow

1. User taps the text tool button → `activeTool = 'text'`
2. A torn paper scrap (HTML overlay) appears at the center of the canvas
3. The element auto-focuses, triggering the mobile keyboard
4. User types — text appears on the paper in Caveat (handwriting font), dark brown ink (`#3a2a1a`)
5. The paper auto-grows vertically to fit the text
6. **Commit**: tap outside the paper (Enter adds a newline since the paper supports multi-line text)
7. **Cancel**: if text is empty on commit, the scrap is discarded
8. `activeTool` resets to `null`

### Visual Design

- **Paper shape**: Torn edges via CSS `clip-path` polygon with irregular vertices
- **Background**: Off-white (`#fffef8`)
- **Shadow**: `2px 3px 8px rgba(0,0,0,0.18)` for a lifted appearance
- **Rotation**: Slight random rotation (−3° to 3°) for analog feel
- **Font**: Caveat, ~18px, color `#3a2a1a`
- **No color options, no font options** — just handwriting

### After Commit

The text converts from an HTML overlay to a **Konva Group** containing:
- A `Shape` with custom `sceneFunc` drawing the torn paper edges (matching the CSS clip-path)
- A `Text` node rendering the content in Caveat

The group is draggable and transformable (rotate, scale) like existing scrap elements.

## Files to Modify

### `src/types.ts`
- Add `hasPaperBackground?: boolean` to `JournalEntry`
- Existing entries without this field render as before (backward compatible)

### `src/components/PaperScrapInput.tsx` (new)
Replaces `TextOverlay.tsx` for the text tool flow.

- Absolutely-positioned HTML `div` over the Konva canvas
- Styled as torn paper scrap (CSS `clip-path`, off-white background, shadow)
- Contains a `contentEditable` div that auto-focuses on mount (gives native cursor, selection, and keyboard trigger without needing a hidden textarea)
- Listens for:
  - Text input → updates displayed text, auto-grows paper height
  - Click/tap outside → calls `onCommit(text)` if non-empty, else `onCancel()`
- Props: `onCommit(text: string)`, `onCancel()`, `canvasRect: DOMRect` (to position the paper at canvas center)

### `src/components/Scrapbook.tsx`
Update `TextItem` component:
- When `entry.hasPaperBackground` is true, render a Konva `Group` containing:
  - A `Shape` drawing the torn paper background (off-white fill, jagged edge path via `sceneFunc`)
  - The existing `Text` node, positioned inside the paper shape
- When `hasPaperBackground` is false/undefined, render as before (plain text)
- The `Transformer` wraps the entire group

### `src/App.tsx`
- Remove `TextOverlay` import, add `PaperScrapInput` import
- Replace `TextOverlay` render block with `PaperScrapInput` when `activeTool === 'text'`
- Simplify `handleAddText`: hardcode `fontFamily: 'Caveat'`, `color: '#3a2a1a'`, `hasPaperBackground: true`
- The signature changes to `handleAddText(text: string)` since font/color/size are no longer user-chosen

### `src/components/TextOverlay.tsx`
- Can be deleted once `PaperScrapInput` is in place (or kept if other features depend on it — verify first)

## Verification

1. **Tap text tool** → torn paper scrap appears at canvas center, keyboard opens
2. **Type text** → appears in Caveat handwriting on the paper, paper grows vertically
3. **Tap outside** → text commits, paper becomes draggable/scalable Konva element with torn paper background
4. **Tap outside with empty text** → paper scrap disappears, no entry created
5. **Existing text entries** (without `hasPaperBackground`) still render as plain text
6. **Committed paper scrap** → can be dragged, rotated, scaled via transformer
7. **Glue system** → paper scrap entries work with existing long-press glue and peel mechanics
