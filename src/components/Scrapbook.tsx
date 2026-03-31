import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Shape, Text, Rect, Line } from 'react-konva';
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
}

const ScrapItem: React.FC<ScrapItemProps> = ({ scrap, isSelected, onSelect, onChange, onReturn, stageHeight }) => {
  const [image] = useImage(scrap.image);
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

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

  const WashiTape: React.FC<{ x: number; y: number }> = ({ x, y }) => (
    <Group x={x} y={y} rotation={-45}>
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(0, 0, 40, 15);
          ctx.fillStrokeShape(shape);
        }}
        fill="rgba(0,0,0,0.8)"
        opacity={0.6}
        shadowBlur={2}
      />
      {[...Array(8)].map((_, i) => (
        <Shape
          key={i}
          x={i * 5}
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(5, 15);
            ctx.strokeShape(shape);
          }}
          stroke="white"
          strokeWidth={1}
          opacity={0.3}
        />
      ))}
    </Group>
  );

  return (
    <>
      <Group
        draggable={!scrap.isGlued}
        x={scrap.x}
        y={scrap.y}
        rotation={scrap.rotation}
        scaleX={scrap.scale}
        scaleY={scrap.scale}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          const y = e.target.y();
          if (y > stageHeight) {
            onReturn();
          } else {
            onChange({ x: e.target.x(), y });
          }
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
              <Rect
                x={4}
                y={4}
                width={image.width}
                height={image.height}
                fill="rgba(0,0,0,0.2)"
                listening={false}
              />
            )}
            {image && (
              <KonvaImage
                image={image}
                width={image.width}
                height={image.height}
              />
            )}
            {!scrap.isGlued && image && (
              <>
                <WashiTape x={-10} y={-10} />
                <WashiTape x={image.width - 20} y={image.height - 20} />
              </>
            )}
          </>
        ) : (
          <>
            <Shape
              sceneFunc={(ctx, shape) => {
                drawJaggedPath(ctx, scrap.points);
                ctx.fillStrokeShape(shape);
              }}
              fill="rgba(0,0,0,0.2)"
              offsetX={-4}
              offsetY={4}
              listening={false}
            />

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

            {!scrap.isGlued && (
              <>
                <WashiTape x={-10} y={-10} />
                <WashiTape x={180} y={180} />
              </>
            )}
          </>
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
        fontFamily={entry.type === 'title' ? 'Cormorant Garamond' : 'Inter'}
        fontStyle={entry.type === 'title' ? 'italic bold' : 'normal'}
        fill="#1a1a1a"
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
  dimensions,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const checkDeselect = (e: any) => {
    if (isTapeActive) return; // tape mode captures all events
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
