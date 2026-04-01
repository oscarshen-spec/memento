import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
import { Point } from '../types';

interface CuttingRoomProps {
  image: string;
  onCut: (points: Point[], isTorn?: boolean) => void;
  onCancel: () => void;
}

type GestureState = 'idle' | 'drawing' | 'panning' | 'torn' | 'arranging';

interface TearPair {
  tearLine: Point[];      // 61 points spanning x=0 to x=cw (generated once)
  topPolygon: Point[];    // upper half — shares tearLine
  bottomPolygon: Point[]; // lower half — shares tearLine
}

const TEAR_JITTER_BOOST = 1.5; // heavier fiber effect vs. scissors cuts

const generateTearPair = (
  trail: Point[],
  roughness: number,
  cw: number,
  ch: number,
): TearPair => {
  const start = trail[0];
  const end = trail[trail.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let leftY: number;
  let rightY: number;

  if (Math.abs(dx) < 5) {
    const midY = (start.y + end.y) / 2;
    leftY = midY;
    rightY = midY;
  } else {
    const slope = dy / dx;
    leftY = start.y - slope * start.x;
    rightY = start.y + slope * (cw - start.x);
  }

  leftY = Math.max(10, Math.min(ch - 10, leftY));
  rightY = Math.max(10, Math.min(ch - 10, rightY));

  const numSegs = 60;
  const tearLine: Point[] = [];
  for (let i = 0; i <= numSegs; i++) {
    const t = i / numSegs;
    const bx = t * cw;
    const by = leftY + (rightY - leftY) * t;
    const noise =
      ((Math.random() - 0.5) * 50 * roughness +
        (Math.random() - 0.5) * 18 * roughness) *
      TEAR_JITTER_BOOST;
    tearLine.push({ x: bx, y: by + noise });
  }

  // CRITICAL: use [...tearLine] copies — never mutate tearLine itself
  const topPolygon: Point[] = [
    { x: 0, y: 0 },
    { x: cw, y: 0 },
    { x: cw, y: tearLine[tearLine.length - 1].y },
    ...[...tearLine].reverse(),
    { x: 0, y: tearLine[0].y },
  ];

  const bottomPolygon: Point[] = [
    { x: 0, y: tearLine[0].y },
    ...tearLine,
    { x: cw, y: tearLine[tearLine.length - 1].y },
    { x: cw, y: ch },
    { x: 0, y: ch },
  ];

  return { tearLine, topPolygon, bottomPolygon };
};

export const CuttingRoom: React.FC<CuttingRoomProps> = ({ image, onCut, onCancel }) => {
  const [gestureState, setGestureState] = useState<GestureState>('idle');
  const [tearPair, setTearPair] = useState<TearPair | null>(null);
  const [tearPath, setTearPath] = useState<Point[]>([]);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [pieceAOffset, setPieceAOffset] = useState({ x: 0, y: 0 });
  const [pieceBOffset, setPieceBOffset] = useState({ x: 0, y: 0 });

  // refs — not state, updated during touch moves without triggering re-render
  const drawTouchId = useRef<number | null>(null);
  const drawPath = useRef<Point[]>([]);
  const panRef = useRef<{ dist: number; mid: Point } | null>(null);
  const ripSpeed = useRef<number[]>([]);
  const lastRipTime = useRef<number>(0);
  const lastRipPos = useRef<Point | null>(null);
  const arrangeDragRef = useRef<{
    piece: 'A' | 'B';
    touchId: number;
    startTouchX: number;
    startTouchY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const arrangePieceARef = useRef<HTMLCanvasElement>(null);
  const arrangePieceBRef = useRef<HTMLCanvasElement>(null);

  // Decode image once and cache in ref so draw() never calls drawImage before load
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = image;
  }, [image]);


  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = imgRef.current;
    if (img) {
      // Draw image with pan/zoom transform applied
      ctx.save();
      ctx.translate(canvasTransform.x, canvasTransform.y);
      ctx.scale(canvasTransform.scale, canvasTransform.scale);
      const imgScale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const imgX = (canvas.width - img.naturalWidth * imgScale) / 2;
      const imgY = (canvas.height - img.naturalHeight * imgScale) / 2;
      ctx.drawImage(img, imgX, imgY, img.naturalWidth * imgScale, img.naturalHeight * imgScale);
      ctx.restore();
    }

    // Overlays drawn in raw canvas space (no transform)
    if (gestureState === 'ripping' && fingerB && fingerB.trail.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(fingerB.trail[0].x, fingerB.trail[0].y);
      for (let i = 1; i < fingerB.trail.length; i++) {
        ctx.lineTo(fingerB.trail[i].x, fingerB.trail[i].y);
      }
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (gestureState === 'torn' && tearPolygon) {
      ctx.beginPath();
      tearPolygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        draw();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [image, gestureState, fingerB, tearPolygon, canvasTransform]);

  const handleReset = () => {
    drawTouchId.current = null;
    drawPath.current = [];
    setGestureState('idle');
    setTearPath([]);
    setTearPair(null);
    setPieceAOffset({ x: 0, y: 0 });
    setPieceBOffset({ x: 0, y: 0 });
    ripSpeed.current = [];
    lastRipPos.current = null;
    panRef.current = null;
    arrangeDragRef.current = null;
  };

  // Touch helpers
  const getTouchPos = (touch: React.Touch): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const pinchDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const pinchMidpoint = (t1: React.Touch, t2: React.Touch): Point => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const allTouches = e.touches;
    const changedTouches = e.changedTouches;

    if (gestureState === 'idle' && allTouches.length === 2) {
      // Two fingers → pan/zoom
      const t1 = allTouches[0];
      const t2 = allTouches[1];
      panRef.current = { dist: pinchDistance(t1, t2), mid: pinchMidpoint(t1, t2) };
      setGestureState('panning');

    } else if (gestureState === 'idle' && allTouches.length === 1) {
      // Single finger → start drawing the tear line
      const touch = changedTouches[0];
      const pos = getTouchPos(touch);
      drawTouchId.current = touch.identifier;
      drawPath.current = [pos];
      ripSpeed.current = [];
      lastRipTime.current = performance.now();
      lastRipPos.current = pos;
      setTearPath([pos]);
      setGestureState('drawing');

    } else if (gestureState === 'torn' && allTouches.length === 1) {
      // Tap in torn state → start a new draw
      handleReset();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (gestureState === 'panning' && e.touches.length === 2) {
      if (!panRef.current) return;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = pinchDistance(t1, t2);
      const newMid = pinchMidpoint(t1, t2);
      const scaleFactor = panRef.current.dist > 0 ? newDist / panRef.current.dist : 1;
      setCanvasTransform(prev => ({
        scale: Math.max(0.5, Math.min(4, prev.scale * scaleFactor)),
        x: prev.x + (newMid.x - panRef.current!.mid.x),
        y: prev.y + (newMid.y - panRef.current!.mid.y),
      }));
      panRef.current = { dist: newDist, mid: newMid };

    } else if (gestureState === 'drawing') {
      const touch = Array.from(e.touches).find(t => t.identifier === drawTouchId.current);
      if (!touch) return;
      const pos = getTouchPos(touch);
      const now = performance.now();
      const dt = now - lastRipTime.current;
      if (dt > 0 && lastRipPos.current) {
        const dx = pos.x - lastRipPos.current.x;
        const dy = pos.y - lastRipPos.current.y;
        ripSpeed.current.push(Math.sqrt(dx * dx + dy * dy) / dt);
      }
      lastRipTime.current = now;
      lastRipPos.current = pos;
      drawPath.current = [...drawPath.current, pos];
      setTearPath([...drawPath.current]); // triggers canvas redraw
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const endedIds = new Set(Array.from(e.changedTouches).map(t => t.identifier));

    if (gestureState === 'panning' && e.touches.length === 0) {
      setGestureState('idle');

    } else if (
      gestureState === 'drawing' &&
      drawTouchId.current !== null &&
      endedIds.has(drawTouchId.current)
    ) {
      const canvas = canvasRef.current;
      if (canvas && drawPath.current.length >= 3) {
        const samples = ripSpeed.current;
        const avgSpeed =
          samples.length > 0
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0.5;
        const roughness = Math.max(0.3, Math.min(2.0, 0.3 + (avgSpeed - 0.5) * 0.68));
        const pair = generateTearPair(drawPath.current, roughness, canvas.width, canvas.height);
        setTearPair(pair);
        if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
      }
      drawTouchId.current = null;
      setGestureState('torn');
    }
  };

  const handleTouchCancel = (_e: React.TouchEvent) => {
    handleReset();
  };

  const canFinish = gestureState === 'torn' && tearPair !== null;

  const handleFinish = () => {
    if (tearPair) {
      setPieceAOffset({ x: 0, y: 0 });
      setPieceBOffset({ x: 0, y: 0 });
      setGestureState('arranging');
    }
  };

  const hintText: Partial<Record<GestureState, string>> = {
    idle: 'Hold to anchor, swipe to tear',
    pending: 'Hold…',
    anchored: 'Now swipe to rip',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-0 md:p-4"
      style={{
        background: 'radial-gradient(ellipse at center, #1a120a 0%, #0d0806 70%, #050302 100%)',
      }}
    >
      {/* Subtle cutting mat grid pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative w-full h-full md:max-w-4xl flex flex-col gap-4 md:gap-6 p-4 md:p-0">

        {/* Header */}
        <div className="flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-serif italic" style={{ color: '#e8d5b8' }}>The Cutting Room</h2>
            {hintText[gestureState] && (
              <p className="text-[9px] md:text-sm uppercase tracking-[0.2em]" style={{ color: 'rgba(196,112,75,0.7)' }}>
                {hintText[gestureState]}
              </p>
            )}
          </div>
          <div className="flex gap-2 md:gap-4 items-center">
            <button
              onClick={handleReset}
              className="p-3 rounded-full transition-colors active:scale-95"
              style={{ background: 'rgba(196,112,75,0.15)', color: '#c4704b' }}
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={onCancel}
              className="p-3 rounded-full transition-colors active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative flex-1 md:aspect-video rounded-2xl overflow-hidden cursor-crosshair"
          style={{
            background: '#0a0604',
            boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(196,112,75,0.12)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* Anchored pulse ring */}
          {gestureState === 'anchored' && fingerA && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: fingerA.pos.x,
                top: fingerA.pos.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-12 h-12 rounded-full border-2 border-amber-400 animate-ping" />
            </div>
          )}

          {/* Idle / pending center hint */}
          {(gestureState === 'idle' || gestureState === 'pending') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-5xl mb-4 select-none" style={{ color: 'rgba(196,112,75,0.2)' }}>✂</p>
                <p className="font-medium text-sm" style={{ color: 'rgba(232,213,184,0.35)' }}>Hold to anchor, swipe to tear</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex justify-center gap-4 shrink-0 pb-4 md:pb-0">
          <button
            disabled={!canFinish}
            onClick={handleFinish}
            className="flex items-center gap-3 px-10 py-4 rounded-full font-bold tracking-wider text-sm transition-all active:scale-95"
            style={{
              background: canFinish ? 'linear-gradient(135deg, #e8d5b8 0%, #d4aa50 100%)' : 'rgba(255,255,255,0.06)',
              color: canFinish ? '#2c1810' : 'rgba(255,255,255,0.15)',
              boxShadow: canFinish ? '0 8px 24px rgba(212,170,80,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
              cursor: canFinish ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={20} />
            KEEP PIECE
          </button>
        </div>

      </div>
    </div>
  );
};
