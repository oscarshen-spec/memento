import React from 'react';
import { RawMaterial } from '../types';
import { motion, useAnimation, useMotionValue, useSpring } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { playSound } from '../services/soundService';
import { DrawerPosition, clampPosition, makeScatterPosition } from '../utils/drawerScatter';
import { TinBox, TIN_W, TIN_H } from './TinBox';

// ─── MaterialCard ──────────────────────────────────────────────────────────────

export interface MaterialCardProps {
  material: RawMaterial;
  position: DrawerPosition;
  drawerRef: React.RefObject<HTMLDivElement>;
  onSelect: (m: RawMaterial) => void;
  onDragMaterial: (m: RawMaterial, info: PanInfo) => void;
  onRearrange: (m: RawMaterial, newX: number, newY: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onReclassifyToGallery: (id: string) => void;
  galleryRectRef: React.RefObject<DOMRect | null>;
}

export const MaterialCard = React.memo(({
  material, position, drawerRef, onSelect, onDragMaterial, onRearrange, onDragStateChange,
  onReclassifyToGallery, galleryRectRef,
}: MaterialCardProps) => {
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
        const rect = cardRectRef.current;
        cardRectRef.current = null;
        const drawerEl = drawerRef.current;
        if (drawerEl && rect && rect.width > 0) {
          const db = drawerEl.getBoundingClientRect();
          const dropCenterX = rect.left + info.offset.x + rect.width / 2;
          const dropCenterY = rect.top + info.offset.y + rect.height / 2;
          const insideDrawer =
            dropCenterX > db.left && dropCenterX < db.right &&
            dropCenterY > db.top && dropCenterY < db.bottom;
          if (insideDrawer) {
            onRearrange(material, rect.left + info.offset.x - db.left, rect.top + info.offset.y - db.top);
            return;
          }
          const galleryRect = galleryRectRef.current;
          if (galleryRect) {
            const inGallery =
              dropCenterX > galleryRect.left && dropCenterX < galleryRect.right &&
              dropCenterY > galleryRect.top && dropCenterY < galleryRect.bottom;
            if (inGallery) {
              onReclassifyToGallery(material.id);
              return;
            }
          }
        }
        onDragMaterial(material, info);
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(material); }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        scale: springScale,
        rotate: springRot,
        zIndex: isDragging ? 9999 : position.zIndex,
        touchAction: 'none',
        boxShadow: isDragging ? '0 24px 40px rgba(0,0,0,0.55), 0 8px 16px rgba(0,0,0,0.4)' : undefined,
      }}
      className="w-[100px] h-[100px] cursor-grab active:cursor-grabbing"
    >
      <img src={material.image} className="w-full h-full object-cover pointer-events-none rounded-[2px]" alt="Material" />
    </motion.div>
  );
});

// ─── Wooden drawer sound synthesis ───────────────────────────────────────────

function playDrawerSound(opening: boolean) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

  const duration = opening ? 0.38 : 0.32;
  const now = ctx.currentTime;

  // --- Slide noise (filtered white noise) ---
  const bufferSize = ctx.sampleRate * duration;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Bandpass filter for wood-slide texture
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(opening ? 800 : 1100, now);
  bandpass.frequency.linearRampToValueAtTime(opening ? 400 : 500, now + duration * 0.8);
  bandpass.Q.value = 1.2;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  noiseGain.gain.linearRampToValueAtTime(0.1, now + duration * 0.75);
  noiseGain.gain.linearRampToValueAtTime(0, now + duration * 0.85);

  noiseSource.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);

  // --- Heavy wooden wheel rumble ---
  // Separate noise buffer for the wheel layer
  const wheelBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const wheelData = wheelBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) wheelData[i] = Math.random() * 2 - 1;

  const wheelSource = ctx.createBufferSource();
  wheelSource.buffer = wheelBuffer;

  // Low-pass for deep woody rumble body
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 280;
  lowpass.Q.value = 2.5;

  // LFO simulates the periodic knock of heavy wheel rotation (~10 thumps/sec)
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(opening ? 11 : 9, now);
  lfo.frequency.linearRampToValueAtTime(opening ? 6 : 5, now + duration * 0.9);

  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.12;

  const wheelGain = ctx.createGain();
  wheelGain.gain.setValueAtTime(0, now);
  wheelGain.gain.linearRampToValueAtTime(0.28, now + 0.035);
  wheelGain.gain.linearRampToValueAtTime(0.22, now + duration * 0.7);
  wheelGain.gain.linearRampToValueAtTime(0, now + duration * 0.88);

  // LFO modulates the wheel gain to create rhythmic thumping
  lfo.connect(lfoDepth);
  lfoDepth.connect(wheelGain.gain);

  wheelSource.connect(lowpass);
  lowpass.connect(wheelGain);
  wheelGain.connect(ctx.destination);
  wheelSource.start(now);
  lfo.start(now);

  // --- Thud at end (low-freq impact) ---
  const thudTime = now + duration * 0.82;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(opening ? 90 : 75, thudTime);
  osc.frequency.exponentialRampToValueAtTime(30, thudTime + 0.12);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(opening ? 0.55 : 0.7, thudTime);
  thudGain.gain.exponentialRampToValueAtTime(0.001, thudTime + 0.18);

  osc.connect(thudGain);
  thudGain.connect(ctx.destination);
  osc.start(thudTime);
  osc.stop(thudTime + 0.18);

  // Close context after sounds finish
  setTimeout(() => ctx.close(), (duration + 0.25) * 1000);
}

// ─── MaterialDrawer ────────────────────────────────────────────────────────────

interface MaterialDrawerProps {
  materials: RawMaterial[];
  onSelect: (material: RawMaterial) => void;
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onDragMaterial: (material: RawMaterial, info: PanInfo) => void;
  onCardDragging?: (dragging: boolean) => void;
  galleryOpen: boolean;
  onOpenGallery: () => void;
  onReclassifyToGallery: (id: string) => void;
  galleryRectRef: React.RefObject<DOMRect | null>;
  onAddEnvelope?: () => void;
}

export const MaterialDrawer: React.FC<MaterialDrawerProps> = ({
  materials, onSelect, isOpen, onToggle, onDragMaterial, onCardDragging, galleryOpen, onOpenGallery,
  onReclassifyToGallery, galleryRectRef, onAddEnvelope,
}) => {
  const controls = useAnimation();
  const overflowDivRef = React.useRef<HTMLDivElement>(null);

  const handleCardDragState = React.useCallback((dragging: boolean) => {
    const el = overflowDivRef.current;
    if (el) {
      el.style.overflow = dragging ? 'visible' : '';
    }
    onCardDragging?.(dragging);
  }, [onCardDragging]);

  const [safeAreaBottom, setSafeAreaBottom] = React.useState(0);
  React.useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom').trim();
    setSafeAreaBottom(parseInt(raw, 10) || 0);
  }, []);

  const [positionsMap, setPositionsMap] = React.useState<Record<string, DrawerPosition>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setPositionsMap(prev => {
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 80;
      const blocked = [{
        x: containerW - TIN_W - 12,
        y: 12,
        width: TIN_W,
        height: TIN_H,
      }];
      const maxZ = Object.values(prev).reduce((acc, p) => Math.max(acc, p.zIndex), 0);
      const next = { ...prev };
      let added = 0;
      materials.forEach((m) => {
        if (!next[m.id]) {
          next[m.id] = makeScatterPosition(
            Object.keys(next).length + added,
            containerW,
            containerH,
            maxZ + 1,
            Object.values(next),
            blocked,
          );
          added++;
        }
      });
      const ids = new Set(materials.map(m => m.id));
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id]; });
      return next;
    });
  }, [materials]);

  const onRearrange = React.useCallback((material: RawMaterial, newX: number, newY: number) => {
    setPositionsMap(prev => {
      const maxZ = Object.values(prev).reduce((m, p) => Math.max(m, p.zIndex), 0);
      const containerW = containerRef.current?.offsetWidth ?? 320;
      const containerH = containerRef.current?.offsetHeight ?? 80;
      const blocked = [{
        x: containerW - TIN_W - 12,
        y: 12,
        width: TIN_W,
        height: TIN_H,
      }];
      const { x, y } = clampPosition(newX, newY, containerW, containerH, blocked);
      return {
        ...prev,
        [material.id]: { ...prev[material.id], x, y, zIndex: maxZ + 1 },
      };
    });
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
      playDrawerSound(true);
      onToggle(true);
    } else if (isFastUp || isDraggedUp) {
      playDrawerSound(false);
      onToggle(false);
    } else {
      controls.start(isOpen ? { y: 0 } : { y: closedY });
    }
  };

  return (
    <motion.div
      drag={galleryOpen ? false : 'y'}
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
        ref={overflowDivRef}
        className={`flex-1 flex flex-col border-b border-black/40 transition-colors duration-300 overflow-hidden ${isOpen ? '' : 'bg-[#0f0805]'}`}
        style={isOpen ? { backgroundImage: 'url(/Drawer.png)', backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >

        <div
          ref={containerRef}
          className={`flex-1 relative transition-colors duration-300 ${isOpen ? 'bg-[#1e1008]/70 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]' : 'bg-black/30 shadow-inner'}`}
        >
          {materials.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="text-white/20 font-serif italic text-sm tracking-wide">Empty drawer</span>
              <span className="text-white/10 text-[10px] uppercase tracking-[0.2em]">tap + to add materials</span>
            </div>
          ) : (
            materials.map((m) => {
              const pos = positionsMap[m.id];
              if (!pos) return null;
              return (
                <MaterialCard
                  key={m.id}
                  material={m}
                  position={pos}
                  drawerRef={containerRef}
                  onSelect={onSelect}
                  onDragMaterial={onDragMaterial}
                  onRearrange={onRearrange}
                  onDragStateChange={handleCardDragState}
                  onReclassifyToGallery={onReclassifyToGallery}
                  galleryRectRef={galleryRectRef}
                />
              );
            })
          )}
          {onAddEnvelope && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onPointerUp={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => { e.stopPropagation(); onAddEnvelope(); }}
              title="Add envelope"
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                opacity: 0.72,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              }}
            >
              <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Envelope body */}
                <rect x="1" y="1" width="38" height="28" rx="2" fill="#f2ead8" stroke="#c8b890" strokeWidth="1"/>
                {/* Flap triangle */}
                <polygon points="1,1 39,1 20,17" fill="#e8dfc4" stroke="#c8b890" strokeWidth="0.8"/>
                {/* Bottom V fold lines */}
                <line x1="1" y1="29" x2="20" y2="16" stroke="#c8b890" strokeWidth="0.6" opacity="0.5"/>
                <line x1="39" y1="29" x2="20" y2="16" stroke="#c8b890" strokeWidth="0.6" opacity="0.5"/>
              </svg>
            </button>
          )}
          <TinBox isOpen={galleryOpen} onOpen={onOpenGallery} />
        </div>
      </div>

      <div
        onClick={() => {
          if (galleryOpen) return;
          playDrawerSound(!isOpen);
          onToggle(!isOpen);
        }}
        className={`h-[24px] drawer-front flex flex-col items-center justify-center shrink-0 border-t border-white/5 relative ${galleryOpen ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className="drawer-handle" />
      </div>

      <div className="drawer-front shrink-0" style={{ height: safeAreaBottom }} />
    </motion.div>
  );
};
