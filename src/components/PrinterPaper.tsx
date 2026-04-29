import React, { useLayoutEffect, useState } from 'react';
import { motion } from 'motion/react';

const PRINTER_W = 196;
const PRINTER_H = 244;
const SLOT_Y = 190;
const PAPER_H = 260;
const BTN_PAD = 4;

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

  useLayoutEffect(() => {
    if (printerButtonEl) {
      setRect(printerButtonEl.getBoundingClientRect());
    }
  }, [printerButtonEl]);

  if (!rect) return null;

  // The printer img origin is BTN_PAD inside the button's bounding rect
  const imgLeft = rect.left + BTN_PAD;
  const imgTop = rect.top + BTN_PAD;

  return (
    <div
      style={{
        position: 'fixed',
        left: imgLeft,
        top: imgTop,
        width: PRINTER_W,
        height: PRINTER_H + PAPER_H,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      {/* ── Top half of printer (above slot) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: SLOT_Y,
          overflow: 'hidden',
          zIndex: 30,
        }}
      >
        <img
          src="/Printer.png"
          width={PRINTER_W}
          height={PRINTER_H}
          alt=""
          draggable={false}
          style={{ display: 'block' }}
        />
      </div>

      {/* ── Paper clip container (paper slides out here) ── */}
      <div
        style={{
          position: 'absolute',
          top: SLOT_Y,
          left: 0,
          height: PAPER_H,
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        <motion.img
          src={imageUrl}
          alt="Printing…"
          draggable={false}
          style={{
            display: 'block',
            width: PRINTER_W,
            height: PAPER_H,
            objectFit: 'contain',
            background: '#fff8f1',
          }}
          initial={{ y: -PAPER_H }}
          animate={{ y: 0 }}
          transition={{ duration: 2.5, ease: 'linear' }}
          onAnimationComplete={onComplete}
        />
      </div>

      {/* ── Bottom half of printer (slot strip, overlays top of paper) ── */}
      <div
        style={{
          position: 'absolute',
          top: SLOT_Y,
          left: 0,
          height: PRINTER_H - SLOT_Y,
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        <img
          src="/Printer.png"
          width={PRINTER_W}
          height={PRINTER_H}
          alt=""
          draggable={false}
          style={{ display: 'block', marginTop: -SLOT_Y }}
        />
      </div>
    </div>
  );
};
