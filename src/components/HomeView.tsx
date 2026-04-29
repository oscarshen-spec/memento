import React, { useState } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { Plus } from 'lucide-react';
import type { ScrapbookMeta } from '../types';

interface HomeViewProps {
  scrapbooks: ScrapbookMeta[];
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

const NB_W = 240;
const NB_H = 318;
const GAP = 28;
const STRIDE = NB_W + GAP;

export function HomeView({ scrapbooks, onSelect, onCreateNew }: HomeViewProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [entering, setEntering] = useState<string | null>(null);

  const totalCount = scrapbooks.length + 1; // last slot = "New" card
  const screenW = window.innerWidth;
  const baseX = screenW / 2 - NB_W / 2 - activeIdx * STRIDE;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = STRIDE / 3;
    if (info.offset.x < -threshold && activeIdx < totalCount - 1) {
      setActiveIdx(i => i + 1);
    } else if (info.offset.x > threshold && activeIdx > 0) {
      setActiveIdx(i => i - 1);
    }
  };

  const handleTapBook = (id: string, idx: number) => {
    if (activeIdx !== idx) {
      setActiveIdx(idx);
      return;
    }
    setEntering(id);
    setTimeout(() => {
      onSelect(id);
      setEntering(null);
    }, 480);
  };

  const handleTapNew = () => {
    if (activeIdx !== scrapbooks.length) {
      setActiveIdx(scrapbooks.length);
      return;
    }
    onCreateNew();
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none flex flex-col bg-[#0f0805]">
      {/* Desk surface (top ~72%) */}
      <div className="relative flex-1 flex flex-col wood-texture" style={{ minHeight: 0 }}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.18)' }} />

        {/* Title */}
        <div className="relative flex flex-col items-center pt-14 z-10 gap-1 shrink-0">
          <h1
            className="font-hand font-bold"
            style={{ fontSize: 30, color: 'rgba(232,213,184,0.88)', letterSpacing: '0.01em' }}
          >
            My Scrapbooks
          </h1>
          <p style={{ fontSize: 11, color: 'rgba(212,170,80,0.5)', letterSpacing: '0.18em' }} className="uppercase">
            Tap to open
          </p>
        </div>

        {/* Notebook carousel */}
        <div className="relative flex-1 flex items-center overflow-hidden" style={{ minHeight: 0 }}>
          <motion.div
            className="absolute top-0 bottom-0 flex items-center"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.07}
            onDragEnd={handleDragEnd}
            animate={{ x: baseX }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            style={{ cursor: 'grab' }}
          >
            <div className="flex items-center" style={{ gap: GAP }}>
              {scrapbooks.map((book, i) => {
                const isActive = activeIdx === i;
                const isEntering = entering === book.id;
                return (
                  <motion.button
                    key={book.id}
                    onClick={() => handleTapBook(book.id, i)}
                    animate={{
                      scale: isEntering ? 1.08 : isActive ? 1 : 0.86,
                      y: isActive ? -10 : 4,
                      opacity: isEntering ? 0 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    style={{ width: NB_W, height: NB_H, position: 'relative', flexShrink: 0 }}
                    className="focus:outline-none"
                    draggable={false}
                  >
                    <img
                      src="/scrapbook_cover.png"
                      alt={book.name}
                      className="w-full h-full object-cover rounded-sm"
                      style={{
                        boxShadow: isActive
                          ? '5px 5px 6px rgba(0,0,0,0.3), 0 12px 32px rgba(0,0,0,0.45)'
                          : '3px 3px 6px rgba(0,0,0,0.25)',
                      }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p
                        style={{
                          fontFamily: "'Slackey', sans-serif",
                          fontSize: 22,
                          color: 'white',
                          textShadow: '0 1px 6px rgba(0,0,0,0.55)',
                          textAlign: 'center',
                          lineHeight: 1.35,
                          padding: '0 24px',
                        }}
                      >
                        {book.name}
                      </p>
                    </div>
                  </motion.button>
                );
              })}

              {/* New scrapbook card */}
              <motion.button
                key="new"
                onClick={handleTapNew}
                animate={{
                  scale: activeIdx === scrapbooks.length ? 1 : 0.86,
                  y: activeIdx === scrapbooks.length ? -10 : 4,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                style={{ width: NB_W, height: NB_H, flexShrink: 0 }}
                className="focus:outline-none"
                draggable={false}
              >
                <div
                  className="w-full h-full rounded-sm flex flex-col items-center justify-center gap-3"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '2px dashed rgba(232,213,184,0.3)',
                    boxShadow: '3px 3px 10px rgba(0,0,0,0.28)',
                  }}
                >
                  <Plus size={34} color="rgba(232,213,184,0.65)" strokeWidth={1.5} />
                  <p
                    className="font-hand font-bold"
                    style={{ color: 'rgba(232,213,184,0.65)', fontSize: 18 }}
                  >
                    New Scrapbook
                  </p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Dot indicators — sit inside the desk, above the edge */}
        <div className="relative flex justify-center gap-2 pb-4 z-10 shrink-0">
          {Array.from({ length: totalCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width: activeIdx === i ? 20 : 6,
                height: 6,
                background: activeIdx === i ? 'rgba(212,170,80,0.8)' : 'rgba(232,213,184,0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Desk edge — identical to the editor */}
      <div className="desk-edge" />

      {/* Lap / background photo — identical to the editor drawer area */}
      <div
        className="shrink-0"
        style={{
          height: '20vh',
          backgroundImage: 'url(/Background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'bottom center',
        }}
      />
    </div>
  );
}
