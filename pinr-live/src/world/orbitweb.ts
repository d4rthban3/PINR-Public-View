import type { OrbitGroup } from "./orbit";
import { Camera } from "../web/galaxycam";

/**
 *
 * for ○ reported. This file is only the picture's geometry and its words; nothing here reads another coin.
 */
export const CENTER = 200;
export const RING = 112;
export const SAT_AT = 48;
export const MAX_POINTS = 6;
/** Offsets (degrees) from a group's outward direction, nearest first and alternating sides, so a few points sit close to the label and many fan out. */
const OFFSETS = [55, -55, 85, -85, 115, -115];

export interface WebPoint {
  x: number;
  y: number;
  onchain: boolean;
  /** Index into the group's facts. */
  fact: number;
}
export interface WebNode {
  id: OrbitGroup["id"];
  x: number;
  y: number;
  /** Outward angle in radians. */
  angle: number;
  points: WebPoint[];
  /** Facts that did not get a point of their own. */
  more: number;
  /** "chain" when any fact in the group is ●, "reported" when all are ○, "none" when nothing is recorded. */
  line: "chain" | "reported" | "none";
}

export function webLayout(groups: OrbitGroup[]): WebNode[] {
  return groups.map((g, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    const x = CENTER + Math.cos(angle) * RING;
    const y = CENTER + Math.sin(angle) * RING;
    const shown = g.facts.slice(0, MAX_POINTS);
    const points = shown.map((f, k) => {
      const a = angle + (OFFSETS[k]! * Math.PI) / 180;
      return { x: x + Math.cos(a) * SAT_AT, y: y + Math.sin(a) * SAT_AT, onchain: f.onchain, fact: k };
    });
    const line = !g.facts.length ? "none" : g.facts.some((f) => f.onchain) ? "chain" : "reported";
    return { id: g.id, x, y, angle, points, more: Math.max(0, g.facts.length - shown.length), line };
  });
}

export interface WebPoint3 {
  x: number;
  y: number;
  z: number;
  onchain: boolean;
  fact: number;
}
export interface WebNode3 {
  id: OrbitGroup["id"];
  x: number;
  y: number;
  z: number;
  points: WebPoint3[];
  more: number;
  line: "chain" | "reported" | "none";
}
const norm3 = (v: number[]): [number, number, number] => {
  const m = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / m, v[1]! / m, v[2]! / m];
};
export const DEPTH = 0.45;
/**
 *
 * leaning toward and away from the viewer in turn. (The old octahedron put up and away, and toward and down, on the same spot at the home slant,
 * so Links hid behind Creator and Pool behind Holders.)
 */
const HOME = new Camera();
/** A direction given in the home view's own terms (right, up, toward the viewer) as a world direction. */
const fromView = (sx: number, sy: number, sz: number): [number, number, number] =>
  norm3([0, 1, 2].map((k) => sx * HOME.x[k]! + sy * HOME.y[k]! + sz * HOME.z[k]!));
/** Each group's place on the hexagon as seen at rest: Creator at the top, the rest clockwise (radians, screen up = 90 degrees). */
const SCREEN_ANGLE = Array.from({ length: 6 }, (_, i) => (90 - i * 60) * (Math.PI / 180));
const DIRS = SCREEN_ANGLE.map((a, i) => {
  const flat = Math.sqrt(1 - DEPTH * DEPTH);
  return fromView(Math.cos(a) * flat, Math.sin(a) * flat, i % 2 ? -DEPTH : DEPTH);
});
/** A fact's lean toward or away from the viewer: small, so its point always lands outside its group's circle at rest, never on the group's label. */
const FACT_DEPTH = 0.3;

/** The same web in real 3D: each group's facts fan outward around it, leaning toward and away from the viewer in turn. Centre is (0,0,0). */
export function webLayout3d(groups: OrbitGroup[]): WebNode3[] {
  return groups.map((g, i) => {
    const out = DIRS[i % DIRS.length]!;
    const gx = out[0] * RING;
    const gy = out[1] * RING;
    const gz = out[2] * RING;
    const base = SCREEN_ANGLE[i % SCREEN_ANGLE.length]!;
    const flat = Math.sqrt(1 - FACT_DEPTH * FACT_DEPTH);
    const shown = g.facts.slice(0, MAX_POINTS);
    const points = shown.map((f, k) => {
      const a = base + (OFFSETS[k]! * Math.PI) / 180;
      const [dx, dy, dz] = fromView(Math.cos(a) * flat, Math.sin(a) * flat, k % 2 ? -FACT_DEPTH : FACT_DEPTH);
      return { x: gx + dx * SAT_AT, y: gy + dy * SAT_AT, z: gz + dz * SAT_AT, onchain: f.onchain, fact: k };
    });
    const line = !g.facts.length ? "none" : g.facts.some((f) => f.onchain) ? "chain" : "reported";
    return { id: g.id, x: gx, y: gy, z: gz, points, more: Math.max(0, g.facts.length - shown.length), line };
  });
}
