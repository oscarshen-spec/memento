import React, { useRef, useEffect } from 'react';
import { WASHI_PATTERNS, WashiPattern } from '../washiPatterns';

// ── Swatch canvas ─────────────────────────────────────────────────────────────

const SWATCH_W  = 70;  // px
const SWATCH_H  = 46;  // px
const TAPE_HW   = 16;  // half-width of the demo tape strip inside swatch
const PREVIEW_SEED = 42;

function drawSwatchPattern(canvas: HTMLCanvasElement, pattern: WashiPattern) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);

  const len = w;
  const hw  = TAPE_HW * (w / SWATCH_W); // scale to canvas DPR
  const cy  = h / 2;

  // Tape body
  ctx.save();
  ctx.translate(0, cy);
  ctx.beginPath();
  ctx.rect(0, -hw, len, hw * 2);
  ctx.fillStyle = pattern.baseColor;
  ctx.fill();

  // Pattern decoration
  pattern.draw(ctx, len, hw, PREVIEW_SEED);

  // Sheen
  ctx.beginPath();
  ctx.rect(0, -hw, len, hw * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();

  // Torn left edge
  ctx.beginPath();
  ctx.moveTo(0, -hw);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(-4, -hw + t * hw * 2);
  }
  ctx.strokeStyle = 'rgba(180,150,160,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Torn right edge
  ctx.beginPath();
  ctx.moveTo(len, -hw);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(len + 4, -hw + t * hw * 2);
  }
  ctx.stroke();

  ctx.restore();
}

// ── SwatchItem ────────────────────────────────────────────────────────────────

interface SwatchItemProps {
  pattern: WashiPattern;
  isSelected: boolean;
  onSelect: () => void;
}

const SwatchItem: React.FC<SwatchItemProps> = ({ pattern, isSelected, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = SWATCH_W * dpr;
    canvas.height = SWATCH_H * dpr;
    canvas.style.width  = `${SWATCH_W}px`;
    canvas.style.height = `${SWATCH_H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    drawSwatchPattern(canvas, pattern);
  }, [pattern]);

  return (
    <button
      onClick={onSelect}
      title={pattern.label}
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '4px 2px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <div
        style={{
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: isSelected
            ? '0 0 0 2.5px #1a1a1a, 0 2px 6px rgba(0,0,0,0.35)'
            : '0 1px 4px rgba(0,0,0,0.22)',
          transform: isSelected ? 'scale(1.07)' : 'scale(1)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <canvas ref={canvasRef} />
      </div>
      <span
        style={{
          fontSize: 9,
          fontFamily: 'system-ui, sans-serif',
          color: isSelected ? '#1a1a1a' : '#666',
          fontWeight: isSelected ? 700 : 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          transition: 'color 0.15s ease',
        }}
      >
        {pattern.label}
      </span>
    </button>
  );
};

// ── TapePatternPicker ─────────────────────────────────────────────────────────

interface TapePatternPickerProps {
  selectedPatternId: string;
  onSelect: (id: string) => void;
}

export const TapePatternPicker: React.FC<TapePatternPickerProps> = ({
  selectedPatternId,
  onSelect,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '6px 16px 4px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {WASHI_PATTERNS.map((p) => (
        <SwatchItem
          key={p.id}
          pattern={p}
          isSelected={p.id === selectedPatternId}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </div>
  );
};
