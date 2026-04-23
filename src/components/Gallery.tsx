import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';
import {
  DrawerPosition,
  clampPosition,
  makeScatterPosition,
} from '../utils/drawerScatter';
import { GalleryMaterialCard } from './GalleryMaterialCard';

interface GalleryProps {
  materials: RawMaterial[];
  isOpen: boolean;
  onClose: () => void;
  onTapMaterial: (m: RawMaterial) => void;
  onDragEnd: (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => void;
  onContainerRectChange?: (rect: DOMRect | null) => void;
  onCardDragging?: (dragging: boolean) => void;
}

export const Gallery: React.FC<GalleryProps> = ({
  materials,
  isOpen,
  onClose,
  onTapMaterial,
  onDragEnd,
  onContainerRectChange,
  onCardDragging,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [positionsMap, setPositionsMap] = React.useState<Record<string, DrawerPosition>>({});

  // Seed positions for newly-added materials; drop positions for removed ones.
  React.useEffect(() => {
    setPositionsMap(prev => {
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 120;
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
          );
          added++;
        }
      });
      const ids = new Set(materials.map(m => m.id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [materials]);

  // Publish container rect to parent for cross-zone drop detection.
  React.useEffect(() => {
    if (!onContainerRectChange) return;
    const rect = containerRef.current?.getBoundingClientRect() ?? null;
    onContainerRectChange(rect);
    if (!isOpen) return;
    const id = window.setInterval(() => {
      onContainerRectChange(containerRef.current?.getBoundingClientRect() ?? null);
    }, 500);
    return () => window.clearInterval(id);
  }, [isOpen, onContainerRectChange]);

  const handleRearrange = React.useCallback((m: RawMaterial, newX: number, newY: number) => {
    setPositionsMap(prev => {
      const maxZ = Object.values(prev).reduce((z, p) => Math.max(z, p.zIndex), 0);
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 120;
      const { x, y } = clampPosition(newX, newY, containerW, containerH);
      return {
        ...prev,
        [m.id]: { ...prev[m.id], x, y, zIndex: maxZ + 1 },
      };
    });
  }, []);

  const handleCardDragEnd = React.useCallback(
    (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => {
      const container = containerRef.current?.getBoundingClientRect();
      if (container && cardRect) {
        const centerX = cardRect.left + info.offset.x + cardRect.width / 2;
        const centerY = cardRect.top + info.offset.y + cardRect.height / 2;
        const inside =
          centerX > container.left && centerX < container.right &&
          centerY > container.top && centerY < container.bottom;
        if (inside) {
          handleRearrange(m, cardRect.left + info.offset.x - container.left,
            cardRect.top + info.offset.y - container.top);
          return;
        }
      }
      onDragEnd(m, info, cardRect);
    },
    [onDragEnd, handleRearrange],
  );

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{
        height: 'calc(80vh - 32px)',
        backgroundImage: 'url(/gallery_background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        touchAction: 'none',
      }}
      initial={{ y: '100%' }}
      animate={{ y: isOpen ? '0%' : '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className="flex items-center justify-between px-4 h-10 shrink-0">
        <span
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: 'rgba(232,213,184,0.6)', fontWeight: 600 }}
        >
          Gallery
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="flex items-center gap-1 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(232,213,184,0.12)',
            color: 'rgba(232,213,184,0.85)',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          <X size={14} />
          Close
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative bg-[#1e1008]/70 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]"
      >
        {materials.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-white/20 font-serif italic text-sm tracking-wide">
              Gallery is empty
            </span>
            <span className="text-white/10 text-[10px] uppercase tracking-[0.2em]">
              new photos land here by default
            </span>
          </div>
        ) : (
          materials.map((m) => {
            const pos = positionsMap[m.id];
            if (!pos) return null;
            return (
              <GalleryMaterialCard
                key={m.id}
                material={m}
                position={pos}
                onTap={onTapMaterial}
                onDragEnd={handleCardDragEnd}
                onDragStateChange={onCardDragging}
              />
            );
          })
        )}
      </div>
    </motion.div>
  );
};
