import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { startPrinterFeed } from '../services/soundService';

// Display size — images are 786px native, shown at 200px (scale ≈ 0.254x)
const PRINTER_DISPLAY_W = 175;
const TOP_H = Math.round(196 * PRINTER_DISPLAY_W / 786);  // 44px — printer body
const BOTTOM_H = Math.round(92 * PRINTER_DISPLAY_W / 786); // 21px — paper slot
const PAPER_W = 140;  // photo card width (centered under slot)
const PAPER_H = 185;  // photo card height
const PAPER_X = Math.round((PRINTER_DISPLAY_W - PAPER_W) / 2); // 18px offset to center
const BTN_PAD = 4;    // button has p-1

export interface PrinterPaperProps {
  imageUrl: string;
  printerButtonEl: HTMLButtonElement | null;
  onComplete: () => void;
}

export const PrinterPaper: React.FC<PrinterPaperProps> = ({
  imageUrl,
  printerButtonEl,
  onComplete,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const stopSound = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (printerButtonEl) setRect(printerButtonEl.getBoundingClientRect());
  }, [printerButtonEl]);

  useEffect(() => {
    stopSound.current = startPrinterFeed();
    return () => stopSound.current?.();
  }, []);

  if (!rect) return null;

  const left = rect.left + BTN_PAD;
  const top = rect.top + BTN_PAD;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: PRINTER_DISPLAY_W,
        height: TOP_H + PAPER_H,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      {/* Printer body — top clip, sits above the emerging paper */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PRINTER_DISPLAY_W,
          height: TOP_H,
          overflow: 'hidden',
          zIndex: 30,
        }}
      >
        <img
          src="/img/card_printer_top.png"
          alt=""
          draggable={false}
          style={{ display: 'block', width: PRINTER_DISPLAY_W, height: TOP_H }}
        />
      </div>

      {/* Paper — slides from behind the printer body, above the slot */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: PAPER_X,
          width: PAPER_W,
          height: PAPER_H,
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        <motion.img
          src={imageUrl}
          alt="Printing…"
          draggable={false}
          style={{
            display: 'block',
            width: PAPER_W,
            height: PAPER_H,
            objectFit: 'contain',
            background: '#fff8f1',
          }}
          initial={{ y: -PAPER_H }}
          animate={{ y: 0 }}
          transition={{ duration: 2.5, ease: 'linear' }}
          onAnimationComplete={() => { stopSound.current?.(); onComplete(); }}
        />
      </div>

      {/* Slot strip — bottom clip, paper slides above it */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: 0,
          width: PRINTER_DISPLAY_W,
          height: BOTTOM_H,
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        <img
          src="/img/card_printer_bottom.png"
          alt=""
          draggable={false}
          style={{ display: 'block', width: PRINTER_DISPLAY_W, height: BOTTOM_H }}
        />
      </div>
    </div>
  );
};
