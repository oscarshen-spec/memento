import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
import { Point } from '../types';

interface CuttingRoomProps {
  image: string;
  onCut: (points: Point[], isTorn?: boolean) => void;
  onCancel: () => void;
}

type GestureState = 'idle' | 'pending' | 'panning' | 'anchored' | 'ripping' | 'torn';

interface FingerA {
  id: number;
  pos: Point;
}

interface FingerB {
  id: number;
  pos: Point;
  trail: Point[];
}

export const CuttingRoom: React.FC<CuttingRoomProps> = ({ image, onCut, onCancel }) => {
  const [gestureState, setGestureState] = useState<GestureState>('idle');
  const [fingerA, setFingerA] = useState<FingerA | null>(null);
  const [fingerB, setFingerB] = useState<FingerB | null>(null);
  const [canvasTransform, setCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [tearPolygon, setTearPolygon] = useState<Point[] | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panRef = useRef<{ dist: number; mid: Point } | null>(null);
  const ripSpeed = useRef<number[]>([]);
  const lastRipTime = useRef<number>(0);
  const lastRipPos = useRef<Point | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Decode image once and cache in ref so draw() never calls drawImage before load
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = image;
  }, [image]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const generateTearPolygon = (trail: Point[], roughness: number, cw: number, ch: number): Point[] => {
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
    const tearPts: Point[] = [];
    for (let i = 0; i <= numSegs; i++) {
      const t = i / numSegs;
      const bx = t * cw;
      const by = leftY + (rightY - leftY) * t;
      const noise =
        (Math.random() - 0.5) * 50 * roughness +
        (Math.random() - 0.5) * 18 * roughness;
      tearPts.push({ x: bx, y: by + noise });
    }

    return [
      { x: 0, y: 0 },
      { x: cw, y: 0 },
      { x: cw, y: tearPts[tearPts.length - 1].y },
      ...tearPts.slice().reverse(),
      { x: 0, y: tearPts[0].y },
    ];
  };

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
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setGestureState('idle');
    setFingerA(null);
    setFingerB(null);
    setTearPolygon(null);
    ripSpeed.current = [];
    lastRipPos.current = null;
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

    if ((gestureState === 'idle' || gestureState === 'pending') && allTouches.length === 2) {
      // Two fingers — go straight to panning regardless of whether they arrived
      // simultaneously (idle→panning) or sequentially (pending→panning)
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      const t1 = allTouches[0];
      const t2 = allTouches[1];
      panRef.current = { dist: pinchDistance(t1, t2), mid: pinchMidpoint(t1, t2) };
      setFingerA(null);
      setGestureState('panning');

    } else if (gestureState === 'idle' && allTouches.length === 1) {
      const touch = changedTouches[0];
      setFingerA({ id: touch.identifier, pos: getTouchPos(touch) });
      setGestureState('pending');
      longPressTimer.current = setTimeout(() => {
        setGestureState('anchored');
        if (navigator.vibrate) navigator.vibrate(80);
      }, 400);

    } else if (gestureState === 'anchored' && allTouches.length === 2) {
      const newTouch = Array.from(changedTouches).find(t => t.identifier !== fingerA?.id);
      if (newTouch) {
        const pos = getTouchPos(newTouch);
        ripSpeed.current = [];
        lastRipTime.current = performance.now();
        lastRipPos.current = pos;
        setFingerB({ id: newTouch.identifier, pos, trail: [pos] });
        setGestureState('ripping');
      }

    } else if (gestureState === 'torn' && allTouches.length === 1) {
      const touch = changedTouches[0];
      setTearPolygon(null);
      setFingerB(null);
      setFingerA({ id: touch.identifier, pos: getTouchPos(touch) });
      setGestureState('pending');
      longPressTimer.current = setTimeout(() => {
        setGestureState('anchored');
        if (navigator.vibrate) navigator.vibrate(80);
      }, 400);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (gestureState === 'pending' && fingerA) {
      // Track finger drift during hold so the anchor ring appears at the actual finger position
      const touch = Array.from(e.touches).find(t => t.identifier === fingerA.id);
      if (touch) setFingerA(prev => prev ? { ...prev, pos: getTouchPos(touch) } : null);

    } else if (gestureState === 'panning' && e.touches.length === 2) {
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

    } else if (gestureState === 'ripping' && fingerB) {
      const touch = Array.from(e.touches).find(t => t.identifier === fingerB.id);
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
      setFingerB(prev => prev ? { ...prev, pos, trail: [...prev.trail, pos] } : null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const endedIds = new Set(Array.from(e.changedTouches).map(t => t.identifier));

    if (gestureState === 'pending' && fingerA && endedIds.has(fingerA.id)) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setFingerA(null);
      setGestureState('idle');

    } else if (gestureState === 'panning' && e.touches.length === 0) {
      setGestureState('idle');

    } else if (gestureState === 'anchored' && fingerA && endedIds.has(fingerA.id)) {
      setFingerA(null);
      setGestureState('idle');

    } else if (gestureState === 'ripping') {
      if (fingerA && endedIds.has(fingerA.id)) {
        setFingerA(null);
        setFingerB(null);
        setGestureState('idle');
      } else if (fingerB && endedIds.has(fingerB.id)) {
        const canvas = canvasRef.current;
        if (canvas && fingerB.trail.length >= 2) {
          const samples = ripSpeed.current;
          const avgSpeed =
            samples.length > 0
              ? samples.reduce((a, b) => a + b, 0) / samples.length
              : 0.5;
          // Linear map: 0.5 px/ms → roughness 0.3, 3.0 px/ms → roughness 2.0
          const roughness = Math.max(0.3, Math.min(2.0, 0.3 + (avgSpeed - 0.5) * 0.68));
          const polygon = generateTearPolygon(fingerB.trail, roughness, canvas.width, canvas.height);
          setTearPolygon(polygon);
          if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
        }
        setFingerB(null);
        setGestureState('torn');
      }
    }
  };

  const handleTouchCancel = (_e: React.TouchEvent) => {
    handleReset();
  };

  const canFinish = gestureState === 'torn' && tearPolygon !== null;

  const handleFinish = () => {
    if (tearPolygon) onCut(tearPolygon, true);
  };

  const hintText: Partial<Record<GestureState, string>> = {
    idle: 'Hold to anchor, swipe to tear',
    pending: 'Hold…',
    anchored: 'Now swipe to rip',
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:max-w-4xl flex flex-col gap-4 md:gap-6 p-4 md:p-0">

        {/* Header */}
        <div className="flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-serif italic">The Cutting Room</h2>
            {hintText[gestureState] && (
              <p className="text-[9px] md:text-sm text-white/40 uppercase tracking-widest">
                {hintText[gestureState]}
              </p>
            )}
          </div>
          <div className="flex gap-2 md:gap-4 items-center">
            <button
              onClick={handleReset}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={onCancel}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative flex-1 md:aspect-video bg-black rounded-2xl overflow-hidden cursor-crosshair shadow-2xl border border-white/10"
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
                <p className="text-5xl mb-4 text-white/20 select-none">〜</p>
                <p className="text-white/40 font-medium text-sm">Hold to anchor, swipe to tear</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex justify-center gap-4 shrink-0 pb-4 md:pb-0">
          <button
            disabled={!canFinish}
            onClick={handleFinish}
            className={`
              flex items-center gap-3 px-10 py-5 rounded-full font-bold transition-all active:scale-95
              ${canFinish
                ? 'bg-white text-black shadow-2xl'
                : 'bg-white/10 text-white/20 cursor-not-allowed'}
            `}
          >
            <Check size={24} />
            KEEP PIECE
          </button>
        </div>

      </div>
    </div>
  );
};
