/**
 * Where a frame's script time goes. Off unless the page has ?hud in its address (or runs in dev): then every `mark(name)` adds the time since the
 * previous mark to that name, and the HUD prints the biggest few. `window.__prof()` returns every name's average ms per frame.
 */
let on = false;
let last = 0;
let frames = 0;
const acc = new Map<string, number>();

export const prof = {
  enable(): void {
    on = true;
    (window as unknown as { __prof: () => Record<string, number> }).__prof = () => Object.fromEntries([...acc].map(([k, v]) => [k, +(v / Math.max(1, frames)).toFixed(3)]));
  },
  begin(): void {
    if (!on) return;
    last = performance.now();
    frames++;
  },
  mark(name: string): void {
    if (!on) return;
    const t = performance.now();
    acc.set(name, (acc.get(name) ?? 0) + (t - last));
    last = t;
  },
  top(n: number): string {
    if (!on || frames === 0) return "";
    return [...acc]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} ${(v / frames).toFixed(2)}`)
      .join(" · ");
  },
};
