/**
 * Pressure field. A card that swells pushes its neighbours away, softly, with the push fading
 * over distance. Cards never change their resting place: this only computes a temporary
 * offset that relaxes back to zero when the swelling stops. Step 5 reuses the same function
 * for hover.
 */
export interface Body {
  /** Resting centre. */
  cx: number;
  cy: number;
  /** Resting size. */
  w: number;
  h: number;
  /** Swelling: 1 = resting, 1.2 = 20% larger. */
  grow: number;
}

/** Reach and cap are tuned for 170-unit-wide tiles; `scale` adapts them to other tile sizes. */
export const REACH = 120;
export const MAX_PUSH = 40;
/** Beyond this many reaches the push is under 1% of a tile's swell (e^-5) and is left out. */
export const FAR_REACHES = 5;

const radius = (b: Body): number => Math.sqrt(b.w * b.h) / 2;

/** Offset (dx, dy) for every body, in the same order as the input. */
export function pressureOffsets(bodies: Body[], out?: Float32Array, scale = 1): Float32Array {
  const reach = REACH * scale;
  const cap = MAX_PUSH * scale;
  const n = bodies.length;
  const res = out && out.length >= n * 2 ? out : new Float32Array(n * 2);
  res.fill(0, 0, n * 2);
  // Pinr.io lag (9 Nov): with lists that load as you scroll the field holds thousands of tiles, and every swelling tile looked at every other
  // one (1.8 s of 40 s on a phone at 4x slower CPU). A tile further than FAR_REACHES reaches on either axis gets under 1% of the push (e^-5),
  // so it is passed over with two comparisons before any square root or exponential.
  let maxR = 0;
  for (let i = 0; i < n; i++) maxR = Math.max(maxR, radius(bodies[i]!));
  for (let g = 0; g < n; g++) {
    const bg = bodies[g]!;
    const extra = (bg.grow - 1) * radius(bg);
    if (extra <= 0.01) continue;
    const rg = radius(bg);
    const far = rg + maxR + FAR_REACHES * reach;
    for (let i = 0; i < n; i++) {
      if (i === g) continue;
      const bi = bodies[i]!;
      const dx = bi.cx - bg.cx;
      const dy = bi.cy - bg.cy;
      if (dx > far || dx < -far || dy > far || dy < -far) continue;
      const d = Math.hypot(dx, dy) || 1;
      const gapDist = Math.max(0, d - rg - radius(bi));
      const mag = extra * Math.exp(-gapDist / reach);
      res[i * 2]! += (dx / d) * mag;
      res[i * 2 + 1]! += (dy / d) * mag;
    }
  }
  for (let i = 0; i < n; i++) {
    const x = res[i * 2]!;
    const y = res[i * 2 + 1]!;
    const m = Math.hypot(x, y);
    if (m > cap) {
      res[i * 2] = (x / m) * cap;
      res[i * 2 + 1] = (y / m) * cap;
    }
  }
  return res;
}
