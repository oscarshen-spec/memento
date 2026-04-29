import React, { useLayoutEffect, useState } from 'react';
import { motion } from 'motion/react';

// Display dimensions (scaled from 786px native width)
const PRINTER_W = 280;
const TOP_H = Math.round(196 * PRINTER_W / 786);   // ~70px
const BOTTOM_H = Math.round(92 * PRINTER_W / 786);  // ~33px
const PAPER_W = 200;
const PAPER_H = 260;
const PAPER_X = Math.round((PRINTER_W - PAPER_W) / 2); // center paper under printer
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

  const imgLeft = rect.left + BTN_PAD;
  const imgTop = rect.top + BTN_PAD;

  return (
    <div
      style={{
        position: 'fixed',
        left: imgLeft,
        top: imgTop,
        width: PRINTER_W,
        height: TOP_H + PAPER_H,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      {/* Top layer — printer body, highest z-index, covers top of emerging paper */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 30,
        }}
      >
        <img
          src="/img/card_printer_top.png"
          width={PRINTER_W}
          height={TOP_H}
          alt=""
          draggable={false}
          style={{ display: 'block' }}
        />
      </div>

      {/* Paper clip container — paper slides downward from behind the slot */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: PAPER_X,
          width: PAPER_W,
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
            width: PAPER_W,
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

      {/* Bottom layer — output slot, sits on top of paper as it exits (sandwiches paper) */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: 0,
          zIndex: 25,
        }}
      >
        <img
          src="/img/card_printer_bottom.png"
          width={PRINTER_W}
          height={BOTTOM_H}
          alt=""
          draggable={false}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
};
