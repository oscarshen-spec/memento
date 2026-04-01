import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { TapeStrip, Scrap, Point, JournalEntry, ScrapbookPage, ResidueMark } from '../types';
import type { GlueRect } from './GlueAnimation';
import { TapeLayer } from './TapeLayer';
import useImage from 'use-image';

// ─── ScrapItem ──────────────────────────────────────────────────────────────────

interface ScrapItemProps {
  scrap: Scrap;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<Scrap>) => void;
  onReturn: () => void;
  stageHeight: number;
  isGlueActive: boolean;
  isFalling: boolean;
  onFallDone: () => void;
  isBeingGlued: boolean;
  onGlueTap: (id: string, rect: GlueRect) => void;
  onPeel: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight, isGlueActive, isFalling, onFallDone, isBeingGlued, onGlueTap, onPeel }) => {
  const [image] = useImage(scrap.image);
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchBaseScale = useRef<number>(scrap.scale);
  const wasPinching = useRef(false);
  const lastDragPos = useRef<{ x: number; y: number; t: number } | null>(null);
  const velocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const baseRotation = useRef<number>(scrap.rotation);
  const activeTween = useRef<Konva.Tween | null>(null);
  const wobbleTween = useRef<Konva.Tween | null>(null);
  const isPointerDown = useRef(false);
  const [showSheen, setShowSheen] = useState(false);

  // Screen coords (fixed positioning) — used for GlueAnimation overlay.
  // Uses actual image dimensions × scale (not axis-aligned bounding box)
  // so the overlay card matches the scrap exactly.
  const getScreenRect = () => {
    const node = shapeRef.current;
    if (!node) return null;
    const stage = node.getStage();
    if (!stage) return null;
    const stageBR = stage.container().getBoundingClientRect();
    const w = image ? image.width * scrap.scale : 80;
    const h = image ? image.height * scrap.scale : 60;
    const cx = stageBR.left + node.x();
    const cy = stageBR.top + node.y();
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  };

  // Stage-relative coords — used for ResidueMark (Konva canvas space)
  const getStageRect = () => {
    const node = shapeRef.current;
    if (!node) return null;
    const cr = node.getClientRect();
    return { x: cr.x, y: cr.y, width: cr.width, height: cr.height };
  };

  const getPinchDistance = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: any) => {
    const touches: TouchList = e.evt.touches;
    if (touches.length === 2) {
      pinchStartDist.current = getPinchDistance(touches[0], touches[1]);
      pinchBaseScale.current = scrap.scale;
      wasPinching.current = true;
    }
  };

  const handleTouchMove = (e: any) => {
    const touches: TouchList = e.evt.touches;
    if (touches.length !== 2 || pinchStartDist.current === null) return;
    e.evt.preventDefault();
    const newDist = getPinchDistance(touches[0], touches[1]);
    const ratio = newDist / pinchStartDist.current;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchBaseScale.current * ratio));
    onChange({ scale: newScale });
  };

  const handleTouchEnd = (e: any) => {
    if (e.evt.touches.length < 2) {
      pinchStartDist.current = null;
    }
    if (isGlueActive) {
      isPointerDown.current = false;
      setShowSheen(false);
    }
    // Peel: pinch released on a glued scrap → return to loose + create residue
    if (wasPinching.current && scrap.isGlued && e.evt.touches.length === 0) {
      wasPinching.current = false;
      const rect = getStageRect();
      if (rect) onPeel(scrap.id, rect);
      return;
    }
  };

  const handleTap = () => {
    if (wasPinching.current) {
      wasPinching.current = false;
      return;
    }
    if (isGlueActive && !scrap.isGlued) {
      const rect = getScreenRect();
      if (rect) onGlueTap(scrap.id, { ...rect, rotation: scrap.rotation });
      return;
    }
    onSelect();
  };

  const handleDragStart = (e: any) => {
    const node = e.target;
    baseRotation.current = scrap.rotation;
    velocity.current = { vx: 0, vy: 0 };
    lastDragPos.current = { x: node.x(), y: node.y(), t: Date.now() };
    activeTween.current?.destroy();
    activeTween.current = null;
    node.setAttrs({
      scaleX: scrap.scale * 1.04,
      scaleY: scrap.scale * 1.04,
      shadowColor: 'rgba(0,0,0,0.55)',
      shadowBlur: 28,
      shadowOffsetY: 20,
      shadowOffsetX: 0,
    });
    navigator.vibrate?.(10);
  };

  const handleDragMove = (e: any) => {
    const node = e.target;
    const now = Date.now();
    const x = node.x();
    const y = node.y();

    if (lastDragPos.current) {
      const dt = now - lastDragPos.current.t;
      if (dt > 0) {
        velocity.current = {
          vx: (x - lastDragPos.current.x) / dt,
          vy: (y - lastDragPos.current.y) / dt,
        };
      }
    }
    lastDragPos.current = { x, y, t: now };

    const { vx, vy } = velocity.current;
    const clampedVx = Math.max(-40, Math.min(40, vx));
    const speed = Math.min(Math.sqrt(vx * vx + vy * vy), 40);

    node.setAttrs({
      shadowColor: 'rgba(0,0,0,0.55)',
      shadowBlur: 20 + speed * 0.6,
      shadowOffsetY: 16 + speed * 0.4,
      shadowOffsetX: clampedVx * 0.2,
      skewX: clampedVx * 0.012,
      rotation: baseRotation.current + clampedVx * 0.04,
    });
  };

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    return () => {
      activeTween.current?.destroy();
      wobbleTween.current?.destroy();
    };
  }, []);

  // Idle wobble while scrap is loose (not glued) — starts on placement
  useEffect(() => {
    if (scrap.isGlued || !shapeRef.current) {
      wobbleTween.current?.destroy();
      wobbleTween.current = null;
      if (shapeRef.current) shapeRef.current.rotation(scrap.rotation);
      return;
    }
    const node = shapeRef.current;
    const baseRot = scrap.rotation;
    const stagger = (scrap.id.charCodeAt(0) + scrap.id.charCodeAt(scrap.id.length - 1)) % 120;
    let cancelled = false;

    const doWobble = (dir: 1 | -1) => {
      if (cancelled || !shapeRef.current) return;
      wobbleTween.current?.destroy();
      wobbleTween.current = new Konva.Tween({
        node,
        duration: 0.42,
        easing: Konva.Easings.EaseInOut,
        rotation: baseRot + dir * 3,
        onFinish: () => doWobble(dir === 1 ? -1 : 1),
      });
      wobbleTween.current.play();
    };

    const t = setTimeout(() => doWobble(1), stagger * 10);
    return () => {
      cancelled = true;
      clearTimeout(t);
      wobbleTween.current?.destroy();
      wobbleTween.current = null;
      if (shapeRef.current) shapeRef.current.rotation(scrap.rotation);
    };
  }, [scrap.isGlued]);

  useEffect(() => {
    if (!scrap.isGlued || !shapeRef.current) return;
    activeTween.current?.destroy();
    activeTween.current = null;
    const node = shapeRef.current;
    const s = scrap.scale;
    // Squish down as the bottle presses, then spring flat
    node.to({
      scaleX: s * 1.07,
      scaleY: s * 0.88,
      shadowBlur: 1,
      shadowOffsetY: 1,
      duration: 0.07,
      easing: Konva.Easings.EaseIn,
      onFinish: () => {
        node.to({
          scaleX: s,
          scaleY: s,
          shadowBlur: 3,
          shadowOffsetY: 2,
          shadowOffsetX: 0,
          duration: 0.3,
          easing: Konva.Easings.EaseOut,
        });
      },
    });
  }, [scrap.isGlued]);

  useEffect(() => {
    if (!isFalling || !shapeRef.current) return;

    const node = shapeRef.current;
    const origX = node.x();
    const origY = node.y();
    const origRot = node.rotation();
    let shakeCount = 0;
    let cancelled = false;
    let currentTween: Konva.Tween | null = null;

    const doFall = () => {
      if (cancelled) return;
      const finalRot = origRot + (Math.random() * 56 - 28);
      currentTween = new Konva.Tween({
        node,
        duration: 0.55,
        easing: Konva.Easings.EaseIn,
        y: stageHeight + 250,
        rotation: finalRot,
        onFinish: () => { if (!cancelled) onFallDone(); },
      });
      currentTween.play();
    };

    const doShake = () => {
      if (cancelled) return;
      if (shakeCount >= 6) {
        doFall();
        return;
      }
      const dx = shakeCount % 2 === 0 ? 5 : -5;
      const dr = shakeCount % 2 === 0 ? 4 : -4;
      currentTween = new Konva.Tween({
        node,
        duration: 0.05,
        x: origX + dx,
        y: origY,
        rotation: origRot + dr,
        onFinish: () => { shakeCount++; doShake(); },
      });
      currentTween.play();
    };

    const delay = Math.random() * 150;
    const timer = setTimeout(doShake, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      currentTween?.destroy();
    };
  }, [isFalling]);

  const drawJaggedPath = (ctx: any, points: Point[], jitterMultiplier = 1) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const jitter = dist * 0.05 * jitterMultiplier;

      ctx.lineTo(
        midX + (Math.random() - 0.5) * jitter,
        midY + (Math.random() - 0.5) * jitter,
      );
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.closePath();
  };

  const isRect = scrap.points.length === 0;


  return (
    <>
      <Group
        visible={!isBeingGlued}
        draggable={!scrap.isGlued && !isGlueActive}
        x={scrap.x}
        y={scrap.y}
        offsetX={image ? image.width / 2 : 0}
        offsetY={image ? image.height / 2 : 0}
        rotation={scrap.rotation}
        scaleX={scrap.scale}
        scaleY={scrap.scale}
        shadowColor={scrap.isGlued ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.35)'}
        shadowBlur={scrap.isGlued ? 3 : 4}
        shadowOffsetX={0}
        shadowOffsetY={scrap.isGlued ? 2 : 3}
        onClick={() => {
          if (isGlueActive && !scrap.isGlued) {
            const rect = getScreenRect();
            if (rect) onGlueTap(scrap.id, { ...rect, rotation: scrap.rotation });
            return;
          }
          onSelect();
        }}
        onTap={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => { handleTouchMove(e); }}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => { isPointerDown.current = true; }}
        onMouseUp={() => { isPointerDown.current = false; setShowSheen(false); }}
        onMouseMove={() => {}}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          const node = e.target;
          const y = node.y();

          if (y > stageHeight) {
            node.setAttrs({
              scaleX: scrap.scale,
              scaleY: scrap.scale,
              shadowColor: 'rgba(0,0,0,0.35)',
              shadowBlur: 4,
              shadowOffsetY: 3,
              shadowOffsetX: 0,
              skewX: 0,
              rotation: baseRotation.current,
            });
            onReturn();
            return;
          }

          activeTween.current?.destroy();

          const tween = new Konva.Tween({
            node,
            duration: 0.5,
            easing: Konva.Easings.ElasticEaseOut,
            scaleX: scrap.scale,
            scaleY: scrap.scale,
            shadowColor: 'rgba(0,0,0,0.35)',
            shadowBlur: 4,
            shadowOffsetY: 3,
            shadowOffsetX: 0,
            skewX: 0,
            rotation: baseRotation.current,
            onFinish: () => {
              onChange({ x: node.x(), y: node.y(), rotation: baseRotation.current });
              activeTween.current = null;
            },
          });

          tween.play();
          activeTween.current = tween;
          navigator.vibrate?.(30);
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          onChange({
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scale: scaleX,
          });
        }}
        ref={shapeRef}
      >
        {isRect ? (
          <>
            {image && (
              <KonvaImage
                image={image}
                width={image.width}
                height={image.height}
              />
            )}
          </>
        ) : (
          <>
            <Group
              clipFunc={(ctx) => {
                drawJaggedPath(ctx, scrap.points, 1);
              }}
            >
              {image && (
                <KonvaImage
                  image={image}
                  width={image.width}
                  height={image.height}
                />
              )}
            </Group>

            <Shape
              sceneFunc={(ctx, shape) => {
                drawJaggedPath(ctx, scrap.points, scrap.isTorn ? 2.5 : 1);
                ctx.fillStrokeShape(shape);
              }}
              stroke="white"
              strokeWidth={scrap.isTorn ? 4.5 : 1}
              opacity={scrap.isTorn ? 0.7 : 0.3}
              listening={false}
            />

          </>
        )}
        {showSheen && image && (
          <Rect
            x={0}
            y={0}
            width={isRect ? image.width : Math.max(...scrap.points.map(p => p.x))}
            height={isRect ? image.height : Math.max(...scrap.points.map(p => p.y))}
            fill="rgba(255,255,255,0.38)"
            listening={false}
          />
        )}
      </Group>

      {isSelected && !scrap.isGlued && (
        <Transformer
          ref={trRef}
          anchorSize={24}
          anchorCornerRadius={12}
          anchorStroke="#1a1a1a"
          anchorFill="white"
          borderStroke="#1a1a1a"
          borderDash={[4, 4]}
          rotateAnchorOffset={40}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

/** Draw a torn-edge rectangle for paper scrap backgrounds. */
const drawTornPaper = (ctx: Konva.Context, shape: Konva.Shape) => {
  const w = shape.width();
  const h = shape.height();
  const seed = shape.id()?.split('').reduce((a, c) => a + c.charCodeAt(0), 0) ?? 42;
  const jag = (i: number) => Math.sin(seed + i * 2.7) * 1.5;

  ctx.beginPath();
  // Top edge (jagged)
  const topSteps = 8;
  for (let i = 0; i <= topSteps; i++) {
    const px = (i / topSteps) * w;
    const py = jag(i);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  // Right edge
  const rightSteps = 6;
  for (let i = 0; i <= rightSteps; i++) {
    ctx.lineTo(w + jag(i + 20), (i / rightSteps) * h);
  }
  // Bottom edge (jagged)
  for (let i = topSteps; i >= 0; i--) {
    ctx.lineTo((i / topSteps) * w, h + jag(i + 40));
  }
  // Left edge
  for (let i = rightSteps - 1; i >= 0; i--) {
    ctx.lineTo(jag(i + 60), (i / rightSteps) * h);
  }
  ctx.closePath();
  ctx.fillStrokeShape(shape);
};

// ─── TextItem ────────────────────────────────────────────────────────────────────

interface TextItemProps {
  entry: JournalEntry;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<JournalEntry>) => void;
}

const TextItem: React.FC<TextItemProps> = ({ entry, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const groupRef = useRef<any>(null);

  useEffect(() => {
    const targetRef = entry.hasPaperBackground ? groupRef : shapeRef;
    if (isSelected && trRef.current && targetRef.current) {
      trRef.current.nodes([targetRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, entry.hasPaperBackground]);

  const padding = 4;

  // Estimate paper dimensions from text content
  const longestLine = entry.text.split('\n').reduce((a, l) => (l.length > a.length ? l : a), '');
  const textWidth = entry.fontSize * longestLine.length * 0.55;
  const lineCount = entry.text.split('\n').length;
  const textHeight = entry.text.length > 0 ? entry.fontSize * 1.5 * lineCount : entry.fontSize;
  const paperWidth = Math.max(120, textWidth + padding * 2);
  const paperHeight = textHeight + padding * 2;

  if (entry.hasPaperBackground) {
    return (
      <>
        <Group
          ref={groupRef}
          x={entry.x}
          y={entry.y}
          rotation={entry.rotation}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => {
            onChange({ x: e.target.x(), y: e.target.y() });
          }}
          onTransformEnd={() => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            onChange({
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              fontSize: entry.fontSize * scaleX,
            });
            node.scaleX(1);
            node.scaleY(1);
          }}
        >
          <Shape
            id={entry.id}
            width={paperWidth}
            height={paperHeight}
            fill="#fffbe2"
            shadowColor="rgba(0,0,0,0.18)"
            shadowBlur={8}
            shadowOffsetX={2}
            shadowOffsetY={3}
            sceneFunc={drawTornPaper}
          />
          <Text
            text={entry.text}
            x={padding}
            y={padding}
            width={paperWidth - padding * 2}
            fontSize={entry.fontSize}
            fontFamily="Caveat"
            fill={entry.color ?? '#3a2a1a'}
            align="center"
            lineHeight={1.5}
          />
        </Group>
        {isSelected && (
          <Transformer
            ref={trRef}
            anchorSize={24}
            anchorCornerRadius={12}
            anchorStroke="#1a1a1a"
            anchorFill="white"
            borderStroke="#1a1a1a"
            borderDash={[4, 4]}
            rotateAnchorOffset={40}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) return oldBox;
              return newBox;
            }}
          />
        )}
      </>
    );
  }

  // Original plain text rendering (backward compatible)
  return (
    <>
      <Text
        ref={shapeRef}
        text={entry.text}
        x={entry.x}
        y={entry.y}
        rotation={entry.rotation}
        fontSize={entry.fontSize}
        fontFamily={entry.fontFamily ?? (entry.type === 'title' ? 'Cormorant Garamond' : 'Nunito')}
        fontStyle={
          entry.fontFamily
            ? entry.fontFamily === 'Cormorant Garamond'
              ? 'italic bold'
              : 'normal'
            : entry.type === 'title'
              ? 'italic bold'
              : 'normal'
        }
        fill={entry.color ?? '#1a1a1a'}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({ x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange({
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: node.fontSize() * node.scaleX(),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          anchorSize={24}
          anchorCornerRadius={12}
          anchorStroke="#1a1a1a"
          anchorFill="white"
          borderStroke="#1a1a1a"
          borderDash={[4, 4]}
          rotateAnchorOffset={40}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

// ─── LinedPaper ──────────────────────────────────────────────────────────────────

const LinedPaper: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const lineSpacing = 28;
  const lines: React.ReactElement[] = [];

  for (let y = lineSpacing; y < height; y += lineSpacing) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="#ccc5b5"
        strokeWidth={0.8}
        listening={false}
      />
    );
  }

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#fefcf5"
        listening={false}
      />
      {lines}
      <Line
        points={[0, 34, width, 34]}
        stroke="#ccc5b5"
        strokeWidth={1.5}
        opacity={0.5}
        listening={false}
      />
      <Line
        points={[44, 0, 44, height]}
        stroke="#e8a0a0"
        strokeWidth={1}
        opacity={0.55}
        listening={false}
      />
    </>
  );
};

// ─── Scrapbook ───────────────────────────────────────────────────────────────────

interface ScrapbookProps {
  page: ScrapbookPage;
  onUpdateScrap: (id: string, attrs: Partial<Scrap>) => void;
  onUpdateEntry: (id: string, attrs: Partial<JournalEntry>) => void;
  onReturnScrap: (scrap: Scrap) => void;
  onAddTapeStrip: (strip: TapeStrip) => void;
  isTapeActive: boolean;
  isGlueActive: boolean;
  fallingScrapIds: string[] | null;
  onFallComplete: (ids: string[]) => void;
  dimensions: { width: number; height: number };
  selectedScrapId: string | null;
  onSelectScrap: (id: string | null) => void;
  gluingScrapId: string | null;
  onGlueTap: (id: string, rect: GlueRect) => void;
  onPeel: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
}

const DRAG_OVERFLOW = 180;


export const Scrapbook = React.forwardRef<Konva.Stage, ScrapbookProps>(({
  page,
  onUpdateScrap,
  onUpdateEntry,
  onReturnScrap,
  onAddTapeStrip,
  isTapeActive,
  isGlueActive,
  fallingScrapIds,
  onFallComplete,
  dimensions,
  selectedScrapId,
  onSelectScrap,
  gluingScrapId,
  onGlueTap,
  onPeel,
}, ref) => {
  const selectedId = selectedScrapId;
  const setSelectedId = onSelectScrap;
  const fallsDoneCount = useRef(0);

  useEffect(() => {
    if (fallingScrapIds !== null) {
      fallsDoneCount.current = 0;
    }
  }, [fallingScrapIds]);

  const checkDeselect = (e: any) => {
    if (isTapeActive) return;
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);
  };

  return (
    <div className="w-full h-full">
      <Stage
        ref={ref}
        width={dimensions.width}
        height={dimensions.height + DRAG_OVERFLOW}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
        {/* Layer 0: lined paper background + residue marks */}
        <Layer listening={false}>
          <LinedPaper width={dimensions.width} height={dimensions.height + DRAG_OVERFLOW} />
          {(page.residueMarks ?? []).map((mark: ResidueMark) => (
            <Rect
              key={mark.id}
              x={mark.x}
              y={mark.y}
              width={mark.width}
              height={mark.height}
              rotation={mark.rotation}
              fillRadialGradientStartPoint={{ x: mark.width * 0.5, y: mark.height * 0.5 }}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndPoint={{ x: mark.width * 0.5, y: mark.height * 0.5 }}
              fillRadialGradientEndRadius={Math.max(mark.width, mark.height) * 0.65}
              fillRadialGradientColorStops={[0, 'rgba(190,155,90,0.22)', 1, 'rgba(180,140,80,0)']}
              listening={false}
            />
          ))}
        </Layer>

        {/* Layer 1: scraps and journal entries */}
        <Layer listening={!isTapeActive}>
          {[...page.scraps].sort((a, b) => a.zIndex - b.zIndex).map((scrap) => (
            <ScrapItem
              key={scrap.id}
              scrap={scrap}
              isSelected={scrap.id === selectedId}
              onSelect={() => { if (!isGlueActive) setSelectedId(scrap.id); }}
              onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
              onReturn={() => onReturnScrap(scrap)}
              stageHeight={dimensions.height}
              isGlueActive={isGlueActive}
              isFalling={fallingScrapIds?.includes(scrap.id) ?? false}
              isBeingGlued={scrap.id === gluingScrapId}
              onFallDone={() => {
                if (!fallingScrapIds) return;
                fallsDoneCount.current += 1;
                if (fallsDoneCount.current >= fallingScrapIds.length) {
                  fallsDoneCount.current = 0;
                  onFallComplete(fallingScrapIds);
                }
              }}
              onGlueTap={onGlueTap}
              onPeel={onPeel}
            />
          ))}
          {page.journalEntries.map((entry) => (
            <TextItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedId}
              onSelect={() => setSelectedId(entry.id)}
              onChange={(newAttrs) => onUpdateEntry(entry.id, newAttrs)}
            />
          ))}
        </Layer>

        {/* Layer 2: tape */}
        <TapeLayer
          isActive={isTapeActive}
          strips={page.tapeStrips}
          onStripAdded={onAddTapeStrip}
          stageWidth={dimensions.width}
          stageHeight={dimensions.height + DRAG_OVERFLOW}
        />
      </Stage>
    </div>
  );
});
