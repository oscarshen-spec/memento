import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings } from 'lucide-react';

interface DebugPanelProps {
  windowLight: boolean;
  onWindowLightChange: (v: boolean) => void;
}

export function DebugPanel({ windowLight, onWindowLightChange }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Backdrop — closes panel on outside click */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 100 }}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                bottom: 56,
                left: 0,
                width: 160,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Toggle row: Window Light */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Window Light</span>
                <button
                  onClick={() => onWindowLightChange(!windowLight)}
                  style={{
                    width: 28,
                    height: 16,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    background: windowLight ? 'rgb(251,191,36)' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                  aria-label="Toggle window light"
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: windowLight ? 14 : 2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger button */}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
          }}
          aria-label="Open debug panel"
        >
          <Settings size={14} />
        </button>
      </div>
    </>
  );
}
