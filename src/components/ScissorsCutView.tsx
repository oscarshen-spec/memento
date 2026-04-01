import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Point } from '../types';
import { playSound } from '../services/soundService';

interface ScissorsCutViewProps {
  image: string;
  onCut: (insideImage: string, insidePoints: Point[], outsideImage: string) => void;
  onCancel: () => void;
}

interface LassoPoint {
  x: number;
  y: number;
  jitter: number; // velocity-based jitter for this point
}

/** Add perpendicular noise to each path segment based on per-point jitter. */
function jaggedPath(points: LassoPoint[], sx: number, sy: number): Point[] {
  const scale = Math.max(sx, sy);
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const scaledJitter = curr.jitter * scale;
    const offset = (Math.random() - 0.5) * 2 * scaledJitter;
    result.push({ x: curr.x + nx * offset, y: curr.y + ny * offset });
  }
  return result;
}

export const ScissorsCutView: React.FC<ScissorsCutViewProps> = ({ image, onCut, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const lassoPoints = useRef<LassoPoint[]>([]);
  const isDrawing = useRef(false);
  const velocitySamples = useRef<{ time: number; x: number; y: number }[]>([]);
  const pointCount = useRef(0);
  const animFrameId = useRef<number>(0);

  // Load the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = image;
  }, [image]);

  // Calculate how the image fits in the canvas (aspect-fit with padding)
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

    return {
      x: (canvas.width - w) / 2,
      y: (canvas.height - h) / 2,
      width: w,
      height: h,
    };
  }, []);

  // Draw the canvas: image + lasso path
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const rect = getImageDisplayRect();
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);

    const points = lassoPoints.current;
    if (points.length < 2) return;

    // Draw lasso path
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // Start point indicator
    const start = points[0];
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.fill();

    // Snap ring when near start
    const last = points[points.length - 1];
    const distToStart = Math.hypot(last.x - start.x, last.y - start.y);
    if (distToStart <= 20 && points.length > 5) {
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(start.x, start.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Scissors emoji at current tip
    if (isDrawing.current && points.length > 0) {
      const tip = points[points.length - 1];
      ctx.save();
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2702\uFE0F', tip.x + 12, tip.y - 12);
      ctx.restore();
    }
  }, [getImageDisplayRect]);

  // Resize canvas to fill container
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

  // --- TASK 3: Touch event handlers ---

  const getCanvasPoint = (touch: React.Touch): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const computeJitter = (): number => {
    const samples = velocitySamples.current;
    if (samples.length < 2) return 0.5;
    let totalSpeed = 0;
    for (let i = 1; i < samples.length; i++) {
      const dx = samples[i].x - samples[i - 1].x;
      const dy = samples[i].y - samples[i - 1].y;
      const dt = samples[i].time - samples[i - 1].time;
      if (dt > 0) totalSpeed += Math.hypot(dx, dy) / dt;
    }
    const avgSpeed = totalSpeed / (samples.length - 1);
    return Math.max(0.5, Math.min(4.0, 0.5 + (avgSpeed - 0.3) * 2.5));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const pt = getCanvasPoint(e.touches[0]);
    lassoPoints.current = [{ ...pt, jitter: 0.5 }];
    velocitySamples.current = [{ time: Date.now(), ...pt }];
    pointCount.current = 0;
    isDrawing.current = true;
    draw();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing.current || e.touches.length !== 1) return;
    const pt = getCanvasPoint(e.touches[0]);
    const points = lassoPoints.current;
    const last = points[points.length - 1];

    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3) return;

    const now = Date.now();
    velocitySamples.current.push({ time: now, ...pt });
    if (velocitySamples.current.length > 10) velocitySamples.current.shift();

    const jitter = computeJitter();
    points.push({ ...pt, jitter });

    pointCount.current++;
    if (pointCount.current % 15 === 0) {
      navigator.vibrate?.(5);
      playSound('scissorTrace');
    }

    cancelAnimationFrame(animFrameId.current);
    animFrameId.current = requestAnimationFrame(draw);
  };

  const handleTouchEnd = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const points = lassoPoints.current;
    if (points.length <= 5) {
      lassoPoints.current = [];
      draw();
      return;
    }

    const start = points[0];
    const end = points[points.length - 1];
    const distToStart = Math.hypot(end.x - start.x, end.y - start.y);

    if (distToStart > 20) {
      points.push({ ...start, jitter: points[points.length - 1].jitter });
    }

    navigator.vibrate?.(30);
    playSound('scissorSnip');

    applyCut(points);
  };

  // --- TASK 4: Image clipping ---

  const applyCut = (points: LassoPoint[]) => {
    const img = imgRef.current;
    if (!img) return;

    const displayRect = getImageDisplayRect();
    if (displayRect.width === 0) return;

    const sx = img.naturalWidth / displayRect.width;
    const sy = img.naturalHeight / displayRect.height;

    const imageSpacePoints: LassoPoint[] = points.map(p => ({
      x: (p.x - displayRect.x) * sx,
      y: (p.y - displayRect.y) * sy,
      jitter: p.jitter,
    }));

    const jagged = jaggedPath(imageSpacePoints, sx, sy);

    // Inside piece (stays on canvas)
    const insideCanvas = document.createElement('canvas');
    insideCanvas.width = img.naturalWidth;
    insideCanvas.height = img.naturalHeight;
    const ictx = insideCanvas.getContext('2d')!;
    ictx.beginPath();
    jagged.forEach((p, i) => (i === 0 ? ictx.moveTo(p.x, p.y) : ictx.lineTo(p.x, p.y)));
    ictx.closePath();
    ictx.clip();
    ictx.drawImage(img, 0, 0);
    const insideImage = insideCanvas.toDataURL('image/png');

    // Outside piece (returns to drawer)
    const outsideCanvas = document.createElement('canvas');
    outsideCanvas.width = img.naturalWidth;
    outsideCanvas.height = img.naturalHeight;
    const octx = outsideCanvas.getContext('2d')!;
    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'destination-out';
    octx.beginPath();
    jagged.forEach((p, i) => (i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)));
    octx.closePath();
    octx.fill();
    const outsideImage = outsideCanvas.toDataURL('image/png');

    lassoPoints.current = [];
    onCut(insideImage, jagged, outsideImage);
  };

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
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        ✕
      </button>

      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-sm"
        style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}
      >
        Trace around what you want to keep
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </motion.div>
  );
};
