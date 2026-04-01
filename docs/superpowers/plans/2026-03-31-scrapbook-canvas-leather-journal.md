# Scrapbook Canvas — Left-Bound Leather Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain white canvas with a realistic left-bound leather journal — dark brown leather spine, visible page-stack edge, gutter shadow, and lined paper background rendered as a Konva layer.

**Architecture:** Three CSS divs (`.spine`, `.page-stack`, `.gutter`) sit to the left of a `.page` div that wraps the Konva Stage. Inside the Stage, a new Layer 0 draws the lined-paper background; all existing scraps stay on Layer 1. The book chrome is pure CSS; the paper texture is Konva so it exports with the page.

**Tech Stack:** React 19, TypeScript, Konva / react-konva, Tailwind CSS v4 (index.css for custom classes)

---

## Files

| File | Change |
|---|---|
| `src/index.css` | Add `.book-container`, `.spine`, `.page-stack`, `.gutter`, `.page`; remove `.scrapbook-container` |
| `src/App.tsx` | Replace `.scrapbook-container` div with `.book-container` flex structure |
| `src/components/Scrapbook.tsx` | Strip old classes from outer div; add Konva Layer 0 (lined paper) |

---

## Task 1: Add Book Layout CSS Classes

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Open `src/index.css` and remove the `.scrapbook-container` rule**

  Delete this entire block (currently lines 71–75):
  ```css
  .scrapbook-container {
    box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.1);
    border-radius: 12px;
    border: 4px solid #f3f4f6;
  }
  ```

- [ ] **Step 2: Add the five new book layout classes in its place**

  Insert at the same location in `src/index.css`:
  ```css
  /* ── Book Layout ── */
  .book-container {
    display: flex;
    flex-direction: row;
    border-radius: 6px;
    overflow: hidden;
    filter: drop-shadow(0 20px 50px rgba(0,0,0,0.6)) drop-shadow(0 2px 8px rgba(0,0,0,0.4));
  }

  .spine {
    width: 36px;
    flex-shrink: 0;
    border-radius: 6px 0 0 6px;
    background: linear-gradient(
      to right,
      #2a1208 0%,
      #5c2a10 20%,
      #8a4020 45%,
      #6b3018 65%,
      #3a1808 100%
    );
    position: relative;
    overflow: hidden;
  }

  /* Leather grain */
  .spine::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 6px,
      rgba(255, 255, 255, 0.04) 6px,
      rgba(255, 255, 255, 0.04) 7px
    );
  }

  /* Gold title band */
  .spine::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 4px;
    right: 4px;
    transform: translateY(-50%);
    height: 48px;
    border: 1px solid rgba(212, 170, 80, 0.4);
    border-radius: 2px;
  }

  .page-stack {
    width: 14px;
    flex-shrink: 0;
    background: repeating-linear-gradient(
      0deg,
      #e8e0d0 0px,
      #e8e0d0 1px,
      #f5f0e8 1px,
      #f5f0e8 3px
    );
    box-shadow: inset -3px 0 8px rgba(0, 0, 0, 0.15);
  }

  .gutter {
    width: 18px;
    flex-shrink: 0;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.35) 0%,
      rgba(0, 0, 0, 0.12) 60%,
      transparent 100%
    );
  }

  .page {
    flex: 1;
    background: #fefcf5;
    position: relative;
    border-radius: 0 6px 6px 0;
    overflow: hidden;
    box-shadow: inset -4px 0 12px rgba(0, 0, 0, 0.06);
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npm run lint`

  Expected: no errors. (CSS changes don't affect TS — this is just a sanity check the project still builds.)

- [ ] **Step 4: Commit**

  ```bash
  git add src/index.css
  git commit -m "style: add leather journal book layout CSS classes"
  ```

---

## Task 2: Update App.tsx — Swap in Book Layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find the existing scrapbook wrapper div in `src/App.tsx`**

  It currently looks like this (around line 226):
  ```tsx
  <div
    className="scrapbook-container overflow-hidden bg-white"
    style={{ width: bookDims.width, height: bookDims.height }}
  >
    <Scrapbook
      page={currentPage}
      onUpdateScrap={updateScrap}
      onUpdateEntry={updateEntry}
      dimensions={bookDims}
    />
  </div>
  ```

- [ ] **Step 2: Replace that div with the four-zone book layout**

  Replace the block from Step 1 with:
  ```tsx
  <div
    className="book-container"
    style={{ width: bookDims.width, height: bookDims.height }}
  >
    <div className="spine" />
    <div className="page-stack" />
    <div className="gutter" />
    <div className="page">
      <Scrapbook
        page={currentPage}
        onUpdateScrap={updateScrap}
        onUpdateEntry={updateEntry}
        dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
      />
    </div>
  </div>
  ```

  Note: `bookDims.width` is the total book width. The spine (36px) + page-stack (14px) + gutter (18px) consume 68px, so the Konva Stage receives `bookDims.width - 68` as its width. The `.page` div has `flex: 1` and needs no explicit width.

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npm run lint`

  Expected: no errors.

- [ ] **Step 4: Visual check — run dev server**

  Run: `npm run dev`

  Open `http://localhost:3000`. You should see the book spine, page-stack edge, and gutter shadow on the left side of the canvas. The page area will still be plain white until Task 3.

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: replace canvas wrapper with leather book layout"
  ```

---

## Task 3: Add Konva Layer 0 — Lined Paper Background

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Import `Rect` and `Line` from react-konva**

  The existing import at the top of `src/components/Scrapbook.tsx` is:
  ```tsx
  import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text } from 'react-konva';
  ```

  Replace it with:
  ```tsx
  import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
  ```

- [ ] **Step 2: Build the `LinedPaper` component above `Scrapbook`**

  Insert this new component directly above the `export const Scrapbook` line:
  ```tsx
  const LinedPaper: React.FC<{ width: number; height: number }> = ({ width, height }) => {
    const lineSpacing = 28;
    const lines: React.ReactElement[] = [];

    // Horizontal ruled lines
    for (let y = lineSpacing; y < height; y += lineSpacing) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, width, y]}
          stroke="#ccc5b5"
          strokeWidth={0.8}
          listening={false}
        />
      );
    }

    return (
      <>
        {/* Cream base */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#fefcf5"
          listening={false}
        />
        {/* Ruled lines */}
        {lines}
        {/* Top header rule */}
        <Line
          points={[0, 34, width, 34]}
          stroke="#ccc5b5"
          strokeWidth={1.5}
          opacity={0.5}
          listening={false}
        />
        {/* Red margin */}
        <Line
          points={[44, 0, 44, height]}
          stroke="#e8a0a0"
          strokeWidth={1}
          opacity={0.55}
          listening={false}
        />
      </>
    );
  };
  ```

- [ ] **Step 3: Strip the old classes from `Scrapbook`'s outer div and add Layer 0**

  Find the `return` statement inside `export const Scrapbook` (around line 280). It currently reads:
  ```tsx
  return (
    <div className="w-full h-full paper-texture scrapbook-container overflow-hidden">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
        <Layer>
          {page.scraps...}
          {page.journalEntries...}
        </Layer>
      </Stage>
    </div>
  );
  ```

  Replace it with:
  ```tsx
  return (
    <div className="w-full h-full overflow-hidden">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
        {/* Layer 0: lined paper background */}
        <Layer listening={false}>
          <LinedPaper width={dimensions.width} height={dimensions.height} />
        </Layer>

        {/* Layer 1: scraps and journal entries */}
        <Layer>
          {page.scraps.sort((a, b) => a.zIndex - b.zIndex).map((scrap) => (
            <ScrapItem
              key={scrap.id}
              scrap={scrap}
              isSelected={scrap.id === selectedId}
              onSelect={() => setSelectedId(scrap.id)}
              onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
            />
          ))}
          {page.journalEntries.map((entry) => (
            <TextItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedId}
              onSelect={() => setSelectedId(entry.id)}
              onChange={(newAttrs) => onUpdateEntry(entry.id, newAttrs)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  Run: `npm run lint`

  Expected: no errors.

- [ ] **Step 5: Visual check — full result**

  Run: `npm run dev`

  Open `http://localhost:3000`. Verify:
  - Left edge shows dark leather spine with grain and faint gold band
  - Next to spine: thin page-stack edge (alternating light paper lines)
  - Then gutter shadow fading right
  - Main canvas: cream background with horizontal ruled lines, red margin line on left, heavier top header rule
  - Existing scraps still drag, rotate, scale normally
  - No white border or old `scrapbook-container` box-shadow visible

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Scrapbook.tsx
  git commit -m "feat: add Konva lined-paper layer and remove old canvas styles"
  ```
