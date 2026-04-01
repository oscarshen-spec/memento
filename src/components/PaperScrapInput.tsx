import React, { useRef, useEffect, useState } from 'react';

interface PaperScrapInputProps {
  onCommit: (text: string) => void;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PaperScrapInput: React.FC<PaperScrapInputProps> = ({ onCommit, onCancel, containerRef }) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rotation] = useState(() => (Math.random() - 0.5) * 6); // −3° to 3°

  // Auto-focus to trigger keyboard
  useEffect(() => {
    const timer = setTimeout(() => {
      editableRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Click-outside to commit/cancel
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const text = editableRef.current?.innerText.trim() ?? '';
        if (text) {
          onCommit(text);
        } else {
          onCancel();
        }
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onCommit, onCancel]);

  // Position at center of the book page container
  const containerRect = containerRef.current?.getBoundingClientRect();
  const top = containerRect ? containerRect.top + containerRect.height / 2 : '50%';
  const left = containerRect ? containerRect.left + containerRect.width / 2 : '50%';

  const placeholderStyle = `
    [data-placeholder]:empty::before {
      content: attr(data-placeholder);
      color: rgba(80, 60, 40, 0.35);
      pointer-events: none;
    }
  `;

  return (
    <>
      <style>{placeholderStyle}</style>
      <div
        ref={wrapperRef}
        style={{
          position: 'fixed',
          top,
          left,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          zIndex: 40,
          background: '#fffef8',
          boxShadow: '2px 3px 8px rgba(0,0,0,0.18)',
          clipPath: `polygon(
            2% 0%, 12% 1%, 25% 0%, 38% 2%, 50% 0%, 62% 1%, 75% 0%, 88% 2%, 98% 0%,
            100% 15%, 99% 30%, 100% 50%, 99% 70%, 100% 85%,
            97% 100%, 85% 99%, 72% 100%, 58% 98%, 45% 100%, 32% 99%, 18% 100%, 5% 98%, 0% 100%,
            1% 82%, 0% 65%, 1% 45%, 0% 28%, 1% 12%
          )`,
          padding: '18px 22px',
          minWidth: 120,
          minHeight: 48,
          maxWidth: 280,
        }}
      >
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 18,
            color: '#3a2a1a',
            lineHeight: 1.5,
            outline: 'none',
            minHeight: 24,
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
          data-placeholder="type here…"
        />
      </div>
    </>
  );
};
