# Glue Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a glue tool to the toolbar that lets users rub photo scraps to fix them to the page, and animates unglued scraps falling off when the user turns the page.

**Architecture:** A new `'glue'` activeTool mode disables scrap dragging and enables rub-to-glue detection in `ScrapItem`. Page turn is intercepted in `App.tsx`: if unglued scraps exist, it passes `fallingScrapIds` to `Scrapbook`, which runs shake-then-fall tweens on each affected `ScrapItem`; once all are off-screen, the scraps are moved back to `rawMaterials` and page navigation proceeds.

**Tech Stack:** React 19, TypeScript, Konva / react-konva (Konva.Tween for animations), Vitest (new, for unit tests), Tailwind CSS v4

---

## File Map

| File | Change |
|------|--------|
| `src/utils/scrapUtils.ts` | **Create** — pure `partitionScraps` utility |
| `src/utils/scrapUtils.test.ts` | **Create** — Vitest unit tests |
| `vite.config.ts` | **Modify** — add Vitest test config |
| `src/App.tsx` | **Modify** — add glue tool button, intercept page turn, manage fall-off state |
| `src/components/Scrapbook.tsx` | **Modify** — add `isGlueActive` + fall-off props, wire to ScrapItem |

---

## Task 0: Add Vitest + unit-test the scrap partition utility

**Files:**
- Create: `src/utils/scrapUtils.ts`
- Create: `src/utils/scrapUtils.test.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected output: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add test config to `vite.config.ts`**

Add a `test` block inside the `defineConfig` return. The full updated file:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
    test: {
      environment: 'node',
    },
  };
});
```

- [ ] **Step 3: Add `test` script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write the failing test**

Create `src/utils/scrapUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { partitionScraps } from './scrapUtils';
import type { Scrap } from '../types';

const makeScrap = (id: string, isGlued: boolean): Scrap => ({
  id,
  image: 'data:image/png;base64,abc',
  points: [],
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
  zIndex: 0,
  isGlued,
});

describe('partitionScraps', () => {
  it('splits scraps into staying (glued) and falling (loose)', () => {
    const scraps = [
      makeScrap('a', true),
      makeScrap('b', false),
      makeScrap('c', true),
      makeScrap('d', false),
    ];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying.map(s => s.id)).toEqual(['a', 'c']);
    expect(falling.map(s => s.id)).toEqual(['b', 'd']);
  });

  it('returns all staying when all are glued', () => {
    const scraps = [makeScrap('a', true), makeScrap('b', true)];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying).toHaveLength(2);
    expect(falling).toHaveLength(0);
  });

  it('returns all falling when none are glued', () => {
    const scraps = [makeScrap('a', false), makeScrap('b', false)];
    const { staying, falling } = partitionScraps(scraps);
    expect(staying).toHaveLength(0);
    expect(falling).toHaveLength(2);
  });

  it('returns empty arrays for empty input', () => {
    const { staying, falling } = partitionScraps([]);
    expect(staying).toHaveLength(0);
    expect(falling).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Run test — verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './scrapUtils'`

- [ ] **Step 6: Create `src/utils/scrapUtils.ts`**

```ts
import type { Scrap } from '../types';

export function partitionScraps(scraps: Scrap[]): { staying: Scrap[]; falling: Scrap[] } {
  return {
    staying: scraps.filter(s => s.isGlued),
    falling: scraps.filter(s => !s.isGlued),
  };
}
```

- [ ] **Step 7: Run test — verify it passes**

```bash
npm test
```

Expected: PASS — 4 tests pass

- [ ] **Step 8: Commit**

```bash
git add src/utils/scrapUtils.ts src/utils/scrapUtils.test.ts vite.config.ts package.json package-lock.json
git commit -m "test: add Vitest + partitionScraps utility"
```

---

## Task 1: Add glue tool button to the toolbar

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `'glue'` to the activeTool type**

In `App.tsx`, find:

```ts
const [activeTool, setActiveTool] = useState<'tape' | 'text' | null>(null);
```

Replace with:

```ts
const [activeTool, setActiveTool] = useState<'tape' | 'text' | 'glue' | null>(null);
```

- [ ] **Step 2: Add the glue button to the toolbar**

In `App.tsx`, find the text tool button (the last button in the left toolbar group). After the closing `</button>` tag of the text tool, add:

```tsx
{/* Glue tool */}
<button
  onClick={() => setActiveTool(activeTool === 'glue' ? null : 'glue')}
  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
    activeTool === 'glue'
      ? 'bg-white/15 text-white/90'
      : 'text-white/50 hover:bg-white/10 hover:text-white/70'
  }`}
  title="Glue tool"
>
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="10" width="8" height="11" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor"/>
    <path d="M10 10 L10 7 L14 7 L14 10" fill="none"/>
    <line x1="12" y1="7" x2="12" y2="4"/>
    <path d="M11.2 4.5 Q13.2 6 12 7.5" strokeWidth="1.4"/>
  </svg>
  {activeTool === 'glue' && (
    <div className="w-1 h-1 rounded-full bg-white/80" />
  )}
</button>
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add glue tool button to toolbar"
```

---

## Task 2: Wire `isGlueActive` into Scrapbook and ScrapItem — disable drag in glue mode

**Files:**
- Modify: `src/components/Scrapbook.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `isGlueActive` prop to `ScrapbookProps`**

In `Scrapbook.tsx`, find the `ScrapbookProps` interface:

```ts
interface ScrapbookProps {
  page: ScrapbookPage;
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  dimensions: { width: number; height: number };
}
```

Replace with:

```ts
interface ScrapbookProps {
  page: ScrapbookPage;
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  dimensions: { width: number; height: number };
}
```

- [ ] **Step 2: Destructure `isGlueActive` in the Scrapbook component**

Find:

```ts
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  dimensions,
}) => {
```

Replace with:

```ts
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  dimensions,
}) => {
```

- [ ] **Step 3: Pass `isGlueActive` to each `ScrapItem`**

In the Scrapbook JSX, find:

```tsx
<ScrapItem
  key={scrap.id}
  scrap={scrap}
  isSelected={scrap.id === selectedId}
  onSelect={() => setSelectedId(scrap.id)}
  onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
  onReturn={() => onReturnScrap(scrap)}
  stageHeight={dimensions.height}
/>
```

Replace with:

```tsx
<ScrapItem
  key={scrap.id}
  scrap={scrap}
  isSelected={scrap.id === selectedId}
  onSelect={() => setSelectedId(scrap.id)}
  onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
  onReturn={() => onReturnScrap(scrap)}
  stageHeight={dimensions.height}
  isGlueActive={isGlueActive}
/>
```

- [ ] **Step 4: Add `isGlueActive` to `ScrapItemProps` and update `draggable`**

Find the `ScrapItemProps` interface at the top of the file:

```ts
interface ScrapItemProps {
  scrap: Scrap;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Scrap>) => void;
  onReturn: () => void;
  stageHeight: number;
}
```

Replace with:

```ts
interface ScrapItemProps {
  scrap: Scrap;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Scrap>) => void;
  onReturn: () => void;
  stageHeight: number;
  isGlueActive: boolean;
}
```

- [ ] **Step 5: Destructure `isGlueActive` in `ScrapItem` and update `draggable`**

Find:

```ts
const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight }) => {
```

Replace with:

```ts
const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight, isGlueActive }) => {
```

Then find the `draggable` prop on the Group:

```tsx
draggable={!scrap.isGlued}
```

Replace with:

```tsx
draggable={!scrap.isGlued && !isGlueActive}
```

- [ ] **Step 6: Pass `isGlueActive` from `App.tsx` to `Scrapbook`**

In `App.tsx`, find the `<Scrapbook` JSX and add the new prop:

```tsx
<Scrapbook
  page={currentPage}
  onUpdateScrap={updateScrap}
  onUpdateEntry={updateEntry}
  onReturnScrap={handleReturnScrap}
  onAddTapeStrip={handleAddTapeStrip}
  isTapeActive={activeTool === 'tape'}
  isGlueActive={activeTool === 'glue'}
  dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
/>
```

- [ ] **Step 7: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/components/Scrapbook.tsx src/App.tsx
git commit -m "feat: wire isGlueActive — disable scrap drag in glue mode"
```

---

## Task 3: Rub-to-glue detection and wet sheen in ScrapItem

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add pointer-down tracking ref and `showSheen` state to `ScrapItem`**

Inside the `ScrapItem` component body, after the existing `useRef` / `useState` declarations (around line 33), add:

```ts
const isPointerDown = useRef(false);
const [showSheen, setShowSheen] = useState(false);
```

- [ ] **Step 2: Add rub handlers to the Group**

In the Group JSX in `ScrapItem`, add four new event handlers after `onTouchEnd`:

```tsx
onMouseDown={() => { isPointerDown.current = true; }}
onMouseUp={() => { isPointerDown.current = false; setShowSheen(false); }}
onMouseMove={() => {
  if (!isGlueActive || !isPointerDown.current || scrap.isGlued) return;
  setShowSheen(true);
  onChange({ isGlued: true });
}}
onTouchMove={(e) => {
  const touches: TouchList = e.evt.touches;
  if (!isGlueActive || touches.length !== 1 || scrap.isGlued) return;
  setShowSheen(true);
  onChange({ isGlued: true });
}}
```

Also update `onTouchEnd` to clear sheen. Find:

```tsx
const handleTouchEnd = (e: any) => {
  if (e.evt.touches.length < 2) {
    pinchStartDist.current = null;
  }
};
```

Replace with:

```tsx
const handleTouchEnd = (e: any) => {
  if (e.evt.touches.length < 2) {
    pinchStartDist.current = null;
  }
  if (isGlueActive) {
    isPointerDown.current = false;
    setShowSheen(false);
  }
};
```

- [ ] **Step 3: Add the sheen overlay inside the Group JSX**

The sheen must appear inside the Group's children, after the image/shape content. It should be invisible when `!showSheen`.

Inside the `ScrapItem` return, find the closing `</Group>` of the main group (before the Transformer). Just before `</Group>`, add:

```tsx
{showSheen && image && (
  <Rect
    x={0}
    y={0}
    width={isRect ? image.width : Math.max(...scrap.points.map(p => p.x))}
    height={isRect ? image.height : Math.max(...scrap.points.map(p => p.y))}
    fill="rgba(255,255,255,0.38)"
    listening={false}
  />
)}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

1. Open the app, place a scrap on the page
2. Tap the glue bottle icon in the toolbar
3. Drag your finger across the scrap — it should flash white and become locked (shadow stays flat, drag no longer works)

- [ ] **Step 6: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: rub-to-glue detection with wet sheen overlay"
```

---

## Task 4: Shadow tween when a scrap is glued

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add a useEffect to ScrapItem that tweens the shadow on glue**

In `ScrapItem`, after the existing `useEffect` blocks, add:

```ts
useEffect(() => {
  if (scrap.isGlued && shapeRef.current) {
    shapeRef.current.to({
      shadowBlur: 3,
      shadowOffsetY: 2,
      shadowOffsetX: 0,
      duration: 0.2,
    });
  }
}, [scrap.isGlued]);
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Rub a scrap with the glue tool. The shadow should visibly flatten (from a large floating shadow to a tight flat one) as it locks.

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: animate shadow flatten when scrap is glued"
```

---

## Task 5: Fall-off animation in ScrapItem

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add `isFalling` and `onFallDone` to `ScrapItemProps`**

Find the `ScrapItemProps` interface and add two new props:

```ts
interface ScrapItemProps {
  scrap: Scrap;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Scrap>) => void;
  onReturn: () => void;
  stageHeight: number;
  isGlueActive: boolean;
  isFalling: boolean;
  onFallDone: () => void;
}
```

- [ ] **Step 2: Destructure `isFalling` and `onFallDone` in ScrapItem**

Find:

```ts
const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight, isGlueActive }) => {
```

Replace with:

```ts
const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight, isGlueActive, isFalling, onFallDone }) => {
```

- [ ] **Step 3: Add the fall-off useEffect to ScrapItem**

After the existing `useEffect` blocks in `ScrapItem`, add:

```ts
useEffect(() => {
  if (!isFalling || !shapeRef.current) return;

  const node = shapeRef.current;
  const origX = node.x();
  const origY = node.y();
  const origRot = node.rotation();
  let shakeCount = 0;

  const doFall = () => {
    const finalRot = origRot + (Math.random() > 0.5 ? 28 : -28);
    new Konva.Tween({
      node,
      duration: 0.55,
      easing: Konva.Easings.EaseIn,
      y: stageHeight + 250,
      rotation: finalRot,
      onFinish: () => onFallDone(),
    }).play();
  };

  const doShake = () => {
    if (shakeCount >= 6) {
      doFall();
      return;
    }
    const dx = shakeCount % 2 === 0 ? 5 : -5;
    const dr = shakeCount % 2 === 0 ? 4 : -4;
    new Konva.Tween({
      node,
      duration: 0.05,
      x: origX + dx,
      y: origY,
      rotation: origRot + dr,
      onFinish: () => { shakeCount++; doShake(); },
    }).play();
  };

  const delay = Math.random() * 150;
  const timer = setTimeout(doShake, delay);
  return () => clearTimeout(timer);
}, [isFalling]);
```

- [ ] **Step 4: Pass `isFalling` and `onFallDone` from Scrapbook to ScrapItem**

In the Scrapbook JSX where `ScrapItem` is rendered, you need to pass these two new props. You will add `fallingScrapIds` to Scrapbook in the next task — for now, pass placeholder values so TypeScript is happy:

```tsx
<ScrapItem
  key={scrap.id}
  scrap={scrap}
  isSelected={scrap.id === selectedId}
  onSelect={() => setSelectedId(scrap.id)}
  onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
  onReturn={() => onReturnScrap(scrap)}
  stageHeight={dimensions.height}
  isGlueActive={isGlueActive}
  isFalling={false}
  onFallDone={() => {}}
/>
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: shake + fall animation in ScrapItem"
```

---

## Task 6: Scrapbook fall orchestration

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add fall-off props to `ScrapbookProps`**

Find the `ScrapbookProps` interface and add:

```ts
interface ScrapbookProps {
  page: ScrapbookPage;
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  fallingScrapIds: string[] | null;
  onFallComplete: (ids: string[]) => void;
  dimensions: { width: number; height: number };
}
```

- [ ] **Step 2: Destructure the new props in the Scrapbook component**

Find:

```ts
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  dimensions,
}) => {
```

Replace with:

```ts
export const Scrapbook: React.FC<ScrapbookProps> = ({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  dimensions,
}) => {
```

- [ ] **Step 3: Add a completed-falls counter ref to Scrapbook**

Inside the Scrapbook component body, after `const [selectedId, ...]`, add:

```ts
const fallsDoneCount = useRef(0);
```

- [ ] **Step 4: Wire `isFalling` and `onFallDone` into ScrapItem rendering**

Replace the ScrapItem placeholder props from Task 5 with the real logic:

```tsx
<ScrapItem
  key={scrap.id}
  scrap={scrap}
  isSelected={scrap.id === selectedId}
  onSelect={() => setSelectedId(scrap.id)}
  onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
  onReturn={() => onReturnScrap(scrap)}
  stageHeight={dimensions.height}
  isGlueActive={isGlueActive}
  isFalling={fallingScrapIds?.includes(scrap.id) ?? false}
  onFallDone={() => {
    if (!fallingScrapIds) return;
    fallsDoneCount.current += 1;
    if (fallsDoneCount.current >= fallingScrapIds.length) {
      fallsDoneCount.current = 0;
      onFallComplete(fallingScrapIds);
    }
  }}
/>
```

- [ ] **Step 5: Reset counter when a new fall batch starts**

Add a `useEffect` to the Scrapbook component body to reset the counter whenever `fallingScrapIds` changes to a new non-null value:

```ts
useEffect(() => {
  if (fallingScrapIds !== null) {
    fallsDoneCount.current = 0;
  }
}, [fallingScrapIds]);
```

- [ ] **Step 6: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "feat: orchestrate fall-off sequence in Scrapbook"
```

---

## Task 7: Page turn intercept and fall-off state in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add fall-off state**

In `App.tsx`, after the `activeTool` state declaration, add:

```ts
const [fallingOff, setFallingOff] = useState<{ direction: 'prev' | 'next'; scrapIds: string[] } | null>(null);
const [drawerBounce, setDrawerBounce] = useState(false);
```

- [ ] **Step 2: Add `handlePageTurn` function**

After the `updateEntry` function in `App.tsx`, add:

```ts
const handlePageTurn = (direction: 'prev' | 'next') => {
  const { falling } = partitionScraps(currentPage.scraps);
  if (falling.length === 0) {
    setCurrentPageIndex(prev => direction === 'next' ? prev + 1 : prev - 1);
    return;
  }
  setFallingOff({ direction, scrapIds: falling.map(s => s.id) });
};
```

- [ ] **Step 3: Import `partitionScraps`**

At the top of `App.tsx`, add the import:

```ts
import { partitionScraps } from './utils/scrapUtils';
```

- [ ] **Step 4: Add `handleFallComplete` function**

After `handlePageTurn`, add:

```ts
const handleFallComplete = (fallenIds: string[]) => {
  const fallen = currentPage.scraps.filter(s => fallenIds.includes(s.id));
  const updatedPages = [...pages];
  updatedPages[currentPageIndex].scraps = currentPage.scraps.filter(s => !fallenIds.includes(s.id));
  setPages(updatedPages);
  setRawMaterials(prev => [
    ...fallen.map(s => ({ id: Math.random().toString(36).substr(2, 9), image: s.image })),
    ...prev,
  ]);
  const dir = fallingOff!.direction;
  setFallingOff(null);
  setCurrentPageIndex(prev => dir === 'next' ? prev + 1 : prev - 1);
  setDrawerBounce(true);
  setTimeout(() => setDrawerBounce(false), 300);
};
```

- [ ] **Step 5: Replace direct page turn calls with `handlePageTurn`**

Find the two chevron buttons in the toolbar JSX. Replace:

```tsx
onClick={() => { setActiveTool(null); setCurrentPageIndex(prev => prev - 1); }}
```

with:

```tsx
onClick={() => { setActiveTool(null); handlePageTurn('prev'); }}
```

And replace:

```tsx
onClick={() => { setActiveTool(null); setCurrentPageIndex(prev => prev + 1); }}
```

with:

```tsx
onClick={() => { setActiveTool(null); handlePageTurn('next'); }}
```

- [ ] **Step 6: Pass fall-off props to Scrapbook**

Find the `<Scrapbook` JSX and update it:

```tsx
<Scrapbook
  page={currentPage}
  onUpdateScrap={updateScrap}
  onUpdateEntry={updateEntry}
  onReturnScrap={handleReturnScrap}
  onAddTapeStrip={handleAddTapeStrip}
  isTapeActive={activeTool === 'tape'}
  isGlueActive={activeTool === 'glue'}
  fallingScrapIds={fallingOff?.scrapIds ?? null}
  onFallComplete={handleFallComplete}
  dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
/>
```

- [ ] **Step 7: Add drawer bounce animation**

Find the `MaterialDrawer` JSX and wrap the container div in a Framer Motion element. Find:

```tsx
<div className="relative w-full h-[20vh] overflow-hidden z-20">
  <MaterialDrawer
```

Replace with:

```tsx
<motion.div
  className="relative w-full h-[20vh] overflow-hidden z-20"
  animate={drawerBounce ? { y: [0, -6, 0] } : {}}
  transition={{ duration: 0.25, ease: 'easeOut' }}
>
  <MaterialDrawer
```

And close with `</motion.div>` instead of `</div>`.

- [ ] **Step 8: Check TypeScript compiles**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: all 4 tests still pass

- [ ] **Step 10: Manual end-to-end test**

```bash
npm run dev
```

1. Place 2–3 scraps on the page. Leave them unglued.
2. Glue 1 of them using the glue tool (rub over it).
3. Tap the next-page arrow.
4. The unglued scraps should shake, then fall off the bottom.
5. The glued scrap stays put.
6. The page turns.
7. The drawer bounces.
8. Go back to the first page — the fallen scraps are gone from the canvas.
9. Open the drawer — the fallen scraps are back in it.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat: intercept page turn — unglued scraps fall off and return to drawer"
```
