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
    if (!imageUrl) return;
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
      className="fixed inset-0 z-50 flex justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <motion.div
        style={{ position: 'absolute', top: 96, width: 345, display: 'flex', flexDirection: 'column', gap: 27 }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Exported page canvas */}
        <div style={{ width: 345, height: 528, background: '#fff8f1', flexShrink: 0 }}>
          <img
            src={imageUrl}
            alt="Exported page"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%' }}>
          <a
            href={imageUrl}
            download="memento-page.png"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              borderRadius: 8,
              padding: '16px 24px',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontFamily: 'Caveat, cursive', fontWeight: 700, fontSize: 24, color: 'white', whiteSpace: 'nowrap' }}>
              Save to Photos
            </span>
          </a>

          <button
            onClick={handleShare}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '2px solid white',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
