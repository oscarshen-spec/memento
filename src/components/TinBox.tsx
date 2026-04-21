import React from 'react';
import { motion } from 'motion/react';

export const TIN_W = 88;
export const TIN_H = 72;

interface TinBoxProps {
  isOpen: boolean;
  onOpen: () => void;
}

export const TinBox: React.FC<TinBoxProps> = ({ isOpen, onOpen }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isOpen) onOpen();
      }}
      aria-label="Open gallery"
      className="absolute"
      style={{
        width: TIN_W,
        height: TIN_H,
        top: 12,
        right: 12,
        zIndex: 50,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: isOpen ? 'default' : 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {/* Tin body */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-[6px]"
        style={{
          height: TIN_H * 0.78,
          background:
            'linear-gradient(180deg, #c9c9cc 0%, #8c8c92 40%, #60606a 100%)',
          boxShadow:
            '0 6px 10px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.3)',
          border: '1px solid rgba(20,20,25,0.6)',
        }}
      >
        {/* Printed label */}
        <div
          className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center text-[8px] uppercase tracking-[0.18em] font-semibold"
          style={{ color: 'rgba(30,25,20,0.75)' }}
        >
          Photos
        </div>
      </div>

      {/* Tin lid */}
      <motion.div
        className="absolute left-0 right-0 rounded-[6px]"
        style={{
          top: 0,
          height: TIN_H * 0.3,
          background:
            'linear-gradient(180deg, #dcdce0 0%, #a8a8ae 70%, #7a7a82 100%)',
          boxShadow:
            '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
          border: '1px solid rgba(20,20,25,0.55)',
          transformOrigin: '50% 100%',
        }}
        animate={isOpen ? { rotateX: -105, y: -4 } : { rotateX: 0, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      />
    </button>
  );
};
