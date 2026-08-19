/** Procedural Web Audio - chaos pack + ASMR pack + optional ambient. */

type SfxName =
  | "yeet"
  | "impact"
  | "explode"
  | "spawn"
  | "ui"
  | "mission"
  | "record"
  | "pull"
  | "pop"
  | "flush"
  | "glass"
  | "soft"
  | "enough";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let ambientNodes: { osc: OscillatorNode; g: GainNode }[] | null = null;
let unlocked = false;
let muted = false;
let volume = 0.65;
let asmr = true;
let ambientOn = false;

function ensureGraph() {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    ambientBus = ctx.createGain();
    sfxBus.connect(master);
    ambientBus.connect(master);
    master.connect(ctx.destination);
    ambientBus.gain.value = 0;
    applyVolume();
  }
  return ctx;
}

function applyVolume() {
  if (!master || !ctx) return;
  const g = muted ? 0 : volume * volume;
  master.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
}

export function unlockAudio() {
  const c = ensureGraph();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
  if (ambientOn) startAmbient();
}

export function setMuted(m: boolean) {
  muted = m;
  applyVolume();
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  applyVolume();
}

export function setAsmr(v: boolean) {
  asmr = v;
}

export function setAmbientEnabled(v: boolean) {
  ambientOn = v;
  if (v) startAmbient();
  else stopAmbient();
}

export function isMuted() {
  return muted;
}

export function getVolume() {
  return volume;
}

export function resumeAudioIfNeeded() {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function noiseBuffer(duration: number, sampleRate: number) {
  const len = Math.floor(sampleRate * duration);
  const buf = (ctx as AudioContext).createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playTone(
  freq: number,
  type: OscillatorType,
  attack: number,
  decay: number,
  peak: number,
  detune = 0,
) {
  if (!ctx || !sfxBus || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(g);
  g.connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function playNoise(duration: number, peak: number, filterFreq: number, q = 1, type: BiquadFilterType = "bandpass") {
  if (!ctx || !sfxBus || muted) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(duration, ctx.sampleRate);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.Q.setValueAtTime(q, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxBus);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
  };
}

function startAmbient() {
  const c = ensureGraph();
  if (!c || !ambientBus || muted || !ambientOn) return;
  if (ambientNodes) return;
  const freqs = asmr ? [110, 165, 220] : [55, 82, 110];
  ambientNodes = freqs.map((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = f;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(ambientBus!);
    osc.start();
    g.gain.setTargetAtTime(asmr ? 0.018 : 0.01, c.currentTime, 1.2);
    return { osc, g };
  });
  ambientBus.gain.setTargetAtTime(1, c.currentTime, 0.5);
}

function stopAmbient() {
  if (!ctx || !ambientBus || !ambientNodes) return;
  const t = ctx.currentTime;
  for (const n of ambientNodes) {
    n.g.gain.setTargetAtTime(0.0001, t, 0.3);
    try {
      n.osc.stop(t + 0.8);
    } catch {
      /* ignore */
    }
  }
  ambientNodes = null;
}

export function playSfx(name: SfxName, intensity = 1) {
  if (!unlocked && name !== "ui") unlockAudio();
  const c = ensureGraph();
  if (!c || !sfxBus || muted) return;
  if (c.state === "suspended") void c.resume();

  const i = Math.max(0.15, Math.min(1.5, intensity));
  const soft = asmr ? 0.55 : 1;
  const rateJitter = () => 1 + (Math.random() * 2 - 1) * (asmr ? 0.04 : 0.08);

  switch (name) {
    case "pull":
      playTone((asmr ? 180 : 120) * rateJitter(), "sine", 0.01, asmr ? 0.12 : 0.08, 0.05 * i * soft);
      break;
    case "yeet":
      if (asmr) {
        playNoise(0.22, 0.12 * i, 1400, 0.5, "lowpass");
        playTone(160 * rateJitter(), "sine", 0.01, 0.18, 0.12 * i);
      } else {
        playNoise(0.18, 0.22 * i, 900 + 400 * i, 0.7);
        playTone(90 * rateJitter(), "triangle", 0.005, 0.12, 0.28 * i);
        playTone(220 * rateJitter(), "sawtooth", 0.002, 0.08, 0.08 * i);
      }
      break;
    case "soft":
      playTone(240 * rateJitter(), "sine", 0.02, 0.2, 0.1 * i * soft);
      playNoise(0.12, 0.06 * i, 800, 0.4, "lowpass");
      break;
    case "impact":
      if (asmr) {
        playNoise(0.08, 0.08 * i, 400, 0.8, "lowpass");
        playTone(90 * rateJitter(), "sine", 0.005, 0.1, 0.08 * i);
      } else {
        playNoise(0.06 + 0.04 * i, 0.18 * i, 300 + 200 * i, 1.2);
        playTone((110 + 40 * i) * rateJitter(), "square", 0.002, 0.07, 0.12 * i);
      }
      break;
    case "explode":
      playNoise(0.35, (asmr ? 0.22 : 0.45) * i, 180, 0.5);
      playNoise(0.2, (asmr ? 0.12 : 0.25) * i, 1200, 0.8);
      playTone(55 * rateJitter(), "sine", 0.01, 0.4, 0.28 * i * soft);
      break;
    case "pop":
      playNoise(0.05, 0.15 * i * soft, 2200, 1.5);
      playTone(880 * rateJitter(), "sine", 0.002, 0.06, 0.08 * i);
      break;
    case "glass":
      playTone(1200 * rateJitter(), "triangle", 0.002, 0.12, 0.1 * i);
      playTone(1800 * rateJitter(), "sine", 0.002, 0.08, 0.06 * i);
      playNoise(0.08, 0.12 * i, 3000, 2);
      break;
    case "flush":
      playNoise(0.4, 0.2 * i * soft, 600, 0.6, "lowpass");
      playTone(60, "sine", 0.02, 0.45, 0.15 * i);
      playTone(320, "triangle", 0.01, 0.25, 0.06 * i);
      break;
    case "spawn":
      playTone((asmr ? 420 : 520) * rateJitter(), "sine", 0.005, 0.1, 0.07 * i * soft);
      playTone((asmr ? 630 : 780) * rateJitter(), "triangle", 0.005, 0.08, 0.04 * i);
      break;
    case "ui":
      playTone(640 * rateJitter(), "sine", 0.004, 0.05, 0.05 * i * soft);
      break;
    case "mission": {
      const notes = asmr ? [392, 494, 587, 784] : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, idx) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "triangle";
        const start = c.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(f, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.1 * soft, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(g);
        g.connect(sfxBus!);
        osc.start(start);
        osc.stop(start + 0.25);
      });
      break;
    }
    case "record":
      playTone(440, "sine", 0.01, 0.15, 0.1 * soft);
      playTone(660, "triangle", 0.01, 0.2, 0.08 * soft);
      playTone(880, "sine", 0.01, 0.28, 0.06 * soft);
      break;
    case "enough":
      playTone(330, "sine", 0.03, 0.4, 0.1 * soft);
      playTone(247, "sine", 0.04, 0.5, 0.08 * soft);
      playTone(196, "triangle", 0.05, 0.6, 0.06 * soft);
      break;
  }
}

export type { SfxName };
