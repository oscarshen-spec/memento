import React, { useState, useRef } from 'react';
import type { PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { partitionScraps, tapeTouchesScrap } from './utils/scrapUtils';
import confetti from 'canvas-confetti';
import { Scrap, Point, RawMaterial, ScrapbookPage, JournalEntry, TapeStrip } from './types';
import { CameraView } from './components/CameraView';
import { CuttingRoom } from './components/CuttingRoom';
import { PageFlipContainer } from './components/PageFlipContainer';
import { MaterialDrawer } from './components/MaterialDrawer';
import { JournalModal } from './components/JournalModal';
import { TextOverlay } from './components/TextOverlay';

const INITIAL_PAGE: ScrapbookPage = {
  id: 'page-1',
  scraps: [],
  journalEntries: [],
  tapeStrips: [],
  background: '#fdfaf3',
};

export default function App() {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([
    { id: 'sample-1', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=80' },
    { id: 'sample-2', image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=400&q=80' },
    { id: 'sample-3', image: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&q=80' },
    { id: 'sample-4', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  ]);
  const [pages, setPages] = useState<ScrapbookPage[]>([INITIAL_PAGE]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [view, setView] = useState<'scrapbook' | 'camera' | 'cutting' | 'drawer' | 'journal'>('scrapbook');
  const [currentMaterial, setCurrentMaterial] = useState<RawMaterial | null>(null);
  const [activeTool, setActiveTool] = useState<'tape' | 'text' | 'glue' | null>(null);
  const [fallingOff, setFallingOff] = useState<{ direction: 'prev' | 'next'; scrapIds: string[] } | null>(null);
  const [drawerBounce, setDrawerBounce] = useState(false);
  const [selectedScrapId, setSelectedScrapId] = useState<string | null>(null);

  const currentPage = pages[currentPageIndex];

  // Calculate scrapbook dimensions based on screen size (desk is 80vh)
  const getScrapbookDimensions = () => {
    const deskHeight = window.innerHeight * 0.8;
    const padding = 0;
    const verticalPadding = window.innerWidth < 768 ? 60 : 100;
    const topBarHeight = 64;
    
    return {
      width: window.innerWidth - padding,
      height: deskHeight - verticalPadding - topBarHeight,
    };
  };

  const [bookDims, setBookDims] = useState(getScrapbookDimensions());
  const bookPageRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleResize = () => setBookDims(getScrapbookDimensions());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCapture = (image: string) => {
    const newMaterial: RawMaterial = {
      id: Math.random().toString(36).substr(2, 9),
      image,
    };
    setRawMaterials(prev => [newMaterial, ...prev]);
    setSelectedScrapId(null);
    setView('drawer');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleCapture(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCut = (points: Point[], isTorn?: boolean) => {
    if (!currentMaterial) return;

    const newScrap: Scrap = {
      id: Math.random().toString(36).substr(2, 9),
      image: currentMaterial.image,
      points,
      x: (bookDims.width - 68) / 2 - 100,
      y: bookDims.height / 2 - 100,
      rotation: (Math.random() - 0.5) * 20,
      scale: 0.5,
      zIndex: currentPage.scraps.length,
      isGlued: false,
      isTorn: isTorn ?? false,
    };

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps.push(newScrap);
    setPages(updatedPages);
    
    setRawMaterials(prev => prev.filter(m => m.id !== currentMaterial.id));
    setCurrentMaterial(null);
    setView('scrapbook');
    
    confetti({
      particleCount: 40,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#fdfaf3', '#e5e7eb', '#000000']
    });
  };

  const handleDragMaterial = (material: RawMaterial, info: PanInfo) => {
    const rect = bookPageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropX = info.point.x - rect.left;
    const dropY = info.point.y - rect.top;
    if (dropX < 0 || dropY < 0 || dropX > rect.width || dropY > rect.height) return;

    const newScrap: Scrap = {
      id: Math.random().toString(36).substr(2, 9),
      image: material.image,
      points: [],
      x: dropX,
      y: dropY,
      rotation: (Math.random() - 0.5) * 10,
      scale: 0.5,
      zIndex: currentPage.scraps.length,
      isGlued: false,
    };

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps.push(newScrap);
    setPages(updatedPages);
    setRawMaterials(prev => prev.filter(m => m.id !== material.id));
  };

  const handleAddJournal = (text: string, type: 'title' | 'body' | 'date') => {
    const newEntry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      x: (bookDims.width - 68) / 2 - 100,
      y: bookDims.height / 2 - 100,
      rotation: (Math.random() - 0.5) * 5,
      fontSize: type === 'title' ? 48 : type === 'date' ? 14 : 24,
    };

    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries.push(newEntry);
    setPages(updatedPages);
  };

  const handleReturnScrap = (scrap: Scrap) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.filter(s => s.id !== scrap.id);
    setPages(updatedPages);
    setRawMaterials(prev => [{ id: Math.random().toString(36).substr(2, 9), image: scrap.image }, ...prev]);
    setSelectedScrapId(null);
    setView('drawer');
  };

  const handleAddTapeStrip = (strip: TapeStrip) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].tapeStrips.push(strip);
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.map(s =>
      !s.isGlued && tapeTouchesScrap(strip, s) ? { ...s, isGlued: true } : s
    );
    setPages(updatedPages);
  };

  const handleAddText = (text: string, fontFamily: string, color: string, fontSize: number) => {
    const newEntry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type: 'body',
      x: (bookDims.width - 68) / 2 - 100,
      y: bookDims.height / 2 - 50,
      rotation: (Math.random() - 0.5) * 5,
      fontSize,
      fontFamily,
      color,
    };
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries.push(newEntry);
    setPages(updatedPages);
    setActiveTool(null);
  };

  const updateScrap = (id: string, attrs: Partial<Scrap>) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps = updatedPages[currentPageIndex].scraps.map(s => 
      s.id === id ? { ...s, ...attrs } : s
    );
    setPages(updatedPages);
  };

  const updateEntry = (id: string, attrs: Partial<JournalEntry>) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].journalEntries = updatedPages[currentPageIndex].journalEntries.map(e =>
      e.id === id ? { ...e, ...attrs } : e
    );
    setPages(updatedPages);
  };

  const handlePageTurn = (direction: 'prev' | 'next') => {
    setSelectedScrapId(null);

    // Auto-add a blank page when flipping forward from the last page
    if (direction === 'next' && currentPageIndex === pages.length - 1) {
      const newPage: ScrapbookPage = {
        id: `page-${pages.length + 1}`,
        scraps: [],
        journalEntries: [],
        tapeStrips: [],
        background: '#fdfaf3',
      };
      setPages(prev => [...prev, newPage]);
    }

    const { falling } = partitionScraps(currentPage.scraps);
    if (falling.length === 0) {
      setCurrentPageIndex(prev => direction === 'next' ? prev + 1 : prev - 1);
      return;
    }
    setFallingOff({ direction, scrapIds: falling.map(s => s.id) });
  };

  const handleFallComplete = (fallenIds: string[]) => {
    if (!fallingOff) return;
    const dir = fallingOff.direction;
    const fallen = currentPage.scraps.filter(s => fallenIds.includes(s.id));
    setPages(prev => prev.map((p, i) =>
      i === currentPageIndex
        ? { ...p, scraps: p.scraps.filter(s => !fallenIds.includes(s.id)) }
        : p
    ));
    setRawMaterials(prev => [
      ...fallen.map(s => ({ id: Math.random().toString(36).substr(2, 9), image: s.image })),
      ...prev,
    ]);
    setFallingOff(null);
    setCurrentPageIndex(prev => dir === 'next' ? prev + 1 : prev - 1);
    setDrawerBounce(true);
    setTimeout(() => setDrawerBounce(false), 300);
  };

  const handleSelectScrap = (id: string | null) => {
    if (id !== null) setActiveTool(null);
    setSelectedScrapId(id);
  };

  const addPage = () => {
    const newPage: ScrapbookPage = {
      id: `page-${pages.length + 1}`,
      scraps: [],
      journalEntries: [],
      tapeStrips: [],
      background: '#fdfaf3',
    };
    setPages([...pages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden select-none flex flex-col bg-[#0f0805]">
      {/* Desk Area (Top 80%) */}
      <div className="relative w-full h-[80vh] flex flex-col items-center z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] wood-texture">
        {/* Scattered selection icons — scissor & tear, shown when a scrap is selected */}
        <AnimatePresence>
          {selectedScrapId !== null && (
            <>
              <motion.button
                key="scissor-tool"
                onClick={() => {}}
                style={{ position: 'absolute', top: -60, left: -20, rotate: '102deg', zIndex: 20 }}
                className="p-1"
                title="Cut"
                initial={{ y: -140, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.08 } }}
                exit={{ y: -140, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
              >
                <img
                  src="/Scissors.png"
                  width="240"
                  height="240"
                  alt="Scissor"
                  className="transition-all duration-150 opacity-100 hover:scale-105"
                  style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
              <motion.button
                key="tear-tool"
                onClick={() => {}}
                style={{ position: 'absolute', top: -36, right: 120, rotate: '15deg', zIndex: 20 }}
                className="p-1"
                title="Tear"
                initial={{ y: -140, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0 } }}
                exit={{ y: -140, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.08 } }}
              >
                <img
                  src="/Tear.png"
                  width="175"
                  height="175"
                  alt="Tear"
                  className="transition-all duration-150 opacity-100 hover:scale-105"
                  style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Scattered tool icons — lying on the desk above the scrapbook */}
        <AnimatePresence>
          {selectedScrapId === null && (
            <>
              <motion.button
                key="tape-tool"
                onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
                style={{ position: 'absolute', top: -40, left: -40, rotate: '-14deg', zIndex: 20 }}
                className="p-1"
                title="Tape tool"
                initial={{ y: -120, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.08 } }}
                exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
              >
                <img
                  src="/Tape.png"
                  width="200"
                  height="200"
                  alt="Tape"
                  className={`transition-all duration-150 ${activeTool === 'tape' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                  style={{ filter: activeTool === 'tape' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
              <motion.button
                key="text-tool"
                onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
                style={{ position: 'absolute', top: -32, left: '52%', translateX: '-50%', rotate: '-6deg', zIndex: 20 }}
                className="p-1"
                title="Text tool"
                initial={{ y: -120, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0.04 } }}
                exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.04 } }}
              >
                <img
                  src="/Text.png"
                  width="180"
                  height="180"
                  alt="Text"
                  className={`transition-all duration-150 ${activeTool === 'text' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                  style={{ filter: activeTool === 'text' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
              <motion.button
                key="glue-tool"
                onClick={() => setActiveTool(activeTool === 'glue' ? null : 'glue')}
                style={{ position: 'absolute', top: -32, right: -24, rotate: '12deg', zIndex: 20 }}
                className="p-1"
                title="Glue tool"
                initial={{ y: -120, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26, delay: 0 } }}
                exit={{ y: -120, opacity: 0, transition: { duration: 0.3, ease: 'easeIn', delay: 0.08 } }}
              >
                <img
                  src="/Glue.png"
                  width="200"
                  height="200"
                  alt="Glue"
                  className={`transition-all duration-150 ${activeTool === 'glue' ? 'opacity-100 scale-110' : 'opacity-100 hover:scale-105'}`}
                  style={{ filter: activeTool === 'glue' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
                />
              </motion.button>
            </>
          )}
        </AnimatePresence>
        {/* Top Bar - Subtle icons on the desk */}
        <div className="w-full h-16 flex justify-between items-center px-6 md:px-12 shrink-0 z-10">
          <div />

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <h1 className="text-lg leading-none" style={{ fontFamily: 'Caveat, cursive', color: 'rgba(232,213,184,0.7)', fontWeight: 700 }}>My Scrapbook</h1>
              <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(212,170,80,0.4)', letterSpacing: '0.2em' }}>
                Page {currentPageIndex + 1} of {pages.length}
              </p>
            </div>
            <div className="flex gap-0.5">
              <button
                disabled={currentPageIndex === 0}
                onClick={() => { setActiveTool(null); handlePageTurn('prev'); }}
                className="p-2 rounded-lg disabled:opacity-15 transition-colors"
                style={{ color: 'rgba(212,170,80,0.6)' }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => { setActiveTool(null); handlePageTurn('next'); }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'rgba(212,170,80,0.6)' }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrapbook on Desk */}
        <div className="relative flex-1 flex items-center justify-start w-full">
          {/* Cover + book wrapper — cover bleeds 28px beyond book on all sides.
              Shifted left by 96px (28 cover bleed + 36 spine + 14 page-stack + 18 gutter)
              so the Konva canvas left edge aligns to x=0 of the screen. */}
          <div className="relative" style={{ width: bookDims.width + 56, height: bookDims.height + 56, marginLeft: -96 }}>
            {/* Leather cover — sits behind everything */}
            <img
              src="/scrapbook_cover.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none"
              style={{ filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.65))' }}
            />
            {/* Book positioned inset 28px from cover edges */}
            <div
              className="absolute book-container"
              style={{ top: 28, left: 28, width: bookDims.width, height: bookDims.height }}
            >
              <div className="spine" />
              <div className="page-stack" />
              <div className="gutter" />
              <div
                ref={bookPageRef}
                className="book-page"
              >
                <PageFlipContainer
                  currentPage={currentPage}
                  currentPageIndex={currentPageIndex}
                  prevPage={currentPageIndex > 0 ? pages[currentPageIndex - 1] : null}
                  nextPage={currentPageIndex < pages.length - 1 ? pages[currentPageIndex + 1] : 'add-page'}
                  onFlipComplete={(dir) => handlePageTurn(dir)}
                  onAddPage={addPage}
                  dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
                  onUpdateScrap={updateScrap}
                  onUpdateEntry={updateEntry}
                  onReturnScrap={handleReturnScrap}
                  onAddTapeStrip={handleAddTapeStrip}
                  isTapeActive={activeTool === 'tape'}
                  isGlueActive={activeTool === 'glue'}
                  fallingScrapIds={fallingOff?.scrapIds ?? null}
                  onFallComplete={handleFallComplete}
                  selectedScrapId={selectedScrapId}
                  onSelectScrap={handleSelectScrap}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desk Edge Lip */}
      <div className="desk-edge" />

      {/* Drawer Area (Bottom 20%) */}
      <motion.div
        className="relative w-full h-[20vh] overflow-hidden z-20"
        style={{ backgroundImage: 'url(/Background.png)', backgroundSize: 'cover', backgroundPosition: 'bottom center' }}
        animate={drawerBounce ? { y: [0, -6, 0] } : {}}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <MaterialDrawer
          materials={rawMaterials}
          isOpen={view === 'drawer'}
          onToggle={(open) => { setActiveTool(null); if (open) { setSelectedScrapId(null); setView('drawer'); } else { setView('scrapbook'); } }}
          onSelect={(m) => {
            setActiveTool(null);
            setCurrentMaterial(m);
            setSelectedScrapId(null);
            setView('cutting');
          }}
          onDragMaterial={handleDragMaterial}
          onClose={() => setView('scrapbook')}
          onUpload={handleFileUpload}
        />
      </motion.div>

      {/* Modals */}
      <AnimatePresence mode="wait">
        {view === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-50"
          >
            <CameraView
              onCapture={handleCapture}
              onClose={() => { setActiveTool(null); setView('scrapbook'); }}
            />
          </motion.div>
        )}

        {view === 'cutting' && currentMaterial && (
          <motion.div
            key="cutting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50"
          >
            <CuttingRoom
              image={currentMaterial.image}
              onCut={handleCut}
              onCancel={() => { setActiveTool(null); setSelectedScrapId(null); setView('drawer'); }}
            />
          </motion.div>
        )}

        {view === 'journal' && (
          <JournalModal
            key="journal"
            onAdd={handleAddJournal}
            onClose={() => { setActiveTool(null); setView('scrapbook'); }}
          />
        )}

        {activeTool === 'text' && (
          <TextOverlay
            key="text-overlay"
            onAdd={handleAddText}
            onClose={() => setActiveTool(null)}
          />
        )}
      </AnimatePresence>

      {/* SVG Filter for torn edges */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="torn-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
        </filter>
      </svg>
    </div>
  );
}
