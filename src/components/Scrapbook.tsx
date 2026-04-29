import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { TapeStrip, Scrap, Point, JournalEntry, ScrapbookPage, ResidueMark, Envelope } from '../types';
import type { GlueRect } from './GlueAnimation';
import { TapeLayer } from './TapeLayer';
import useImage from 'use-image';

// ─── Seeded PRNG helpers ─────────────────────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function hashPoints(points: Point[]): number {
  let h = 2166136261;
  for (const p of points) {
    h = Math.imul(h ^ ((p.x * 100) | 0), 16777619);
    h = Math.imul(h ^ ((p.y * 100) | 0), 16777619);
  }
  return h >>> 0;
}

function drawJaggedPath(ctx: any, points: Point[], rand: () => number, jitterMultiplier = 1) {
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
      midX + (rand() - 0.5) * jitter,
      midY + (rand() - 0.5) * jitter,
    );
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.closePath();
}

function drawTornEdge(ctx: any, points: Point[], rand: () => number, amplitude: number) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) { ctx.lineTo(p2.x, p2.y); continue; }
    const nx = -dy / len;
    const ny =  dx / len;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const disp = (rand() - 0.5) * amplitude;
    ctx.quadraticCurveTo(
      midX + nx * disp,
      midY + ny * disp,
      p2.x, p2.y,
    );
  }
  // Open path — no closePath, so only the tear line is stroked
}

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

  const pointSeed = React.useMemo(() => hashPoints(scrap.points), [scrap.points]);
  const tornSeed = React.useMemo(() => scrap.tornEdge ? hashPoints(scrap.tornEdge) : 0, [scrap.tornEdge]);

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
                drawJaggedPath(ctx, scrap.points, seededRand(pointSeed), 1);
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

            {scrap.isTorn && scrap.tornEdge ? (
              <>
                {/* Dark shadow pass — depth/lift */}
                <Shape
                  sceneFunc={(ctx, shape) => {
                    drawTornEdge(ctx, scrap.tornEdge!, seededRand(tornSeed), 10);
                    ctx.fillStrokeShape(shape);
                  }}
                  stroke="rgba(0,0,0,0.22)"
                  strokeWidth={8}
                  listening={false}
                />
                {/* Mid warm-white pass — paper body */}
                <Shape
                  sceneFunc={(ctx, shape) => {
                    drawTornEdge(ctx, scrap.tornEdge!, seededRand(tornSeed), 8);
                    ctx.fillStrokeShape(shape);
                  }}
                  stroke="rgba(245,238,220,0.92)"
                  strokeWidth={5}
                  listening={false}
                />
                {/* Fine bright fiber pass — highlight */}
                <Shape
                  sceneFunc={(ctx, shape) => {
                    drawTornEdge(ctx, scrap.tornEdge!, seededRand(tornSeed), 5);
                    ctx.fillStrokeShape(shape);
                  }}
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={2}
                  listening={false}
                />
              </>
            ) : (
              <Shape
                sceneFunc={(ctx, shape) => {
                  drawJaggedPath(ctx, scrap.points, seededRand(pointSeed), 1);
                  ctx.fillStrokeShape(shape);
                }}
                stroke="white"
                strokeWidth={1}
                opacity={0.3}
                listening={false}
              />
            )}

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
  const paperWidth = entry.paperWidthOverride ?? Math.max(120, textWidth + padding * 2);
  const paperHeight = entry.paperHeightOverride ?? (textHeight + padding * 2);

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
            const scaleY = node.scaleY();
            onChange({
              x: node.x(),
              y: node.y(),
              rotation: node.rotation(),
              fontSize: entry.fontSize * scaleX,
              paperWidthOverride: paperWidth * scaleX,
              paperHeightOverride: paperHeight * scaleY,
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
            fontFamily="IM Fell English"
            fontStyle="italic"
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
  const [paperImage] = useImage('/Final Process.png');

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
      {paperImage && (
        <KonvaImage
          image={paperImage}
          x={0}
          y={0}
          width={width}
          height={height}
          listening={false}
        />
      )}
    </>
  );
};

// ─── Envelope ────────────────────────────────────────────────────────────────────

const ENV_W = 200;
const ENV_H = 130;
const FLAP_H = 55;
const ENV_PADDING = 8;

const ENVELOPE_STYLES = {
  cream: { body: '#f2ead8', flap: '#e8dfc4', interior: '#faf6ea', line: '#c8b890' },
  kraft: { body: '#c4864a', flap: '#a86830', interior: '#d4986a', line: '#7a4810' },
  pink:  { body: '#f2cdd0', flap: '#e8bec2', interior: '#fce8ea', line: '#c8a0a4' },
} as const;

// Axis-aligned bounding box check (ignores rotation, good enough for tuck detection)
export function hitTestEnvelope(x: number, y: number, env: Envelope): boolean {
  const halfW = (ENV_W * env.scale) / 2;
  const halfH = (ENV_H * env.scale) / 2;
  return x >= env.x - halfW && x <= env.x + halfW && y >= env.y - halfH && y <= env.y + halfH;
}

// ─── TuckedScrapItem ─────────────────────────────────────────────────────────────

interface TuckedScrapItemProps {
  scrap: Scrap;
  envelopeId: string;
  onUntuck: (envelopeId: string, scrap: Scrap, stageX: number, stageY: number) => void;
  onMove: (newX: number, newY: number) => void;
}

const TuckedScrapItem: React.FC<TuckedScrapItemProps> = ({ scrap, envelopeId, onUntuck, onMove }) => {
  const [image] = useImage(scrap.image);
  const nodeRef = useRef<any>(null);
  const interiorH = ENV_H - FLAP_H;

  return (
    <Group
      ref={nodeRef}
      x={scrap.x}
      y={scrap.y}
      offsetX={image ? image.width / 2 : 0}
      offsetY={image ? image.height / 2 : 0}
      scaleX={scrap.scale}
      scaleY={scrap.scale}
      rotation={scrap.rotation}
      draggable
      onClick={(e) => { e.cancelBubble = true; }}
      onTap={(e) => { e.cancelBubble = true; }}
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const node = e.target;
        const lx = node.x();
        const ly = node.y();
        const margin = 30;
        if (lx < -margin || lx > ENV_W + margin || ly < -margin || ly > interiorH + margin) {
          const abs = node.getAbsolutePosition();
          onUntuck(envelopeId, scrap, abs.x, abs.y);
        } else {
          onMove(lx, ly);
        }
      }}
      shadowColor="rgba(0,0,0,0.25)"
      shadowBlur={4}
      shadowOffsetY={2}
    >
      {image && <KonvaImage image={image} width={image.width} height={image.height} />}
    </Group>
  );
};

// ─── EnvelopeItem ────────────────────────────────────────────────────────────────

interface EnvelopeItemProps {
  envelope: Envelope;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<Envelope>) => void;
  onUntuckScrap: (envelopeId: string, scrap: Scrap, stageX: number, stageY: number) => void;
  onUpdateEnvelope: (id: string, attrs: Partial<Envelope>) => void;
}

const EnvelopeItem: React.FC<EnvelopeItemProps> = ({
  envelope, isSelected, onSelect, onChange, onUntuckScrap, onUpdateEnvelope,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const flapGroupRef = useRef<any>(null);
  const flapShadowRef = useRef<any>(null);
  const wasDragging = useRef(false);

  const colors = ENVELOPE_STYLES[envelope.style];

  // Edge jitter for imperfect paper look, seeded from envelope id
  const jitter = React.useMemo(() => {
    const seed = envelope.id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 17);
    const r = seededRand(seed >>> 0);
    return Array.from({ length: 16 }, () => (r() - 0.5) * 1.6);
  }, [envelope.id]);

  // Initialize flap to correct visual state on mount (no animation)
  useEffect(() => {
    if (!flapGroupRef.current) return;
    flapGroupRef.current.scaleY(envelope.isOpen ? 0.001 : 1);
    flapGroupRef.current.shadowBlur(envelope.isOpen ? 0 : 5);
    flapGroupRef.current.shadowOffsetY(envelope.isOpen ? 0 : 4);
    flapGroupRef.current.shadowOpacity(envelope.isOpen ? 0 : 0.25);
    if (flapShadowRef.current) flapShadowRef.current.opacity(envelope.isOpen ? 0 : 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate flap when isOpen changes
  useEffect(() => {
    if (!flapGroupRef.current) return;
    flapGroupRef.current.to({
      duration: 0.28,
      easing: Konva.Easings.EaseInOut,
      scaleY: envelope.isOpen ? 0.001 : 1,
      shadowBlur: envelope.isOpen ? 0 : 5,
      shadowOffsetY: envelope.isOpen ? 0 : 4,
      shadowOpacity: envelope.isOpen ? 0 : 0.25,
    });
    if (flapShadowRef.current) {
      flapShadowRef.current.to({
        duration: 0.28,
        easing: Konva.Easings.EaseInOut,
        opacity: envelope.isOpen ? 0 : 1,
      });
    }
  }, [envelope.isOpen]);

  // Sync transformer
  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const handleTap = () => {
    if (wasDragging.current) { wasDragging.current = false; return; }
    onSelect();
    onUpdateEnvelope(envelope.id, { isOpen: !envelope.isOpen });
  };

  const hasContents = envelope.contents.length > 0;

  return (
    <>
      <Group
        ref={groupRef}
        x={envelope.x}
        y={envelope.y}
        offsetX={ENV_W / 2}
        offsetY={ENV_H / 2}
        rotation={envelope.rotation}
        scaleX={envelope.scale}
        scaleY={envelope.scale}
        draggable
        onClick={handleTap}
        onTap={handleTap}
        onDragStart={() => { wasDragging.current = false; }}
        onDragMove={() => { wasDragging.current = true; }}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({ x: node.x(), y: node.y() });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          onChange({ x: node.x(), y: node.y(), rotation: node.rotation(), scale: node.scaleX() });
          node.scaleX(node.scaleX()); // keep uniform
          node.scaleY(node.scaleX());
        }}
        // Slightly deeper shadow when closed with hidden contents (privacy cue)
        shadowColor="rgba(0,0,0,0.35)"
        shadowBlur={!envelope.isOpen && hasContents ? 14 : 8}
        shadowOffsetY={!envelope.isOpen && hasContents ? 7 : 4}
        shadowOpacity={0.35}
      >
        {/* Envelope body */}
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(jitter[0], jitter[1]);
            ctx.lineTo(ENV_W + jitter[2], jitter[3]);
            ctx.lineTo(ENV_W + jitter[4], ENV_H + jitter[5]);
            ctx.lineTo(jitter[6], ENV_H + jitter[7]);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          fill={colors.body}
          stroke={colors.line}
          strokeWidth={0.6}
        />

        {/* Interior background, visible when open */}
        <Rect
          x={2} y={FLAP_H}
          width={ENV_W - 4} height={ENV_H - FLAP_H - 2}
          fill={colors.interior}
          visible={envelope.isOpen}
        />

        {/* Side fold crease lines */}
        <Line
          points={[0, FLAP_H, ENV_W / 2, ENV_H / 2]}
          stroke={colors.line} strokeWidth={0.5} opacity={0.35} listening={false}
        />
        <Line
          points={[ENV_W, FLAP_H, ENV_W / 2, ENV_H / 2]}
          stroke={colors.line} strokeWidth={0.5} opacity={0.35} listening={false}
        />

        {/* Bottom flap triangle (static) */}
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(0, ENV_H);
            ctx.lineTo(ENV_W / 2, ENV_H / 2);
            ctx.lineTo(ENV_W, ENV_H);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          fill={colors.flap}
          stroke={colors.line}
          strokeWidth={0.5}
          opacity={0.85}
          listening={false}
        />

        {/* Tucked contents — clipped to interior, visible when open */}
        {envelope.isOpen && (
          <Group
            x={0} y={FLAP_H}
            clipFunc={(ctx) => { ctx.rect(ENV_PADDING, ENV_PADDING, ENV_W - ENV_PADDING * 2, ENV_H - FLAP_H - ENV_PADDING * 2); }}
          >
            {envelope.contents.map((scrap) => (
              <TuckedScrapItem
                key={scrap.id}
                scrap={scrap}
                envelopeId={envelope.id}
                onUntuck={onUntuckScrap}
                onMove={(nx, ny) => {
                  onUpdateEnvelope(envelope.id, {
                    contents: envelope.contents.map(s => s.id === scrap.id ? { ...s, x: nx, y: ny } : s),
                  });
                }}
              />
            ))}
          </Group>
        )}

        {/* Flap body shadow that fades as flap opens — simulates flap casting shadow on interior */}
        <Rect
          ref={flapShadowRef}
          x={0} y={0}
          width={ENV_W} height={FLAP_H + 12}
          fillLinearGradientStartPoint={{ x: 0, y: FLAP_H + 12 }}
          fillLinearGradientEndPoint={{ x: 0, y: 0 }}
          fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.13)', 1, 'rgba(0,0,0,0)']}
          listening={false}
        />

        {/* Top flap group — scaleY animated by Tween (no React prop, imperatively controlled) */}
        <Group
          ref={flapGroupRef}
          shadowColor="rgba(0,0,0,0.3)"
        >
          <Shape
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              ctx.moveTo(jitter[8], jitter[9]);
              ctx.lineTo(ENV_W + jitter[10], jitter[11]);
              ctx.lineTo(ENV_W / 2 + jitter[12], FLAP_H + jitter[13]);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fill={colors.flap}
            stroke={colors.line}
            strokeWidth={0.6}
          />
        </Group>

        {/* Privacy cue: subtle pencil-mark corner line when closed with contents */}
        {!envelope.isOpen && hasContents && (
          <Line
            points={[ENV_W - 16, 5, ENV_W - 5, 16]}
            stroke={colors.line}
            strokeWidth={1.2}
            opacity={0.45}
            lineCap="round"
            listening={false}
          />
        )}
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
          keepRatio
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 40) return oldBox;
            return newBox;
          }}
        />
      )}
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
  onUpdateEnvelope: (id: string, attrs: Partial<Envelope>) => void;
  onTuckScrap: (scrapId: string, envelopeId: string, dropX: number, dropY: number) => void;
  onUntuckScrap: (envelopeId: string, scrap: Scrap, stageX: number, stageY: number) => void;
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
  onUpdateEnvelope,
  onTuckScrap,
  onUntuckScrap,
}, ref) => {
  const selectedId = selectedScrapId;
  const setSelectedId = onSelectScrap;
  const fallsDoneCount = useRef(0);

  // Wrap scrap onChange to intercept drops onto open envelopes
  const makeScrapChangeHandler = React.useCallback((scrap: Scrap) => (newAttrs: Partial<Scrap>) => {
    if ('x' in newAttrs && 'y' in newAttrs && newAttrs.x !== undefined && newAttrs.y !== undefined) {
      const envelopes = page.envelopes ?? [];
      const openEnv = envelopes.find(env => env.isOpen && hitTestEnvelope(newAttrs.x!, newAttrs.y!, env));
      if (openEnv) {
        onTuckScrap(scrap.id, openEnv.id, newAttrs.x!, newAttrs.y!);
        return;
      }
    }
    onUpdateScrap(scrap.id, newAttrs);
  }, [page.envelopes, onTuckScrap, onUpdateScrap]);

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

        {/* Layer 1: envelopes, scraps and journal entries */}
        <Layer listening={!isTapeActive}>
          {(page.envelopes ?? []).sort((a, b) => a.zIndex - b.zIndex).map((env) => (
            <EnvelopeItem
              key={env.id}
              envelope={env}
              isSelected={env.id === selectedId}
              onSelect={() => setSelectedId(env.id)}
              onChange={(attrs) => onUpdateEnvelope(env.id, attrs)}
              onUntuckScrap={onUntuckScrap}
              onUpdateEnvelope={onUpdateEnvelope}
            />
          ))}
          {[...page.scraps].sort((a, b) => a.zIndex - b.zIndex).map((scrap) => (
            <ScrapItem
              key={scrap.id}
              scrap={scrap}
              isSelected={scrap.id === selectedId}
              onSelect={() => { if (!isGlueActive) setSelectedId(scrap.id); }}
              onChange={makeScrapChangeHandler(scrap)}
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
