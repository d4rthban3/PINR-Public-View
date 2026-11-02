import type { OrbitGroup } from "./orbit";

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
const DIRS: [number, number, number][] = [
  [0, 1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
  [-1, 0, 0],
  [0, 0, -1],
];
const norm3 = (v: number[]): [number, number, number] => {
  const m = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / m, v[1]! / m, v[2]! / m];
};
const cross3 = (a: number[], b: number[]): number[] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

/** The same web in real 3D: each group's facts sit on a cone around its outward direction, so nothing lies in one flat plane. Centre is (0,0,0). */
export function webLayout3d(groups: OrbitGroup[]): WebNode3[] {
  return groups.map((g, i) => {
    const out = DIRS[i % DIRS.length]!;
    const gx = out[0] * RING;
    const gy = out[1] * RING;
    const gz = out[2] * RING;
    const u = norm3(cross3(out, Math.abs(out[1]) > 0.5 ? [1, 0.2, 0.3] : [0.2, 1, 0.3]));
    const v = norm3(cross3(out, u));
    const shown = g.facts.slice(0, MAX_POINTS);
    const points = shown.map((f, k) => {
      const az = k * 2.399963;
      const sp = 0.7 + 0.5 * ((k % 3) / 2);
      const c = Math.cos(sp);
      const s = Math.sin(sp);
      const dx = c * out[0] + s * (Math.cos(az) * u[0] + Math.sin(az) * v[0]);
      const dy = c * out[1] + s * (Math.cos(az) * u[1] + Math.sin(az) * v[1]);
      const dz = c * out[2] + s * (Math.cos(az) * u[2] + Math.sin(az) * v[2]);
      return { x: gx + dx * SAT_AT, y: gy + dy * SAT_AT, z: gz + dz * SAT_AT, onchain: f.onchain, fact: k };
    });
    const line = !g.facts.length ? "none" : g.facts.some((f) => f.onchain) ? "chain" : "reported";
    return { id: g.id, x: gx, y: gy, z: gz, points, more: Math.max(0, g.facts.length - shown.length), line };
  });
}
