import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  HS_KEY,
  OBJECT_DEFS,
  THEMES,
  WORRY_LABELS,
  type HighScore,
  type ObjectKind,
  type PlayMode,
  type ScoreState,
} from "@/lib/yeet/types";
import {
  formatProgress,
  getDailyMission,
  isDailyDone,
  loadMissionProgress,
  markDailyDone,
  missionProgressValue,
  MISSIONS,
  saveMissionProgress,
  type MissionDef,
  type MissionProgress,
} from "@/lib/yeet/missions";
import {
  playSfx,
  resumeAudioIfNeeded,
  setAmbientEnabled,
  setAsmr,
  setMuted,
  setVolume,
  unlockAudio,
} from "@/lib/yeet/audio";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  modePreset,
  saveSettings,
  type AppSettings,
} from "@/lib/yeet/settings";
import { bumpJournal, todayJournal, type JournalDay } from "@/lib/yeet/journal";
import {
  Body,
  Bodies,
  Composite,
  Engine,
  Events,
  Query,
  World,
  clamp,
  haptic,
  makeBody,
  roundRect,
  shade,
  type BodyMeta,
  type Particle,
  type Zone,
} from "./engine";

type DragState = {
  body: Matter.Body;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
};

function loadHigh(): HighScore {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return { bestYeet: 0, farthest: 0, chaos: 0, zen: 0, bestCalmStreak: 0, updatedAt: 0 };
    return { bestYeet: 0, farthest: 0, chaos: 0, zen: 0, bestCalmStreak: 0, updatedAt: 0, ...JSON.parse(raw) };
  } catch {
    return { bestYeet: 0, farthest: 0, chaos: 0, zen: 0, bestCalmStreak: 0, updatedAt: 0 };
  }
}

function saveHigh(s: HighScore) {
  try {
    localStorage.setItem(HS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function emptyScore(bestYeet = 0): ScoreState {
  return {
    farthest: 0,
    airTime: 0,
    collisions: 0,
    chaos: 0,
    lastYeet: 0,
    bestYeet,
    zen: 0,
    calmStreak: 0,
    bestCalmStreak: 0,
    yeetsToday: 0,
    flushes: 0,
  };
}

export function YeetGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const metaRef = useRef<Map<number, BodyMeta>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const shakeRef = useRef({ trauma: 0 });
  const sizeRef = useRef({ w: 800, h: 600, dpr: 1 });
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const floorBodiesRef = useRef<Matter.Body[]>([]);
  const zonesRef = useRef<Zone[]>([]);
  const scoreRef = useRef<ScoreState>(emptyScore());
  const gravityRef = useRef(1);
  const bounceRef = useRef(0.7);
  const powerRef = useRef(1);
  const timeScaleRef = useRef(1);
  const slowMoRef = useRef(0);
  const selectedRef = useRef<ObjectKind>("worry");
  const settingsRef = useRef<AppSettings>({ ...DEFAULT_SETTINGS });
  const themeRef = useRef(THEMES[0]);
  const missionRef = useRef<MissionProgress>({ missionIndex: 0, completed: 0 });
  const completingRef = useRef(false);
  const missionDoneFlashRef = useRef(0);
  const lastPullSoundRef = useRef(0);
  const lastUiScoreSyncRef = useRef(0);
  const idleTimerRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const aimRef = useRef({ angle: -0.4, power: 0.6 });
  const sessionEndAtRef = useRef(0);
  const attractRef = useRef(0);

  const [score, setScore] = useState<ScoreState>(emptyScore());
  const [high, setHigh] = useState<HighScore>(loadHigh());
  const [selected, setSelected] = useState<ObjectKind>("worry");
  const [gravity, setGravity] = useState(0.55);
  const [bounce, setBounce] = useState(0.95);
  const [power, setPower] = useState(0.85);
  const [started, setStarted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDataUrl, setShareDataUrl] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enoughOpen, setEnoughOpen] = useState(false);
  const [bodyCount, setBodyCount] = useState(0);
  const [hint, setHint] = useState("Yeet the stress. Clear the challenge.");
  const [missionProg, setMissionProg] = useState<MissionProgress>({ missionIndex: 0, completed: 0 });
  const [missionBanner, setMissionBanner] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [journal, setJournal] = useState<JournalDay>(todayJournal());
  const [sessionLeft, setSessionLeft] = useState<number | null>(null);
  const [breathPhase, setBreathPhase] = useState(0);

  const daily = useMemo(() => getDailyMission(), []);
  const currentMission: MissionDef = MISSIONS[missionProg.missionIndex % MISSIONS.length];
  const showChallenges = settings.showChallenges && settings.mode !== "freeplay";
  const missionCurrent = missionProgressValue(currentMission, score);
  const missionPct = clamp(missionCurrent / currentMission.target, 0, 1);
  const dailyCurrent = missionProgressValue(daily, score);
  const dailyPct = clamp(dailyCurrent / daily.target, 0, 1);
  const dailyComplete = isDailyDone();
  const theme = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];

  const applySettings = useCallback((next: AppSettings, persist = true) => {
    setSettings(next);
    settingsRef.current = next;
    themeRef.current = THEMES.find((t) => t.id === next.theme) ?? THEMES[0];
    setMuted(next.muted);
    setVolume(next.volume);
    setAsmr(next.asmr);
    setAmbientEnabled(next.ambient && !next.muted);
    const preset = modePreset(next.mode);
    setGravity(preset.gravity);
    setBounce(preset.bounce);
    setPower(preset.power);
    gravityRef.current = preset.gravity;
    bounceRef.current = preset.bounce;
    powerRef.current = preset.power;
    timeScaleRef.current = preset.timeScale;
    if (engineRef.current) engineRef.current.gravity.y = 0.6 * preset.gravity;
    if (persist) saveSettings(next);
  }, []);

  useEffect(() => {
    const s = loadSettings();
    const prefers =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefers) s.reducedMotion = true;
    applySettings(s, false);
    setHigh(loadHigh());
    const mp = loadMissionProgress();
    missionRef.current = mp;
    setMissionProg(mp);
    setJournal(todayJournal());
  }, [applySettings]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    gravityRef.current = gravity;
    if (engineRef.current) engineRef.current.gravity.y = 0.6 * gravity;
  }, [gravity]);
  useEffect(() => {
    bounceRef.current = bounce;
  }, [bounce]);
  useEffect(() => {
    powerRef.current = power;
  }, [power]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudioIfNeeded();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (settings.mode !== "zen" && settings.mode !== "soft") return;
    let id = 0;
    const tick = () => {
      setBreathPhase((p) => (p + 0.008) % 1);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [settings.mode]);

  useEffect(() => {
    if (!started || !settings.sessionMinutes) {
      setSessionLeft(null);
      sessionEndAtRef.current = 0;
      return;
    }
    sessionEndAtRef.current = Date.now() + settings.sessionMinutes * 60_000;
    const id = window.setInterval(() => {
      const left = Math.max(0, sessionEndAtRef.current - Date.now());
      setSessionLeft(left);
      if (left <= 0) {
        playSfx("enough");
        setEnoughOpen(true);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [started, settings.sessionMinutes]);

  const checkMission = useCallback((s: ScoreState) => {
    if (!settingsRef.current.showChallenges || settingsRef.current.mode === "freeplay") return;
    if (completingRef.current) return;
    const mp = missionRef.current;
    const mission = MISSIONS[mp.missionIndex % MISSIONS.length];
    if (missionProgressValue(mission, s) >= mission.target) {
      completingRef.current = true;
      playSfx("mission");
      const next: MissionProgress = {
        ...mp,
        missionIndex: (mp.missionIndex + 1) % MISSIONS.length,
        completed: mp.completed + 1,
      };
      missionRef.current = next;
      saveMissionProgress(next);
      setMissionProg(next);
      setMissionBanner(`Cleared: ${mission.title}`);
      setHint(`Next: ${MISSIONS[next.missionIndex].title}`);
      missionDoneFlashRef.current = 1;
      bumpJournal({ challenges: 1 });
      setJournal(todayJournal());
      scoreRef.current = {
        ...emptyScore(s.bestYeet),
        yeetsToday: s.yeetsToday,
        bestCalmStreak: s.bestCalmStreak,
      };
      setScore({ ...scoreRef.current });
      window.setTimeout(() => {
        completingRef.current = false;
        setMissionBanner(null);
      }, 2600);
    }
    if (!isDailyDone()) {
      const d = getDailyMission();
      if (missionProgressValue(d, s) >= d.target) {
        const marked = markDailyDone(missionRef.current);
        missionRef.current = marked;
        setMissionProg(marked);
        playSfx("record");
        setMissionBanner(`Daily done: ${d.title}`);
        bumpJournal({ challenges: 1 });
        setJournal(todayJournal());
      }
    }
  }, []);

  const pushScore = useCallback(() => {
    const s = { ...scoreRef.current };
    setScore(s);
    const h = loadHigh();
    let dirty = false;
    let record = false;
    if (s.bestYeet > h.bestYeet) {
      h.bestYeet = s.bestYeet;
      dirty = true;
      record = true;
    }
    if (s.farthest > h.farthest) {
      h.farthest = s.farthest;
      dirty = true;
      record = true;
    }
    if (s.chaos > h.chaos) {
      h.chaos = s.chaos;
      dirty = true;
      record = true;
    }
    if (s.zen > h.zen) {
      h.zen = s.zen;
      dirty = true;
      record = true;
    }
    if (s.bestCalmStreak > h.bestCalmStreak) {
      h.bestCalmStreak = s.bestCalmStreak;
      dirty = true;
    }
    if (dirty) {
      h.updatedAt = Date.now();
      saveHigh(h);
      setHigh({ ...h });
      if (record) playSfx("record", 0.85);
    }
    checkMission(s);
  }, [checkMission]);

  const spawnBurst = useCallback((x: number, y: number, color: string, n = 14) => {
    const count = settingsRef.current.reducedMotion ? Math.min(6, n) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4,
        max: 0.3 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }, []);

  const createObject = useCallback((kind: ObjectKind, x: number, y: number, extraLabel?: string) => {
    const engine = engineRef.current;
    if (!engine) return null;
    const stamp = kind === "stamp" ? (settingsRef.current.stampText || "YEET").slice(0, 8).toUpperCase() : undefined;
    const worry =
      kind === "worry" ? extraLabel || WORRY_LABELS[Math.floor(Math.random() * WORRY_LABELS.length)] : undefined;
    const { body, meta } = makeBody(kind, x, y, bounceRef.current, stamp || worry);
    metaRef.current.set(body.id, meta);
    World.add(engine.world, body);
    setBodyCount(Composite.allBodies(engine.world).length - floorBodiesRef.current.length);
    return body;
  }, []);

  const rebuildZones = useCallback((w: number, h: number) => {
    zonesRef.current = [
      { x: w * 0.42, y: h * 0.88, w: w * 0.16, h: 36, kind: "sticky" },
      { x: w * 0.62, y: h * 0.88, w: w * 0.14, h: 36, kind: "ice" },
      { x: w * 0.78, y: h * 0.88, w: w * 0.12, h: 36, kind: "bounce" },
    ];
  }, []);

  const resetWorld = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const keep = new Set(floorBodiesRef.current.map((b) => b.id));
    for (const b of Composite.allBodies(engine.world)) {
      if (!keep.has(b.id)) {
        World.remove(engine.world, b);
        metaRef.current.delete(b.id);
      }
    }
    particlesRef.current = [];
    dragRef.current = null;
    scoreRef.current = emptyScore(scoreRef.current.bestYeet);
    setScore({ ...scoreRef.current });
    setBodyCount(0);
    const { w, h } = sizeRef.current;
    const pad = Math.min(w * 0.14, 110);
    createObject("worry", pad, h * 0.5);
    createObject("pillow", pad + 70, h * 0.52);
    createObject("orb", pad + 130, h * 0.48);
    createObject("slime", pad + 40, h * 0.32);
    playSfx("ui");
    setHint(
      settingsRef.current.mode === "freeplay"
        ? "Freeplay - no pressure, just yeet."
        : `Challenge: ${MISSIONS[missionRef.current.missionIndex % MISSIONS.length].title}`,
    );
  }, [createObject]);

  const flushAll = useCallback(() => {
    unlockAudio();
    const engine = engineRef.current;
    if (!engine) return;
    const { w } = sizeRef.current;
    for (const b of Composite.allBodies(engine.world).filter((x) => !x.isStatic)) {
      Body.applyForce(b, b.position, {
        x: (0.05 + Math.random() * 0.04) * powerRef.current,
        y: -0.04 - Math.random() * 0.03,
      });
      spawnBurst(b.position.x, b.position.y, themeRef.current.accent, 8);
    }
    for (let i = 0; i < 30; i++) spawnBurst(Math.random() * w, 40 + Math.random() * 80, themeRef.current.accent, 2);
    scoreRef.current.flushes += 1;
    scoreRef.current.chaos += 20;
    scoreRef.current.zen += 15;
    playSfx("flush");
    if (settingsRef.current.haptics) haptic(30);
    bumpJournal({ flushes: 1 });
    setJournal(todayJournal());
    pushScore();
    setHint("Desk cleared. Breathe.");
    window.setTimeout(() => {
      const eng = engineRef.current;
      if (!eng) return;
      for (const b of Composite.allBodies(eng.world)) {
        if (!b.isStatic && (b.position.x > sizeRef.current.w + 80 || b.position.y < -120)) {
          World.remove(eng.world, b);
          metaRef.current.delete(b.id);
        }
      }
      setBodyCount(Composite.allBodies(eng.world).length - floorBodiesRef.current.length);
    }, 900);
  }, [pushScore, spawnBurst]);

  const applyYeet = useCallback(
    (body: Matter.Body, fromX: number, fromY: number, toX: number, toY: number) => {
      const dx = fromX - toX;
      const dy = fromY - toY;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) return;
      const scale = 0.0018 * powerRef.current;
      const maxF = 0.12 * powerRef.current;
      let fx = dx * scale;
      let fy = dy * scale;
      const mag = Math.hypot(fx, fy);
      if (mag > maxF) {
        fx = (fx / mag) * maxF;
        fy = (fy / mag) * maxF;
      }
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.applyForce(body, body.position, { x: fx, y: fy });
      const strength = Math.min(1, dist / 180) * powerRef.current;
      const yeetScore = Math.round(strength * 1000);
      scoreRef.current.lastYeet = yeetScore;
      if (yeetScore > scoreRef.current.bestYeet) scoreRef.current.bestYeet = yeetScore;
      scoreRef.current.chaos += Math.round(strength * 12);
      scoreRef.current.yeetsToday += 1;
      const meta = metaRef.current.get(body.id);
      if (meta) {
        meta.yeeted = true;
        meta.maxDist = 0;
        meta.airAccum = 0;
      }
      const calmBonus = meta?.def.calm ? 8 : 0;
      const smooth = strength > 0.25 && strength < 0.85 ? 12 : 4;
      scoreRef.current.zen += smooth + calmBonus;
      if (meta?.def.calm || (strength < 0.75 && meta?.kind !== "bomb")) {
        scoreRef.current.calmStreak += 1;
        scoreRef.current.bestCalmStreak = Math.max(scoreRef.current.bestCalmStreak, scoreRef.current.calmStreak);
      } else if (meta?.kind === "bomb" || strength > 0.95) {
        scoreRef.current.calmStreak = 0;
      }
      if (strength > 0.45 && strength < 0.8 && !settingsRef.current.reducedMotion) slowMoRef.current = 0.45;
      spawnBurst(body.position.x, body.position.y, meta?.def.rim ?? themeRef.current.accent, 16);
      if (!settingsRef.current.reducedMotion) {
        shakeRef.current.trauma = Math.min(
          1,
          shakeRef.current.trauma + (settingsRef.current.mode === "zen" ? 0.08 : 0.22) + strength * 0.25,
        );
      }
      playSfx(meta?.def.calm ? "soft" : "yeet", 0.45 + strength * 0.75);
      if (settingsRef.current.haptics) haptic(10 + strength * 20);
      bumpJournal({ yeets: 1, zen: scoreRef.current.zen, calmBest: scoreRef.current.bestCalmStreak });
      setJournal(todayJournal());
      pushScore();
      idleTimerRef.current = 0;
      setHint(meta?.kind === "worry" ? `Yeeted "${meta.label ?? "worry"}". Nice.` : "Stack hits or keep it soft.");
    },
    [pushScore, spawnBurst],
  );

  const bigYeet = useCallback(() => {
    unlockAudio();
    const engine = engineRef.current;
    if (!engine) return;
    const { w, h } = sizeRef.current;
    const bodies = Composite.allBodies(engine.world).filter((b) => !b.isStatic && metaRef.current.has(b.id));
    if (bodies.length === 0) {
      const pad = Math.min(w * 0.14, 110);
      const b = createObject(selectedRef.current, pad, h * 0.55);
      if (b) applyYeet(b, pad, h * 0.55, pad - 160 * powerRef.current, h * 0.55 - 80 * powerRef.current);
      return;
    }
    bodies.sort((a, b) => a.position.x - b.position.x);
    const target = bodies[0];
    const ang = aimRef.current.angle;
    const pwr = 120 + aimRef.current.power * 120 * powerRef.current;
    applyYeet(target, target.position.x, target.position.y, target.position.x - Math.cos(ang) * pwr, target.position.y - Math.sin(ang) * pwr * 0.7);
  }, [applyYeet, createObject]);

  const captureShare = useCallback(() => {
    unlockAudio();
    playSfx("ui");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    const out = document.createElement("canvas");
    out.width = Math.min(1200, Math.floor(w * 2));
    out.height = Math.min(675, Math.floor(h * 2));
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const th = themeRef.current;
    ctx.fillStyle = th.bg1;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height * 0.76);
    const fh = out.height * 0.24;
    ctx.fillStyle = "#111318";
    ctx.fillRect(0, out.height - fh, out.width, fh);
    ctx.fillStyle = th.accent;
    ctx.font = `700 ${Math.floor(out.width * 0.04)}px system-ui,sans-serif`;
    ctx.fillText("YEET", 28, out.height - fh + fh * 0.32);
    ctx.fillStyle = "#eef0f4";
    ctx.font = `600 ${Math.floor(out.width * 0.022)}px system-ui,sans-serif`;
    const s = scoreRef.current;
    ctx.fillText(`Yeet ${s.bestYeet} · Zen ${s.zen} · Chaos ${s.chaos} · Far ${Math.round(s.farthest)}m`, 28, out.height - fh + fh * 0.55);
    ctx.fillStyle = "#8b919c";
    ctx.font = `500 ${Math.floor(out.width * 0.018)}px system-ui,sans-serif`;
    ctx.fillText(`Challenges ${missionRef.current.completed} · Calm ${s.bestCalmStreak} · ${settingsRef.current.mode}`, 28, out.height - fh + fh * 0.78);
    ctx.textAlign = "right";
    ctx.fillText("yeet.grok.me", out.width - 28, out.height - fh + fh * 0.45);
    ctx.textAlign = "left";
    setShareDataUrl(out.toDataURL("image/png"));
    setShareOpen(true);
  }, []);

  // Physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const engine = Engine.create({ gravity: { x: 0, y: 0.6 * gravityRef.current, scale: 0.001 } });
    engine.positionIterations = 8;
    engine.velocityIterations = 6;
    engineRef.current = engine;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(420, Math.floor(rect.height));
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      for (const b of floorBodiesRef.current) World.remove(engine.world, b);
      const thick = 80;
      const wallOpts = { isStatic: true, friction: 0.4, restitution: 0.2, label: "wall" };
      const floor = Bodies.rectangle(w / 2, h + thick / 2 - 4, w + 200, thick, wallOpts);
      const left = Bodies.rectangle(-thick / 2, h / 2, thick, h * 2, wallOpts);
      const right = Bodies.rectangle(w + thick / 2, h / 2, thick, h * 2, wallOpts);
      const ceiling = Bodies.rectangle(w / 2, -thick / 2, w + 200, thick, wallOpts);
      const p1 = Bodies.rectangle(w * 0.55, h * 0.7, w * 0.2, 16, { ...wallOpts, label: "platform", chamfer: { radius: 6 } });
      const p2 = Bodies.rectangle(w * 0.78, h * 0.46, w * 0.14, 14, { ...wallOpts, label: "breakable", chamfer: { radius: 4 } });
      metaRef.current.set(p2.id, {
        kind: "brick",
        def: OBJECT_DEFS.find((d) => d.id === "brick")!,
        yeeted: false,
        airAccum: 0,
        maxDist: 0,
        hp: 3,
        platform: true,
        destructible: true,
      });
      floorBodiesRef.current = [floor, left, right, ceiling, p1, p2];
      World.add(engine.world, floorBodiesRef.current);
      rebuildZones(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    Events.on(engine, "collisionStart", (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const ma = metaRef.current.get(a.id);
        const mb = metaRef.current.get(b.id);
        if (!ma && !mb) continue;
        const impact = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        if (impact < 1.1) continue;
        scoreRef.current.collisions += 1;
        scoreRef.current.chaos += Math.round(impact * 2);
        if (impact > 6) scoreRef.current.zen = Math.max(0, scoreRef.current.zen - 2);
        const cx = (a.position.x + b.position.x) / 2;
        const cy = (a.position.y + b.position.y) / 2;
        spawnBurst(cx, cy, ma?.def.rim ?? mb?.def.rim ?? themeRef.current.accent, Math.min(18, 5 + Math.floor(impact)));
        if (!settingsRef.current.reducedMotion) {
          shakeRef.current.trauma = Math.min(1, shakeRef.current.trauma + Math.min(0.4, impact * 0.035));
        }
        playSfx("impact", Math.min(1.3, 0.3 + impact * 0.1));

        for (const [body, meta] of [[a, ma], [b, mb]] as const) {
          if (!meta?.def.fragile || !body) continue;
          if (impact > 3.5) {
            spawnBurst(body.position.x, body.position.y, meta.def.rim, 22);
            playSfx(meta.kind === "glass" ? "glass" : "pop", 1);
            World.remove(engine.world, body);
            metaRef.current.delete(body.id);
            scoreRef.current.chaos += 12;
            scoreRef.current.zen += meta.kind === "bubble" ? 6 : 2;
          }
        }
        for (const [body, meta] of [[a, ma], [b, mb]] as const) {
          if (!meta?.destructible || !body) continue;
          if (impact > 5) {
            meta.hp -= 1;
            if (meta.hp <= 0) {
              spawnBurst(body.position.x, body.position.y, "#94a3b8", 24);
              playSfx("glass", 0.8);
              World.remove(engine.world, body);
              metaRef.current.delete(body.id);
              floorBodiesRef.current = floorBodiesRef.current.filter((x) => x.id !== body.id);
              scoreRef.current.chaos += 25;
            }
          }
        }
        const bombBody = ma?.def.explosive ? a : mb?.def.explosive ? b : null;
        if (bombBody && impact > 4) {
          for (const o of Composite.allBodies(engine.world).filter((bd) => !bd.isStatic && bd.id !== bombBody.id)) {
            const dx = o.position.x - bombBody.position.x;
            const dy = o.position.y - bombBody.position.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 220) {
              const f = (0.08 * (1 - d / 220)) / d;
              Body.applyForce(o, o.position, { x: dx * f, y: dy * f });
            }
          }
          spawnBurst(bombBody.position.x, bombBody.position.y, "#a3e635", 36);
          scoreRef.current.chaos += 40;
          scoreRef.current.calmStreak = 0;
          playSfx("explode", 1.1);
          if (settingsRef.current.haptics) haptic(40);
          World.remove(engine.world, bombBody);
          metaRef.current.delete(bombBody.id);
        }
      }
      setBodyCount(Composite.allBodies(engine.world).length - floorBodiesRef.current.length);
      pushScore();
    });

    const { w, h } = sizeRef.current;
    const pad = Math.min(w * 0.14, 110);
    createObject("worry", pad, h * 0.5);
    createObject("pillow", pad + 72, h * 0.52);
    createObject("orb", pad + 130, h * 0.46);
    createObject("bubble", pad + 50, h * 0.3);
    createObject("slime", pad + 110, h * 0.3);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawHex = (r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const drawBody = (body: Matter.Body) => {
      const meta = metaRef.current.get(body.id);
      if (!meta || meta.platform) return;
      const { def } = meta;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      const hc = settingsRef.current.highContrast;
      if (def.shape === "rect" || def.shape === "soft") {
        const hw = def.radius * (def.shape === "soft" ? 0.95 : 0.85);
        const hh = def.radius * (def.shape === "soft" ? 0.7 : 0.55);
        ctx.fillStyle = def.color;
        ctx.strokeStyle = hc ? "#fff" : def.rim;
        ctx.lineWidth = hc ? 4 : 3;
        roundRect(ctx, -hw, -hh, hw * 2, hh * 2, def.shape === "soft" ? 16 : 6);
        ctx.fill();
        ctx.stroke();
      } else if (def.shape === "hex") {
        drawHex(def.radius);
        ctx.fillStyle = def.color;
        ctx.strokeStyle = hc ? "#fff" : def.rim;
        ctx.lineWidth = hc ? 4 : 3;
        ctx.fill();
        ctx.stroke();
      } else {
        const r = def.radius;
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, def.rim);
        g.addColorStop(0.55, def.color);
        g.addColorStop(1, shade(def.color, -40));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = hc ? 4 : 3;
        ctx.strokeStyle = hc ? "#fff" : "rgba(255,255,255,0.22)";
        ctx.stroke();
        if (def.id === "bubble") {
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.beginPath();
          ctx.arc(-r * 0.25, -r * 0.25, r * 0.25, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const text = meta.label || def.glyph;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = `700 ${Math.floor(def.radius * (meta.label ? 0.42 : 0.9))}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 1);
      ctx.restore();
    };

    const drawStatic = (body: Matter.Body) => {
      if (body.label !== "platform" && body.label !== "breakable") return;
      const verts = body.vertices;
      const th = themeRef.current;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.fillStyle = body.label === "breakable" ? "#2a3140" : th.platform;
      ctx.strokeStyle = body.label === "breakable" ? "#f87171" : "#2f3746";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    };

    const frame = (ts: number) => {
      const last = lastTsRef.current || ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      dt = Math.min(dt, 0.05);
      if (slowMoRef.current > 0) slowMoRef.current = Math.max(0, slowMoRef.current - dt);
      const scale = timeScaleRef.current * (slowMoRef.current > 0 ? 0.35 : 1);
      Engine.update(engine, (1000 / 60) * scale);

      for (const body of Composite.allBodies(engine.world)) {
        if (body.isStatic) continue;
        const meta = metaRef.current.get(body.id);
        if (!meta) continue;
        for (const z of zonesRef.current) {
          if (
            body.position.x > z.x - z.w / 2 &&
            body.position.x < z.x + z.w / 2 &&
            body.position.y > z.y - z.h / 2 &&
            body.position.y < z.y + z.h / 2
          ) {
            if (z.kind === "sticky") Body.setVelocity(body, { x: body.velocity.x * 0.92, y: body.velocity.y * 0.92 });
            else if (z.kind === "ice") Body.setVelocity(body, { x: body.velocity.x * 1.01, y: body.velocity.y * 0.995 });
            else if (z.kind === "bounce" && body.velocity.y > 0.5)
              Body.setVelocity(body, { x: body.velocity.x, y: -Math.abs(body.velocity.y) * 1.15 });
          }
        }
        if (meta.yeeted) {
          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          if (speed > 0.35) {
            meta.airAccum += dt;
            scoreRef.current.airTime = Math.max(scoreRef.current.airTime, meta.airAccum);
          }
          const dist = Math.max(0, body.position.x - 40) / 10;
          if (dist > meta.maxDist) {
            meta.maxDist = dist;
            scoreRef.current.farthest = Math.max(scoreRef.current.farthest, dist);
          }
        }
      }

      idleTimerRef.current += dt;
      if (idleTimerRef.current > 6 && !dragRef.current) {
        attractRef.current += dt;
        if (attractRef.current > 2.5) {
          attractRef.current = 0;
          const bodies = Composite.allBodies(engine.world).filter((b) => !b.isStatic);
          const b = bodies[Math.floor(Math.random() * bodies.length)];
          if (b) Body.applyForce(b, b.position, { x: (Math.random() - 0.3) * 0.008, y: -0.01 - Math.random() * 0.008 });
        }
      }

      const keys = keysRef.current;
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) aimRef.current.angle += dt * 1.2;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) aimRef.current.angle -= dt * 1.2;
      if (keys["ArrowUp"] || keys["w"] || keys["W"]) aimRef.current.power = clamp(aimRef.current.power + dt * 0.5, 0.2, 1);
      if (keys["ArrowDown"] || keys["s"] || keys["S"]) aimRef.current.power = clamp(aimRef.current.power - dt * 0.5, 0.2, 1);

      if (ts - lastUiScoreSyncRef.current > 200) {
        lastUiScoreSyncRef.current = ts;
        setScore({ ...scoreRef.current });
        checkMission(scoreRef.current);
      }

      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 280 * dt;
        p.vx *= 0.98;
        if (p.life <= 0) parts.splice(i, 1);
      }
      shakeRef.current.trauma = Math.max(0, shakeRef.current.trauma - dt * 1.6);
      if (missionDoneFlashRef.current > 0) missionDoneFlashRef.current = Math.max(0, missionDoneFlashRef.current - dt * 0.8);

      const { w: cw, h: ch, dpr } = sizeRef.current;
      const th = themeRef.current;
      const trauma = settingsRef.current.reducedMotion ? 0 : shakeRef.current.trauma;
      const shakeAmt = trauma * trauma;
      const ox = (Math.random() * 2 - 1) * shakeAmt * 10;
      const oy = (Math.random() * 2 - 1) * shakeAmt * 10;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, th.bg0);
      bg.addColorStop(1, th.bg1);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < cw; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
        ctx.stroke();
      }
      for (let y = 0; y < ch; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }
      for (const z of zonesRef.current) {
        ctx.fillStyle = z.kind === "sticky" ? "rgba(74,222,128,0.12)" : z.kind === "ice" ? "rgba(125,211,252,0.12)" : "rgba(251,191,36,0.12)";
        roundRect(ctx, z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 8);
        ctx.fill();
        ctx.fillStyle = "rgba(238,240,244,0.35)";
        ctx.font = "600 10px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(z.kind, z.x, z.y + 3);
      }
      const launchPad = Math.min(cw * 0.14, 110);
      ctx.fillStyle = "rgba(94,234,212,0.05)";
      ctx.fillRect(0, 0, launchPad + 80, ch);
      for (const m of [40, 80]) {
        const gx = 40 + m * 10;
        if (gx < cw - 20) {
          ctx.strokeStyle = "rgba(94,234,212,0.18)";
          ctx.beginPath();
          ctx.moveTo(gx, ch * 0.12);
          ctx.lineTo(gx, ch - 28);
          ctx.stroke();
          ctx.fillStyle = "rgba(238,240,244,0.2)";
          ctx.font = "600 11px system-ui,sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${m}m`, gx + 4, ch * 0.12 + 12);
        }
      }
      for (const body of Composite.allBodies(engine.world)) if (body.isStatic) drawStatic(body);
      for (const body of Composite.allBodies(engine.world)) if (!body.isStatic) drawBody(body);
      for (const p of parts) {
        const a = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (missionDoneFlashRef.current > 0) {
        ctx.fillStyle = `rgba(94,234,212,${missionDoneFlashRef.current * 0.12})`;
        ctx.fillRect(0, 0, cw, ch);
      }
      const drag = dragRef.current;
      if (drag) {
        const { body, curX, curY } = drag;
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(body.position.x, body.position.y);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        const dx = body.position.x - curX;
        const dy = body.position.y - curY;
        let px = body.position.x;
        let py = body.position.y;
        let vx = dx * 0.18 * powerRef.current;
        let vy = dy * 0.18 * powerRef.current;
        ctx.fillStyle = "rgba(238,240,244,0.5)";
        for (let i = 0; i < 16; i++) {
          px += vx * 0.35;
          py += vy * 0.35;
          vy += 0.9 * gravityRef.current;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (settingsRef.current.keyboardHints) {
        const bodies = Composite.allBodies(engine.world).filter((b) => !b.isStatic && metaRef.current.has(b.id));
        if (bodies.length) {
          bodies.sort((a, b) => a.position.x - b.position.x);
          const t = bodies[0];
          const ang = aimRef.current.angle;
          const pwr = 40 + aimRef.current.power * 80;
          ctx.strokeStyle = "rgba(238,240,244,0.25)";
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(t.position.x, t.position.y);
          ctx.lineTo(t.position.x + Math.cos(ang) * pwr, t.position.y + Math.sin(ang) * pwr * 0.7);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      Events.off(engine, "collisionStart");
      World.clear(engine.world, false);
      Engine.clear(engine);
      engineRef.current = null;
      metaRef.current.clear();
    };
  }, [checkMission, createObject, pushScore, rebuildZones, spawnBurst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (sizeRef.current.w / rect.width),
        y: (e.clientY - rect.top) * (sizeRef.current.h / rect.height),
      };
    };
    const onDown = (e: PointerEvent) => {
      unlockAudio();
      setStarted(true);
      idleTimerRef.current = 0;
      const p = toLocal(e);
      const engine = engineRef.current;
      if (!engine) return;
      const hits = Query.point(Composite.allBodies(engine.world).filter((b) => !b.isStatic), p);
      if (hits.length > 0) {
        const body = hits[hits.length - 1];
        dragRef.current = { body, startX: body.position.x, startY: body.position.y, curX: p.x, curY: p.y };
        Body.setStatic(body, true);
        Body.setVelocity(body, { x: 0, y: 0 });
        playSfx("pull", 0.45);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e);
      const drag = dragRef.current;
      if (!drag) return;
      drag.curX = p.x;
      drag.curY = p.y;
      Body.setPosition(drag.body, {
        x: drag.startX + (p.x - drag.startX) * 0.12,
        y: drag.startY + (p.y - drag.startY) * 0.12,
      });
      const pull = Math.hypot(p.x - drag.startX, p.y - drag.startY);
      const now = performance.now();
      if (pull > 40 && now - lastPullSoundRef.current > 180) {
        lastPullSoundRef.current = now;
        playSfx("pull", 0.2 + Math.min(0.45, pull / 400));
      }
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag) {
        Body.setStatic(drag.body, false);
        applyYeet(drag.body, drag.body.position.x, drag.body.position.y, drag.curX, drag.curY);
        dragRef.current = null;
      }
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [applyYeet]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.code === "Space") {
        e.preventDefault();
        unlockAudio();
        setStarted(true);
        bigYeet();
      }
      if (e.key === "f" || e.key === "F") flushAll();
      if (e.key === "r" || e.key === "R") resetWorld();
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [bigYeet, flushAll, resetWorld]);

  const spawnSelected = () => {
    unlockAudio();
    setStarted(true);
    const { w, h } = sizeRef.current;
    const pad = Math.min(w * 0.14, 110);
    createObject(selected, pad + (Math.random() - 0.5) * 40, h * 0.35 + Math.random() * 40);
    playSfx("spawn");
  };

  const spawnWorry = () => {
    setSelected("worry");
    selectedRef.current = "worry";
    unlockAudio();
    setStarted(true);
    const { w, h } = sizeRef.current;
    const pad = Math.min(w * 0.14, 110);
    createObject("worry", pad + (Math.random() - 0.5) * 30, h * 0.4);
    playSfx("spawn");
    setHint("Labelled a worry - fling it away.");
  };

  const patchSettings = (partial: Partial<AppSettings>) => {
    applySettings({ ...settingsRef.current, ...partial });
  };

  const beginPlay = () => {
    unlockAudio();
    playSfx("ui");
    setStarted(true);
    setHint(settings.mode === "freeplay" ? "Freeplay sandbox. No challenges." : `Challenge: ${currentMission.title}`);
  };

  const enoughForToday = () => {
    playSfx("enough");
    setEnoughOpen(true);
    setJournal(todayJournal());
  };

  const compact = settings.compactHud;
  const breathScale = 0.85 + Math.sin(breathPhase * Math.PI * 2) * 0.12;

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-bg text-fg" style={{ ["--color-accent" as string]: theme.accent } as CSSProperties}>
      <header className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-4 ${compact ? "opacity-90" : ""}`}>
        <div className="pointer-events-auto min-w-0 max-w-[46%] rounded-xl border border-border bg-surface/90 px-2.5 py-1.5 backdrop-blur-md sm:px-4 sm:py-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight sm:text-xl">YEET</h1>
            <span className="hidden text-xs text-muted sm:inline">stress reliever</span>
          </div>
          {!compact && <p className="mt-0.5 truncate text-[10px] text-subtle sm:text-xs">{hint}</p>}
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <div className={`grid gap-1 ${compact ? "grid-cols-2" : "grid-cols-2 sm:flex"}`}>
            <StatChip label="Yeet" value={score.lastYeet || score.bestYeet} accent compact={compact} />
            <StatChip label="Zen" value={score.zen} compact={compact} />
            {!compact && (
              <>
                <StatChip label="Chaos" value={score.chaos} compact={compact} />
                <StatChip label="Calm" value={score.calmStreak} compact={compact} />
              </>
            )}
          </div>
          <div className="flex gap-1">
            <button type="button" className="rounded-lg border border-border bg-surface/90 px-2 py-1 text-[10px] text-muted hover:text-fg" onClick={() => { unlockAudio(); patchSettings({ muted: !settings.muted }); if (settings.muted) playSfx("ui"); }}>
              {settings.muted ? "Muted" : "Sound"}
            </button>
            <button type="button" className="rounded-lg border border-border bg-surface/90 px-2 py-1 text-[10px] text-muted hover:text-fg" onClick={() => { playSfx("ui"); setSettingsOpen(true); }}>
              Menu
            </button>
          </div>
        </div>
      </header>

      {showChallenges && (
        <div className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-2 ${compact ? "top-[3.6rem]" : "top-[4.6rem] sm:top-[5.1rem]"}`}>
          <div className="pointer-events-auto w-full max-w-md space-y-1.5">
            <div className="rounded-xl border border-border bg-surface/90 px-3 py-2 backdrop-blur-md">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-accent">Challenge {missionProg.completed + 1}</p>
                  <p className="truncate text-sm font-semibold">{currentMission.title}</p>
                  {!compact && <p className="text-[11px] text-muted">{currentMission.blurb}</p>}
                </div>
                <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-score">{formatProgress(currentMission, missionCurrent)}</p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent" style={{ width: `${missionPct * 100}%` }} />
              </div>
            </div>
            {!dailyComplete && (
              <div className="rounded-xl border border-border/80 bg-surface/80 px-3 py-1.5 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] text-muted"><span className="font-medium text-fg">Daily:</span> {daily.title}</p>
                  <p className="font-mono text-[10px] tabular-nums text-subtle">{formatProgress(daily, dailyCurrent)}</p>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${dailyPct * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {missionBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-[10rem] z-30 flex justify-center px-3">
          <div className="rounded-full border border-accent/40 bg-accent/15 px-4 py-1.5 text-xs font-semibold text-accent backdrop-blur-md">{missionBanner}</div>
        </div>
      )}

      {(settings.mode === "soft" || settings.mode === "zen") && started && (
        <div className="pointer-events-none absolute bottom-[11.5rem] left-3 z-10 sm:bottom-[10rem]">
          <div className="h-12 w-12 rounded-full border border-accent/40 bg-accent/10" style={{ transform: `scale(${breathScale})` }} title="Breathe with the ring" />
        </div>
      )}

      {sessionLeft !== null && (
        <div className="pointer-events-none absolute bottom-[11.5rem] right-3 z-10 rounded-lg border border-border bg-surface/90 px-2 py-1 font-mono text-[10px] tabular-nums text-muted sm:bottom-[10rem]">
          {Math.ceil(sessionLeft / 1000)}s
        </div>
      )}

      <div ref={wrapRef} className="relative min-h-0 flex-1 touch-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" style={{ touchAction: "none" }} />
        {!started && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-bg/50 p-4">
            <div className="pointer-events-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface px-5 py-6 text-center shadow-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">yeet.grok.me</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">In-Timeline stress dump</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Spawn worries, memes, slime, and glass. Slingshot them into sticky floors, ice, and bounce pads. Soft soothes; chaos thrash-clears.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-left text-[11px] text-muted">
                <div className="rounded-lg border border-border bg-surface-2 p-2"><p className="font-medium text-fg">Modes</p>Soft · Zen · Chaos · Freeplay</div>
                <div className="rounded-lg border border-border bg-surface-2 p-2"><p className="font-medium text-fg">Toys</p>Worries · Bombs · Bubbles · Slime</div>
                <div className="rounded-lg border border-border bg-surface-2 p-2"><p className="font-medium text-fg">Zones</p>Sticky · Ice · Bounce</div>
                <div className="rounded-lg border border-border bg-surface-2 p-2"><p className="font-medium text-fg">Keys</p>Space yeet · F flush · arrows aim</div>
              </div>
              {showChallenges && (
                <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-xs">
                  <span className="font-medium text-accent">Now: </span>{currentMission.title} - {currentMission.blurb}
                </p>
              )}
              <button type="button" onClick={beginPlay} className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg active:scale-[0.98]">Start yeeting</button>
            </div>
          </div>
        )}
      </div>

      <footer className="z-20 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md sm:px-4 sm:pt-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {OBJECT_DEFS.map((def) => {
              const active = selected === def.id;
              return (
                <button key={def.id} type="button" onClick={() => { setSelected(def.id); playSfx("ui", 0.5); }}
                  className={`flex min-w-[3.6rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-1.5 sm:min-w-[4.1rem] ${active ? "border-accent bg-accent/10 text-fg" : "border-border bg-surface-2 text-muted"}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black/70"
                    style={{ background: `radial-gradient(circle at 30% 30%, ${def.rim}, ${def.color})` }}>{def.glyph}</span>
                  <span className="text-[9px] font-medium">{def.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button type="button" onClick={spawnSelected} className="min-h-10 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-xs font-medium sm:min-h-11 sm:text-sm">Spawn</button>
            <button type="button" onClick={spawnWorry} className="min-h-10 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-xs font-medium sm:min-h-11 sm:text-sm">Worry</button>
            <button type="button" onClick={() => { setStarted(true); bigYeet(); }} className="min-h-10 min-w-[5.5rem] flex-[1.3] rounded-xl bg-accent px-3 text-sm font-bold text-accent-fg sm:min-h-11">YEET</button>
            <button type="button" onClick={flushAll} className="min-h-10 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-xs font-medium sm:min-h-11 sm:text-sm">Flush</button>
            <button type="button" onClick={captureShare} className="min-h-10 rounded-xl border border-border px-2 text-xs font-medium text-muted sm:min-h-11 sm:text-sm">Share</button>
          </div>
          {!compact && (
            <div className="grid grid-cols-3 gap-1.5">
              <SliderField label="Gravity" value={gravity} min={0.2} max={2} step={0.05} onChange={setGravity} />
              <SliderField label="Bounce" value={bounce} min={0.1} max={1.2} step={0.05} onChange={setBounce} />
              <SliderField label="Power" value={power} min={0.5} max={2} step={0.05} onChange={setPower} />
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-subtle">
            <span>{bodyCount} objs · zen {score.zen} · today {journal.yeets} yeets</span>
            <button type="button" className="text-muted hover:text-fg" onClick={enoughForToday}>Enough for today</button>
          </div>
        </div>
      </footer>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setSettingsOpen(false)}>
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Menu</h3>
              <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs text-muted" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <Section title="Mode">
              <div className="grid grid-cols-2 gap-2">
                {(["soft", "zen", "chaos", "freeplay"] as PlayMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => { playSfx("ui"); patchSettings({ mode: m, showChallenges: m !== "freeplay", asmr: m === "soft" || m === "zen" ? true : settings.asmr }); }}
                    className={`rounded-xl border px-3 py-2 text-left text-xs capitalize ${settings.mode === m ? "border-accent bg-accent/10 text-fg" : "border-border text-muted"}`}>{m}</button>
                ))}
              </div>
            </Section>
            <Section title="Theme">
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <button key={t.id} type="button" onClick={() => patchSettings({ theme: t.id })}
                    className={`rounded-full border px-3 py-1.5 text-xs ${settings.theme === t.id ? "border-accent text-fg" : "border-border text-muted"}`}>{t.label}</button>
                ))}
              </div>
            </Section>
            <Section title="Sound">
              <Toggle label="ASMR pack" on={settings.asmr} onChange={(v) => patchSettings({ asmr: v })} />
              <Toggle label="Ambient drone" on={settings.ambient} onChange={(v) => patchSettings({ ambient: v })} />
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted">Volume
                <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => patchSettings({ volume: Number(e.target.value) })} className="accent-accent" />
              </label>
            </Section>
            <Section title="Comfort">
              <Toggle label="Compact HUD" on={settings.compactHud} onChange={(v) => patchSettings({ compactHud: v })} />
              <Toggle label="High contrast" on={settings.highContrast} onChange={(v) => patchSettings({ highContrast: v })} />
              <Toggle label="Reduced motion" on={settings.reducedMotion} onChange={(v) => patchSettings({ reducedMotion: v })} />
              <Toggle label="Haptics" on={settings.haptics} onChange={(v) => patchSettings({ haptics: v })} />
              <Toggle label="Show challenges" on={settings.showChallenges} onChange={(v) => patchSettings({ showChallenges: v })} />
              <Toggle label="Keyboard aim hints" on={settings.keyboardHints} onChange={(v) => patchSettings({ keyboardHints: v })} />
            </Section>
            <Section title="Session wind-down">
              <div className="flex gap-2">
                {([0, 2, 5] as const).map((m) => (
                  <button key={m} type="button" onClick={() => patchSettings({ sessionMinutes: m })}
                    className={`rounded-xl border px-3 py-2 text-xs ${settings.sessionMinutes === m ? "border-accent bg-accent/10" : "border-border text-muted"}`}>{m === 0 ? "Off" : `${m} min`}</button>
                ))}
              </div>
            </Section>
            <Section title="Stamp text">
              <input value={settings.stampText} maxLength={8} onChange={(e) => patchSettings({ stampText: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent" placeholder="YEET" />
            </Section>
            <Section title="Today">
              <p className="text-xs text-muted">{journal.yeets} yeets · {journal.flushes} flushes · {journal.challenges} challenges · zen best {journal.zen}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-border px-3 py-2 text-xs" onClick={() => { resetWorld(); setSettingsOpen(false); }}>Reset board</button>
                <button type="button" className="rounded-xl border border-border px-3 py-2 text-xs" onClick={() => { enoughForToday(); setSettingsOpen(false); }}>Enough for today</button>
              </div>
            </Section>
          </div>
        </div>
      )}

      {shareOpen && shareDataUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setShareOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between"><h3 className="font-semibold">Share card</h3>
              <button type="button" className="text-xs text-muted" onClick={() => setShareOpen(false)}>Close</button></div>
            <img src={shareDataUrl} alt="Yeet card" className="mt-3 w-full rounded-xl border border-border" />
            <div className="mt-3 flex gap-2">
              <a href={shareDataUrl} download="yeet-card.png" className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-fg">Download</a>
              <button type="button" className="min-h-11 flex-1 rounded-xl border border-border text-sm" onClick={async () => {
                const text = `YEET stress dump - zen ${score.zen}, chaos ${score.chaos}, calm ${score.bestCalmStreak}, challenges ${missionProg.completed}. yeet.grok.me`;
                try { await navigator.clipboard.writeText(text); setHint("Stats copied"); } catch { setHint(text); }
              }}>Copy stats</button>
            </div>
          </div>
        </div>
      )}

      {enoughOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Session close</p>
            <h3 className="mt-2 text-xl font-semibold">Enough for today</h3>
            <p className="mt-2 text-sm text-muted">You yeeted {journal.yeets} things today, flushed {journal.flushes} boards, and cleared {journal.challenges} challenges. That counts.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="min-h-11 rounded-xl bg-accent font-semibold text-accent-fg" onClick={() => { captureShare(); setEnoughOpen(false); }}>Share a quiet win</button>
              <button type="button" className="min-h-11 rounded-xl border border-border text-sm text-muted" onClick={() => setEnoughOpen(false)}>Keep playing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">{title}</h4>
      {children}
    </section>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => { playSfx("ui", 0.4); onChange(!on); }}
      className="mt-1 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-xs">
      <span className="text-fg">{label}</span>
      <span className={on ? "text-accent" : "text-subtle"}>{on ? "On" : "Off"}</span>
    </button>
  );
}

function StatChip({ label, value, accent, compact }: { label: string; value: string | number; accent?: boolean; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-surface/90 backdrop-blur-md ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}>
      <div className="text-[8px] font-medium uppercase tracking-wider text-subtle sm:text-[9px]">{label}</div>
      <div className={`font-mono font-semibold tabular-nums ${compact ? "text-xs" : "text-sm sm:text-base"} ${accent ? "text-score" : "text-fg"}`}>{value}</div>
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface-2 px-2 py-1.5">
      <span className="flex justify-between text-[9px] font-medium text-muted">{label}<span className="font-mono tabular-nums text-fg">{value.toFixed(2)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full appearance-none rounded-full bg-border accent-accent" />
    </label>
  );
}
