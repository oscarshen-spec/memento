import React from 'react';
import { RawMaterial } from '../types';
import { motion, useMotionValue, useSpring } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { playSound } from '../services/soundService';
import { DrawerPosition, CARD_W, CARD_H } from '../utils/drawerScatter';

interface GalleryMaterialCardProps {
  material: RawMaterial;
  position: DrawerPosition;
  onTap: (m: RawMaterial) => void;
  onDragEnd: (m: RawMaterial, info: PanInfo, cardRect: DOMRect | null) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

export const GalleryMaterialCard = React.memo(({
  material, position, onTap, onDragEnd, onDragStateChange,
}: GalleryMaterialCardProps) => {
  const scaleValue = useMotionValue(1);
  const springScale = useSpring(scaleValue, { stiffness: 350, damping: 12 });
  const rotValue = useMotionValue(position.rotation);
  const springRot = useSpring(rotValue, { stiffness: 280, damping: 18 });

  const [isDragging, setIsDragging] = React.useState(false);
  const cardRectRef = React.useRef<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={cardRef}
      drag
      dragSnapToOrigin
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={() => {
        cardRectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
        setIsDragging(true);
        onDragStateChange?.(true);
        scaleValue.set(1.04);
        playSound('paperRustle');
        navigator.vibrate?.(10);
      }}
      onDrag={(_, info) => {
        const targetRot = Math.max(-15, Math.min(15, position.rotation + info.velocity.x * -0.02));
        rotValue.set(targetRot);
      }}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        onDragStateChange?.(false);
        scaleValue.set(1);
        rotValue.set(position.rotation);
        navigator.vibrate?.(30);
        onDragEnd(material, info, cardRectRef.current);
        cardRectRef.current = null;
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTap(material);
      }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: CARD_W,
        height: CARD_H,
        scale: springScale,
        rotate: springRot,
        zIndex: isDragging ? 9999 : position.zIndex,
        touchAction: 'none',
        boxShadow: isDragging
          ? '0 24px 40px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.4)'
          : undefined,
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <img
        src={material.image}
        className="w-full h-full object-cover pointer-events-none rounded-[2px]"
        alt="Gallery material"
      />
    </motion.div>
  );
});
