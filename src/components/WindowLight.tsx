import { useEffect, useRef } from 'react';

export function WindowLight() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const floodRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shaftARef = useRef<HTMLDivElement>(null);
  const shaftBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const flood = floodRef.current;
    const glow = glowRef.current;
    const shaftA = shaftARef.current;
    const shaftB = shaftBRef.current;
    if (!overlay || !flood || !glow || !shaftA || !shaftB) return;

    let raf: number;

    const tick = () => {
      const t = Date.now();
      // Five oscillators at irrational ratios — never sync
      const o1 = Math.sin(t * 0.00018);   // ~35s period — main wander
      const o2 = Math.sin(t * 0.000113);  // ~56s — shaft A
      const o3 = Math.sin(t * 0.000137);  // ~46s — shaft B
      const o4 = Math.sin(t * 0.000058);  // ~108s — flood size / slow Y
      const o5 = Math.sin(t * 0.000031);  // ~203s — very slow secondary glow

      // Flood: wanders widely + size breathes + opacity pulses
      const floodX = 10 + o1 * 16 + o5 * 6;
      const floodY = -10 + o4 * 14 + o1 * 4;
      const floodSize = 120 + o4 * 30 + o5 * 15;
      const floodOpacity = 0.50 + o4 * 0.18;
      flood.style.background = `radial-gradient(ellipse ${floodSize}% 100% at ${floodX}% ${floodY}%, rgba(255,195,80,${floodOpacity.toFixed(2)}) 0%, rgba(255,175,60,0.2) 35%, transparent 65%)`;

      // Secondary warm glow: roams independently
      const glowX = 30 + o5 * 25 + o1 * 10;
      const glowY = 20 + o4 * 20;
      const glowOpacity = 0.10 + o5 * 0.08;
      glow.style.background = `radial-gradient(ellipse 80% 60% at ${glowX}% ${glowY}%, rgba(255,160,40,${glowOpacity.toFixed(2)}) 0%, transparent 70%)`;

      // Shaft A: sweeps + rotates
      shaftA.style.opacity = String(Math.max(0.01, 0.07 + o2 * 0.07));
      shaftA.style.transform = `translateX(${o2 * 50}px) rotate(${28 + o2 * 10}deg)`;

      // Shaft B: sweeps opposite direction + rotates
      shaftB.style.opacity = String(Math.max(0.01, 0.05 + o3 * 0.05));
      shaftB.style.transform = `translateX(${o3 * 35}px) rotate(${32 + o3 * 8}deg)`;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 25 }}
    >
      {/* Clouds: soft blobs drifting behind the light */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '4%', left: 0,
          width: '220px', height: '90px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 100%)',
          filter: 'blur(30px)',
          animation: 'cloud-drift-a 90s linear infinite', animationDelay: '-20s',
        }} />
        <div style={{
          position: 'absolute', top: '10%', left: 0,
          width: '300px', height: '110px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.13) 0%, transparent 100%)',
          filter: 'blur(36px)',
          animation: 'cloud-drift-b 70s linear infinite', animationDelay: '-35s',
        }} />
        <div style={{
          position: 'absolute', top: '1%', left: 0,
          width: '170px', height: '70px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 100%)',
          filter: 'blur(24px)',
          animation: 'cloud-drift-c 115s linear infinite', animationDelay: '-60s',
        }} />
      </div>

      {/* Flood: main warm light from upper-left */}
      <div ref={floodRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Secondary roaming warm glow */}
      <div ref={glowRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Shaft A: wide blurred diagonal strip */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftARef}
          style={{
            position: 'absolute', top: '-50%', left: '-10px',
            width: '160px', height: '200%',
            background: 'rgba(255,220,120,0.08)',
            transform: 'rotate(30deg)', transformOrigin: 'top left',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Shaft B: narrower blurred strip */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftBRef}
          style={{
            position: 'absolute', top: '-50%', left: '60px',
            width: '80px', height: '200%',
            background: 'rgba(255,230,140,0.06)',
            transform: 'rotate(30deg)', transformOrigin: 'top left',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Vignette: static dark gradient, right + bottom */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(145deg, transparent 30%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </div>
  );
}
