import Matter from "matter-js";
import { OBJECT_DEFS, type ObjectDef, type ObjectKind } from "@/lib/yeet/types";

export const { Engine, World, Bodies, Body, Events, Query, Composite } = Matter;

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};

export type BodyMeta = {
  kind: ObjectKind;
  def: ObjectDef;
  yeeted: boolean;
  airAccum: number;
  maxDist: number;
  label?: string;
  hp: number;
  platform?: boolean;
  destructible?: boolean;
};

export type Zone = { x: number; y: number; w: number; h: number; kind: "sticky" | "ice" | "bounce" };

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function shade(hex: string, amt: number) {
  const n = hex.replace("#", "");
  const num = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  const r = clamp(((num >> 16) & 255) + amt, 0, 255);
  const g = clamp(((num >> 8) & 255) + amt, 0, 255);
  const b = clamp((num & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function makeBody(
  kind: ObjectKind,
  x: number,
  y: number,
  bounceMul: number,
  label?: string,
): { body: Matter.Body; meta: BodyMeta } {
  const def = OBJECT_DEFS.find((d) => d.id === kind) ?? OBJECT_DEFS[0];
  let body: Matter.Body;
  const opts = {
    density: def.density,
    restitution: def.restitution * bounceMul,
    friction: def.friction,
    frictionAir: def.sticky ? 0.04 : 0.012,
    label: kind,
  };
  if (def.shape === "rect" || kind === "brick" || kind === "worry") {
    body = Bodies.rectangle(x, y, def.radius * 1.7, def.radius * 1.15, {
      ...opts,
      chamfer: { radius: def.shape === "soft" ? 12 : 4 },
    });
  } else if (def.shape === "hex") {
    body = Bodies.polygon(x, y, 6, def.radius, opts);
  } else {
    body = Bodies.circle(x, y, def.radius, opts);
  }
  return {
    body,
    meta: {
      kind,
      def,
      yeeted: false,
      airAccum: 0,
      maxDist: 0,
      label,
      hp: def.fragile ? 1 : 3,
    },
  };
}

export function haptic(ms = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
