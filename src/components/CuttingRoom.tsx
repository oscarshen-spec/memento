import React, { useState, useRef, useEffect } from 'react';
import { Scissors, RotateCcw, Check, X, RefreshCw } from 'lucide-react';
import { Point } from '../types';

interface CuttingRoomProps {
  image: string;
  onCut: (points: Point[], isTorn?: boolean) => void;
  onCancel: () => void;
}

export const CuttingRoom: React.FC<CuttingRoomProps> = ({ image, onCut, onCancel }) => {
  const [mode, setMode] = useState<'cut' | 'tear'>('cut');

  // Cut mode state
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Tear mode state
  const [tearStart, setTearStart] = useState<Point | null>(null);
  const [tearEnd, setTearEnd] = useState<Point | null>(null);
  const [tearPolygon, setTearPolygon] = useState<Point[] | null>(null);
  const [isDraggingTear, setIsDraggingTear] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    const img = new Image();
    img.src = image;

    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    if (mode === 'cut') {
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
      }
    } else {
      if (isDraggingTear && tearStart && tearEnd) {
        // Live drag: show extended dashed tear line across full canvas
        const dx = tearEnd.x - tearStart.x;
        const dy = tearEnd.y - tearStart.y;
        let lx = 0, ly: number, rx = canvas.width, ry: number;
        if (Math.abs(dx) < 5) {
          ly = (tearStart.y + tearEnd.y) / 2;
          ry = ly;
        } else {
          const slope = dy / dx;
          ly = tearStart.y - slope * tearStart.x;
          ry = tearStart.y + slope * (canvas.width - tearStart.x);
        }
        ly = Math.max(0, Math.min(canvas.height, ly));
        ry = Math.max(0, Math.min(canvas.height, ry));

        // Shade kept area
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width, 0);
        ctx.lineTo(rx, ry);
        ctx.lineTo(lx, ly);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();

        // Tear line
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

      } else if (tearPolygon) {
        // Finalized torn polygon
        ctx.beginPath();
        tearPolygon.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.stroke();
      }
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
  }, [image, points, tearPolygon, mode, tearStart, tearEnd, isDraggingTear]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    if (mode === 'cut') {
      setIsDrawing(true);
      setPoints([pos]);
    } else {
      setIsDraggingTear(true);
      setTearStart(pos);
      setTearEnd(pos);
      setTearPolygon(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    if (mode === 'cut') {
      if (!isDrawing) return;
      setPoints(prev => [...prev, pos]);
    } else {
      if (!isDraggingTear) return;
      setTearEnd(pos);
    }
    draw();
  };

  const handleMouseUp = () => {
    if (mode === 'cut') {
      setIsDrawing(false);
    } else {
      setIsDraggingTear(false);
      const canvas = canvasRef.current;
      if (canvas && tearStart && tearEnd) {
        const polygon = generateTearPolygon(tearStart, tearEnd, canvas.width, canvas.height);
        setTearPolygon(polygon);
      }
    }
  };

  const handleReset = () => {
    setPoints([]);
    setTearStart(null);
    setTearEnd(null);
    setTearPolygon(null);
    setIsDraggingTear(false);
  };

  const handleRetear = () => {
    const canvas = canvasRef.current;
    if (canvas && tearStart && tearEnd) {
      const polygon = generateTearPolygon(tearStart, tearEnd, canvas.width, canvas.height);
      setTearPolygon(polygon);
    }
  };

  const canFinish = mode === 'cut' ? points.length >= 3 : tearPolygon !== null;

  const handleFinish = () => {
    if (mode === 'cut') {
      onCut(points, false);
    } else if (tearPolygon) {
      onCut(tearPolygon, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:max-w-4xl flex flex-col gap-4 md:gap-6 p-4 md:p-0">
        <div className="flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-serif italic">The Cutting Room</h2>
            <p className="text-[9px] md:text-sm text-white/40 uppercase tracking-widest">
              {mode === 'cut' ? 'Draw a path to cut' : 'Drag across to tear'}
            </p>
          </div>
          <div className="flex gap-2 md:gap-4 items-center">
            {/* Mode Toggle */}
            <div className="flex rounded-full overflow-hidden border border-white/20">
              <button
                onClick={() => { setMode('cut'); handleReset(); }}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-2 ${
                  mode === 'cut' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                <Scissors size={13} />
                Cut
              </button>
              <button
                onClick={() => { setMode('tear'); handleReset(); }}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                  mode === 'tear' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                Tear
              </button>
            </div>
            <button onClick={handleReset} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95">
              <RotateCcw size={20} />
            </button>
            <button onClick={onCancel} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95">
              <X size={20} />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 md:aspect-video bg-black rounded-2xl overflow-hidden cursor-crosshair shadow-2xl border border-white/10"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <canvas ref={canvasRef} className="w-full h-full" />

          {mode === 'cut' && points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Scissors className="mx-auto mb-4 text-white/20" size={48} />
                <p className="text-white/40 font-medium text-sm">Draw a path to cut</p>
              </div>
            </div>
          )}

          {mode === 'tear' && !tearStart && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-5xl mb-4 text-white/20 select-none">〜</p>
                <p className="text-white/40 font-medium text-sm">Drag across to tear</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4 shrink-0 pb-4 md:pb-0">
          {mode === 'tear' && tearPolygon && (
            <button
              onClick={handleRetear}
              className="flex items-center gap-2 px-6 py-4 rounded-full font-bold transition-all active:scale-95 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw size={18} />
              RETEAR
            </button>
          )}
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
            {mode === 'cut' ? 'FINISH CUT' : 'KEEP PIECE'}
          </button>
        </div>
      </div>
    </div>
  );
};
