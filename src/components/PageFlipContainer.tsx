import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { animate } from 'motion';
import { Scrap, JournalEntry, ScrapbookPage, TapeStrip } from '../types';
import { Scrapbook } from './Scrapbook';
import { AddPageView } from './AddPageView';

interface PageFlipContainerProps {
  currentPage: ScrapbookPage;
  prevPage: ScrapbookPage | null;
  nextPage: ScrapbookPage | 'add-page';
  onFlipComplete: (direction: 'next' | 'prev') => void;
  onAddPage: () => void;
  dimensions: { width: number; height: number };
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  fallingScrapIds: string[] | null;
  onFallComplete: (ids: string[]) => void;
}

const EDGE_ZONE_WIDTH = 30;

export const PageFlipContainer: React.FC<PageFlipContainerProps> = ({
  currentPage,
  prevPage,
  nextPage,
  onFlipComplete,
  onAddPage,
  dimensions,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
}) => {
  const rotateY = useMotionValue(0);
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  const [selectedScrapId, setSelectedScrapId] = useState<string | null>(null);
  const isFlipping = flipDir !== null;

  const shadowOpacity = useTransform(rotateY, (v: number) => {
    const abs = Math.abs(v);
    if (abs === 0) return 0;
    return (Math.min(abs, 180 - abs) / 90) * 0.45;
  });

  const pointerStartX = useRef<number>(0);
  const pointerLastX = useRef<number>(0);
  const pointerPrevX = useRef<number>(0);
  const pointerPrevT = useRef<number>(Date.now());

  const sharedScrapbookProps = {
    onUpdateScrap,
    onUpdateEntry,
    onReturnScrap,
    onAddTapeStrip,
    isTapeActive: isTapeActive && !isFlipping,
    isGlueActive: isGlueActive && !isFlipping,
    fallingScrapIds,
    onFallComplete,
    dimensions,
    selectedScrapId,
    onSelectScrap: setSelectedScrapId,
  };

  const handleRightZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartX.current = e.clientX;
    pointerLastX.current = e.clientX;
    pointerPrevX.current = e.clientX;
    pointerPrevT.current = Date.now();
    setFlipDir('next');
  };

  const handleLeftZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStartX.current = e.clientX;
    pointerLastX.current = e.clientX;
    pointerPrevX.current = e.clientX;
    pointerPrevT.current = Date.now();
    setFlipDir('prev');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flipDir === null) return;
    const dx = e.clientX - pointerStartX.current;

    pointerPrevX.current = pointerLastX.current;
    pointerPrevT.current = Date.now();
    pointerLastX.current = e.clientX;

    if (flipDir === 'next') {
      // Drag left: dx is negative, clamp to [-width, 0]
      const clamped = Math.max(-dimensions.width, Math.min(0, dx));
      rotateY.set((clamped / dimensions.width) * -180);
    } else {
      // Drag right: dx is positive, clamp to [0, width]
      const clamped = Math.max(0, Math.min(dimensions.width, dx));
      rotateY.set((clamped / dimensions.width) * 180);
    }
  };

  return (
    <div
      className="relative w-full h-full"
      style={{ perspective: 1200 }}
    >
      {/* z-index 1: next/prev page (revealed underneath flip) */}
      <div className="absolute inset-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
        {flipDir === 'prev' && prevPage ? (
          <Scrapbook page={prevPage} {...sharedScrapbookProps} />
        ) : nextPage === 'add-page' ? (
          <AddPageView onAdd={onAddPage} />
        ) : (
          <Scrapbook page={nextPage} {...sharedScrapbookProps} />
        )}
      </div>

      {/* z-index 2: shadow overlay */}
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          pointerEvents: 'none',
          background: flipDir === 'prev'
            ? 'linear-gradient(to left, rgba(0,0,0,0.4), transparent)'
            : 'linear-gradient(to right, rgba(0,0,0,0.4), transparent)',
          opacity: shadowOpacity,
        }}
      />

      {/* z-index 3: current page (rotates on flip) */}
      <motion.div
        className="absolute inset-0"
        style={{
          zIndex: 3,
          transformStyle: 'preserve-3d',
          rotateY,
          transformOrigin: flipDir === 'prev' ? 'right center' : 'left center',
        }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Scrapbook page={currentPage} {...sharedScrapbookProps} />
        </div>
        {/* Back face: kraft paper */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: '#f0e8d8',
          }}
        />
      </motion.div>

      {/* z-index 4: edge zone overlays */}
      {/* Right edge — turn next */}
      <div
        className="absolute top-0 right-0 h-full"
        style={{ width: EDGE_ZONE_WIDTH, zIndex: 4, cursor: 'ew-resize' }}
        onPointerDown={handleRightZoneDown}
        onPointerMove={handlePointerMove}
      />
      {/* Left edge — turn prev */}
      {prevPage && (
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: EDGE_ZONE_WIDTH, zIndex: 4, cursor: 'ew-resize' }}
          onPointerDown={handleLeftZoneDown}
          onPointerMove={handlePointerMove}
        />
      )}
    </div>
  );
};
