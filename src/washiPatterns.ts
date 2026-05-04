/**
 * Washi tape pattern catalog.
 *
 * Each pattern provides a `draw` function that renders the tape body texture
 * into the current canvas context in **tape-local coordinates**:
 *   x: 0 → len   (along tape)
 *   y: -hw → hw  (across tape, centred at 0)
 *
 * The draw fn is called AFTER the tape body rect has been filled with
 * `baseColor`, so it only needs to paint the decorative layer on top.
 * It should clip to the tape rect itself if needed.
 */
export interface WashiPattern {
  id: string;
  label: string;
  baseColor: string;
  draw: (ctx: CanvasRenderingContext2D, len: number, hw: number, seed: number) => void;
}

function seededRng(seed: number): () => number {
  let s = (Math.abs(seed * 1000) | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Pattern definitions ───────────────────────────────────────────────────────

const cream: WashiPattern = {
  id: 'cream',
  label: 'Cream',
  baseColor: '#f5e6c8',
  draw(ctx, len, hw) {
    // Subtle vertical grain lines
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(180,150,100,0.18)';
    ctx.lineWidth = 0.5;
    for (let x = 4; x < len; x += 7) {
      ctx.beginPath(); ctx.moveTo(x, -hw); ctx.lineTo(x, hw); ctx.stroke();
    }
    ctx.restore();
  },
};

const blushPink: WashiPattern = {
  id: 'blush',
  label: 'Blush',
  baseColor: '#f2c4ce',
  draw(ctx, len, hw, seed) {
    // Tiny hearts scattered
    const rng = seededRng(seed + 10);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    ctx.fillStyle = 'rgba(220,100,130,0.45)';
    const spacing = hw * 2.2;
    for (let x = spacing * 0.5; x < len; x += spacing) {
      const y = (rng() - 0.5) * hw * 1.1;
      const r = hw * 0.22;
      // Simple heart: two arcs + bottom point
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(r, r);
      ctx.beginPath();
      ctx.moveTo(0, 0.4);
      ctx.bezierCurveTo(-1.2, -0.6, -1.2, -1.4, 0, -1.0);
      ctx.bezierCurveTo(1.2, -1.4, 1.2, -0.6, 0, 0.4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
};

const mintGreen: WashiPattern = {
  id: 'mint',
  label: 'Mint',
  baseColor: '#b8e0d2',
  draw(ctx, len, hw) {
    // Horizontal dashed lines
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(60,140,110,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const y = -hw + ((r + 0.5) / rows) * hw * 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  },
};

const lavender: WashiPattern = {
  id: 'lavender',
  label: 'Lavender',
  baseColor: '#d4b8e0',
  draw(ctx, len, hw, seed) {
    // Scattered small dots
    const rng = seededRng(seed + 30);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    ctx.fillStyle = 'rgba(120,70,180,0.35)';
    const count = Math.floor(len / (hw * 1.4));
    for (let i = 0; i < count; i++) {
      const x = rng() * len;
      const y = (rng() - 0.5) * hw * 1.6;
      const r = hw * 0.14 + rng() * hw * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

const nautical: WashiPattern = {
  id: 'nautical',
  label: 'Nautical',
  baseColor: '#2a4a7f',
  draw(ctx, len, hw) {
    // White horizontal stripes
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const stripeCount = 4;
    const stripeH = (hw * 2) / (stripeCount * 2 - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < stripeCount; i++) {
      const y = -hw + i * stripeH * 2;
      ctx.fillRect(0, y, len, stripeH);
    }
    ctx.restore();
  },
};

const polkaDots: WashiPattern = {
  id: 'dots',
  label: 'Dots',
  baseColor: '#fff5e6',
  draw(ctx, len, hw, seed) {
    const rng = seededRng(seed + 50);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const cols = Math.ceil(len / (hw * 1.6));
    const rows = 2;
    const dotR = hw * 0.28;
    const colors = ['rgba(220,70,60,0.80)', 'rgba(60,130,200,0.75)', 'rgba(50,160,80,0.75)'];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = (c + 0.5) * (len / cols) + (rng() - 0.5) * hw * 0.3;
        const y = -hw + (r + 0.5) * ((hw * 2) / rows) + (rng() - 0.5) * hw * 0.3;
        ctx.fillStyle = colors[(c * rows + r) % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};

const sakura: WashiPattern = {
  id: 'sakura',
  label: 'Sakura',
  baseColor: '#fce8ee',
  draw(ctx, len, hw, seed) {
    const rng = seededRng(seed + 70);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const spacing = hw * 2.5;
    for (let x = spacing * 0.3; x < len; x += spacing) {
      const cy = (rng() - 0.5) * hw * 1.0;
      const size = hw * 0.38;
      const rot = rng() * Math.PI * 2;
      const alpha = 0.65 + rng() * 0.25;
      // 5 petals
      for (let p = 0; p < 5; p++) {
        const pa = rot + (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(pa) * size * 0.38,
          cy + Math.sin(pa) * size * 0.38,
          size * 0.30, 0, Math.PI * 2,
        );
        ctx.fillStyle = `rgba(240,140,170,${alpha})`;
        ctx.fill();
      }
      // Center
      ctx.beginPath();
      ctx.arc(x, cy, size * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,210,100,${alpha + 0.1})`;
      ctx.fill();
    }
    ctx.restore();
  },
};

const leafy: WashiPattern = {
  id: 'leafy',
  label: 'Leafy',
  baseColor: '#d4e8c2',
  draw(ctx, len, hw, seed) {
    const rng = seededRng(seed + 90);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const spacing = hw * 2.0;
    for (let x = spacing * 0.4; x < len; x += spacing) {
      const y = (rng() - 0.5) * hw * 1.2;
      const angle = (rng() - 0.5) * 1.2;
      const lh = hw * 0.55;
      const lw = hw * 0.28;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -lh);
      ctx.bezierCurveTo(lw, -lh * 0.3, lw, lh * 0.3, 0, lh);
      ctx.bezierCurveTo(-lw, lh * 0.3, -lw, -lh * 0.3, 0, -lh);
      ctx.fillStyle = `rgba(60,130,60,${0.45 + rng() * 0.25})`;
      ctx.fill();
      // Midrib
      ctx.beginPath();
      ctx.moveTo(0, -lh); ctx.lineTo(0, lh);
      ctx.strokeStyle = 'rgba(40,100,40,0.30)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
};

const starry: WashiPattern = {
  id: 'starry',
  label: 'Starry',
  baseColor: '#1a2a50',
  draw(ctx, len, hw, seed) {
    const rng = seededRng(seed + 110);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const count = Math.floor(len / (hw * 0.9));
    for (let i = 0; i < count; i++) {
      const x = rng() * len;
      const y = (rng() - 0.5) * hw * 1.7;
      const r = hw * 0.15 + rng() * hw * 0.08;
      const pts = 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      ctx.beginPath();
      for (let s = 0; s < pts * 2; s++) {
        const a = (s / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        const ri = s % 2 === 0 ? r : r * 0.45;
        if (s === 0) ctx.moveTo(Math.cos(a) * ri, Math.sin(a) * ri);
        else ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255,220,80,${0.70 + rng() * 0.25})`;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
};

const confetti: WashiPattern = {
  id: 'confetti',
  label: 'Confetti',
  baseColor: '#fefefe',
  draw(ctx, len, hw, seed) {
    const rng = seededRng(seed + 130);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -hw, len, hw * 2); ctx.clip();
    const colors = [
      'rgba(240,80,100,0.75)', 'rgba(80,160,220,0.75)',
      'rgba(80,200,100,0.75)', 'rgba(250,190,50,0.75)',
      'rgba(190,100,240,0.70)',
    ];
    const count = Math.floor(len / (hw * 0.65));
    for (let i = 0; i < count; i++) {
      const x = rng() * len;
      const y = (rng() - 0.5) * hw * 1.7;
      const w = hw * 0.22 + rng() * hw * 0.12;
      const h = hw * 0.12 + rng() * hw * 0.08;
      const angle = rng() * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  },
};

export const WASHI_PATTERNS: WashiPattern[] = [
  cream,
  blushPink,
  mintGreen,
  lavender,
  nautical,
  polkaDots,
  sakura,
  leafy,
  starry,
  confetti,
];

export function getPattern(id: string): WashiPattern {
  return WASHI_PATTERNS.find(p => p.id === id) ?? cream;
}
