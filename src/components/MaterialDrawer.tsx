import React from 'react';
import ReactDOM from 'react-dom';
import { Scissors, Plus } from 'lucide-react';
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
        className="bg-white border border-black/10 relative group shrink-0 w-24 h-24 rounded-sm cursor-grab active:cursor-grabbing"
      >
        <div className="absolute inset-0 p-2 flex items-center justify-center">
          <div className="relative w-full h-full bg-white p-1 shadow-sm">
            <img src={material.image} className="w-full h-full object-cover pointer-events-none" alt="Material" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <Scissors size={16} className="text-white drop-shadow-lg" />
            </div>
          </div>
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
          className="bg-white border border-black/10 rounded-sm"
        >
          <div className="absolute inset-0 p-2 flex items-center justify-center">
            <div className="relative w-full h-full bg-white p-1 shadow-sm">
              <img src={material.image} className="w-full h-full object-cover pointer-events-none" alt="Material" />
            </div>
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
  materials, onSelect, onClose, onUpload, isOpen, onToggle, onDragMaterial
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
      <div className={`flex-1 overflow-hidden flex flex-col border-b border-black/40 transition-colors duration-300 ${isOpen ? 'bg-[#3d2b1f]' : 'bg-[#0f0805]'}`}>
        <div className="px-6 py-2 border-b border-black/10 flex justify-between items-center bg-black/20 backdrop-blur-sm">
          <h3 className="font-serif italic text-sm text-white/80">Materials</h3>
          <label className="flex items-center gap-2 px-3 py-1 bg-white/10 text-white rounded-full text-[10px] font-bold cursor-pointer hover:bg-white/20 transition-all active:scale-95 shadow-md border border-white/10">
            <Plus size={12} />
            <span>ADD</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </div>

        <div className={`flex-1 overflow-x-auto p-4 flex gap-6 shadow-inner scrollbar-hide items-center transition-colors duration-300 ${isOpen ? 'bg-[#2a1a10]/60' : 'bg-black/30'}`}>
          {materials.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/30 italic font-serif text-xs">
              No materials...
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
