import React, { useState, useRef } from 'react';
import { Layer, Shape, Rect } from 'react-konva';
import { TapeStrip, Point } from '../types';

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

const TAPE_COLOR = 'rgba(240,225,190,0.88)';
const TAPE_EDGE_COLOR = 'rgba(170,145,100,0.75)';
const TAPE_GRAIN_COLOR = 'rgba(200,180,140,0.22)';
const WISP_COLOR = 'rgba(190,165,120,0.55)';
const PREVIEW_SEED = 99999;

/**
 * Draws a masking tape strip from `start` to `end` directly onto a Konva
 * sceneFunc context. Pass `tearSeed` for a finalized strip (draws jagged torn
 * right end + fiber wisps). Pass `null` for the in-progress preview (clean end).
 */
function drawTapeShape(
  ctx: any,
  start: Point,
  end: Point,
  width: number,
  tearSeed: number | null,
  alpha = 1,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  // Unit vectors along and perpendicular to the tape axis
  const ax = dx / len;
  const ay = dy / len;
  const px = (-dy / len) * (width / 2);
  const py = (dx / len) * (width / 2);

  // Four corners: top-left (tl), bottom-left (bl), bottom-right (br), top-right (tr)
  const tl = { x: start.x + px, y: start.y + py };
  const bl = { x: start.x - px, y: start.y - py };
  const br = { x: end.x - px, y: end.y - py };
  const tr = { x: end.x + px, y: end.y + py };

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── Shadow ──
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.13)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = ax * 1 + px * 0.05;
  ctx.shadowOffsetY = ay * 1 + py * 0.05;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.fillStyle = TAPE_COLOR;
  ctx.fill();
  ctx.restore();

  // ── Tape body (no shadow) ──
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.fillStyle = TAPE_COLOR;
  ctx.fill();

  // ── Paper grain lines (clipped to tape body) ──
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = TAPE_GRAIN_COLOR;
  ctx.lineWidth = 0.5;
  for (let i = 6; i < len; i += 8) {
    ctx.beginPath();
    ctx.moveTo(start.x + ax * i + px * 0.85, start.y + ay * i + py * 0.85);
    ctx.lineTo(start.x + ax * i - px * 0.85, start.y + ay * i - py * 0.85);
    ctx.stroke();
  }
  ctx.restore();

  // ── Left torn end (start side) — always shown ──
  const leftRng = seededRng((tearSeed ?? PREVIEW_SEED) + 1);
  const steps = 7;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mx = tl.x + (bl.x - tl.x) * t;
    const my = tl.y + (bl.y - tl.y) * t;
    const jag = (leftRng() - 0.5) * 7;
    ctx.lineTo(mx - ax * Math.abs(jag), my - ay * Math.abs(jag));
  }
  ctx.strokeStyle = TAPE_EDGE_COLOR;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // ── Right torn end — only on finalized strips ──
  if (tearSeed !== null) {
    const rightRng = seededRng(tearSeed);
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = tr.x + (br.x - tr.x) * t;
      const my = tr.y + (br.y - tr.y) * t;
      const jag = (rightRng() - 0.5) * 10;
      ctx.lineTo(mx + ax * jag, my + ay * jag);
    }
    ctx.strokeStyle = TAPE_EDGE_COLOR;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // ── Fiber wisps at tear end ──
    const wispRng = seededRng(tearSeed + 77);
    ctx.strokeStyle = WISP_COLOR;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.3 + wispRng() * 0.4) / 4;
      const wx = tr.x + (br.x - tr.x) * t;
      const wy = tr.y + (br.y - tr.y) * t;
      const wlen = 5 + wispRng() * 5;
      const angle = (wispRng() - 0.5) * 0.9;
      const wdx = ax * Math.cos(angle) - ay * Math.sin(angle);
      const wdy = ax * Math.sin(angle) + ay * Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + wdx * wlen, wy + wdy * wlen);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── Constants ────────────────────────────────────────────────────────────────

const TAPE_WIDTH = 28;
const DIRECTION_LOCK_DIST = 5;
const TEAR_THRESHOLD = 0.34; // cos(~70°)

// ── Component ────────────────────────────────────────────────────────────────

export interface TapeLayerProps {
  isActive: boolean;
  strips: TapeStrip[];
  onStripAdded: (strip: TapeStrip) => void;
  stageWidth: number;
  stageHeight: number;
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
}) => {
  const [inProgress, setInProgress] = useState<InProgress | null>(null);
  const ipRef = useRef<InProgress | null>(null);

  const getPos = (e: any): Point | null => {
    const pos = e.target.getStage()?.getPointerPosition();
    return pos ? { x: pos.x, y: pos.y } : null;
  };

  const finalize = (start: Point, end: Point) => {
    ipRef.current = null;
    setInProgress(null);
    if (vecLen({ x: end.x - start.x, y: end.y - start.y }) < DIRECTION_LOCK_DIST) return;
    onStripAdded({
      id: Math.random().toString(36).substr(2, 9),
      startPoint: start,
      endPoint: end,
      width: TAPE_WIDTH,
      tearSeed: Math.random() * 100000,
    });
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
  };

  const handleMove = (e: any) => {
    if (!ipRef.current) return;
    const pos = getPos(e);
    if (!pos) return;
    const ip = ipRef.current;

    const totalMovement = { x: pos.x - ip.startPoint.x, y: pos.y - ip.startPoint.y };
    const stepMovement  = { x: pos.x - ip.prevPoint.x,  y: pos.y - ip.prevPoint.y };

    // Lock tape direction once the user has moved far enough
    let tapeDirection = ip.tapeDirection;
    if (!tapeDirection && vecLen(totalMovement) > DIRECTION_LOCK_DIST) {
      tapeDirection = vecNorm(totalMovement);
    }

    // Check tear: current step deviates > 70° from locked direction
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
      // pointer left stage — finalize at last known position
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
            drawTapeShape(ctx, strip.startPoint, strip.endPoint, strip.width, strip.tearSeed);
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
              TAPE_WIDTH,
              null,
              0.5,
            );
          }}
          listening={false}
        />
      )}
    </Layer>
  );
};
