import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { RawMaterial } from '../types';

// Prototype asset URLs from Figma (valid 7 days)
const CAMERA_STICKER = 'https://www.figma.com/api/mcp/asset/d2ea133a-4368-4897-b37c-3caf565a05c4';

const TICKET_ITEMS = [
  { src: 'https://www.figma.com/api/mcp/asset/d86fb12d-0ae5-4ef3-af21-00aafe37df00', w: 93, h: 48, rot: -7.88 },
  { src: 'https://www.figma.com/api/mcp/asset/bd9418f7-2b85-4ff3-927e-e7c5f74157b5', w: 102, h: 56, rot: 0 },
  { src: 'https://www.figma.com/api/mcp/asset/3a906c80-1945-4791-b1c3-75bf939e1928', w: 51, h: 94, rot: 11.54 },
  { src: 'https://www.figma.com/api/mcp/asset/1a6f5f6c-125a-4acc-a72f-bf8d7e7dc20a', w: 94, h: 55, rot: 2 },
  { src: 'https://www.figma.com/api/mcp/asset/ca449837-06ee-4b08-acec-2110bac501e2', w: 50, h: 93, rot: -4 },
  { src: 'https://www.figma.com/api/mcp/asset/2afc196e-73e1-4978-8a5b-2b01bf851978', w: 52, h: 104, rot: 6 },
  { src: 'https://www.figma.com/api/mcp/asset/e77cf9d6-5ef9-4076-9e99-6fe16bacdc32', w: 73, h: 30, rot: -3 },
  { src: 'https://www.figma.com/api/mcp/asset/906bf4eb-db2f-432b-8bd0-60154d2f84eb', w: 38, h: 64, rot: 8 },
  { src: 'https://www.figma.com/api/mcp/asset/a8a578db-bd18-494d-b4de-a92f25e7b7b9', w: 40, h: 63, rot: -5 },
  { src: 'https://www.figma.com/api/mcp/asset/f0ca00a2-ae4a-4062-b8bc-13dd5b43465a', w: 37, h: 63, rot: 9 },
  { src: 'https://www.figma.com/api/mcp/asset/827fd219-c023-4c8c-8aff-3b7e7c4c0049', w: 45, h: 60, rot: -2 },
  { src: 'https://www.figma.com/api/mcp/asset/83bab927-8062-4a37-9d09-a7238ea1e14f', w: 88, h: 45, rot: 13.25 },
];

const PEOPLE_ITEMS = [
  { src: 'https://www.figma.com/api/mcp/asset/57ec1018-5038-443c-856c-a6eaf85b3b86', w: 67, h: 64, rot: 4.85, polaroid: true },
  { src: 'https://www.figma.com/api/mcp/asset/b4c9b980-9a69-4d96-b263-c6be37f96a0f', w: 74, h: 89, rot: 4.84, polaroid: true },
  { src: 'https://www.figma.com/api/mcp/asset/22d03baf-db7f-4802-a8e8-846c205b8997', w: 67, h: 64, rot: -3.33, polaroid: true },
  { src: 'https://www.figma.com/api/mcp/asset/9e3d5b42-0e30-4bbc-b4fb-e217abf06101', w: 77, h: 111, rot: -9.07, polaroid: true },
  { src: 'https://www.figma.com/api/mcp/asset/9e3d5b42-0e30-4bbc-b4fb-e217abf06101', w: 72, h: 103, rot: 17.74, polaroid: true },
];

const BUILDING_ITEMS = [
  { src: 'https://www.figma.com/api/mcp/asset/e45de1b2-ed76-4ba0-a0ac-cbf95b391c3e', w: 64, h: 85, rot: 6.83 },
  { src: 'https://www.figma.com/api/mcp/asset/8addd5bc-71a5-4f6e-b9c5-50c1fa8a9e67', w: 64, h: 85, rot: -3.52 },
  { src: 'https://www.figma.com/api/mcp/asset/0b5f106a-6017-4f36-a4c5-e0198573eaa8', w: 84, h: 112, rot: -4.95 },
  { src: 'https://www.figma.com/api/mcp/asset/182cf97e-e646-43b4-97e1-4c0f5ae363b1', w: 64, h: 85, rot: 10.4 },
];

const OTHER_ITEMS = [
  { src: 'https://www.figma.com/api/mcp/asset/e45de1b2-ed76-4ba0-a0ac-cbf95b391c3e', w: 64, h: 85, rot: 6.83 },
  { src: 'https://www.figma.com/api/mcp/asset/8addd5bc-71a5-4f6e-b9c5-50c1fa8a9e67', w: 64, h: 85, rot: -3.52 },
  { src: 'https://www.figma.com/api/mcp/asset/0b5f106a-6017-4f36-a4c5-e0198573eaa8', w: 84, h: 112, rot: -4.95 },
  { src: 'https://www.figma.com/api/mcp/asset/182cf97e-e646-43b4-97e1-4c0f5ae363b1', w: 64, h: 85, rot: 10.4 },
];

interface ScatteredItem {
  src: string;
  w: number;
  h: number;
  rot: number;
  polaroid?: boolean;
}

function ScatteredRow({ items }: { items: ScatteredItem[] }) {
  return (
    <div
      className="relative w-full overflow-x-auto overflow-y-visible"
      style={{ height: 140, scrollbarWidth: 'none' }}
    >
      <div
        className="absolute top-0 left-0 flex items-center"
        style={{ gap: 8, padding: '8px 0', height: 140 }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="shrink-0 relative"
            style={{
              transform: `rotate(${item.rot}deg)`,
              width: item.w,
              height: item.h,
            }}
          >
            {item.polaroid ? (
              <div
                style={{
                  width: item.w,
                  height: item.h,
                  background: '#fff',
                  padding: '4px 4px 12px 4px',
                  boxShadow: '2px 2px 2px rgba(0,0,0,0.2)',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={item.src}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            ) : (
              <img
                src={item.src}
                alt=""
                style={{
                  width: item.w,
                  height: item.h,
                  objectFit: 'cover',
                  display: 'block',
                  boxShadow: '2px 2px 2px rgba(0,0,0,0.2)',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CategorySection {
  label: string;
  items: ScatteredItem[];
}

const PROTOTYPE_CATEGORIES: CategorySection[] = [
  { label: 'Tickets', items: TICKET_ITEMS },
  { label: 'People', items: PEOPLE_ITEMS },
  { label: 'Buildings', items: BUILDING_ITEMS },
  { label: 'Something else', items: OTHER_ITEMS },
];

interface GalleryProps {
  materials: RawMaterial[];
  isOpen: boolean;
  onClose: () => void;
  onTapMaterial: (m: RawMaterial) => void;
  onDragEnd: (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => void;
  onContainerRectChange?: (rect: DOMRect | null) => void;
  onCardDragging?: (dragging: boolean) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ isOpen, onClose }) => {
  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      style={{
        height: 'calc(80vh - 32px)',
        backgroundImage: 'url(/gallery_background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      initial={{ y: '100%' }}
      animate={{ y: isOpen ? '0%' : '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.35)' }} />

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 -ml-1"
              aria-label="Close collection"
            >
              <ChevronLeft size={24} color="white" />
            </button>
            <h1
              style={{
                fontFamily: 'Caveat, cursive',
                fontWeight: 700,
                fontSize: 24,
                color: '#fff',
                lineHeight: 1,
              }}
            >
              Your Collection
            </h1>
          </div>
          <img
            src={CAMERA_STICKER}
            alt="Camera"
            style={{ width: 80, height: 51, objectFit: 'contain', filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.2))' }}
          />
        </div>

        {/* Scrollable category list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8" style={{ scrollbarWidth: 'none' }}>
          {PROTOTYPE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-8">
              <p
                style={{
                  fontFamily: 'Caveat, cursive',
                  fontWeight: 400,
                  fontSize: 16,
                  color: '#fff',
                  marginBottom: 8,
                  lineHeight: 1,
                }}
              >
                {cat.label}
              </p>
              <ScatteredRow items={cat.items} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
