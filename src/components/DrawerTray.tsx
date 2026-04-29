import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';
import { MaterialDrawer } from './MaterialDrawer';

type Zone = null | 'photos' | 'tape' | 'papers';

// Fixed rotations for the photo pile — seeded so they never re-randomise on render
const PHOTO_ROTATIONS = [-17, 14, -5];
const PHOTO_OFFSETS: { left: number; top: number }[] = [
  { left: 0, top: 10 },
  { left: 20, top: 0 },
  { left: 8, top: 18 },
];

// Paper pile colour stack matching the Figma drawer spec
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
}

export const DrawerTray: React.FC<DrawerTrayProps> = ({
  materials,
  onSelect,
  onUpload,
  onDragMaterial,
  onCardDragging,
  galleryOpen,
  onOpenGallery,
  onReclassifyToGallery,
  galleryRectRef,
  onAddEnvelope,
}) => {
  const [activeZone, setActiveZone] = useState<Zone>(null);

  const previewPhotos = materials.slice(0, 3);

  return (
    <div className="relative w-full h-full">
      <AnimatePresence>
        {activeZone === null && (
          <motion.div
            key="zones"
            className="absolute inset-0 flex items-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* ── Photos zone ─────────────────────────────────────── */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => setActiveZone('photos')}
            >
              <div className="relative w-[90px] h-[80px]">
                {previewPhotos.map((m, i) => (
                  <img
                    key={m.id}
                    src={m.image}
                    alt=""
                    className="absolute w-[52px] h-[70px] object-cover rounded-[2px] pointer-events-none"
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

            {/* ── Tape zone (placeholder) ──────────────────────────── */}
            {/* TODO: implement tape zone expand */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => { /* no-op: tape zone not yet implemented */ }}
            >
              <img
                src="/Tape.png"
                alt="Tape"
                className="w-[90px] h-[90px] object-contain pointer-events-none"
                style={{
                  transform: 'rotate(12.5deg)',
                  filter: 'drop-shadow(5px 5px 6px rgba(0,0,0,0.3))',
                }}
              />
            </button>

            {/* ── Papers zone (placeholder) ────────────────────────── */}
            {/* TODO: implement papers zone expand */}
            <button
              className="relative flex-1 h-full flex items-center justify-center"
              onClick={() => { /* no-op: papers zone not yet implemented */ }}
            >
              <div className="relative w-[80px] h-[90px]">
                {PAPER_STACK.map((p, i) => (
                  <div
                    key={i}
                    className="absolute rounded-[1px] pointer-events-none"
                    style={{
                      width: 66,
                      height: 99,
                      backgroundColor: p.bg,
                      left: 4 + i * 4,
                      top: 2 + i * 5,
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeZone === 'photos' && (
          <motion.div
            key="photos-drawer"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <MaterialDrawer
              materials={materials}
              onSelect={onSelect}
              isOpen={true}
              onToggle={(open) => { if (!open) setActiveZone(null); }}
              onClose={() => setActiveZone(null)}
              onUpload={onUpload}
              onDragMaterial={onDragMaterial}
              onCardDragging={onCardDragging}
              galleryOpen={galleryOpen}
              onOpenGallery={onOpenGallery}
              onReclassifyToGallery={onReclassifyToGallery}
              galleryRectRef={galleryRectRef}
              onAddEnvelope={onAddEnvelope}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
