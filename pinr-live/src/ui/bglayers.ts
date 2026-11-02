import { BG_MOVERS } from "./bgmovers.gen";

/**
 *
 * every frame, blur filters and all (3.5 fps against 52 for the same picture still, on a 4x slowed run). It is the same drawing, split by tools/bg-layers.mjs into a still base and
 * a few layers that only turn or fade, each drawn once and then moved by the compositor (transform and opacity, nothing else), plus the small pieces below drawn by the page from the
 * art's own numbers (bgmovers.gen.ts). All sizes are the art's own 1200-unit numbers times `--bgk` (screen px per art unit), so the layers sit exactly where the one picture did.
 * The moving parts are the art's own: the ring turns once in 208 s, the counter ring back in 272 s, the core and logo breathe in 35.2 s, the pulse rings, the twinkling dots and the
 * particles along the two tracks. The flow dashes along the tracks, which crept 3.6 units a second, are drawn still.
 */
export type BgLook = "dark" | "light";
export interface BgLayers {
  /** Show this look's background; `still` shows the single still picture instead (reduced motion, or the background switched off). */
  set(look: BgLook, still: boolean, stillSrc: string): void;
  /** Milliseconds (performance.now) the logo layer's breathing began, for the boot veil's hand-over; null before the layers exist. */
  logoStart(): number | null;
}

const A = "/art/bgl-";
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
};
const img = (src: string, cls: string): HTMLImageElement => {
  const i = el("img", cls);
  i.src = src;
  i.alt = "";
  i.decoding = "async";
  i.draggable = false;
  return i;
};
const STEPS = 48;
/** Points along an SVG path, evenly by length (a straight line between neighbours is within a fraction of a pixel at 48 steps for these gentle curves). */
function samplePath(d: string, steps: number): { x: number; y: number }[] {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.append(path);
  const len = path.getTotalLength();
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = path.getPointAtLength((len * i) / steps);
    out.push({ x: q.x, y: q.y });
  }
  return out;
}
const pct = (v: number): string => `${((v / 1200) * 100).toFixed(4)}%`;

export function createBgLayers(root: HTMLElement): BgLayers {
  let key = "";
  let start: number | null = null;
  const stage = el("div", "bgstage");
  root.replaceChildren(stage);
  const fit = (): void => {
    // One art unit in screen px: the art is a square that covers the (oversized) box, exactly as `object-fit: cover` placed the one picture.
    const k = Math.max(root.offsetWidth, root.offsetHeight) / 1200;
    if (k > 0) root.style.setProperty("--bgk", k.toFixed(5));
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(root);
  fit();

  function build(look: BgLook): void {
    const M = BG_MOVERS[look];
    stage.replaceChildren();
    stage.append(img(`${A}${look}-base.svg`, "bgl base"));
    // the pulse rings: a thin ring that grows and fades (30.4 s)
    for (const p of M.pulse) {
      const d = el("div", "bgl pulse");
      d.style.cssText = `width:${pct(p.r * 2)};height:${pct(p.r * 2)};left:${pct(600 - p.r)};top:${pct(600 - p.r)};border:calc(var(--bgk) * ${p.width}) solid ${p.stroke};animation-delay:${p.delay}s`;
      stage.append(d);
    }
    stage.append(img(`${A}${look}-ring-slow.svg`, "bgl ring slow"), img(`${A}${look}-ring-counter.svg`, "bgl ring counter"));
    const tw = el("div", "bgl twinkles");
    tw.style.opacity = String(M.twinkle.opacity);
    for (const t of M.twinkle.dots) {
      const d = el("i", "tw");
      d.style.cssText = `width:${pct(t.r * 2)};height:${pct(t.r * 2)};left:${pct(t.cx - t.r)};top:${pct(t.cy - t.r)};background:${M.twinkle.fill};animation-delay:${t.delay}s`;
      tw.append(d);
    }
    stage.append(tw);
    // the particles along the two tracks: the art's own paths, sampled into transform keyframes (offset-path would be redrawn by the main thread every frame; a transform stays on the compositor)
    const pa = el("div", "bgl particles");
    const sheet = document.createElement("style");
    let css = "";
    M.particles.list.forEach((p, n) => {
      const d = el("i", "pt");
      const r = p.r;
      const pts = samplePath(p.path, STEPS);
      css += `@keyframes bgl-travel-${look}-${n}{${pts.map((q, i) => `${((i / STEPS) * 100).toFixed(3)}%{transform:translate(${q.x.toFixed(2)}px,${q.y.toFixed(2)}px)}`).join("")}}`;
      d.style.cssText = `width:${r * 8}px;height:${r * 8}px;margin:${-r * 4}px 0 0 ${-r * 4}px;animation:bgl-travel-${look}-${n} ${p.dur}s linear ${p.begin}s infinite;background:radial-gradient(circle,${M.particles.fill} 0 22%,${M.particles.fill}40 28%,${M.particles.fill}00 46%)`;
      pa.append(d);
    });
    sheet.textContent = css;
    pa.append(sheet);
    stage.append(pa);
    stage.append(img(`${A}${look}-logo.svg`, "bgl logo"));
    start = performance.now();
    (window as unknown as { __bgLogoStart?: number }).__bgLogoStart = start; // the boot veil reads it to hand its hero over at the logo's own size and brightness
  }

  return {
    set(look, still, stillSrc) {
      const k = `${look}|${still ? stillSrc : "live"}`;
      if (k === key) return;
      key = k;
      root.dataset.look = look;
      root.classList.toggle("still", still);
      if (still) {
        stage.replaceChildren(img(stillSrc, "bgl base"));
        start = null;
        return;
      }
      build(look);
    },
    logoStart: () => start,
  };
}
