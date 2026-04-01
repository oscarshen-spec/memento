import React, { useState, useRef, useEffect, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import Konva from 'konva';
import { Scrap, JournalEntry, ScrapbookPage, TapeStrip } from '../types';
import { Scrapbook } from './Scrapbook';
import { AddPageView } from './AddPageView';
import { buildFlipEvent, extractPointerCoords, FlipPhase } from '../utils/flipDelegation';

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
  selectedScrapId: string | null;
  onSelectScrap: (id: string | null) => void;
}

const EDGE_ZONE_WIDTH = 30;
const SNAPSHOT_DEBOUNCE_MS = 500;

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
  selectedScrapId,
  onSelectScrap,
}) => {
  const [flipState, setFlipState] = useState<'idle' | 'flipping'>('idle');
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  // Ref mirrors flipDir for use inside callbacks without stale closures
  const flipDirRef = useRef<'next' | 'prev' | null>(null);

  const [currentSnapshot, setCurrentSnapshot] = useState<string | null>(null);
  const [nextSnapshot, setNextSnapshot] = useState<string | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<string | null>(null);

  const currentStageRef = useRef<Konva.Stage>(null);
  const nextStageRef = useRef<Konva.Stage>(null);
  const prevStageRef = useRef<Konva.Stage>(null);
  const flipContainerRef = useRef<HTMLDivElement>(null);
  // Coords captured on pointerdown, dispatched as synthetic mousedown after render
  const pendingCoordsRef = useRef<(ReturnType<typeof extractPointerCoords> & { pointerType: string }) | null>(null);

  // ── Reset when navigating to a new page ──────────────────────────────────
  useEffect(() => {
    setFlipState('idle');
    setFlipDir(null);
    flipDirRef.current = null;
  }, [currentPage.id]);

  // ── Initial snapshot after Konva first renders on page change ─────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCurrentSnapshot(currentStageRef.current?.toDataURL() ?? null);
    });
    return () => cancelAnimationFrame(raf);
  }, [currentPage.id]);

  useEffect(() => {
    if (!prevPage) return;
    const raf = requestAnimationFrame(() => {
      setPrevSnapshot(prevStageRef.current?.toDataURL() ?? null);
    });
    return () => cancelAnimationFrame(raf);
  }, [prevPage?.id]);

  const nextPageId = nextPage === 'add-page' ? null : nextPage.id;
  useEffect(() => {
    if (nextPage === 'add-page') return;
    const raf = requestAnimationFrame(() => {
      setNextSnapshot(nextStageRef.current?.toDataURL() ?? null);
    });
    return () => cancelAnimationFrame(raf);
  }, [nextPageId]);

  // ── Debounced snapshot refresh on content changes ─────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentSnapshot(currentStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [currentPage]);

  useEffect(() => {
    if (!prevPage) return;
    const t = setTimeout(() => {
      setPrevSnapshot(prevStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [prevPage]);

  useEffect(() => {
    if (nextPage === 'add-page') return;
    const t = setTimeout(() => {
      setNextSnapshot(nextStageRef.current?.toDataURL() ?? null);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nextPage]);

  // ── Dispatch synthetic mousedown after HTMLFlipBook mounts ────────────────
  // flipState changes to 'flipping' → React renders HTMLFlipBook → double rAF
  // gives StPageFlip time to register its internal event listeners.
  useEffect(() => {
    if (flipState !== 'flipping' || !pendingCoordsRef.current) return;
    const coords = pendingCoordsRef.current;
    pendingCoordsRef.current = null;

    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = flipContainerRef.current;
        if (!el) return;
        el.dispatchEvent(buildFlipEvent('down', coords.pointerType, coords, el));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [flipState]);

  // ── Forward subsequent pointer events to StPageFlip ───────────────────────
  const dispatchFlipEvent = useCallback((phase: FlipPhase, e: React.PointerEvent) => {
    const el = flipContainerRef.current;
    if (!el) return;
    el.dispatchEvent(buildFlipEvent(phase, e.pointerType, extractPointerCoords(e.nativeEvent), el));
  }, []);

  // ── Edge zone handlers ────────────────────────────────────────────────────
  const handleEdgePointerDown = (e: React.PointerEvent<HTMLDivElement>, dir: 'next' | 'prev') => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pendingCoordsRef.current = { ...extractPointerCoords(e.nativeEvent), pointerType: e.pointerType };
    flipDirRef.current = dir;
    setFlipDir(dir);
    setFlipState('flipping');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flipState !== 'flipping') return;
    dispatchFlipEvent('move', e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flipState !== 'flipping') return;
    dispatchFlipEvent('up', e);
  };

  // ── Shared props passed to every Scrapbook instance ───────────────────────
  const sharedScrapbookProps = {
    onUpdateScrap,
    onUpdateEntry,
    onReturnScrap,
    onAddTapeStrip,
    isTapeActive: isTapeActive && flipState === 'idle',
    isGlueActive: isGlueActive && flipState === 'idle',
    fallingScrapIds,
    onFallComplete,
    dimensions,
    selectedScrapId,
    onSelectScrap,
  };

  const adjacentSnapshot = flipDir === 'prev' ? prevSnapshot : nextSnapshot;
  const { width: w, height: h } = dimensions;

  return (
    <div className="relative w-full h-full">

      {/* z-index 1: Prev page — invisible, kept alive solely for prevSnapshot */}
      {prevPage && (
        <div className="absolute inset-0" style={{ zIndex: 1, opacity: 0, pointerEvents: 'none' }}>
          <Scrapbook ref={prevStageRef} page={prevPage} {...sharedScrapbookProps} />
        </div>
      )}

      {/* z-index 2: Next page — invisible, kept alive solely for nextSnapshot */}
      {nextPage !== 'add-page' && (
        <div className="absolute inset-0" style={{ zIndex: 2, opacity: 0, pointerEvents: 'none' }}>
          <Scrapbook ref={nextStageRef} page={nextPage} {...sharedScrapbookProps} />
        </div>
      )}

      {/* z-index 3: Current page — live Konva canvas, hidden during flip */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 3,
          opacity: flipState === 'flipping' ? 0 : 1,
          pointerEvents: flipState === 'flipping' ? 'none' : 'auto',
        }}
      >
        <Scrapbook ref={currentStageRef} page={currentPage} {...sharedScrapbookProps} />
      </div>

      {/* z-index 4: Static adjacent page revealed under the curl */}
      {flipState === 'flipping' && (
        <div className="absolute inset-0" style={{ zIndex: 4, pointerEvents: 'none' }}>
          {adjacentSnapshot ? (
            <img
              src={adjacentSnapshot}
              style={{ display: 'block', width: w, height: h }}
              alt=""
            />
          ) : nextPage === 'add-page' ? (
            <AddPageView onAdd={onAddPage} />
          ) : (
            <div style={{ background: '#fdfaf3', width: '100%', height: '100%' }} />
          )}
        </div>
      )}

      {/* z-index 5: react-pageflip cylindrical curl — visible only when flipping */}
      <div
        ref={flipContainerRef}
        className="absolute inset-0"
        style={{
          zIndex: 5,
          opacity: flipState === 'flipping' ? 1 : 0,
          visibility: flipState === 'flipping' ? 'visible' : 'hidden',
          pointerEvents: 'none',
        }}
      >
        {flipState === 'flipping' && currentSnapshot && (
          <HTMLFlipBook
            key={flipDir ?? 'idle'}
            width={w}
            height={h}
            size="fixed"
            usePortrait={true}
            useMouseEvents={true}
            drawShadow={true}
            maxShadowOpacity={0.5}
            showCover={false}
            flippingTime={700}
            startPage={flipDir === 'prev' ? 1 : 0}
            style={{ pointerEvents: 'none' } as React.CSSProperties}
            onFlip={() => {
              // StPageFlip fires onFlip before onChangeState('read') on a completed flip.
              // We rely on this ordering: clear flipDirRef here first, so that onChangeState
              // can use flipDirRef.current !== null as the snap-back signal. If StPageFlip
              // ever changes this ordering, snap-back detection will break.
              const dir = flipDirRef.current;
              flipDirRef.current = null;
              setFlipState('idle');
              setFlipDir(null);
              if (dir) onFlipComplete(dir);
            }}
            onChangeState={(e: { data: 'user_fold' | 'fold_corner' | 'flipping' | 'read' }) => {
              // 'read' fires on both completion and snap-back.
              // If flipDirRef is still set, onFlip didn't fire → snap-back.
              if (e.data === 'read' && flipDirRef.current !== null) {
                flipDirRef.current = null;
                setFlipState('idle');
                setFlipDir(null);
              }
            }}
          >
            {/* Forward flip: currentPage curls away; back face = kraft */}
            {flipDir === 'next' ? (
              <>
                <div>
                  <img src={currentSnapshot} style={{ display: 'block', width: w, height: h }} alt="" />
                </div>
                <div style={{ background: '#f0e8d8', width: w, height: h }} />
              </>
            ) : (
              /* Backward flip: currentPage curls away from left; back face = kraft */
              <>
                <div style={{ background: '#f0e8d8', width: w, height: h }} />
                <div>
                  <img src={currentSnapshot} style={{ display: 'block', width: w, height: h }} alt="" />
                </div>
              </>
            )}
          </HTMLFlipBook>
        )}
      </div>

      {/* z-index 6: Right edge — drag left to flip next */}
      <div
        className="absolute top-0 right-0 h-full"
        style={{ width: EDGE_ZONE_WIDTH, zIndex: 6, cursor: 'ew-resize' }}
        onPointerDown={(e) => handleEdgePointerDown(e, 'next')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* z-index 6: Left edge — drag right to flip prev (disabled on first page) */}
      {prevPage && (
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: EDGE_ZONE_WIDTH, zIndex: 6, cursor: 'ew-resize' }}
          onPointerDown={(e) => handleEdgePointerDown(e, 'prev')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
    </div>
  );
};
