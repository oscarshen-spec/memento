import React, { useState } from 'react';
import { useMotionValue } from 'motion/react';
import { Scrap, JournalEntry, ScrapbookPage, TapeStrip } from '../types';
import { Scrapbook } from './Scrapbook';
import { AddPageView } from './AddPageView';
import { shouldSnapForward } from '../utils/flipUtils';

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

// shouldSnapForward is imported for use in Task 6
void shouldSnapForward;

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

  // Suppress unused variable warnings — will be used in Tasks 5–6
  void rotateY;
  void setFlipDir;

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

  return (
    <div
      className="relative w-full h-full"
      style={{ perspective: 1200 }}
    >
      {/* z-index 1: next/prev page (revealed underneath flip) */}
      <div className="absolute inset-0" style={{ zIndex: 1, pointerEvents: 'none' }}>
        {nextPage === 'add-page' ? (
          <AddPageView onAdd={onAddPage} />
        ) : flipDir === 'prev' && prevPage ? (
          <Scrapbook page={prevPage} {...sharedScrapbookProps} />
        ) : nextPage ? (
          <Scrapbook page={nextPage as ScrapbookPage} {...sharedScrapbookProps} />
        ) : null}
      </div>

      {/* z-index 2: shadow overlay (added in Task 5) */}

      {/* z-index 3: current page (front + back face) — rotation added in Task 5 */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 3,
          transformStyle: 'preserve-3d',
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
      </div>

      {/* z-index 4: edge zone overlays (gesture handlers added in Task 4) */}
      {/* Right edge — turn next */}
      <div
        className="absolute top-0 right-0 h-full"
        style={{ width: EDGE_ZONE_WIDTH, zIndex: 4, cursor: 'ew-resize' }}
      />
      {/* Left edge — turn prev (only if prevPage exists) */}
      {prevPage && (
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: EDGE_ZONE_WIDTH, zIndex: 4, cursor: 'ew-resize' }}
        />
      )}
    </div>
  );
};
