import React, { useState, useRef, useEffect } from 'react';
import { Layer, Shape, Rect } from 'react-konva';
import { TapeStrip, Point } from '../types';
import { startTapePull, playSound } from '../services/soundService';
import { getPattern } from '../washiPatterns';

// ── Math helpers ────────────────────────────────────────────────────────────

function vecLen(v: Point): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecNorm(v: Point): Point {
  const len = vecLen(v);
  return len < 0.0001 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function vecDot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** Deterministic pseudo-random number generator seeded with `seed`. */
function seededRng(seed: number): () => number {
  let s = (Math.abs(seed * 1000) | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const TAPE_EDGE_COLOR = 'rgba(180,155,165,0.60)';
const WISP_COLOR      = 'rgba(210,160,170,0.55)';
const PREVIEW_SEED    = 99999;

/**
 * Draws a washi tape strip from `start` to `end` in world space.
 *
 * Internally transforms the canvas into tape-local coordinates before
 * painting, so the pattern draw fn only sees a simple rect:
 *   x: 0 → length  (along tape)
 *   y: -hw → hw    (across tape)
 *
 * `tearSeed !== null` → finalized strip (draws both torn ends + wisps).
 * `tearSeed === null` → live preview (draws only the left torn end).
 */
function drawTapeShape(
  ctx: any,
  start: Point,
  end: Point,
  width: number,
  tearSeed: number | null,
  alpha = 1,
  patternId = 'cream',
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  const angle = Math.atan2(dy, dx);
  const hw = width / 2;

  const pattern = getPattern(patternId);
  const seed = tearSeed ?? PREVIEW_SEED;

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Transform to tape-local space ──────────────────────────────────────────
  ctx.translate(start.x, start.y);
  ctx.rotate(angle);

  // ── Shadow (flat colour pass) ──────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.14)';
  ctx.shadowBlur  = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1.5;
  ctx.beginPath();
  ctx.rect(0, -hw, len, width);
  ctx.fillStyle = pattern.baseColor;
  ctx.fill();
  ctx.restore();

  // ── Tape body (base colour) ────────────────────────────────────────────────
  ctx.beginPath();
  ctx.rect(0, -hw, len, width);
  ctx.fillStyle = pattern.baseColor;
  ctx.fill();

  // ── Pattern decoration ─────────────────────────────────────────────────────
  pattern.draw(ctx as unknown as CanvasRenderingContext2D, len, hw, seed);

  // ── Semi-transparent sheen overlay (gives a slight translucency) ───────────
  ctx.beginPath();
  ctx.rect(0, -hw, len, width);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();

  // ── Left torn end ──────────────────────────────────────────────────────────
  const leftRng = seededRng(seed + 1);
  const steps = 8;
  ctx.beginPath();
  ctx.moveTo(0, -hw);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = -hw + t * width;
    const jag = (leftRng() - 0.5) * 7;
    ctx.lineTo(-Math.abs(jag), y);
  }
  ctx.strokeStyle = TAPE_EDGE_COLOR;
  ctx.lineWidth   = 1;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── Right torn end + wisps — only on finalized strips ─────────────────────
  if (tearSeed !== null) {
    const rightRng = seededRng(tearSeed);
    ctx.beginPath();
    ctx.moveTo(len, -hw);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = -hw + t * width;
      const jag = (rightRng() - 0.5) * 10;
      ctx.lineTo(len + Math.abs(jag), y);
    }
    ctx.strokeStyle = TAPE_EDGE_COLOR;
    ctx.lineWidth   = 1.2;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // Fiber wisps at tear end
    const wispRng = seededRng(tearSeed + 77);
    ctx.strokeStyle = WISP_COLOR;
    ctx.lineWidth   = 0.7;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.3 + wispRng() * 0.4) / 4;
      const wy = -hw + t * width;
      const wlen = 5 + wispRng() * 5;
      const wa = (wispRng() - 0.5) * 0.9;
      ctx.beginPath();
      ctx.moveTo(len, wy);
      ctx.lineTo(len + Math.cos(wa) * wlen, wy + Math.sin(wa) * wlen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TAPE_WIDTH   = 28;
const DIRECTION_LOCK_DIST  = 5;
const TEAR_THRESHOLD       = 0.34; // cos(~70°)

// ── Component ────────────────────────────────────────────────────────────────

export interface TapeLayerProps {
  isActive: boolean;
  strips: TapeStrip[];
  onStripAdded: (strip: TapeStrip) => void;
  stageWidth: number;
  stageHeight: number;
  selectedPatternId?: string;
  selectedWidth?: number;
}

interface InProgress {
  startPoint: Point;
  currentPoint: Point;
  prevPoint: Point;
  tapeDirection: Point | null;
}

export const TapeLayer: React.FC<TapeLayerProps> = ({
  isActive,
  strips,
  onStripAdded,
  stageWidth,
  stageHeight,
  selectedPatternId = 'cream',
  selectedWidth = DEFAULT_TAPE_WIDTH,
}) => {
  const [inProgress, setInProgress] = useState<InProgress | null>(null);
  const ipRef = useRef<InProgress | null>(null);
  const stopPullRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { stopPullRef.current?.(); };
  }, []);

  const getPos = (e: any): Point | null => {
    const pos = e.target.getStage()?.getPointerPosition();
    return pos ? { x: pos.x, y: pos.y } : null;
  };

  const finalize = (start: Point, end: Point) => {
    stopPullRef.current?.();
    stopPullRef.current = null;
    ipRef.current = null;
    setInProgress(null);
    if (vecLen({ x: end.x - start.x, y: end.y - start.y }) < DIRECTION_LOCK_DIST) return;
    onStripAdded({
      id: Math.random().toString(36).substr(2, 9),
      startPoint: start,
      endPoint: end,
      width: selectedWidth,
      tearSeed: Math.random() * 100000,
      patternId: selectedPatternId,
    });
    playSound('tapeRip');
  };

  const handleDown = (e: any) => {
    const pos = getPos(e);
    if (!pos) return;
    const ip: InProgress = {
      startPoint: pos,
      currentPoint: pos,
      prevPoint: pos,
      tapeDirection: null,
    };
    ipRef.current = ip;
    setInProgress({ ...ip });
    stopPullRef.current?.();
    stopPullRef.current = startTapePull();
  };

  const handleMove = (e: any) => {
    if (!ipRef.current) return;
    const pos = getPos(e);
    if (!pos) return;
    const ip = ipRef.current;

    const totalMovement = { x: pos.x - ip.startPoint.x, y: pos.y - ip.startPoint.y };
    const stepMovement  = { x: pos.x - ip.prevPoint.x,  y: pos.y - ip.prevPoint.y  };

    let tapeDirection = ip.tapeDirection;
    if (!tapeDirection && vecLen(totalMovement) > DIRECTION_LOCK_DIST) {
      tapeDirection = vecNorm(totalMovement);
    }

    if (tapeDirection && vecLen(stepMovement) > 1.5) {
      const d = vecDot(vecNorm(stepMovement), tapeDirection);
      if (d < TEAR_THRESHOLD) {
        finalize(ip.startPoint, ip.prevPoint);
        return;
      }
    }

    const updated: InProgress = {
      startPoint: ip.startPoint,
      currentPoint: pos,
      prevPoint: pos,
      tapeDirection,
    };
    ipRef.current = updated;
    setInProgress({ ...updated });
  };

  const handleUp = (e: any) => {
    if (!ipRef.current) return;
    const pos = getPos(e);
    if (!pos) {
      finalize(ipRef.current.startPoint, ipRef.current.prevPoint);
      return;
    }
    finalize(ipRef.current.startPoint, pos);
  };

  return (
    <Layer>
      {/* Transparent hit target — only active in tape mode */}
      {isActive && (
        <Rect
          x={0} y={0}
          width={stageWidth} height={stageHeight}
          fill="transparent"
          onMouseDown={handleDown}
          onTouchStart={handleDown}
          onMouseMove={handleMove}
          onTouchMove={handleMove}
          onMouseUp={handleUp}
          onTouchEnd={handleUp}
        />
      )}

      {/* Finalized strips */}
      {strips.map((strip) => (
        <Shape
          key={strip.id}
          sceneFunc={(ctx) => {
            drawTapeShape(
              ctx,
              strip.startPoint,
              strip.endPoint,
              strip.width,
              strip.tearSeed,
              1,
              strip.patternId ?? 'cream',
            );
          }}
          listening={false}
        />
      ))}

      {/* Live preview */}
      {inProgress && inProgress.tapeDirection && (
        <Shape
          sceneFunc={(ctx) => {
            drawTapeShape(
              ctx,
              inProgress.startPoint,
              inProgress.currentPoint,
              selectedWidth,
              null,
              0.6,
              selectedPatternId,
            );
          }}
          listening={false}
        />
      )}
    </Layer>
  );
};
