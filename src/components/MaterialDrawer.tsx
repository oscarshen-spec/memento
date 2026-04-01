import React from 'react';
import ReactDOM from 'react-dom';
import { RawMaterial } from '../types';
import { motion, useAnimation, useMotionValue, useSpring } from 'motion/react';
import type { PanInfo } from 'motion/react';

// ─── MaterialCard ──────────────────────────────────────────────────────────────

interface MaterialCardProps {
  material: RawMaterial;
  index: number;
  onSelect: (m: RawMaterial) => void;
  onDragMaterial: (m: RawMaterial, info: PanInfo) => void;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material, index, onSelect, onDragMaterial }) => {
  const baseRot = (index % 5 - 2) * 1.2;

  const scaleValue = useMotionValue(1);
  const springScale = useSpring(scaleValue, { stiffness: 350, damping: 12 });
  const rotValue = useMotionValue(baseRot);
  const springRot = useSpring(rotValue, { stiffness: 280, damping: 18 });

  const portalX = useMotionValue(0);
  const portalY = useMotionValue(0);

  const [isDragging, setIsDragging] = React.useState(false);
  const [cardRect, setCardRect] = React.useState<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  return (
    <>
      <motion.div
        ref={cardRef}
        drag
        dragSnapToOrigin
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={() => {
          const rect = cardRef.current?.getBoundingClientRect() ?? null;
          setCardRect(rect);
          portalX.set(0);
          portalY.set(0);
          setIsDragging(true);
          scaleValue.set(1.04);
          navigator.vibrate?.(10);
        }}
        onDrag={(_, info) => {
          portalX.set(info.offset.x);
          portalY.set(info.offset.y);
          const targetRot = Math.max(-15, Math.min(15, baseRot + info.velocity.x * -0.02));
          rotValue.set(targetRot);
        }}
        onDragEnd={(_, info) => {
          setIsDragging(false);
          setCardRect(null);
          scaleValue.set(1);
          rotValue.set(baseRot);
          navigator.vibrate?.(30);
          onDragMaterial(material, info);
        }}
        onClick={(e) => { e.stopPropagation(); onSelect(material); }}
        style={{
          scale: springScale,
          rotate: springRot,
          zIndex: 1,
          touchAction: 'none',
          opacity: isDragging ? 0 : 1,
        }}
        className="relative shrink-0 w-[100px] h-[116px] cursor-grab active:cursor-grabbing"
      >
        {/* Polaroid-style card */}
        <div className="absolute inset-0 bg-[#faf6ee] rounded-[3px] shadow-[1px_2px_8px_rgba(0,0,0,0.25),_inset_0_0_0_1px_rgba(0,0,0,0.06)]">
          <div className="mx-2 mt-2 mb-0 overflow-hidden rounded-[1px]" style={{ height: 'calc(100% - 24px)' }}>
            <img src={material.image} className="w-full h-full object-cover pointer-events-none" alt="Material" />
          </div>
          {/* Bottom strip mimicking polaroid */}
          <div className="h-[16px]" />
        </div>
      </motion.div>

      {isDragging && cardRect && ReactDOM.createPortal(
        <motion.div
          style={{
            position: 'fixed',
            left: cardRect.left,
            top: cardRect.top,
            width: cardRect.width,
            height: cardRect.height,
            x: portalX,
            y: portalY,
            scale: springScale,
            rotate: springRot,
            boxShadow: '0 24px 40px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="rounded-[3px]"
        >
          <div className="absolute inset-0 bg-[#faf6ee] rounded-[3px]">
            <div className="mx-2 mt-2 mb-0 overflow-hidden rounded-[1px]" style={{ height: 'calc(100% - 24px)' }}>
              <img src={material.image} className="w-full h-full object-cover pointer-events-none" alt="Material" />
            </div>
            <div className="h-[16px]" />
          </div>
        </motion.div>,
        document.body
      )}
    </>
  );
};

// ─── MaterialDrawer ────────────────────────────────────────────────────────────

interface MaterialDrawerProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onDragMaterial: (material: RawMaterial, info: PanInfo) => void;
}

export const MaterialDrawer: React.FC<MaterialDrawerProps> = ({
  materials, onSelect, onClose, isOpen, onToggle, onDragMaterial
}) => {
  const controls = useAnimation();

  const [safeAreaBottom, setSafeAreaBottom] = React.useState(0);
  React.useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom').trim();
    setSafeAreaBottom(parseInt(raw, 10) || 0);
  }, []);

  const handleHeight = 24;
  const closedY = `calc(-20vh + ${handleHeight + safeAreaBottom}px)`;

  React.useEffect(() => {
    controls.start(isOpen ? { y: 0 } : { y: closedY });
  }, [isOpen, controls, closedY]);

  const onDrawerDragEnd = (_event: any, info: any) => {
    const isFastDown = info.velocity.y > 500;
    const isFastUp = info.velocity.y < -500;
    const isDraggedDown = info.offset.y > 20;
    const isDraggedUp = info.offset.y < -20;

    if (isFastDown || isDraggedDown) {
      onToggle(true);
    } else if (isFastUp || isDraggedUp) {
      onToggle(false);
    } else {
      controls.start(isOpen ? { y: 0 } : { y: closedY });
    }
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: -200, bottom: 0 }}
      dragElastic={0.05}
      onDragEnd={onDrawerDragEnd}
      animate={controls}
      initial={{ y: closedY }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 top-0 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      style={{ height: '20vh', touchAction: 'none' }}
    >
      <div
        className={`flex-1 overflow-hidden flex flex-col border-b border-black/40 transition-colors duration-300 ${isOpen ? '' : 'bg-[#0f0805]'}`}
        style={isOpen ? { backgroundImage: 'url(/Drawer.png)', backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >

        <div className={`flex-1 overflow-x-auto p-4 px-6 flex gap-5 scrollbar-hide items-center transition-colors duration-300 ${isOpen ? 'bg-[#1e1008]/70 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]' : 'bg-black/30 shadow-inner'}`}>
          {materials.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <span className="text-white/20 font-serif italic text-sm tracking-wide">Empty drawer</span>
              <span className="text-white/10 text-[10px] uppercase tracking-[0.2em]">tap + to add materials</span>
            </div>
          ) : (
            materials.map((m, i) => (
              <MaterialCard
                key={m.id}
                material={m}
                index={i}
                onSelect={onSelect}
                onDragMaterial={onDragMaterial}
              />
            ))
          )}
        </div>
      </div>

      <div
        onClick={() => onToggle(!isOpen)}
        className="h-[24px] drawer-front flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0 border-t border-white/5 relative"
      >
        <div className="drawer-handle" />
      </div>

      <div className="drawer-front shrink-0" style={{ height: safeAreaBottom }} />
    </motion.div>
  );
};
