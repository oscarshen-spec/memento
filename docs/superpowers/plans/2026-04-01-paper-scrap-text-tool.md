# Paper Scrap Text Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the aggressive full-screen TextOverlay with a gentle inline torn paper scrap that appears on the canvas center, lets the user type in handwriting (Caveat), and commits as a draggable Konva element.

**Architecture:** An HTML `contentEditable` div styled as a torn paper scrap is overlaid on the canvas when the text tool is active. On commit (tap outside), it converts to a Konva Group (torn paper Shape + Text) stored as a `JournalEntry` with `hasPaperBackground: true`. Existing entries without this flag render unchanged.

**Tech Stack:** React 19, TypeScript, Konva/react-konva, CSS clip-path

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add `hasPaperBackground` to `JournalEntry` |
| `src/components/PaperScrapInput.tsx` | Create | HTML overlay for inline text editing on torn paper |
| `src/components/Scrapbook.tsx` | Modify | Update `TextItem` to render paper background via Konva |
| `src/App.tsx` | Modify | Swap TextOverlay for PaperScrapInput, simplify handleAddText |

---

### Task 1: Add `hasPaperBackground` to JournalEntry

**Files:**
- Modify: `src/types.ts:24-34`

- [ ] **Step 1: Add the field**

In `src/types.ts`, add `hasPaperBackground?: boolean` to the `JournalEntry` interface:

```typescript
export interface JournalEntry {
  id: string;
  text: string;
  type: 'title' | 'body' | 'date';
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  hasPaperBackground?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add hasPaperBackground to JournalEntry type"
```

---

### Task 2: Create PaperScrapInput component

**Files:**
- Create: `src/components/PaperScrapInput.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/PaperScrapInput.tsx`:

```tsx
import React, { useRef, useEffect, useState } from 'react';

interface PaperScrapInputProps {
  onCommit: (text: string) => void;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PaperScrapInput: React.FC<PaperScrapInputProps> = ({ onCommit, onCancel, containerRef }) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rotation] = useState(() => (Math.random() - 0.5) * 6); // −3° to 3°

  // Auto-focus to trigger keyboard
  useEffect(() => {
    const timer = setTimeout(() => {
      editableRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Click-outside to commit/cancel
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const text = editableRef.current?.innerText.trim() ?? '';
        if (text) {
          onCommit(text);
        } else {
          onCancel();
        }
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onCommit, onCancel]);

  // Position at center of the book page container
  const containerRect = containerRef.current?.getBoundingClientRect();
  const top = containerRect ? containerRect.top + containerRect.height / 2 : '50%';
  const left = containerRect ? containerRect.left + containerRect.width / 2 : '50%';

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'fixed',
        top,
        left,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex: 40,
        background: '#fffef8',
        boxShadow: '2px 3px 8px rgba(0,0,0,0.18)',
        clipPath: `polygon(
          2% 0%, 12% 1%, 25% 0%, 38% 2%, 50% 0%, 62% 1%, 75% 0%, 88% 2%, 98% 0%,
          100% 15%, 99% 30%, 100% 50%, 99% 70%, 100% 85%,
          97% 100%, 85% 99%, 72% 100%, 58% 98%, 45% 100%, 32% 99%, 18% 100%, 5% 98%, 0% 100%,
          1% 82%, 0% 65%, 1% 45%, 0% 28%, 1% 12%
        )`,
        padding: '18px 22px',
        minWidth: 120,
        minHeight: 48,
        maxWidth: 280,
      }}
    >
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 18,
          color: '#3a2a1a',
          lineHeight: 1.5,
          outline: 'none',
          minHeight: 24,
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
        data-placeholder="type here…"
      />
    </div>
  );
};
```

- [ ] **Step 2: Add placeholder styling**

At the top of `PaperScrapInput.tsx`, add a style block inside the component (before the return) or use an inline approach. The simplest: add a CSS rule via a `<style>` tag in the component:

```tsx
// Add inside PaperScrapInput, before the return statement:
const placeholderStyle = `
  [data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: rgba(80, 60, 40, 0.35);
    pointer-events: none;
  }
`;
```

Then in the return, add `<style>{placeholderStyle}</style>` just before the wrapper div:

```tsx
return (
  <>
    <style>{placeholderStyle}</style>
    <div ref={wrapperRef} style={{...}}>
      ...
    </div>
  </>
);
```

- [ ] **Step 3: Verify the component renders**

Run the dev server: `npm run dev`

Temporarily import and render `PaperScrapInput` in App.tsx to confirm the torn paper appears centered on the page, auto-focuses, and accepts text input. Typing should show handwriting text. Clicking outside should trigger commit/cancel. Revert this temporary import after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/components/PaperScrapInput.tsx
git commit -m "feat: create PaperScrapInput component with torn paper overlay"
```

---

### Task 3: Wire PaperScrapInput into App.tsx

**Files:**
- Modify: `src/App.tsx:1-15` (imports)
- Modify: `src/App.tsx:186-202` (handleAddText)
- Modify: `src/App.tsx:604-610` (TextOverlay render)

- [ ] **Step 1: Update imports**

In `src/App.tsx`, replace the TextOverlay import with PaperScrapInput:

```typescript
// Remove this line:
import { TextOverlay } from './components/TextOverlay';

// Add this line:
import { PaperScrapInput } from './components/PaperScrapInput';
```

- [ ] **Step 2: Simplify handleAddText**

Replace the current `handleAddText` at line 186 with:

```typescript
const handleAddText = (text: string) => {
  const newEntry: JournalEntry = {
    id: Math.random().toString(36).substr(2, 9),
    text,
    type: 'body',
    x: (bookDims.width - 68) / 2 - 100,
    y: bookDims.height / 2 - 50,
    rotation: (Math.random() - 0.5) * 5,
    fontSize: 18,
    fontFamily: 'Caveat',
    color: '#3a2a1a',
    hasPaperBackground: true,
  };
  const updatedPages = [...pages];
  updatedPages[currentPageIndex].journalEntries.push(newEntry);
  setPages(updatedPages);
  setActiveTool(null);
};
```

- [ ] **Step 3: Replace TextOverlay render with PaperScrapInput**

Replace the block at lines 604-610:

```tsx
{/* Remove this: */}
{activeTool === 'text' && (
  <TextOverlay
    key="text-overlay"
    onAdd={handleAddText}
    onClose={() => setActiveTool(null)}
  />
)}

{/* Replace with: */}
{activeTool === 'text' && (
  <PaperScrapInput
    key="paper-scrap-input"
    onCommit={handleAddText}
    onCancel={() => setActiveTool(null)}
    containerRef={bookPageRef}
  />
)}
```

- [ ] **Step 4: Verify end-to-end**

Run: `npm run dev`

1. Tap the text tool button on the desk
2. Torn paper scrap should appear at center of the book page
3. Keyboard / cursor should be active
4. Type some text — appears in Caveat handwriting on the paper
5. Tap outside — text commits and appears on the canvas as a text element
6. Tap text tool with empty text and tap outside — nothing created

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace TextOverlay with PaperScrapInput in App"
```

---

### Task 4: Update TextItem to render torn paper background in Konva

**Files:**
- Modify: `src/components/Scrapbook.tsx:485-560` (TextItem component)

- [ ] **Step 1: Add a torn paper sceneFunc helper**

Add this above the `TextItem` component in `Scrapbook.tsx` (around line 485):

```typescript
/** Draw a torn-edge rectangle for paper scrap backgrounds. */
const drawTornPaper = (ctx: Konva.Context, shape: Konva.Shape) => {
  const w = shape.width();
  const h = shape.height();
  const seed = shape.id()?.charCodeAt(0) ?? 42;
  const jag = (i: number) => Math.sin(seed + i * 2.7) * 3;

  ctx.beginPath();
  // Top edge (jagged)
  const topSteps = 8;
  for (let i = 0; i <= topSteps; i++) {
    const px = (i / topSteps) * w;
    const py = jag(i);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  // Right edge
  const rightSteps = 6;
  for (let i = 1; i <= rightSteps; i++) {
    ctx.lineTo(w + jag(i + 20), (i / rightSteps) * h);
  }
  // Bottom edge (jagged)
  for (let i = topSteps; i >= 0; i--) {
    ctx.lineTo((i / topSteps) * w, h + jag(i + 40));
  }
  // Left edge
  for (let i = rightSteps - 1; i >= 0; i--) {
    ctx.lineTo(jag(i + 60), (i / rightSteps) * h);
  }
  ctx.closePath();
  ctx.fillStrokeShape(shape);
};
```

- [ ] **Step 2: Update TextItem to conditionally render paper background**

Replace the `TextItem` component with:

```tsx
const TextItem: React.FC<TextItemProps> = ({ entry, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const groupRef = useRef<any>(null);

  useEffect(() => {
    const targetRef = entry.hasPaperBackground ? groupRef : shapeRef;
    if (isSelected && trRef.current && targetRef.current) {
      trRef.current.nodes([targetRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, entry.hasPaperBackground]);

  const padding = 16;

  // Measure text dimensions for paper background sizing
  const textWidth = entry.fontSize * entry.text.length * 0.55; // rough estimate
  const lineCount = entry.text.split('\n').length;
  const textHeight = entry.fontSize * entry.text.length > 0 ? entry.fontSize * 1.5 * lineCount : entry.fontSize;
  const paperWidth = Math.max(120, Math.min(280, textWidth + padding * 2));
  const paperHeight = textHeight + padding * 2;

  if (entry.hasPaperBackground) {
    return (
      <>
        <Group
          ref={groupRef}
          x={entry.x}
          y={entry.y}
          rotation={entry.rotation}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            onChange({ x: e.target.x(), y: e.target.y() });
          }}
          onTransformEnd={() => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            onChange({
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              fontSize: entry.fontSize * scaleX,
            });
            node.scaleX(1);
            node.scaleY(1);
          }}
        >
          <Shape
            id={entry.id}
            width={paperWidth}
            height={paperHeight}
            fill="#fffef8"
            shadowColor="rgba(0,0,0,0.18)"
            shadowBlur={8}
            shadowOffsetX={2}
            shadowOffsetY={3}
            sceneFunc={drawTornPaper}
          />
          <Text
            ref={shapeRef}
            text={entry.text}
            x={padding}
            y={padding}
            width={paperWidth - padding * 2}
            fontSize={entry.fontSize}
            fontFamily="Caveat"
            fill={entry.color ?? '#3a2a1a'}
            align="center"
            lineHeight={1.5}
          />
        </Group>
        {isSelected && (
          <Transformer
            ref={trRef}
            anchorSize={24}
            anchorCornerRadius={12}
            anchorStroke="#1a1a1a"
            anchorFill="white"
            borderStroke="#1a1a1a"
            borderDash={[4, 4]}
            rotateAnchorOffset={40}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) return oldBox;
              return newBox;
            }}
          />
        )}
      </>
    );
  }

  // Original plain text rendering (backward compatible)
  return (
    <>
      <Text
        ref={shapeRef}
        text={entry.text}
        x={entry.x}
        y={entry.y}
        rotation={entry.rotation}
        fontSize={entry.fontSize}
        fontFamily={entry.fontFamily ?? (entry.type === 'title' ? 'Cormorant Garamond' : 'Nunito')}
        fontStyle={
          entry.fontFamily
            ? entry.fontFamily === 'Cormorant Garamond'
              ? 'italic bold'
              : 'normal'
            : entry.type === 'title'
              ? 'italic bold'
              : 'normal'
        }
        fill={entry.color ?? '#1a1a1a'}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({ x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange({
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: node.fontSize() * node.scaleX(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          anchorSize={24}
          anchorCornerRadius={12}
          anchorStroke="#1a1a1a"
          anchorFill="white"
          borderStroke="#1a1a1a"
          borderDash={[4, 4]}
          rotateAnchorOffset={40}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};
```

- [ ] **Step 3: Verify committed text renders with paper background**

Run: `npm run dev`

1. Add text via the paper scrap input
2. After commit, the text should appear on the canvas with a torn paper background behind it
3. Select the text — transformer handles should appear around the whole group
4. Drag it — should move the paper + text together
5. Scale/rotate — should transform the whole group
6. Existing plain text entries (if any) should still render without the paper background

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: render torn paper background behind text entries in Konva"
```

---

### Task 5: Clean up and final verification

**Files:**
- Delete: `src/components/TextOverlay.tsx` (if no other imports depend on it)

- [ ] **Step 1: Check for other TextOverlay imports**

Search for any remaining imports of `TextOverlay` in the codebase. If none exist beyond the one we already removed in App.tsx, delete the file.

Run: `grep -r "TextOverlay" src/`

- [ ] **Step 2: Delete TextOverlay.tsx if safe**

```bash
rm src/components/TextOverlay.tsx
```

- [ ] **Step 3: Full end-to-end verification**

Run: `npm run dev`

Verify the complete flow:
1. Tap text tool → torn paper scrap appears centered on book page
2. Cursor is active / keyboard open
3. Type "summertime" → text appears in Caveat handwriting, paper auto-grows
4. Type multiple lines → paper grows vertically
5. Tap outside → text commits as draggable Konva element with paper background
6. Drag the committed element → paper + text move together
7. Select and scale → transforms as a unit
8. Tap text tool with no text and tap outside → no entry created, tool deactivates
9. Existing non-paper entries still render correctly
10. Glue (long-press) works on paper scrap entries

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused TextOverlay component"
```
