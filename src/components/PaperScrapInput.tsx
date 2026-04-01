import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';

interface PaperScrapInputProps {
  onCommit: (text: string) => void;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const placeholderStyle = `
  .paper-scrap-input [data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: rgba(80, 60, 40, 0.35);
    pointer-events: none;
  }
`;

export const PaperScrapInput: React.FC<PaperScrapInputProps> = ({ onCommit, onCancel, containerRef }) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rotation] = useState(() => (Math.random() - 0.5) * 6); // −3° to 3°
  const [pos, setPos] = useState<{ top: number | string; left: number | string }>({ top: '50%', left: '50%' });

  // Auto-focus to trigger keyboard
  useEffect(() => {
    const timer = setTimeout(() => {
      editableRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Click-outside to commit/cancel — deferred by one frame to avoid catching the tap that opened the component
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const text = (editableRef.current?.textContent ?? '').trim();
        if (text) {
          onCommit(text);
        } else {
          onCancel();
        }
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onCommit, onCancel]);

  // Position at center of the book page container — reactive to resize/keyboard
  useLayoutEffect(() => {
    const updatePos = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
      }
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, [containerRef]);

  return (
    <>
      <style>{placeholderStyle}</style>
      <div
        ref={wrapperRef}
        className="paper-scrap-input"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          zIndex:40,
          background: '#fffdf2',
          filter: 'drop-shadow(2px 3px rgba(0,0,0,0.18))',
          clipPath: `polygon(
            1% 0%, 12% 0%, 25% 1%, 38% 0%, 50% 0%, 62% 1%, 75% 0%, 88% 1%, 99% 0%,
            100% 15%, 100% 30%, 100% 50%, 100% 70%, 100% 85%,
            99% 100%, 85% 100%, 72% 99%, 58% 100%, 45% 99%, 32% 100%, 18% 99%, 5% 100%, 0% 100%,
            0% 82%, 0% 65%, 0% 45%, 0% 28%, 0% 12%
          )`,
          padding: '4px 8px',
          minWidth: 120,
          minHeight: 48,
          maxWidth: 280,
        }}
      >
        <div
          ref={editableRef}
          contentEditable="plaintext-only"
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 18,
            color: '#3a2a1a',
            lineHeight: 1.5,
            outline: 'none',
            minHeight: 16,
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
          data-placeholder="type here…"
        />
      </div>
    </>
  );
};
