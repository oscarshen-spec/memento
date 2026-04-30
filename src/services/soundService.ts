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
  | 'scissorSnip'
  | 'penStroke'
  | 'paperTearSnap'
  | 'drawerSlide';

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

function penStroke() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Slight random variation so each stroke sounds organic
  const freqVariation = 0.8 + Math.random() * 0.4; // 0.8–1.2×
  const noise = whiteNoise(ctx, 0.025);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800 * freqVariation;
  filter.Q.value = 1.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.10, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.025);
  // Thin low-freq ink "wetness" layer
  const ink = ctx.createOscillator();
  ink.type = 'sine';
  ink.frequency.value = 80;
  const inkGain = ctx.createGain();
  inkGain.gain.setValueAtTime(0.03, t);
  inkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  ink.connect(inkGain);
  inkGain.connect(ctx.destination);
  ink.start(t);
  ink.stop(t + 0.025);
}

function paperTearSnap() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const sr = ctx.sampleRate;

  // Modelled on "Paper, Rip, Letter Paper Tear" — thin dry paper, sibilant
  // friction character, peak energy 3–5 kHz, very light low end.

  // ── Sibilant friction burst — the main "rrip" character ─────────────────
  const dur = 0.22;
  const fricBuf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
  const fricData = fricBuf.getChannelData(0);
  for (let i = 0; i < fricData.length; i++) fricData[i] = Math.random() * 2 - 1;
  const fricSrc = ctx.createBufferSource();
  fricSrc.buffer = fricBuf;

  const fricHp = ctx.createBiquadFilter(); // cut mud below 800 Hz (thin paper)
  fricHp.type = 'highpass';
  fricHp.frequency.value = 800;
  fricHp.Q.value = 0.7;

  const fricPeak = ctx.createBiquadFilter(); // boost sibilant presence 3–5 kHz
  fricPeak.type = 'peaking';
  fricPeak.frequency.value = 3800;
  fricPeak.Q.value = 0.9;
  fricPeak.gain.value = 10;

  const fricLp = ctx.createBiquadFilter(); // natural ceiling for paper
  fricLp.type = 'lowpass';
  fricLp.frequency.value = 12000;

  const fricGain = ctx.createGain();
  fricGain.gain.setValueAtTime(0, t);
  fricGain.gain.linearRampToValueAtTime(0.38, t + 0.010); // 10 ms attack
  fricGain.gain.setValueAtTime(0.38, t + 0.06);
  fricGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  fricSrc.connect(fricHp);
  fricHp.connect(fricPeak);
  fricPeak.connect(fricLp);
  fricLp.connect(fricGain);
  fricGain.connect(ctx.destination);
  fricSrc.start(t);
  fricSrc.stop(t + dur + 0.01);

  // ── Final-edge sweep: bandpass descending 6 kHz → 1.5 kHz ───────────────
  // Mimics the tear propagating to the paper edge and the tension releasing.
  const sweepBuf = ctx.createBuffer(1, Math.ceil(sr * 0.18), sr);
  const sweepData = sweepBuf.getChannelData(0);
  for (let i = 0; i < sweepData.length; i++) sweepData[i] = Math.random() * 2 - 1;
  const sweepSrc = ctx.createBufferSource();
  sweepSrc.buffer = sweepBuf;

  const sweepBp = ctx.createBiquadFilter();
  sweepBp.type = 'bandpass';
  sweepBp.frequency.setValueAtTime(6000, t);
  sweepBp.frequency.exponentialRampToValueAtTime(1500, t + 0.16);
  sweepBp.Q.value = 1.2;

  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0, t);
  sweepGain.gain.linearRampToValueAtTime(0.22, t + 0.010);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

  sweepSrc.connect(sweepBp);
  sweepBp.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweepSrc.start(t);
  sweepSrc.stop(t + 0.19);
}

function drawerSlide() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const sr = ctx.sampleRate;
  const dur = 0.28;

  // Low woody thud as drawer starts moving — short sine bump
  const thudOsc = ctx.createOscillator();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(120, t);
  thudOsc.frequency.exponentialRampToValueAtTime(55, t + 0.09);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.45, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  thudOsc.connect(thudGain);
  thudGain.connect(ctx.destination);
  thudOsc.start(t);
  thudOsc.stop(t + 0.09);

  // Sliding friction — bandpass noise sweeping down as drawer glides
  const slideBuf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
  const slideData = slideBuf.getChannelData(0);
  for (let i = 0; i < slideData.length; i++) slideData[i] = Math.random() * 2 - 1;
  const slideSrc = ctx.createBufferSource();
  slideSrc.buffer = slideBuf;

  const slideBp = ctx.createBiquadFilter();
  slideBp.type = 'bandpass';
  slideBp.frequency.setValueAtTime(900, t + 0.02);
  slideBp.frequency.exponentialRampToValueAtTime(320, t + dur);
  slideBp.Q.value = 1.4;

  const slideGain = ctx.createGain();
  slideGain.gain.setValueAtTime(0, t);
  slideGain.gain.linearRampToValueAtTime(0.18, t + 0.04);
  slideGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  slideSrc.connect(slideBp);
  slideBp.connect(slideGain);
  slideGain.connect(ctx.destination);
  slideSrc.start(t + 0.02);
  slideSrc.stop(t + dur + 0.01);

  // Soft settle bump at the end
  const settleOsc = ctx.createOscillator();
  settleOsc.type = 'sine';
  settleOsc.frequency.setValueAtTime(80, t + dur - 0.02);
  settleOsc.frequency.exponentialRampToValueAtTime(40, t + dur + 0.06);
  const settleGain = ctx.createGain();
  settleGain.gain.setValueAtTime(0, t + dur - 0.02);
  settleGain.gain.linearRampToValueAtTime(0.25, t + dur);
  settleGain.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06);
  settleOsc.connect(settleGain);
  settleGain.connect(ctx.destination);
  settleOsc.start(t + dur - 0.02);
  settleOsc.stop(t + dur + 0.07);
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
  penStroke,
  paperTearSnap,
  drawerSlide,
};

export function playSound(name: SoundName): void {
  try {
    soundFns[name]();
  } catch {
    // Silently fail — sound is enhancement, not critical
  }
}

/**
 * Starts a continuous paper-tear ripping sound. Returns a function to stop it.
 * Plays during the drag gesture; call stop when the finger/mouse lifts.
 */
export function startPaperTear(): () => void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const sr = ctx.sampleRate;

    // Modelled on "Paper, Rip, Letter Paper Tear" — slow deliberate thin-paper
    // tear: sustained sibilant dry-paper friction (3–5 kHz dominant), sparse
    // individually-audible fiber snaps (~15/sec), minimal low end.

    // ── Layer A: sustained sibilant friction hiss (65% of mix) ──────────────
    // HP 800 Hz removes mud (letter paper is thin — almost no sub-1k energy).
    // Peaking +10 dB at 3.8 kHz shapes the dry "shhh" paper-friction character.
    // LP 12 kHz is the natural ceiling for uncoated letter paper.
    const hissBuf = ctx.createBuffer(1, sr, sr);
    const hissData = hissBuf.getChannelData(0);
    for (let i = 0; i < sr; i++) hissData[i] = Math.random() * 2 - 1;
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = hissBuf;
    hissSrc.loop = true;

    const hissHp = ctx.createBiquadFilter();
    hissHp.type = 'highpass';
    hissHp.frequency.value = 800;
    hissHp.Q.value = 0.7;

    const hissPeak = ctx.createBiquadFilter();
    hissPeak.type = 'peaking';
    hissPeak.frequency.value = 3800;
    hissPeak.Q.value = 0.9;
    hissPeak.gain.value = 10;

    const hissLp = ctx.createBiquadFilter();
    hissLp.type = 'lowpass';
    hissLp.frequency.value = 12000;

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0, t);
    hissGain.gain.linearRampToValueAtTime(0.05, t + 0.010);

    // Slow LFO (~18 Hz) gives the subtle undulation of a deliberate tear,
    // not the fast crackling of a quick rip.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 18;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.035;
    lfo.connect(lfoDepth);
    lfoDepth.connect(hissGain.gain);
    lfo.start(t);

    hissSrc.connect(hissHp);
    hissHp.connect(hissPeak);
    hissPeak.connect(hissLp);
    hissLp.connect(hissGain);
    hissGain.connect(ctx.destination);
    hissSrc.start(t);

    // ── Layer B: sparse fiber snaps (30% of mix) ─────────────────────────────
    // Slow tear = ~15 snaps/sec, each individually audible — not a dense crackle.
    // Power-law amplitude: E = E_min / U^(1/(α−1)), α=1.4 → exponent=2.5.
    // Each snap is ~10 ms of noise with sharp exponential decay.
    const snapRate = 15;
    const snapPeriod = Math.ceil(sr / snapRate);
    const numSnaps = 30; // 2 s of unique content before loop
    const snapBuf = ctx.createBuffer(1, snapPeriod * numSnaps, sr);
    const snapData = snapBuf.getChannelData(0);
    const snapDur = Math.ceil(sr * 0.010);
    const alpha = 1.4;
    const minAmp = 0.04;
    for (let p = 0; p < numSnaps; p++) {
      const u = Math.max(0.001, Math.random());
      const amp = Math.min(1.0, minAmp / Math.pow(u, 1 / (alpha - 1)));
      const base = p * snapPeriod;
      for (let i = 0; i < snapDur; i++) {
        snapData[base + i] =
          Math.exp(-i / (sr * 0.002)) * (Math.random() * 2 - 1) * amp;
      }
    }
    const snapSrc = ctx.createBufferSource();
    snapSrc.buffer = snapBuf;
    snapSrc.loop = true;

    const snapBp = ctx.createBiquadFilter();
    snapBp.type = 'bandpass';
    snapBp.frequency.value = 3200;
    snapBp.Q.value = 1.0;

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0, t);
    snapGain.gain.linearRampToValueAtTime(0.07, t + 0.010);

    snapSrc.connect(snapBp);
    snapBp.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapSrc.start(t);

    // ── Layer C: very faint paper-body resonance (5% of mix) ─────────────────
    const bodyBuf = ctx.createBuffer(1, sr, sr);
    const bodyData = bodyBuf.getChannelData(0);
    for (let i = 0; i < sr; i++) bodyData[i] = Math.random() * 2 - 1;
    const bodySrc = ctx.createBufferSource();
    bodySrc.buffer = bodyBuf;
    bodySrc.loop = true;

    const bodyBp = ctx.createBiquadFilter();
    bodyBp.type = 'bandpass';
    bodyBp.frequency.value = 280;
    bodyBp.Q.value = 1.2;

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0, t);
    bodyGain.gain.linearRampToValueAtTime(0.012, t + 0.015);

    bodySrc.connect(bodyBp);
    bodyBp.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodySrc.start(t);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      const fade = 0.035;
      const stopAt = now + fade + 0.005;

      lfoDepth.gain.cancelScheduledValues(now);
      lfoDepth.gain.setValueAtTime(lfoDepth.gain.value, now);
      lfoDepth.gain.linearRampToValueAtTime(0, now + fade);
      lfo.stop(stopAt);

      for (const [gainNode, src] of [
        [hissGain, hissSrc],
        [snapGain, snapSrc],
        [bodyGain, bodySrc],
      ] as [GainNode, AudioBufferSourceNode][]) {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fade);
        src.stop(stopAt);
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Starts a card-printer sound: motor hum + paper friction + roller clicks.
 * Returns a stop function — call it when the paper animation completes.
 */
export function startPrinterFeed(): () => void {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // ── Motor hum (~70 Hz sine with slight warble) ───────────────────────────
    const motorOsc = ctx.createOscillator();
    motorOsc.type = 'sine';
    motorOsc.frequency.value = 72;

    const warbleLfo = ctx.createOscillator();
    warbleLfo.type = 'sine';
    warbleLfo.frequency.value = 6;
    const warbleDepth = ctx.createGain();
    warbleDepth.gain.value = 1.8;
    warbleLfo.connect(warbleDepth);
    warbleDepth.connect(motorOsc.frequency);
    warbleLfo.start(t);

    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(0, t);
    motorGain.gain.linearRampToValueAtTime(0.12, t + 0.08);
    motorOsc.connect(motorGain);
    motorGain.connect(ctx.destination);
    motorOsc.start(t);

    // ── Paper-feed friction (bandpass noise, 1 kHz–2.5 kHz) ─────────────────
    const sr = ctx.sampleRate;
    const frictionBuf = ctx.createBuffer(1, sr, sr);
    const frictionData = frictionBuf.getChannelData(0);
    for (let i = 0; i < sr; i++) frictionData[i] = Math.random() * 2 - 1;
    const frictionSrc = ctx.createBufferSource();
    frictionSrc.buffer = frictionBuf;
    frictionSrc.loop = true;

    const frictionBp = ctx.createBiquadFilter();
    frictionBp.type = 'bandpass';
    frictionBp.frequency.value = 1600;
    frictionBp.Q.value = 1.2;

    const frictionGain = ctx.createGain();
    frictionGain.gain.setValueAtTime(0, t);
    frictionGain.gain.linearRampToValueAtTime(0.06, t + 0.08);
    frictionSrc.connect(frictionBp);
    frictionBp.connect(frictionGain);
    frictionGain.connect(ctx.destination);
    frictionSrc.start(t);

    // ── Roller clicks (~7/sec, like a gear advancing paper) ─────────────────
    const clickRate = 7;
    const clickPeriod = Math.ceil(sr / clickRate);
    const clickBuf = ctx.createBuffer(1, clickPeriod, sr);
    const clickData = clickBuf.getChannelData(0);
    const clickDur = Math.ceil(sr * 0.012);
    for (let i = 0; i < clickDur; i++) {
      clickData[i] = Math.exp(-i / (sr * 0.003)) * (Math.random() * 2 - 1);
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    clickSrc.loop = true;

    const clickHp = ctx.createBiquadFilter();
    clickHp.type = 'highpass';
    clickHp.frequency.value = 1200;

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0, t);
    clickGain.gain.linearRampToValueAtTime(0.22, t + 0.08);
    clickSrc.connect(clickHp);
    clickHp.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickSrc.start(t);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      const fade = 0.12;
      const stopAt = now + fade + 0.01;

      for (const [gainNode, src] of [
        [motorGain, motorOsc],
        [frictionGain, frictionSrc],
        [clickGain, clickSrc],
      ] as [GainNode, AudioScheduledSourceNode][]) {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fade);
        src.stop(stopAt);
      }
      warbleLfo.stop(stopAt);
    };
  } catch {
    return () => {};
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
