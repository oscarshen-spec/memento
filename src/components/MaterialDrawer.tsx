import React from 'react';
import { X, Scissors, Plus } from 'lucide-react';
import { RawMaterial } from '../types';
import { motion, useAnimation } from 'motion/react';

interface MaterialDrawerProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onDragMaterial: (material: RawMaterial, e: React.DragEvent<HTMLDivElement>) => void;
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

  // The drawer is 20% of screen height; content stops above the safe area
  const drawerHeight = "20vh";
  // The handle area is at the bottom of the drawer component
  const handleHeight = 24;
  const closedY = `calc(-20vh + ${handleHeight + safeAreaBottom}px)`;

  React.useEffect(() => {
    controls.start(isOpen ? { y: 0 } : { y: closedY });
  }, [isOpen, controls, closedY]);

  const onDragEnd = (event: any, info: any) => {
    // Dragging DOWN (positive y) opens it
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
      onDragEnd={onDragEnd}
      animate={controls}
      initial={{ y: closedY }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 top-0 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      style={{ height: drawerHeight, touchAction: 'none' }}
    >
      {/* Drawer Content (Organizer Look) */}
      <div className={`flex-1 overflow-hidden flex flex-col border-b border-black/40 transition-colors duration-300 ${isOpen ? 'bg-[#3d2b1f]' : 'bg-[#0f0805]'}`}>
        <div className="px-6 py-2 border-b border-black/10 flex justify-between items-center bg-black/20 backdrop-blur-sm">
          <h3 className="font-serif italic text-sm text-white/80">Materials</h3>
          <label className="flex items-center gap-2 px-3 py-1 bg-white/10 text-white rounded-full text-[10px] font-bold cursor-pointer hover:bg-white/20 transition-all active:scale-95 shadow-md border border-white/10">
            <Plus size={12} />
            <span>ADD</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </div>

        {/* Organizer Grid - Horizontal scroll */}
        <div className={`flex-1 overflow-x-auto p-4 flex gap-6 shadow-inner scrollbar-hide items-center transition-colors duration-300 ${isOpen ? 'bg-[#2a1a10]/60' : 'bg-black/30'}`}>
          {materials.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/30 italic font-serif text-xs">
              No materials...
            </div>
          ) : (
            materials.map((m, i) => (
              <div
                key={m.id}
                draggable
                onPointerDown={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('materialId', m.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragMaterial(m, e);
                }}
                className="bg-white p-2 border border-black/10 shadow-lg flex items-center justify-center relative group shrink-0 w-24 h-24 rounded-sm rotate-1 hover:rotate-0 transition-transform cursor-grab active:cursor-grabbing"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(m);
                  }}
                  className="relative w-full h-full bg-white p-1 shadow-sm cursor-pointer"
                >
                  <img src={m.image} className="w-full h-full object-cover" alt="Material" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Scissors size={16} className="text-white drop-shadow-lg" />
                  </div>
                </motion.div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Drawer Front / Handle Area - At the bottom of the component */}
      <div
        onClick={() => onToggle(!isOpen)}
        className="h-[24px] drawer-front flex flex-col items-center justify-center cursor-grab active:cursor-grabbing shrink-0 border-t border-white/5 relative"
      >
        <div className="drawer-handle" />
      </div>

      {/* Safe area spacer */}
      <div className="drawer-front shrink-0" style={{ height: safeAreaBottom }} />
    </motion.div>
  );
};
