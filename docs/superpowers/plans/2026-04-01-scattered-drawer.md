# Scattered Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the neat horizontal flex row in MaterialDrawer with gravity-anchored scatter — each photo gets a persistent random y-jitter (±14px) and rotation (±15°), drag-to-rearrange within the drawer, positions survive open/close.

**Architecture:** All changes are self-contained in `MaterialDrawer.tsx`. A `positionsMap` state (keyed by material ID) stores each card's absolute `{x, y, rotation, zIndex}`. The content container switches from flex to relative/absolute. `MaterialCard` receives its position as a prop and detects on drag-end whether the drop landed inside the drawer (rearrange) or outside (page-drop).

**Tech Stack:** React 19, TypeScript, Framer Motion (`motion/react`), Tailwind CSS v4

---

## File Structure

| File | Change |
|------|--------|
| `src/components/MaterialDrawer.tsx` | All changes — positionsMap state, absolute layout, drag detection |

No other files change.

---

### Task 1: Add `DrawerPosition` type and `positionsMap` state to `MaterialDrawer`

**Files:**
- Modify: `src/components/MaterialDrawer.tsx`

- [ ] **Step 1: Add `DrawerPosition` type and constants near the top of the file (after imports)**

  In `src/components/MaterialDrawer.tsx`, add after the import block:

  ```ts
  // ─── Drawer scatter types & helpers ───────────────────────────────────────────

  interface DrawerPosition {
    x: number;
    y: number;
    rotation: number;
    zIndex: number;
  }

  const CARD_H = 116;
  const BASE_SPACING = 120; // 100px card + 20px gap

  function makeScatterPosition(index: number, containerHeight: number, baseZ: number): DrawerPosition {
    return {
      x: index * BASE_SPACING + (Math.random() - 0.5) * 10,
      y: (containerHeight - CARD_H) / 2 + (Math.random() - 0.5) * 28,
      rotation: (Math.random() - 0.5) * 30,
      zIndex: baseZ + index,
    };
  }
  ```

- [ ] **Step 2: Add `positionsMap` state, `containerRef`, and `onRearrange` to `MaterialDrawer`**

  Inside the `MaterialDrawer` component, after the existing `safeAreaBottom` state:

  ```ts
  const [positionsMap, setPositionsMap] = React.useState<Record<string, DrawerPosition>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  ```

- [ ] **Step 3: Add a `useEffect` that seeds positions for any material not yet in the map**

  After the existing `useEffect` that reads `--safe-area-inset-bottom`, add:

  ```ts
  React.useEffect(() => {
    setPositionsMap(prev => {
      const containerH = containerRef.current?.offsetHeight ?? 80;
      const maxZ = Object.values(prev).reduce((m, p) => Math.max(m, p.zIndex), 0);
      const next = { ...prev };
      let added = 0;
      materials.forEach((m, i) => {
        if (!next[m.id]) {
          next[m.id] = makeScatterPosition(
            Object.keys(next).length + added,
            containerH,
            maxZ + 1,
          );
          added++;
        }
      });
      // Remove positions for materials that no longer exist
      const ids = new Set(materials.map(m => m.id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [materials]);
  ```

- [ ] **Step 4: Add `onRearrange` handler**

  After the `useEffect` above, add:

  ```ts
  const onRearrange = React.useCallback((material: RawMaterial, newX: number, newY: number) => {
    setPositionsMap(prev => {
      const maxZ = Object.values(prev).reduce((m, p) => Math.max(m, p.zIndex), 0);
      return {
        ...prev,
        [material.id]: { ...prev[material.id], x: newX, y: newY, zIndex: maxZ + 1 },
      };
    });
  }, []);
  ```

- [ ] **Step 5: Verify the app still compiles — run dev server**

  ```bash
  cd /Users/oscarshen/Downloads/analog-scrapbook && npm run dev
  ```

  Expected: no TypeScript errors, app loads normally (drawer layout unchanged so far).

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/MaterialDrawer.tsx
  git commit -m "feat: add positionsMap scatter state to MaterialDrawer"
  ```

---

### Task 2: Update `MaterialCard` to use absolute positioning and detect in-drawer drops

**Files:**
- Modify: `src/components/MaterialDrawer.tsx`

- [ ] **Step 1: Update `MaterialCardProps` to replace `index` with `position` and add new callbacks**

  Replace the existing `MaterialCardProps` interface:

  ```ts
  interface MaterialCardProps {
    material: RawMaterial;
    position: DrawerPosition;
    drawerRef: React.RefObject<HTMLDivElement>;
    onSelect: (m: RawMaterial) => void;
    onDragMaterial: (m: RawMaterial, info: PanInfo) => void;
    onRearrange: (m: RawMaterial, newX: number, newY: number) => void;
  }
  ```

- [ ] **Step 2: Rewrite `MaterialCard` component signature and rotation setup**

  Replace the opening lines of `MaterialCard` (the `baseRot` line and motion values):

  ```ts
  const MaterialCard: React.FC<MaterialCardProps> = ({
    material, position, drawerRef, onSelect, onDragMaterial, onRearrange,
  }) => {
    const scaleValue = useMotionValue(1);
    const springScale = useSpring(scaleValue, { stiffness: 350, damping: 12 });
    const rotValue = useMotionValue(position.rotation);
    const springRot = useSpring(rotValue, { stiffness: 280, damping: 18 });

    const portalX = useMotionValue(0);
    const portalY = useMotionValue(0);

    const [isDragging, setIsDragging] = React.useState(false);
    const [cardRect, setCardRect] = React.useState<DOMRect | null>(null);
    const cardRef = React.useRef<HTMLDivElement>(null);
  ```

- [ ] **Step 3: Update `onDragEnd` to detect in-drawer vs page-drop**

  Replace the existing `onDragEnd` handler inside the `motion.div`:

  ```ts
  onDragEnd={(_, info) => {
    setIsDragging(false);
    setCardRect(null);
    scaleValue.set(1);
    rotValue.set(position.rotation);
    navigator.vibrate?.(30);

    const drawerEl = drawerRef.current;
    if (drawerEl && cardRect) {
      const db = drawerEl.getBoundingClientRect();
      const dropCenterX = cardRect.left + info.offset.x + cardRect.width / 2;
      const dropCenterY = cardRect.top + info.offset.y + cardRect.height / 2;
      const insideDrawer =
        dropCenterX > db.left &&
        dropCenterX < db.right &&
        dropCenterY > db.top &&
        dropCenterY < db.bottom;

      if (insideDrawer) {
        const newX = cardRect.left + info.offset.x - db.left;
        const newY = cardRect.top + info.offset.y - db.top;
        onRearrange(material, newX, newY);
        return;
      }
    }

    onDragMaterial(material, info);
  }}
  ```

- [ ] **Step 4: Update the `motion.div` wrapper to use absolute positioning**

  Change the outer `motion.div` — replace the existing `style` and `className`:

  ```tsx
  <motion.div
    ref={cardRef}
    drag
    dragSnapToOrigin
    onPointerDown={(e) => e.stopPropagation()}
    onDragStart={() => {
      const rect = cardRef.current?.getBoundingClientRect() ?? null;
      setCardRect(rect);
      portalX.set(0);
      portalY.set(0);
      setIsDragging(true);
      scaleValue.set(1.04);
      navigator.vibrate?.(10);
    }}
    onDrag={(_, info) => {
      portalX.set(info.offset.x);
      portalY.set(info.offset.y);
      const targetRot = Math.max(-15, Math.min(15, position.rotation + info.velocity.x * -0.02));
      rotValue.set(targetRot);
    }}
    onDragEnd={(_, info) => {
      setIsDragging(false);
      setCardRect(null);
      scaleValue.set(1);
      rotValue.set(position.rotation);
      navigator.vibrate?.(30);
      const drawerEl = drawerRef.current;
      if (drawerEl && cardRect) {
        const db = drawerEl.getBoundingClientRect();
        const dropCenterX = cardRect.left + info.offset.x + cardRect.width / 2;
        const dropCenterY = cardRect.top + info.offset.y + cardRect.height / 2;
        const insideDrawer =
          dropCenterX > db.left && dropCenterX < db.right &&
          dropCenterY > db.top && dropCenterY < db.bottom;
        if (insideDrawer) {
          onRearrange(material, cardRect.left + info.offset.x - db.left, cardRect.top + info.offset.y - db.top);
          return;
        }
      }
      onDragMaterial(material, info);
    }}
    onClick={(e) => { e.stopPropagation(); onSelect(material); }}
    style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      scale: springScale,
      rotate: springRot,
      zIndex: position.zIndex,
      touchAction: 'none',
      opacity: isDragging ? 0 : 1,
    }}
    className="w-[100px] h-[116px] cursor-grab active:cursor-grabbing"
  >
  ```

  Note: remove `relative shrink-0` from className, remove `zIndex: 1` from the old style (now uses `position.zIndex`).

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  cd /Users/oscarshen/Downloads/analog-scrapbook && npm run dev
  ```

  Expected: no TS errors. Drawer may look broken visually until Task 3 wires up the container.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/MaterialDrawer.tsx
  git commit -m "feat: update MaterialCard to use absolute positioning with scatter coords"
  ```

---

### Task 3: Switch drawer content container to absolute positioning and pass new props

**Files:**
- Modify: `src/components/MaterialDrawer.tsx`

- [ ] **Step 1: Attach `containerRef` and switch the inner content div from flex to relative**

  Find the scrollable content div (currently `overflow-x-auto p-4 px-6 flex gap-5 scrollbar-hide items-center`). Replace it:

  ```tsx
  <div
    ref={containerRef}
    className={`flex-1 relative overflow-hidden transition-colors duration-300 ${isOpen ? 'bg-[#1e1008]/70 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]' : 'bg-black/30 shadow-inner'}`}
  >
  ```

  Note: remove `overflow-x-auto`, `p-4 px-6`, `flex gap-5`, `scrollbar-hide`, `items-center` — these were for the flex row layout.

- [ ] **Step 2: Update the materials render to pass new props to `MaterialCard`**

  Replace the `materials.map(...)` block:

  ```tsx
  materials.map((m) => {
    const pos = positionsMap[m.id];
    if (!pos) return null;
    return (
      <MaterialCard
        key={m.id}
        material={m}
        position={pos}
        drawerRef={containerRef}
        onSelect={onSelect}
        onDragMaterial={onDragMaterial}
        onRearrange={onRearrange}
      />
    );
  })
  ```

- [ ] **Step 3: Verify visually in browser**

  ```bash
  npm run dev
  ```

  Open the app. Open the drawer. Verify:
  1. Photos appear scattered with varied y-positions and rotations (not a neat row)
  2. Empty state message still shows when no materials
  3. Close and reopen — photos stay in same positions
  4. Drag a photo within the drawer — it settles at the drop point
  5. Drag a photo out to the page — page-drop still works (scrap appears on canvas)
  6. Tap a photo — opens CuttingRoom as before

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/MaterialDrawer.tsx
  git commit -m "feat: wire up scattered drawer layout with absolute positioning"
  ```
