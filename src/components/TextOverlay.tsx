import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';

export interface TextOverlayProps {
  onAdd: (text: string, fontFamily: string, color: string, fontSize: number) => void;
  onClose: () => void;
}

const FONTS = [
  { label: 'Serif', family: 'Cormorant Garamond', fontStyle: 'italic' as const, fontWeight: 700 },
  { label: 'Sans',  family: 'Nunito',               fontStyle: 'normal' as const, fontWeight: 600 },
  { label: 'Mono',  family: 'Courier New',          fontStyle: 'normal' as const, fontWeight: 400 },
  { label: 'Hand',  family: 'Caveat',               fontStyle: 'normal' as const, fontWeight: 400 },
] as const;

const SWATCHES = [
  '#ffffff', '#ff3b30', '#ff9500', '#ffcc00',
  '#34c759', '#007aff', '#5856d6', '#000000',
];

const SWATCH_SNAP_MAP: Record<string, number> = {
  '#ffffff': 0, '#ff3b30': 0.1, '#ff9500': 0.25,
  '#ffcc00': 0.35, '#34c759': 0.5, '#007aff': 0.65,
  '#5856d6': 0.75, '#000000': 1.0,
};

const COLOR_STOPS: [number, [number, number, number]][] = [
  [0.00, [255, 255, 255]],
  [0.10, [255,   0,   0]],
  [0.25, [255, 140,   0]],
  [0.35, [255, 255,   0]],
  [0.50, [  0, 200,   0]],
  [0.625,[  0, 200, 255]],
  [0.75, [  0,   0, 255]],
  [0.875,[139,   0, 255]],
  [0.95, [255,   0, 255]],
  [1.00, [  0,   0,   0]],
];

function lerpColor(t: number): string {
  let i = 0;
  while (i < COLOR_STOPS.length - 2 && COLOR_STOPS[i + 1][0] <= t) i++;
  const [t0, c0] = COLOR_STOPS[i];
  const [t1, c1] = COLOR_STOPS[i + 1];
  const a = (t - t0) / (t1 - t0);
  const r = Math.round(c0[0] + a * (c1[0] - c0[0]));
  const g = Math.round(c0[1] + a * (c1[1] - c0[1]));
  const b = Math.round(c0[2] + a * (c1[2] - c0[2]));
  return `rgb(${r},${g},${b})`;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({ onAdd, onClose }) => {
  const [text, setText]               = useState('');
  const [fontIndex, setFontIndex]     = useState(0);
  const [color, setColor]             = useState('#000000');
  const [thumbPos, setThumbPos]       = useState(1.0);
  const [activePanel, setActivePanel] = useState<'font' | 'color'>('font');
  const [vpTop, setVpTop]             = useState(0);
  const [vpHeight, setVpHeight]       = useState(() => window.visualViewport?.height ?? window.innerHeight);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const update = () => {
      setVpTop(vp.offsetTop);
      setVpHeight(vp.height);
    };
    vp.addEventListener('resize', update);
    vp.addEventListener('scroll', update);
    return () => {
      vp.removeEventListener('resize', update);
      vp.removeEventListener('scroll', update);
    };
  }, []);

  const selectedFont = FONTS[fontIndex];
  const canSubmit = text.trim().length > 0;

  const resolveColorFromStrip = useCallback((clientX: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setThumbPos(t);
    setColor(lerpColor(t));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    resolveColorFromStrip(e.clientX);
  }, [resolveColorFromStrip]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    resolveColorFromStrip(e.clientX);
  }, [resolveColorFromStrip]);

  const handleDone = useCallback(() => {
    if (canSubmit) {
      onAdd(text.trim(), selectedFont.family, color, 28);
    } else {
      onClose();
    }
  }, [canSubmit, text, selectedFont.family, color, onAdd, onClose]);

  const previewStyle: React.CSSProperties = {
    fontFamily: selectedFont.family,
    fontStyle:  selectedFont.fontStyle,
    fontWeight: selectedFont.fontWeight,
    fontSize:   '28px',
    color,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed z-50 flex flex-col"
      style={{ top: vpTop, left: 0, right: 0, height: vpHeight, background: 'rgba(15,8,5,0.92)', backdropFilter: 'blur(12px)' }}
    >
      {/* Top bar */}
      <div className="flex justify-end items-center px-6 pt-4 pt-safe pb-2 shrink-0">
        <button
          onClick={handleDone}
          className="text-[15px] font-bold tracking-wider uppercase active:opacity-60"
          style={{ color: '#d4aa50' }}
        >
          Done
        </button>
      </div>

      {/* Live text display */}
      <div className="flex-1 flex items-center justify-center px-8 overflow-hidden">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something..."
          style={previewStyle}
          className="w-full bg-transparent border-none outline-none resize-none text-center
                     placeholder:text-white/25 leading-snug"
          rows={4}
        />
      </div>

      {/* Controls area */}
      <div className="shrink-0 border-t" style={{ background: 'rgba(26,18,10,0.95)', borderColor: 'rgba(196,112,75,0.1)' }}>

        {activePanel === 'font' ? (
          <div className="flex gap-2 px-4 pt-3 pb-2">
            {FONTS.map((font, i) => (
              <button
                key={font.label}
                onClick={() => setFontIndex(i)}
                className="flex-1 py-2 rounded-xl text-[14px] transition-colors active:scale-95"
                style={{
                  fontFamily: font.family,
                  fontStyle:  font.fontStyle,
                  fontWeight: font.fontWeight,
                  background: fontIndex === i ? 'rgba(212,170,80,0.2)' : 'rgba(255,255,255,0.06)',
                  color: fontIndex === i ? '#d4aa50' : 'rgba(255,255,255,0.6)',
                  border: fontIndex === i ? '1px solid rgba(212,170,80,0.3)' : '1px solid transparent',
                }}
              >
                {font.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div
              ref={stripRef}
              className="relative h-7 rounded-full select-none touch-none cursor-pointer"
              style={{
                background: 'linear-gradient(to right, #fff, #ff0000, #ff8c00, #ffff00, #00c800, #00c8ff, #0000ff, #8b00ff, #ff00ff, #000)',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-md pointer-events-none"
                style={{ left: `calc(${thumbPos * 100}% - 12px)`, background: color }}
              />
            </div>
            <div className="flex gap-2 justify-center pb-1">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  onClick={() => {
                    setColor(swatch);
                    setThumbPos(SWATCH_SNAP_MAP[swatch] ?? 0.5);
                  }}
                  className="w-6 h-6 rounded-full border-2 transition-transform active:scale-90"
                  style={{
                    background: swatch,
                    borderColor: color === swatch ? 'white' : 'transparent',
                    transform:   color === swatch ? 'scale(1.15)' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 px-5 pt-1 border-t"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))', borderColor: 'rgba(196,112,75,0.08)' }}>
          <button
            onClick={() => setActivePanel('font')}
            className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
            style={{
              background: activePanel === 'font' ? 'rgba(212,170,80,0.15)' : 'transparent',
              color: activePanel === 'font' ? '#d4aa50' : 'rgba(255,255,255,0.35)',
            }}
          >
            Aa
          </button>
          <button
            onClick={() => setActivePanel('color')}
            className="w-8 h-8 rounded-full border-2 transition-all"
            style={{
              background:  'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              borderColor: activePanel === 'color' ? 'white' : 'transparent',
              boxShadow:   activePanel === 'color' ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};
