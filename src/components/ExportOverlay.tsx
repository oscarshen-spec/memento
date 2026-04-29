import React from 'react';
import { motion } from 'motion/react';

export interface ExportOverlayProps {
  imageUrl: string;
  onClose: () => void;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
}

export const ExportOverlay: React.FC<ExportOverlayProps> = ({ imageUrl, onClose }) => {
  const handleShare = async () => {
    try {
      const file = await dataUrlToFile(imageUrl, 'memento-page.png');
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Memento Page' });
      } else {
        await navigator.clipboard.writeText(imageUrl);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Share failed', err);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      {/* Printed canvas — spring up from below, centred with slight upward offset */}
      <motion.div
        style={{
          width: 354,
          height: 528,
          background: '#fff8f1',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: -66, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Exported page"
          className="w-full h-full object-contain"
        />
      </motion.div>

      {/* Action row — fixed near bottom */}
      <div
        className="fixed bottom-6 left-0 right-0 flex items-center gap-4"
        style={{ paddingLeft: 19, paddingRight: 19 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Save to Photos */}
        <a
          href={imageUrl}
          download="memento-page.png"
          className="flex flex-1 items-center justify-center rounded-[8px]"
          style={{
            border: '2px solid white',
            paddingTop: 16,
            paddingBottom: 16,
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'Caveat, cursive',
              fontWeight: 700,
              fontSize: 24,
              color: 'white',
              whiteSpace: 'nowrap',
            }}
          >
            Save to Photos
          </span>
        </a>

        {/* Share — circular icon button */}
        <button
          onClick={handleShare}
          className="flex items-center justify-center shrink-0 rounded-full"
          style={{
            width: 56,
            height: 56,
            border: '2px solid white',
            background: 'transparent',
          }}
        >
          {/* iOS-style share arrow */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
};
