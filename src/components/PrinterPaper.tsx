import React from 'react';
import { motion } from 'motion/react';

// Printer images are 786px native, displayed at 393px (0.5x) — matches Figma spec exactly
const TOP_H = 98;    // height of top clip (printer body)
const BOTTOM_H = 46; // height of bottom clip (paper slot)
const PAPER_W = 280; // photo card width
const PAPER_H = 360; // photo card height

export interface PrinterPaperProps {
  imageUrl: string;
  onComplete: () => void;
}

export const PrinterPaper: React.FC<PrinterPaperProps> = ({ imageUrl, onComplete }) => {
  const paperOffsetX = `calc(50% - ${PAPER_W / 2}px)`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {/* Top clip — printer body (rows 0–98px of the full printer image) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: TOP_H,
          overflow: 'hidden',
          zIndex: 30,
        }}
      >
        <img
          src="/img/card_printer_top.png"
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: TOP_H, objectFit: 'cover' }}
        />
      </div>

      {/* Paper clip container — photo slides out of the slot */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: paperOffsetX,
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

      {/* Bottom clip — slot strip (rows 98–144px), sits above paper as it exits */}
      <div
        style={{
          position: 'absolute',
          top: TOP_H,
          left: 0,
          right: 0,
          height: BOTTOM_H,
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        <img
          src="/img/card_printer_bottom.png"
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: BOTTOM_H, objectFit: 'cover' }}
        />
      </div>
    </div>
  );
};
