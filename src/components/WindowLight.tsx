import { useEffect, useRef } from 'react';

export function WindowLight() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const shaftARef = useRef<HTMLDivElement>(null);
  const shaftBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const shaftA = shaftARef.current;
    const shaftB = shaftBRef.current;
    if (!overlay || !shaftA || !shaftB) return;

    let raf: number;

    const tick = () => {
      const t = Date.now();
      const o1 = Math.sin(t * 0.00012);
      const o2 = Math.sin(t * 0.000079);
      const o3 = Math.sin(t * 0.000097);
      const o4 = Math.sin(t * 0.000041);

      const floodX = 10 + o1 * 10;
      const floodY = -10 + o4 * 8;
      const floodSize = 120 + o4 * 18;
      overlay.style.setProperty('--flood-x', `${floodX}%`);
      overlay.style.setProperty('--flood-y', `${floodY}%`);
      overlay.style.setProperty('--flood-size', `${floodSize}%`);

      shaftA.style.opacity = String(0.06 + o2 * 0.05);
      shaftA.style.transform = `rotate(${30 + o2 * 5}deg)`;

      shaftB.style.opacity = String(0.05 + o3 * 0.04);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
        ['--flood-x' as string]: '10%',
        ['--flood-y' as string]: '-10%',
        ['--flood-size' as string]: '120%',
      }}
    >
      {/* Clouds: soft blobs drifting behind the light */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '4%',
          left: 0,
          width: '220px',
          height: '90px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 100%)',
          filter: 'blur(30px)',
          animation: 'cloud-drift-a 90s linear infinite',
          animationDelay: '-20s',
        }} />
        <div style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          width: '300px',
          height: '110px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.13) 0%, transparent 100%)',
          filter: 'blur(36px)',
          animation: 'cloud-drift-b 70s linear infinite',
          animationDelay: '-35s',
        }} />
        <div style={{
          position: 'absolute',
          top: '1%',
          left: 0,
          width: '170px',
          height: '70px',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.10) 0%, transparent 100%)',
          filter: 'blur(24px)',
          animation: 'cloud-drift-c 115s linear infinite',
          animationDelay: '-60s',
        }} />
      </div>

      {/* Flood: warm radial light from upper-left */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse var(--flood-size) 100% at var(--flood-x) var(--flood-y), rgba(255,195,80,0.55) 0%, rgba(255,175,60,0.2) 35%, transparent 65%)',
        }}
      />

      {/* Shaft A: wide blurred diagonal strip */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftARef}
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-10px',
            width: '160px',
            height: '200%',
            background: 'rgba(255,220,120,0.08)',
            transform: 'rotate(30deg)',
            transformOrigin: 'top left',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Shaft B: narrower blurred strip, offset */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div
          ref={shaftBRef}
          style={{
            position: 'absolute',
            top: '-50%',
            left: '60px',
            width: '80px',
            height: '200%',
            background: 'rgba(255,230,140,0.06)',
            transform: 'rotate(30deg)',
            transformOrigin: 'top left',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Vignette: static dark gradient, right + bottom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(145deg, transparent 30%, rgba(0,0,0,0.35) 100%)',
        }}
      />
    </div>
  );
}
