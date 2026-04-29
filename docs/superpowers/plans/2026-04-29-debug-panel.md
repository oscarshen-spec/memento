# Debug Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small fixed gear button at bottom-left that opens a floating debug panel with a toggle for the Window Light overlay.

**Architecture:** A new `DebugPanel` component handles its own open/closed state and renders a fixed-position trigger button + animated panel. The controlled debug flags (`debugWindowLight`) live in `App.tsx` as state and are passed as props. The backdrop div (z-99) behind the panel closes it on outside click. The panel uses Framer Motion `AnimatePresence` for the slide-up animation, consistent with the rest of the app.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Framer Motion (`motion/react`)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/components/DebugPanel.tsx` | Create | Trigger button + animated panel + toggle rows |
| `src/App.tsx` | Modify | Add `debugWindowLight` state, pass to `DebugPanel`, render it unconditionally, thread into `WindowLight` condition |

---

### Task 1: Create `DebugPanel` component

**Files:**
- Create: `src/components/DebugPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings } from 'lucide-react';

interface DebugPanelProps {
  windowLight: boolean;
  onWindowLightChange: (v: boolean) => void;
}

export function DebugPanel({ windowLight, onWindowLightChange }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Backdrop — closes panel on outside click */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 100 }}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                bottom: 40,
                left: 0,
                width: 160,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Toggle row: Window Light */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Window Light</span>
                <button
                  onClick={() => onWindowLightChange(!windowLight)}
                  style={{
                    width: 28,
                    height: 16,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    background: windowLight ? 'rgb(251,191,36)' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                  aria-label="Toggle window light"
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: windowLight ? 14 : 2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger button */}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
          }}
          aria-label="Open debug panel"
        >
          <Settings size={14} />
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the file saved**

Run: `head -3 src/components/DebugPanel.tsx`  
Expected:
```
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings } from 'lucide-react';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DebugPanel.tsx
git commit -m "feat: add DebugPanel component with window light toggle"
```

---

### Task 2: Wire `DebugPanel` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the import**

In `src/App.tsx`, add after line 21 (`import { WindowLight } ...`):

```tsx
import { DebugPanel } from './components/DebugPanel';
```

- [ ] **Step 2: Add `debugWindowLight` state**

In `src/App.tsx`, after line 92 (`const [galleryOpen, setGalleryOpen] ...`), add:

```tsx
const [debugWindowLight, setDebugWindowLight] = useState(true);
```

- [ ] **Step 3: Thread state into the `WindowLight` condition**

Find line 933 in `src/App.tsx`:
```tsx
{(view === 'scrapbook' || view === 'drawer') && <WindowLight />}
```

Replace with:
```tsx
{debugWindowLight && (view === 'scrapbook' || view === 'drawer') && <WindowLight />}
```

- [ ] **Step 4: Render `DebugPanel` unconditionally**

Immediately after the line from Step 3, add:

```tsx
<DebugPanel windowLight={debugWindowLight} onWindowLightChange={setDebugWindowLight} />
```

So it reads:
```tsx
{debugWindowLight && (view === 'scrapbook' || view === 'drawer') && <WindowLight />}
<DebugPanel windowLight={debugWindowLight} onWindowLightChange={setDebugWindowLight} />
```

- [ ] **Step 5: Verify the app builds**

Run: `npm run build 2>&1 | tail -5`  
Expected: no TypeScript errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire DebugPanel into App with debugWindowLight state"
```
