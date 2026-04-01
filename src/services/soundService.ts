export type SoundName =
  | 'wobbleStart'
  | 'paperRustle'
  | 'cardFlip'
  | 'glueSpread'
  | 'glueThud'
  | 'settle'
  | 'peel'
  | 'sparkle'
  | 'tapeRip'
  | 'scissorTrace'
  | 'scissorSnip';

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function whiteNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function paperRustle() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const noise = whiteNoise(ctx, 0.08);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.08);
}

function cardFlip() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.3);
}

function glueSpread() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const noise = whiteNoise(ctx, 1.4);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.3);
  gain.gain.setValueAtTime(0.25, t + 1.0);
  gain.gain.linearRampToValueAtTime(0, t + 1.4);
  // Low rumble underneath
  const rumble = ctx.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 80;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0, t);
  rumbleGain.gain.linearRampToValueAtTime(0.08, t + 0.4);
  rumbleGain.gain.linearRampToValueAtTime(0, t + 1.4);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  rumble.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 1.4);
  rumble.start(t);
  rumble.stop(t + 1.4);
}

function glueThud() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.9, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

function settle() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const noise = whiteNoise(ctx, 0.2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 1.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.2);
}

function peel() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 3 intermittent sticky bursts with descending pitch
  [0, 0.18, 0.42].forEach((offset, i) => {
    const noise = whiteNoise(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 - i * 400;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    const start = t + offset;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
    noise.stop(start + 0.12);
  });
}

function sparkle() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Bright ascending chime tones: E5→G#5→B5→E6→B6
  const tones = [
    { freq: 659,  delay: 0,    gain: 0.20, dur: 0.40 },
    { freq: 831,  delay: 0.06, gain: 0.17, dur: 0.38 },
    { freq: 988,  delay: 0.12, gain: 0.15, dur: 0.35 },
    { freq: 1319, delay: 0.18, gain: 0.13, dur: 0.32 },
    { freq: 1976, delay: 0.09, gain: 0.10, dur: 0.28 },
  ];
  tones.forEach(({ freq, delay, gain: g, dur }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gainNode = ctx.createGain();
    const start = t + delay;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(g, start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
  });
}

function tapeRip() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const noise = whiteNoise(ctx, 0.12);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2800, t);
  filter.frequency.exponentialRampToValueAtTime(1400, t + 0.1);
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.12);
}

function scissorTrace() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Short high-pitched metallic click — like scissor blades brushing
  const noise = whiteNoise(ctx, 0.03);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  filter.Q.value = 2.0;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.03);
}

function scissorSnip() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Two overlapping metallic clicks — like scissor blades closing
  [0, 0.04].forEach((offset) => {
    const noise = whiteNoise(ctx, 0.06);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500 - offset * 5000;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    const start = t + offset;
    gain.gain.setValueAtTime(0.35, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
    noise.stop(start + 0.06);
  });
}

function wobbleStart() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.2);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

const soundFns: Record<SoundName, () => void> = {
  wobbleStart,
  paperRustle,
  cardFlip,
  glueSpread,
  glueThud,
  settle,
  peel,
  sparkle,
  tapeRip,
  scissorTrace,
  scissorSnip,
};

export function playSound(name: SoundName): void {
  try {
    soundFns[name]();
  } catch {
    // Silently fail — sound is enhancement, not critical
  }
}

/**
 * Starts a continuous tape-pull rasp sound. Returns a function to stop it.
 * The stop function fades out over 40ms to prevent audio clicks.
 */
export function startTapePull(): () => void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // ── Background rasp ──────────────────────────────────────────────────────
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);

    // ── Wheel click layer (~13 clicks/sec) ───────────────────────────────────
    // A short buffer with a decaying noise transient at the start, looped.
    // Each period = 1/13s ≈ 77ms. The transient occupies the first ~8ms,
    // the rest is silence — giving a clean click-click-click cadence.
    const clickRate = 13;
    const clickPeriod = Math.ceil(ctx.sampleRate / clickRate);
    const clickBuf = ctx.createBuffer(1, clickPeriod, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    const clickDur = Math.ceil(ctx.sampleRate * 0.008);
    for (let i = 0; i < clickDur; i++) {
      clickData[i] = Math.exp(-i / (ctx.sampleRate * 0.002)) * (Math.random() * 2 - 1);
    }

    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    clickSrc.loop = true;

    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 1800;

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0, t);
    clickGain.gain.linearRampToValueAtTime(0.18, t + 0.05);

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickSrc.start(t);

    // ── Stop ─────────────────────────────────────────────────────────────────
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;

      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04);
      source.stop(now + 0.05);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      clickGain.gain.cancelScheduledValues(now);
      clickGain.gain.setValueAtTime(clickGain.gain.value, now);
      clickGain.gain.linearRampToValueAtTime(0, now + 0.04);
      clickSrc.stop(now + 0.05);
      clickSrc.onended = () => {
        clickSrc.disconnect();
        clickFilter.disconnect();
        clickGain.disconnect();
      };
    };
  } catch {
    return () => {};
  }
}
