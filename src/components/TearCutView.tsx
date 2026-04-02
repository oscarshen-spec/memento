import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Point } from '../types';
import { playSound } from '../services/soundService';

interface TearCutViewProps {
  image: string;
  onCut: (topPolygon: Point[], isTorn: boolean, bottomPolygon: Point[]) => void;
  onCancel: () => void;
}

interface TearPair {
  jaggedLine: Point[];
  topPolygon: Point[];
  bottomPolygon: Point[];
}

/** Apply perpendicular fiber jitter to an open path. Endpoints are kept fixed. */
function applyFiberJitter(points: Point[], jitter: number): Point[] {
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const prev = points[i - 1];
    const next = points[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return p;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (Math.random() - 0.5) * 2 * jitter;
    return { x: p.x + nx * offset, y: p.y + ny * offset };
  });
}

/**
 * Given a freehand drawn path, generate a full-width jagged tear line
 * and the two polygons on either side of it (in canvas coordinate space).
 */
function generateTearFromPath(drawnPath: Point[], cw: number, ch: number): TearPair {
  const p0 = drawnPath[0];
  const pN = drawnPath[drawnPath.length - 1];

  // Project the drawn line to find where it would intersect x=0 and x=cw
  let leftY: number, rightY: number;
  if (Math.abs(pN.x - p0.x) < 1) {
    leftY = rightY = (p0.y + pN.y) / 2;
  } else {
    const slope = (pN.y - p0.y) / (pN.x - p0.x);
    leftY = p0.y + slope * (0 - p0.x);
    rightY = p0.y + slope * (cw - p0.x);
  }
  leftY = Math.max(5, Math.min(ch - 5, leftY));
  rightY = Math.max(5, Math.min(ch - 5, rightY));

  // Sample the drawn path to get deviation from the straight baseline
  const steps = 60;
  const baselinePoints: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = t * cw;
    const baseY = leftY + (rightY - leftY) * t;
    const pathIdx = Math.round(t * (drawnPath.length - 1));
    const pathPt = drawnPath[Math.max(0, Math.min(drawnPath.length - 1, pathIdx))];
    const pathBaselineY = p0.y + (pN.y - p0.y) * t;
    const deviation = pathPt.y - pathBaselineY;
    baselinePoints.push({ x: bx, y: baseY + deviation * 0.4 });
  }

  // Heavy fiber jitter — ~2.5% of canvas size
  const jitter = Math.max(cw, ch) * 0.025;
  const jaggedLine = applyFiberJitter(baselinePoints, jitter);

  const topPolygon: Point[] = [
    { x: 0, y: 0 },
    { x: cw, y: 0 },
    { x: cw, y: jaggedLine[jaggedLine.length - 1].y },
    ...[...jaggedLine].reverse(),
    { x: 0, y: jaggedLine[0].y },
  ];

  const bottomPolygon: Point[] = [
    { x: 0, y: jaggedLine[0].y },
    ...jaggedLine,
    { x: cw, y: jaggedLine[jaggedLine.length - 1].y },
    { x: cw, y: ch },
    { x: 0, y: ch },
  ];

  return { jaggedLine, topPolygon, bottomPolygon };
}

export const TearCutView: React.FC<TearCutViewProps> = ({ image, onCut, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [phase, setPhase] = useState<'drawing' | 'arranging'>('drawing');
  const [pieceAOffset, setPieceAOffset] = useState({ x: 0, y: 0 });
  const [pieceBOffset, setPieceBOffset] = useState({ x: 0, y: 0 });
  const tearPairRef = useRef<TearPair | null>(null);
  const drawnPathRef = useRef<Point[]>([]);
  const isDrawing = useRef(false);
  const arrangePieceARef = useRef<HTMLCanvasElement>(null);
  const arrangePieceBRef = useRef<HTMLCanvasElement>(null);
  const arrangeDragRef = useRef<{
    piece: 'A' | 'B';
    touchId: number;
    startTouchX: number;
    startTouchY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = image;
  }, [image]);

  const getImageDisplayRect = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return { x: 0, y: 0, width: 0, height: 0 };
    const padding = 40;
    const maxW = canvas.width - padding * 2;
    const maxH = canvas.height - padding * 2;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    return { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, width: w, height: h };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rect = getImageDisplayRect();
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);

    const path = drawnPathRef.current;
    if (path.length < 2) return;

    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.restore();

    if (isDrawing.current) {
      const tip = path[path.length - 1];
      ctx.save();
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🖐️', tip.x + 12, tip.y - 12);
      ctx.restore();
    }
  }, [getImageDisplayRect]);

  // Resize canvas to fill window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw, imgLoaded]);

  // Render the two torn pieces into their canvases when entering arrange phase
  useEffect(() => {
    if (phase !== 'arranging' || !tearPairRef.current || !imgRef.current || !canvasRef.current) return;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    const img = imgRef.current;
    const imgScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const imgX = (cw - img.naturalWidth * imgScale) / 2;
    const imgY = (ch - img.naturalHeight * imgScale) / 2;

    const drawPiece = (ref: React.RefObject<HTMLCanvasElement>, polygon: Point[]) => {
      const pc = ref.current;
      if (!pc) return;
      pc.width = cw;
      pc.height = ch;
      const ctx = pc.getContext('2d')!;
      ctx.clearRect(0, 0, cw, ch);
      // Clip to polygon and draw image
      ctx.save();
      ctx.beginPath();
      polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, img.naturalWidth * imgScale, img.naturalHeight * imgScale);
      ctx.restore();
      // Torn fiber edge stroke (extends slightly beyond the clip)
      ctx.beginPath();
      polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    drawPiece(arrangePieceARef, tearPairRef.current.topPolygon);
    drawPiece(arrangePieceBRef, tearPairRef.current.bottomPolygon);
  }, [phase]);

  const canvasPointFrom = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (pt: Point) => {
    drawnPathRef.current = [pt];
    isDrawing.current = true;
    draw();
  };

  const continueDrawing = (pt: Point) => {
    if (!isDrawing.current) return;
    const last = drawnPathRef.current[drawnPathRef.current.length - 1];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3) return;
    drawnPathRef.current.push(pt);
    requestAnimationFrame(draw);
  };

  const finishDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const path = drawnPathRef.current;
    if (path.length < 5) { drawnPathRef.current = []; draw(); return; }

    const canvas = canvasRef.current!;
    navigator.vibrate?.(30);
    playSound('paperTear');
    const pair = generateTearFromPath(path, canvas.width, canvas.height);
    tearPairRef.current = pair;
    setPieceAOffset({ x: 0, y: 0 });
    setPieceBOffset({ x: 0, y: 0 });
    setPhase('arranging');
  };

  // Touch handlers (drawing)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (phase !== 'drawing' || e.touches.length !== 1) return;
    startDrawing(canvasPointFrom(e.touches[0].clientX, e.touches[0].clientY));
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (phase !== 'drawing' || e.touches.length !== 1) return;
    continueDrawing(canvasPointFrom(e.touches[0].clientX, e.touches[0].clientY));
  };
  const handleTouchEnd = () => { if (phase === 'drawing') finishDrawing(); };

  // Mouse handlers (drawing)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || phase !== 'drawing') return;
    startDrawing(canvasPointFrom(e.clientX, e.clientY));
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (phase !== 'drawing') return;
    continueDrawing(canvasPointFrom(e.clientX, e.clientY));
  };
  const handleMouseUp = () => { if (phase === 'drawing') finishDrawing(); };

  // Arrange mode — drag handlers
  const handleArrangeTouchStart = (piece: 'A' | 'B') => (e: React.TouchEvent) => {
    e.stopPropagation();
    if (arrangeDragRef.current) return;
    const t = e.changedTouches[0];
    const offset = piece === 'A' ? pieceAOffset : pieceBOffset;
    arrangeDragRef.current = {
      piece, touchId: t.identifier,
      startTouchX: t.clientX, startTouchY: t.clientY,
      startOffsetX: offset.x, startOffsetY: offset.y,
    };
  };

  const handleArrangeTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const drag = arrangeDragRef.current;
    if (!drag) return;
    const t = Array.from(e.changedTouches).find(touch => touch.identifier === drag.touchId);
    if (!t) return;
    const newOffset = {
      x: drag.startOffsetX + (t.clientX - drag.startTouchX),
      y: drag.startOffsetY + (t.clientY - drag.startTouchY),
    };
    if (drag.piece === 'A') setPieceAOffset(newOffset);
    else setPieceBOffset(newOffset);
  };

  const handleArrangeTouchEnd = () => { arrangeDragRef.current = null; };

  const handleArrangeMouseDown = (piece: 'A' | 'B') => (e: React.MouseEvent) => {
    if (e.button !== 0 || arrangeDragRef.current) return;
    const offset = piece === 'A' ? pieceAOffset : pieceBOffset;
    arrangeDragRef.current = {
      piece, touchId: -1,
      startTouchX: e.clientX, startTouchY: e.clientY,
      startOffsetX: offset.x, startOffsetY: offset.y,
    };
  };

  const handleArrangeMouseMove = (e: React.MouseEvent) => {
    const drag = arrangeDragRef.current;
    if (!drag) return;
    const newOffset = {
      x: drag.startOffsetX + (e.clientX - drag.startTouchX),
      y: drag.startOffsetY + (e.clientY - drag.startTouchY),
    };
    if (drag.piece === 'A') setPieceAOffset(newOffset);
    else setPieceBOffset(newOffset);
  };

  const handleArrangeMouseUp = () => { arrangeDragRef.current = null; };

  const handleRetear = () => {
    tearPairRef.current = null;
    drawnPathRef.current = [];
    setPhase('drawing');
    requestAnimationFrame(draw);
  };

  const handleConfirm = () => {
    const pair = tearPairRef.current;
    if (pair) onCut(pair.topPolygon, true, pair.bottomPolygon);
  };

  const hintText = phase === 'drawing' ? 'Drag to tear' : 'Drag pieces apart, then confirm';

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        background: '#2a5a3a',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,0.05) 19px, rgba(255,255,255,0.05) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,0.05) 19px, rgba(255,255,255,0.05) 20px)',
      }}
    >
      <button
        onClick={() => { playSound('paperRustle'); onCancel(); }}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        ✕
      </button>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-sm pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}
      >
        {hintText}
      </div>

      {/* Drawing canvas — always mounted so ref stays valid during arrange effect */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 touch-none ${phase === 'arranging' ? 'invisible' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Arrange overlay */}
      {phase === 'arranging' && (
        <div
          className="absolute inset-0 z-10"
          style={{ background: 'rgba(10,6,4,0.88)' }}
          onMouseMove={handleArrangeMouseMove}
          onMouseUp={handleArrangeMouseUp}
        >
          {/* Piece A (top half) */}
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pieceAOffset.x}px, ${pieceAOffset.y}px)`, touchAction: 'none', cursor: 'grab' }}
            onTouchStart={handleArrangeTouchStart('A')}
            onTouchMove={handleArrangeTouchMove}
            onTouchEnd={handleArrangeTouchEnd}
            onMouseDown={handleArrangeMouseDown('A')}
          >
            <canvas ref={arrangePieceARef} className="w-full h-full" />
          </div>

          {/* Piece B (bottom half) */}
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pieceBOffset.x}px, ${pieceBOffset.y}px)`, touchAction: 'none', cursor: 'grab' }}
            onTouchStart={handleArrangeTouchStart('B')}
            onTouchMove={handleArrangeTouchMove}
            onTouchEnd={handleArrangeTouchEnd}
            onMouseDown={handleArrangeMouseDown('B')}
          >
            <canvas ref={arrangePieceBRef} className="w-full h-full" />
          </div>

          {/* Action buttons */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-4 z-30">
            <button
              onClick={handleRetear}
              className="px-5 py-2.5 rounded-full text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(8px)' }}
            >
              RETEAR
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-full text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a1a' }}
            >
              KEEP BOTH
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
