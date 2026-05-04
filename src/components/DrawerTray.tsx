import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';
import { MaterialCard } from './MaterialDrawer';
import { DrawerPosition, clampPosition, makeScatterPosition } from '../utils/drawerScatter';
import { playSound } from '../services/soundService';

type Zone = null | 'photos' | 'tape' | 'papers';

// Fixed rotations for the photo pile preview — stable across renders
const PHOTO_ROTATIONS = [-17, 14, -5];
const PHOTO_OFFSETS: { left: number; top: number }[] = [
  { left: 0, top: 13 },
  { left: 26, top: 0 },
  { left: 10, top: 24 },
];

// Paper pile colour stack
const PAPER_STACK = [
  { bg: '#d4a017' },
  { bg: '#c0392b' },
  { bg: '#95a5a6' },
  { bg: '#1a5276' },
  { bg: '#145a32' },
];

export interface DrawerTrayProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragMaterial: (material: RawMaterial, info: PanInfo) => void;
  onCardDragging?: (dragging: boolean) => void;
  galleryOpen: boolean;
  onOpenGallery: () => void;
  onReclassifyToGallery: (id: string) => void;
  galleryRectRef: React.RefObject<DOMRect | null>;
  onAddEnvelope?: () => void;
  onActivateTape?: () => void;
  tapeActive?: boolean;
}

export const DrawerTray: React.FC<DrawerTrayProps> = ({
  materials,
  onSelect,
  onUpload,
  onDragMaterial,
  onCardDragging,
  onReclassifyToGallery,
  galleryRectRef,
  onActivateTape,
  tapeActive = false,
}) => {
  const [activeZone, setActiveZone] = useState<Zone>(null);
  const [isOpen, setIsOpen] = useState(false);
  const controls = useAnimation();

  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom').trim();
    setSafeAreaBottom(parseInt(raw, 10) || 0);
  }, []);

  const handleHeight = 24;
  const closedY = `calc(-20vh + ${handleHeight + safeAreaBottom}px)`;

  useEffect(() => {
    controls.start(isOpen ? { y: 0 } : { y: closedY });
  }, [isOpen, controls, closedY]);

  const onTrayDragEnd = (_: unknown, info: PanInfo) => {
    const isFastDown = info.velocity.y > 500;
    const isFastUp = info.velocity.y < -500;
    const isDraggedDown = info.offset.y > 20;
    const isDraggedUp = info.offset.y < -20;

    if (isFastDown || isDraggedDown) {
      if (!isOpen) playSound('drawerSlide');
      setIsOpen(true);
    } else if (isFastUp || isDraggedUp) {
      if (isOpen) playSound('drawerSlide');
      setIsOpen(false);
    } else {
      controls.start(isOpen ? { y: 0 } : { y: closedY });
    }
  };

  // ── Scatter positions for photo cards ──────────────────────────────────────
  const photoContainerRef = useRef<HTMLDivElement>(null);
  const [positionsMap, setPositionsMap] = useState<Record<string, DrawerPosition>>({});

  useEffect(() => {
    setPositionsMap(prev => {
      const containerW = photoContainerRef.current?.offsetWidth ?? 320;
      const containerH = photoContainerRef.current?.offsetHeight ?? 80;
      const maxZ = Object.values(prev).reduce((acc, p) => Math.max(acc, p.zIndex), 0);
      const next = { ...prev };
      let added = 0;
      materials.forEach((m) => {
        if (!next[m.id]) {
          next[m.id] = makeScatterPosition(
            Object.keys(next).length + added,
            containerW,
            containerH,
            maxZ + 1,
            Object.values(next),
            [],
          );
          added++;
        }
      });
      const ids = new Set(materials.map(m => m.id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [materials]);

  const onRearrange = useCallback((material: RawMaterial, newX: number, newY: number) => {
    setPositionsMap(prev => {
      const maxZ = Object.values(prev).reduce((m, p) => Math.max(m, p.zIndex), 0);
      const containerW = photoContainerRef.current?.offsetWidth ?? 320;
      const containerH = photoContainerRef.current?.offsetHeight ?? 80;
      const { x, y } = clampPosition(newX, newY, containerW, containerH, []);
      return {
        ...prev,
        [material.id]: { ...prev[material.id], x, y, zIndex: maxZ + 1 },
      };
    });
  }, []);

  const overflowRef = useRef<HTMLDivElement>(null);
  const contentDivRef = useRef<HTMLDivElement>(null);
  const handleCardDragState = useCallback((dragging: boolean) => {
    [overflowRef.current, contentDivRef.current].forEach(el => {
      if (el) el.style.overflow = dragging ? 'visible' : '';
    });
    onCardDragging?.(dragging);
  }, [onCardDragging]);

  const previewPhotos = materials.slice(0, 3);

  // ── Photo scatter view (same cards as MaterialDrawer) ──────────────────────
  const photoZoneContent = (
    <div className="flex-1 flex overflow-hidden relative" ref={overflowRef}>
      {/* back chevron */}
      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 z-[10000] w-8 h-8 flex items-center justify-center"
        onClick={() => setActiveZone(null)}
        aria-label="Back"
      >
        <span className="text-white/60 text-xl leading-none">‹</span>
      </button>

      <div ref={photoContainerRef} className="flex-1 relative">
        {materials.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/30 text-xs italic">No photos yet</span>
          </div>
        )}
        {materials.map((m) => {
          const pos = positionsMap[m.id];
          if (!pos) return null;
          return (
            <MaterialCard
              key={m.id}
              material={m}
              position={pos}
              drawerRef={photoContainerRef}
              onSelect={onSelect}
              onDragMaterial={onDragMaterial}
              onRearrange={onRearrange}
              onDragStateChange={handleCardDragState}
              onReclassifyToGallery={onReclassifyToGallery}
              galleryRectRef={galleryRectRef}
            />
          );
        })}
      </div>
    </div>
  );

  // ── Three-zone overview ────────────────────────────────────────────────────
  const zonesContent = (
    <div className="flex-1 flex items-center justify-center gap-2 overflow-hidden">
      {/* Photos zone */}
      <button
        className="relative h-full flex items-center justify-center"
        onClick={() => setActiveZone('photos')}
      >
        <div className="relative w-[120px] h-[105px]">
          {previewPhotos.map((m, i) => (
            <img
              key={m.id}
              src={m.image}
              alt=""
              className="absolute w-[68px] h-[90px] object-cover rounded-[2px] pointer-events-none"
              style={{
                left: PHOTO_OFFSETS[i].left,
                top: PHOTO_OFFSETS[i].top,
                transform: `rotate(${PHOTO_ROTATIONS[i]}deg)`,
                zIndex: i,
                boxShadow: '3px 3px 6px rgba(0,0,0,0.35)',
              }}
            />
          ))}
          {previewPhotos.length === 0 && (
            <div className="absolute inset-0 rounded-[2px] bg-[rgba(255,255,255,0.15)]" />
          )}
        </div>
      </button>

      {/* Tape zone */}
      <button
        className="relative h-full flex items-center justify-center"
        onClick={onActivateTape}
        title="Washi tape"
      >
        <img
          src="/Tape.png"
          alt="Tape"
          className="w-[120px] h-[120px] object-contain pointer-events-none transition-all duration-150"
          style={{
            transform: tapeActive ? 'rotate(12.5deg) scale(1.08)' : 'rotate(12.5deg)',
            filter: tapeActive
              ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))'
              : 'drop-shadow(5px 5px 6px rgba(0,0,0,0.3))',
          }}
        />
      </button>

      {/* Papers zone */}
      <button
        className="relative h-full flex items-center justify-center"
        onClick={() => { /* papers zone not yet implemented */ }}
      >
        <div className="relative w-[105px] h-[120px]">
          {PAPER_STACK.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-[1px] pointer-events-none"
              style={{
                width: 86,
                height: 129,
                backgroundColor: p.bg,
                left: 5 + i * 5,
                top: 3 + i * 6,
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                opacity: 0.9,
                boxShadow: '2px 2px 4px rgba(0,0,0,0.25)',
                zIndex: i,
              }}
            />
          ))}
        </div>
      </button>
    </div>
  );

  return (
    <div className="relative w-full h-full">
      <motion.div
        drag="y"
        dragConstraints={{ top: -200, bottom: 0 }}
        dragElastic={0.05}
        onDragEnd={onTrayDragEnd}
        animate={controls}
        initial={{ y: closedY }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-x-0 top-0 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        style={{ height: '20vh', touchAction: 'none' }}
      >
        {/* Drawer body with wood texture */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeZone ?? 'zones'}
            ref={contentDivRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex-1 flex border-b border-black/40 overflow-hidden"
            style={{
              backgroundImage: 'url(/Drawer.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {activeZone === 'photos' ? photoZoneContent : zonesContent}
          </motion.div>
        </AnimatePresence>

        {/* Handle bar */}
        <div
          onClick={() => { playSound('drawerSlide'); setIsOpen(prev => !prev); }}
          className="h-[24px] drawer-front flex flex-col items-center justify-center shrink-0 border-t border-white/5 cursor-grab active:cursor-grabbing relative z-[99999]"
        >
          <div className="drawer-handle" />
        </div>

        {safeAreaBottom > 0 && (
          <div className="drawer-front shrink-0" style={{ height: safeAreaBottom }} />
        )}
      </motion.div>
    </div>
  );
};
