# Scrap Selection Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a scrap is tapped on the canvas, the top-bar toolbar swaps from tape/text/glue to scissors/tear/trash icons; tapping empty canvas restores the default toolbar.

**Architecture:** Lift `selectedScrapId` from `Scrapbook`'s internal state to `App`, pass it back down via props alongside an `onSelectScrap` callback. App conditionally renders a selection toolbar when `selectedScrapId !== null`.

**Tech Stack:** React 19, TypeScript, Vite, Lucide React (for Trash icon), inline SVG for scissors and tear icons.

---

### Task 1: Update Scrapbook props and remove internal selectedId state

**Files:**
- Modify: `src/components/Scrapbook.tsx`

- [ ] **Step 1: Add `selectedScrapId` and `onSelectScrap` to `ScrapbookProps`**

In `src/components/Scrapbook.tsx`, update the `ScrapbookProps` interface (around line 523):

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
  selectedScrapId: string | null;
  onSelectScrap: (id: string | null) => void;
}
```

- [ ] **Step 2: Remove internal `selectedId` state and use props instead**

In the `Scrapbook` component body (around line 538), replace:

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
```

with:

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
  selectedScrapId,
  onSelectScrap,
}) => {
  const selectedId = selectedScrapId;
  const setSelectedId = onSelectScrap;
```

- [ ] **Step 3: Verify the file compiles — run the dev server briefly**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/Scrapbook.tsx
git commit -m "refactor: lift selectedScrapId out of Scrapbook into props"
```

---

### Task 2: Wire selectedScrapId state in App and pass to Scrapbook

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `selectedScrapId` state to App**

In `src/App.tsx`, after the existing `const [drawerBounce, setDrawerBounce] = useState(false);` line (around line 37), add:

```ts
const [selectedScrapId, setSelectedScrapId] = useState<string | null>(null);
```

- [ ] **Step 2: Pass new props to Scrapbook**

In `src/App.tsx`, find the `<Scrapbook` JSX (around line 378) and add the two new props:

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
  selectedScrapId={selectedScrapId}
  onSelectScrap={setSelectedScrapId}
/>
```

- [ ] **Step 3: Clear selection when activeTool changes or page turns**

In `src/App.tsx`, find `handlePageTurn` (around line 209) and add a clear at the top:

```ts
const handlePageTurn = (direction: 'prev' | 'next') => {
  setSelectedScrapId(null);
  const { falling } = partitionScraps(currentPage.scraps);
  // ... rest unchanged
```

Also find both page-turn button `onClick` handlers (around line 332–343) — they already call `setActiveTool(null)`, which is fine; no change needed there.

- [ ] **Step 4: Type-check**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire selectedScrapId state in App, pass to Scrapbook"
```

---

### Task 3: Swap toolbar to selection mode when a scrap is selected

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the left-side toolbar buttons with a conditional render**

In `src/App.tsx`, find the `<div className="flex gap-8">` block that contains the tape, text, and glue buttons (around line 255). Replace the entire `<div className="flex gap-8">` block with:

```tsx
<div className="flex gap-8">
  {selectedScrapId !== null ? (
    <>
      {/* Scissors — cut */}
      <button
        onClick={() => {}}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
        title="Cut"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/>
          <line x1="14.47" y1="14.48" x2="20" y2="20"/>
          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
      </button>

      {/* Torn paper — tear */}
      <button
        onClick={() => {}}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
        title="Tear"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4 h16 v10 l-2 1.5 l2 1.5 v3 H4 V4z"/>
          <path d="M4 14 l2-1.5 l-2-1.5" strokeWidth="1.4"/>
          <line x1="4" y1="9" x2="20" y2="9" strokeDasharray="2 2" strokeWidth="1.2" opacity="0.5"/>
        </svg>
      </button>

      {/* Trash — delete and return to drawer */}
      <button
        onClick={() => {}}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
        title="Delete"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </>
  ) : (
    <>
      {/* Tape tool */}
      <button
        onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
          activeTool === 'tape'
            ? 'bg-white/15 text-white/90'
            : 'text-white/50 hover:bg-white/10 hover:text-white/70'
        }`}
        title="Tape tool"
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="2.2" fill="currentColor" fillOpacity="0.1"/>
          <circle cx="13" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="rgba(30,20,10,0.7)"/>
          <path d="M3.5,10.5 Q13,8.5 22.5,10.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
          <path d="M3,13 Q13,11 23,13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
          <path d="M3.5,15.5 Q13,13.5 22.5,15.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
          <path d="M21,9.5 L24.5,7 L26,9.5 L22.5,12 Z" fill="currentColor" fillOpacity="0.8"/>
        </svg>
        {activeTool === 'tape' && <div className="w-1 h-1 rounded-full bg-white/80" />}
      </button>

      {/* Text tool */}
      <button
        onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
          activeTool === 'text'
            ? 'bg-white/15 text-white/90'
            : 'text-white/50 hover:bg-white/10 hover:text-white/70'
        }`}
        title="Text tool"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"/>
          <line x1="9" y1="20" x2="15" y2="20"/>
          <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
        {activeTool === 'text' && <div className="w-1 h-1 rounded-full bg-white/80" />}
      </button>

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
        {activeTool === 'glue' && <div className="w-1 h-1 rounded-full bg-white/80" />}
      </button>
    </>
  )}
</div>
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Smoke-test in browser**

```bash
cd /Users/oscarshen/Downloads/analog-scrapbook && npm run dev
```

- Open the app, drag a material onto the canvas.
- Tap the scrap — toolbar should show scissors, tear, trash icons.
- Tap empty canvas — toolbar should revert to tape/text/glue.
- Tap a page-turn arrow — selection should clear.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: swap toolbar to scissors/tear/trash when scrap selected"
```
