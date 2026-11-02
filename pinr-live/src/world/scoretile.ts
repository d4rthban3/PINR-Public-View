/**
 *
 * A tile shows exactly the score the server sent for that coin (a whole number from 1 to 99) or a dash. The count-up spring may roll between two
 * real scores, but it can never leave a number the server did not send: a spring that is not a finite number, a target that is not a real score,
 * or a settled spring that disagrees with the coin's own value are all put right here, in one place, every frame.
 */
export const isScore = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 99;

export interface TileNumber {
  /** the spring's position now */
  x: number;
  /** the number last written to the tile */
  shown: number;
}

/**
 * The text and the spring position for one frame. `value` is the coin's own value from the server (a number as text, or a dash), `x` the spring's
 * position after this frame's step. Returns null text for "leave what is written", a string to write otherwise, and the position to keep.
 */
export function tileNumber(value: string, x: number, shown: number): { text: string | null; x: number; shown: number } {
  const target = Number(value);
  // Not a real score for this coin: a dash, never a number (and the spring is dropped, so a stale position cannot come back).
  if (!isScore(target)) return { text: Number.isNaN(shown) ? null : "—", x: NaN, shown: NaN };
  // A spring that is not a number (NaN, infinity) starts again from the coin's own score.
  if (!Number.isFinite(x)) return { text: value, x: target, shown: target };
  const n = Math.round(x);
  // Settled: whatever the spring did on the way, the tile says exactly the server's number.
  if (Math.abs(x - target) < 0.5) return n === shown && String(target) === String(shown) ? { text: null, x, shown } : { text: value, x, shown: target };
  // Rolling between two real scores: only whole numbers between them, never outside 1..99.
  const roll = Math.min(99, Math.max(1, n));
  return roll === shown ? { text: null, x, shown } : { text: String(roll), x, shown: roll };
}
