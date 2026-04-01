import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { TapeStrip, Scrap, Point, JournalEntry, ScrapbookPage } from '../types';
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
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight, isGlueActive, isFalling, onFallDone }) => {
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
  const isPointerDown = useRef(false);
  const [showSheen, setShowSheen] = useState(false);

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
  };

  const handleTap = () => {
    if (wasPinching.current) {
      wasPinching.current = false;
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
    node.setAttrs({ shadowBlur: 12, shadowOffsetY: 8, shadowOffsetX: 0 });
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
      shadowBlur: 8 + speed * 0.5,
      shadowOffsetY: 6 + speed * 0.3,
      shadowOffsetX: clampedVx * 0.15,
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
    };
  }, []);

  useEffect(() => {
    if (scrap.isGlued && shapeRef.current) {
      activeTween.current?.destroy();
      activeTween.current = null;
      shapeRef.current.to({
        shadowBlur: 3,
        shadowOffsetY: 2,
        shadowOffsetX: 0,
        duration: 0.2,
      });
    }
  }, [scrap.isGlued]);

  useEffect(() => {
    if (!isFalling || !shapeRef.current) return;

    const node = shapeRef.current;
    const origX = node.x();
    const origY = node.y();
    const origRot = node.rotation();
    let shakeCount = 0;

    const doFall = () => {
      const finalRot = origRot + (Math.random() > 0.5 ? 28 : -28);
      new Konva.Tween({
        node,
        duration: 0.55,
        easing: Konva.Easings.EaseIn,
        y: stageHeight + 250,
        rotation: finalRot,
        onFinish: () => onFallDone(),
      }).play();
    };

    const doShake = () => {
      if (shakeCount >= 6) {
        doFall();
        return;
      }
      const dx = shakeCount % 2 === 0 ? 5 : -5;
      const dr = shakeCount % 2 === 0 ? 4 : -4;
      new Konva.Tween({
        node,
        duration: 0.05,
        x: origX + dx,
        y: origY,
        rotation: origRot + dr,
        onFinish: () => { shakeCount++; doShake(); },
      }).play();
    };

    const delay = Math.random() * 150;
    const timer = setTimeout(doShake, delay);
    return () => clearTimeout(timer);
  }, [isFalling]);

  const drawJaggedPath = (ctx: any, points: Point[]) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i-1];
      const p2 = points[i];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const jitter = dist * 0.05;

      ctx.lineTo(
        midX + (Math.random() - 0.5) * jitter,
        midY + (Math.random() - 0.5) * jitter
      );
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.closePath();
  };

  const isRect = scrap.points.length === 0;


  return (
    <>
      <Group
        draggable={!scrap.isGlued && !isGlueActive}
        x={scrap.x}
        y={scrap.y}
        rotation={scrap.rotation}
        scaleX={scrap.scale}
        scaleY={scrap.scale}
        shadowColor="rgba(0,0,0,0.35)"
        shadowBlur={4}
        shadowOffsetX={0}
        shadowOffsetY={3}
        onClick={onSelect}
        onTap={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={(e) => {
          handleTouchMove(e);
          const touches: TouchList = e.evt.touches;
          if (!isGlueActive || touches.length !== 1 || scrap.isGlued) return;
          setShowSheen(true);
          onChange({ isGlued: true });
        }}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => { isPointerDown.current = true; }}
        onMouseUp={() => { isPointerDown.current = false; setShowSheen(false); }}
        onMouseMove={() => {
          if (!isGlueActive || !isPointerDown.current || scrap.isGlued) return;
          setShowSheen(true);
          onChange({ isGlued: true });
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          const node = e.target;
          const x = node.x();
          const y = node.y();

          if (y > stageHeight) {
            node.setAttrs({
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
        onTransformEnd={(e) => {
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
                drawJaggedPath(ctx, scrap.points);
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
                drawJaggedPath(ctx, scrap.points);
                ctx.fillStrokeShape(shape);
              }}
              stroke="white"
              strokeWidth={scrap.isTorn ? 3.5 : 1}
              opacity={scrap.isTorn ? 0.65 : 0.3}
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

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        ref={shapeRef}
        text={entry.text}
        x={entry.x}
        y={entry.y}
        rotation={entry.rotation}
        fontSize={entry.fontSize}
        fontFamily={entry.fontFamily ?? (entry.type === 'title' ? 'Cormorant Garamond' : 'Inter')}
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
        onTransformEnd={(e) => {
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
}

const DRAG_OVERFLOW = 180;

export const Scrapbook: React.FC<ScrapbookProps> = ({
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
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        width={dimensions.width}
        height={dimensions.height + DRAG_OVERFLOW}
        onMouseDown={checkDeselect}
        onTouchStart={checkDeselect}
      >
        {/* Layer 0: lined paper background */}
        <Layer listening={false}>
          <LinedPaper width={dimensions.width} height={dimensions.height} />
        </Layer>

        {/* Layer 1: scraps and journal entries */}
        <Layer listening={!isTapeActive}>
          {[...page.scraps].sort((a, b) => a.zIndex - b.zIndex).map((scrap) => (
            <ScrapItem
              key={scrap.id}
              scrap={scrap}
              isSelected={scrap.id === selectedId}
              onSelect={() => setSelectedId(scrap.id)}
              onChange={(newAttrs) => onUpdateScrap(scrap.id, newAttrs)}
              onReturn={() => onReturnScrap(scrap)}
              stageHeight={dimensions.height}
              isGlueActive={isGlueActive}
              isFalling={fallingScrapIds?.includes(scrap.id) ?? false}
              onFallDone={() => {
                if (!fallingScrapIds) return;
                fallsDoneCount.current += 1;
                if (fallsDoneCount.current >= fallingScrapIds.length) {
                  fallsDoneCount.current = 0;
                  onFallComplete(fallingScrapIds);
                }
              }}
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
};
