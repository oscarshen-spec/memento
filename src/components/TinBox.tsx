import React from 'react';

export const TIN_W = 96;
export const TIN_H = 64;

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
      <img
        src="/metalbox.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
};
