import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { partitionScraps } from './utils/scrapUtils';
import confetti from 'canvas-confetti';
import { Scrap, Point, RawMaterial, ScrapbookPage, JournalEntry, TapeStrip } from './types';
import { CameraView } from './components/CameraView';
import { CuttingRoom } from './components/CuttingRoom';
import { Scrapbook } from './components/Scrapbook';
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

  const currentPage = pages[currentPageIndex];

  // Calculate scrapbook dimensions based on screen size (desk is 80vh)
  const getScrapbookDimensions = () => {
    const deskHeight = window.innerHeight * 0.8;
    const padding = window.innerWidth < 768 ? 40 : 100;
    const verticalPadding = window.innerWidth < 768 ? 60 : 100;
    const topBarHeight = 64;
    
    return {
      width: window.innerWidth - padding,
      height: deskHeight - verticalPadding - topBarHeight,
    };
  };

  const [bookDims, setBookDims] = useState(getScrapbookDimensions());

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

  const handleMaterialDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const materialId = e.dataTransfer.getData('materialId');
    const material = rawMaterials.find(m => m.id === materialId);
    if (!material) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

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
    setRawMaterials(prev => prev.filter(m => m.id !== materialId));
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
    setView('drawer');
  };

  const handleAddTapeStrip = (strip: TapeStrip) => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].tapeStrips.push(strip);
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
    const updatedPages = [...pages];
    updatedPages[currentPageIndex].scraps = currentPage.scraps.filter(s => !fallenIds.includes(s.id));
    setPages(updatedPages);
    setRawMaterials(prev => [
      ...fallen.map(s => ({ id: Math.random().toString(36).substr(2, 9), image: s.image })),
      ...prev,
    ]);
    setFallingOff(null);
    setCurrentPageIndex(prev => dir === 'next' ? prev + 1 : prev - 1);
    setDrawerBounce(true);
    setTimeout(() => setDrawerBounce(false), 300);
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
        {/* Top Bar - Subtle icons on the desk */}
        <div className="w-full h-16 flex justify-between items-center px-6 md:px-12 shrink-0 z-10">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTool(activeTool === 'tape' ? null : 'tape')}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                activeTool === 'tape'
                  ? 'bg-white/15 text-white/90'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
              title="Tape tool"
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                {/* Tape roll outer ring */}
                <circle cx="13" cy="13" r="11" stroke="currentColor" strokeWidth="2.2" fill="currentColor" fillOpacity="0.1"/>
                {/* Inner hole */}
                <circle cx="13" cy="13" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="rgba(30,20,10,0.7)"/>
                {/* Grain lines */}
                <path d="M3.5,10.5 Q13,8.5 22.5,10.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
                <path d="M3,13 Q13,11 23,13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
                <path d="M3.5,15.5 Q13,13.5 22.5,15.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" fill="none"/>
                {/* Pull tab */}
                <path d="M21,9.5 L24.5,7 L26,9.5 L22.5,12 Z" fill="currentColor" fillOpacity="0.8"/>
              </svg>
              {/* Active indicator dot */}
              {activeTool === 'tape' && (
                <div className="w-1 h-1 rounded-full bg-white/80" />
              )}
            </button>
            {/* Text tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                activeTool === 'text'
                  ? 'bg-white/15 text-white/90'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
              title="Text tool"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 4 4 20 4 20 7"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
              {activeTool === 'text' && (
                <div className="w-1 h-1 rounded-full bg-white/80" />
              )}
            </button>
            {/* Glue tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'glue' ? null : 'glue')}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                activeTool === 'glue'
                  ? 'bg-white/15 text-white/90'
                  : 'text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
              title="Glue tool"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="10" width="8" height="11" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor"/>
                <path d="M10 10 L10 7 L14 7 L14 10" fill="none"/>
                <line x1="12" y1="7" x2="12" y2="4"/>
                <path d="M11.2 4.5 Q13.2 6 12 7.5" strokeWidth="1.4"/>
              </svg>
              {activeTool === 'glue' && (
                <div className="w-1 h-1 rounded-full bg-white/80" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <h1 className="text-lg font-serif italic text-white/80 leading-none">My Scrapbook</h1>
              <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mt-1">
                Page {currentPageIndex + 1} / {pages.length}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                disabled={currentPageIndex === 0}
                onClick={() => { setActiveTool(null); handlePageTurn('prev'); }}
                className="p-2 text-white/60 hover:bg-white/10 rounded-lg disabled:opacity-20"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                disabled={currentPageIndex === pages.length - 1}
                onClick={() => { setActiveTool(null); handlePageTurn('next'); }}
                className="p-2 text-white/60 hover:bg-white/10 rounded-lg disabled:opacity-20"
              >
                <ChevronRight size={18} />
              </button>
              <button onClick={() => { setActiveTool(null); addPage(); }} className="p-2 text-white/60 hover:bg-white/10 rounded-lg">
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrapbook on Desk */}
        <div className="relative flex-1 flex items-center justify-center w-full px-6 md:px-0">
          <div
            className="book-container"
            style={{ width: bookDims.width, height: bookDims.height }}
          >
            <div className="spine" />
            <div className="page-stack" />
            <div className="gutter" />
            <div
              className="book-page"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleMaterialDrop}
            >
              <Scrapbook
                page={currentPage}
                onUpdateScrap={updateScrap}
                onUpdateEntry={updateEntry}
                onReturnScrap={handleReturnScrap}
                onAddTapeStrip={handleAddTapeStrip}
                isTapeActive={activeTool === 'tape'}
                isGlueActive={activeTool === 'glue'}
                fallingScrapIds={fallingOff?.scrapIds ?? null}
                onFallComplete={handleFallComplete}
                dimensions={{ width: bookDims.width - 68, height: bookDims.height }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Desk Edge Lip */}
      <div className="desk-edge" />

      {/* Drawer Area (Bottom 20%) */}
      <motion.div
        className="relative w-full h-[20vh] overflow-hidden z-20"
        animate={drawerBounce ? { y: [0, -6, 0] } : {}}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <MaterialDrawer
          materials={rawMaterials}
          isOpen={view === 'drawer'}
          onToggle={(open) => { setActiveTool(null); setView(open ? 'drawer' : 'scrapbook'); }}
          onSelect={(m) => {
            setActiveTool(null);
            setCurrentMaterial(m);
            setView('cutting');
          }}
          onDragMaterial={() => {
            if (view !== 'scrapbook') setView('scrapbook');
          }}
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
              onCancel={() => { setActiveTool(null); setView('drawer'); }}
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
