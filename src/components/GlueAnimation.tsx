import { useEffect, useState } from 'react';
import { playSound } from '../services/soundService';

export interface GlueRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface GlueAnimationProps {
  image: string;
  rect: GlueRect;
  toolRect: { x: number; y: number; width: number; height: number };
  onRubStart?: () => void;   // bottle starts rubbing — hide the original button
  onReturn?: () => void;     // bottle back at tool position — show the original button
  onPress: () => void;
  onComplete: () => void;
}

type Phase = 'flying-to-scrap' | 'rubbing' | 'flying-back' | 'glowing';

const RUB_STROKES = [
  { dx: -14, dy:  9, dr: -26 },
  { dx:  11, dy: -7, dr:  -4 },
  { dx: -11, dy:  6, dr: -24 },
  { dx:   9, dy: -5, dr:  -7 },
  { dx:   0, dy:  0, dr: -15 },
];

export function GlueAnimation({ image, rect, toolRect, onRubStart, onReturn, onPress, onComplete }: GlueAnimationProps) {
  const [phase, setPhase] = useState<Phase>('flying-to-scrap');
  const [rubbingOffset, setRubbingOffset] = useState({ dx: 0, dy: 0, dr: 0 });
  // Card flip state: 0 = front, 180 = back, 360 = front again
  const [cardYRot, setCardYRot] = useState(0);
  const [glueVisible, setGlueVisible] = useState(false);

  useEffect(() => {
    playSound('paperRustle');
    const timers = [
      // Card flips to back while bottle is still flying over
      setTimeout(() => { setCardYRot(180); }, 160),
      // Bottle arrives → glue smear spreads, rubbing starts, hide original button
      setTimeout(() => {
        playSound('glueSpread');
        setPhase('rubbing');
        setGlueVisible(true);
        onRubStart?.();
      }, 980),
      // Bottle done rubbing → flip card back to front, press down
      setTimeout(() => {
        playSound('glueThud');
        onPress();
        setPhase('flying-back');
        setCardYRot(360);
        setGlueVisible(false);
      }, 1350),
      // Bottle back at tool position → restore original button, glow + sparkles
      setTimeout(() => {
        playSound('settle');
        playSound('sparkle');
        setPhase('glowing');
        onReturn?.();
      }, 1800),
      setTimeout(() => { onComplete(); }, 2900),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Rub strokes during rubbing phase
  useEffect(() => {
    if (phase !== 'rubbing') return;
    let i = 0;
    const id = setInterval(() => {
      if (i < RUB_STROKES.length) setRubbingOffset(RUB_STROKES[i++]);
      else clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [phase]);

  // Screen coords
  const scrapCx = rect.x + rect.width  / 2;
  const scrapCy = rect.y + rect.height / 2;
  const toolCx  = toolRect.x + toolRect.width  / 2;
  const toolCy  = toolRect.y + toolRect.height / 2;
  const tx = scrapCx - toolCx;
  const ty = scrapCy - toolCy;

  const bottleSize = 90;

  // ── Bottle transform ────────────────────────────────────────────────────────
  let bottleTransform: string;
  let bottleTransition: string;
  switch (phase) {
    case 'flying-to-scrap':
      bottleTransform = `translate(${tx}px, ${ty}px) rotate(-20deg) scale(0.88)`;
      bottleTransition = 'transform 0.88s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      break;
    case 'rubbing':
      bottleTransform = `translate(${tx + rubbingOffset.dx}px, ${ty + rubbingOffset.dy}px) rotate(${-15 + rubbingOffset.dr}deg) scale(0.88)`;
      bottleTransition = 'transform 0.07s ease-in-out';
      break;
    case 'flying-back':
      bottleTransform = `translate(0px, 0px) rotate(12deg) scale(1)`;
      bottleTransition = 'transform 0.46s cubic-bezier(0.4, 0, 0.6, 1)';
      break;
    default: // glowing
      bottleTransform = `translate(0px, 0px) rotate(12deg) scale(1)`;
      bottleTransition = 'none';
  }

  // ── Card flip ───────────────────────────────────────────────────────────────
  const showFront = cardYRot < 90 || cardYRot >= 270;
  const cardTransition = 'transform 0.3s ease-in-out';

  // ── Sparkles ────────────────────────────────────────────────────────────────
  const sparkleRadius = Math.min(Math.max(rect.width, rect.height) * 0.65, 90);
  const SPARKLES = [
    { angle: 0,   size: 10, delay: 0,   color: '#FFD700' },
    { angle: 45,  size: 8,  delay: 50,  color: '#FFFFFF' },
    { angle: 90,  size: 11, delay: 20,  color: '#FFE566' },
    { angle: 135, size: 8,  delay: 80,  color: '#FFFFFF' },
    { angle: 180, size: 10, delay: 40,  color: '#FFD700' },
    { angle: 225, size: 8,  delay: 100, color: '#FFFFFF' },
    { angle: 270, size: 10, delay: 60,  color: '#FFE566' },
    { angle: 315, size: 8,  delay: 30,  color: '#FFFFFF' },
    { angle: 22,  size: 6,  delay: 130, color: '#FFF8DC' },
    { angle: 112, size: 5,  delay: 160, color: '#FFD700' },
    { angle: 202, size: 6,  delay: 140, color: '#FFF8DC' },
    { angle: 292, size: 5,  delay: 170, color: '#FFD700' },
  ];

  return (
    <>
      {/* ── Flip card overlay (replaces hidden Konva scrap) ─────────────────── */}
      {/* Root anchor at scrap center */}
      <div
        style={{
          position: 'fixed',
          left: scrapCx,
          top: scrapCy,
          width: 0,
          height: 0,
          zIndex: 99,
          pointerEvents: 'none',
        }}
      >
        {/* Match scrap's own rotation */}
        <div style={{ position: 'absolute', transform: `rotate(${rect.rotation}deg)` }}>
          {/* Perspective context */}
          <div style={{ perspective: '900px', perspectiveOrigin: '50% 50%' }}>
            {/* Flip card */}
            <div
              style={{
                position: 'absolute',
                left: -rect.width  / 2,
                top:  -rect.height / 2,
                width:  rect.width,
                height: rect.height,
                transformStyle: 'preserve-3d',
                transform: `rotateY(${cardYRot}deg)`,
                transition: cardTransition,
                borderRadius: 3,
              }}
            >
              {/* Front face — scrap image */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: 3,
                  overflow: 'hidden',
                  visibility: showFront ? 'visible' : 'hidden',
                }}
              >
                <img
                  src={image}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              {/* Back face — paper texture + glue smear */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: '#f7f3ec',
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.018) 3px, rgba(0,0,0,0.018) 4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  visibility: !showFront ? 'visible' : 'hidden',
                }}
              >
                {/* Glue smear spreading as bottle rubs */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(ellipse at 48% 52%, rgba(220,180,60,0.45) 0%, rgba(195,155,40,0.25) 40%, transparent 72%)',
                    transform: glueVisible ? 'scale(1)' : 'scale(0)',
                    transformOrigin: 'center',
                    transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    borderRadius: '50%',
                  }}
                />
                <div
                  style={{
                    fontSize: Math.max(rect.width, rect.height) > 120 ? '2.2rem' : '1.4rem',
                    opacity: 0.55,
                    position: 'relative',
                    zIndex: 1,
                    transform: glueVisible ? 'scale(1.05) rotate(-8deg)' : 'scale(0.7)',
                    transition: 'transform 0.3s ease-out',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                  }}
                >
                  🪣
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Flying glue bottle ───────────────────────────────────────────────── */}
      <img
        src="/Glue.png"
        alt=""
        style={{
          position: 'fixed',
          left: toolCx - bottleSize / 2,
          top:  toolCy - bottleSize / 2,
          width:  bottleSize,
          height: bottleSize,
          zIndex: 200,
          pointerEvents: 'none',
          transform: bottleTransform,
          transition: bottleTransition,
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))',
        }}
      />

      {/* ── Sparkle burst ───────────────────────────────────────────────────── */}
      {phase === 'glowing' && SPARKLES.map(({ angle, size, delay, color }, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: scrapCx,
            top:  scrapCy,
            width: 0,
            height: 0,
            zIndex: 100,
            pointerEvents: 'none',
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -size / 2,
              top:  -size / 2,
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              fontSize: size * 1.3,
              lineHeight: 1,
              filter: `drop-shadow(0 0 ${size * 0.4}px ${color})`,
              animation: `sparkleShoot ${(sparkleRadius * 0.012 + 0.75).toFixed(2)}s ease-out ${delay}ms forwards`,
              ['--sparkle-dist' as string]: `-${Math.round(sparkleRadius)}px`,
            }}
          >
            ✦
          </div>
        </div>
      ))}

      {/* ── Glow pulse ──────────────────────────────────────────────────────── */}
      {phase === 'glowing' && (
        <div
          style={{
            position: 'fixed',
            left: scrapCx - rect.width  * 0.75,
            top:  scrapCy - rect.height * 0.75,
            width:  rect.width  * 1.5,
            height: rect.height * 1.5,
            background: 'radial-gradient(ellipse at center, rgba(255,210,60,0.38) 0%, rgba(255,160,20,0.18) 45%, transparent 72%)',
            borderRadius: '50%',
            zIndex: 98,
            pointerEvents: 'none',
            animation: 'glowFade 1s ease-out forwards',
          }}
        />
      )}
    </>
  );
}
