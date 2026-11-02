import { Camera, attachPointer, diveFrame, drawLoop, prefersReducedMotion, type Dive, type V3 } from "../web/galaxycam";
import { webLayout3d } from "../world/orbitweb";
import type { OrbitGroup } from "../world/orbit";
import { navTrail } from "../world/navtrail";

/**
 *
 * (drag turns it, a quick flick throws it, it settles). Tapping a group pulls the web in and opens that group's facts around it; Back (the button below, the
 *
 */
const SVG = "http://www.w3.org/2000/svg";
const MAX_SHOWN = 12;

export interface RingOptions {
  ticker: string;
  groups: OrbitGroup[];
  loading: boolean;
  /** A group (fact null) or one fact was chosen: the page shows its rows. */
  onOpen(g: OrbitGroup, fact: number | null): void;
  /** The group view opened (the group) or closed (null). */
  onView(g: OrbitGroup | null): void;
}
export interface Ring {
  el: HTMLElement;
  destroy(): void;
}

type Kind = "hub" | "group" | "fact";
interface N {
  kind: Kind;
  world: V3;
  el: SVGGElement;
  spoke: SVGLineElement | null;
  parent: N | null;
  r: number;
  open: () => void;
  // the screen place at the last draw (viewBox units)
  sx: number;
  sy: number;
  f: number;
}

function se<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  return e;
}
const onKey = (fn: () => void) => (e: Event): void => {
  const k = (e as KeyboardEvent).key;
  if (k === "Enter" || k === " ") {
    e.preventDefault();
    fn();
  }
};

export function createRing(opts: RingOptions): Ring {
  const root = document.createElement("div");
  root.className = "orbring";
  const svg = se("svg", { viewBox: "0 0 400 400", role: "img", "aria-label": "The coin and what is linked to it" }, "orbitsvg");
  const scene = se("g", {}, "orbscene");
  svg.append(scene);
  const bar = document.createElement("div");
  bar.className = "orbringbar";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "orbmore orbringback";
  backBtn.textContent = "← All groups";
  backBtn.hidden = true;
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "orbmore";
  resetBtn.textContent = "Reset view";
  bar.append(backBtn, resetBtn);
  root.append(svg, bar);

  const cam = new Camera();
  cam.reduced = prefersReducedMotion();
  let nodes: N[] = [];
  let inGroup: OrbitGroup | null = null;
  let dive: Dive | null = null;
  let anchor: V3 = [0, 0, 0];
  let pending: (() => void) | null = null;
  let radius = 170;
  let sceneRev = 0;
  let order = "";

  const fit = (): void => {
    cam.homeDist = cam.fitDistance(radius, 400, 400);
    cam.minDist = cam.homeDist * 0.5;
    cam.maxDist = cam.homeDist * 1.8;
    cam.reset();
    cam.dist = cam.homeDist;
  };

  function mk(kind: Kind, world: V3, parent: N | null, r: number, open: () => void, spokeCls: string | null, g: SVGGElement): N {
    const spoke = spokeCls ? se("line", {}, spokeCls) : null;
    return { kind, world, el: g, spoke, parent, r, open, sx: 0, sy: 0, f: 1 };
  }

  function groupNode(g: OrbitGroup, loading: boolean): SVGGElement {
    const node = se("g", { tabindex: 0, role: "button", "aria-label": `${g.label}: ${g.facts.length ? g.facts.length + " facts" : "not checked yet"}` }, `orbnode${g.facts.length ? "" : " empty"}`);
    node.setAttribute("data-group", g.id);
    node.append(se("circle", { cx: 0, cy: 0, r: 31 }, "orbdot"));
    const c = se("text", { x: 0, y: -2, "text-anchor": "middle" }, "orbcount");
    c.textContent = loading ? "…" : g.facts.length ? String(g.facts.length) : "○";
    const l = se("text", { x: 0, y: 14, "text-anchor": "middle" }, "orblabel");
    l.textContent = g.label;
    node.append(c, l);
    return node;
  }

  function factNode(g: OrbitGroup, k: number): SVGGElement {
    const f = g.facts[k]!;
    const pt = se("g", { tabindex: 0, role: "button", "aria-label": `${g.label}: ${f.text}` }, "orbpt");
    pt.append(se("circle", { cx: 0, cy: 0, r: 7 }, `orbpdot ${f.onchain ? "chain" : "reported"}`));
    return pt;
  }

  /** The hub: the coin in the middle, the groups around it, each group's first facts around that. */
  function hubScene(): N[] {
    const out: N[] = [];
    const hubG = se("g", {}, "orbhub");
    hubG.append(se("circle", { cx: 0, cy: 0, r: 38 }, "orbcoin"));
    const t = se("text", { x: 0, y: 5, "text-anchor": "middle" }, "orbcointxt");
    t.textContent = opts.ticker.slice(0, 8);
    hubG.append(t);
    const hub = mk("hub", [0, 0, 0], null, 38, () => undefined, null, hubG);
    out.push(hub);
    const lay = webLayout3d(opts.groups);
    opts.groups.forEach((g, i) => {
      const n = lay[i]!;
      const gn = mk("group", [n.x, n.y, n.z], hub, 31, () => enterGroup(g), `orbspoke ${opts.loading ? "none" : n.line}`, groupNode(g, opts.loading));
      gn.el.addEventListener("keydown", onKey(gn.open));
      out.push(gn);
      if (opts.loading) return;
      for (const p of n.points) {
        const f = g.facts[p.fact]!;
        const fn = mk("fact", [p.x, p.y, p.z], gn, 7, () => opts.onOpen(g, p.fact), `orbpspoke ${f.onchain ? "chain" : "reported"}`, factNode(g, p.fact));
        fn.el.addEventListener("keydown", onKey(fn.open));
        out.push(fn);
      }
    });
    return out;
  }

  /** One group opened: the group in the middle and its facts around it (as many as fit; the rows below hold them all). */
  function groupScene(g: OrbitGroup): N[] {
    const out: N[] = [];
    const centre = mk("group", [0, 0, 0], null, 31, () => opts.onOpen(g, null), null, groupNode(g, false));
    centre.el.addEventListener("keydown", onKey(centre.open));
    out.push(centre);
    const shown = g.facts.slice(0, MAX_SHOWN);
    const R = 86 + 3 * shown.length;
    shown.forEach((f, k) => {
      // a sphere around the group, so the facts have depth in every direction
      const y = shown.length === 1 ? 0.6 : 1 - (2 * (k + 0.5)) / shown.length;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const th = k * 2.399963;
      const w: V3 = [Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R];
      const fn = mk("fact", w, centre, 9, () => opts.onOpen(g, k), `orbpspoke ${f.onchain ? "chain" : "reported"}`, factNode(g, k));
      fn.el.addEventListener("keydown", onKey(fn.open));
      out.push(fn);
    });
    return out;
  }

  function setScene(next: N[], r: number): void {
    nodes = next;
    radius = r;
    scene.replaceChildren();
    for (const n of nodes) if (n.spoke) scene.append(n.spoke);
    for (const n of nodes) scene.append(n.el);
    order = "";
    sceneRev++;
    fit();
  }

  function swap(build: () => void, at: V3): void {
    if (cam.reduced) {
      build();
      dive = null;
    } else {
      pending = build;
      anchor = at;
      dive = { t0: performance.now(), pull: true };
    }
    loop.wake();
  }

  function enterGroup(g: OrbitGroup): void {
    if (dive || inGroup) return;
    const n = nodes.find((x) => x.kind === "group" && x.el.getAttribute("data-group") === g.id);
    inGroup = g;
    backBtn.hidden = false;
    swap(() => setScene(groupScene(g), 92 + 3 * Math.min(g.facts.length, MAX_SHOWN) + 20), n ? n.world : [0, 0, 0]);
    opts.onOpen(g, null);
    opts.onView(g);
    //
    navTrail.current?.openOverlay(() => leave());
  }

  /** Step back out to the hub. Called by the trail when Back is pressed, and by this ring's own button (through the trail). */
  function leave(): void {
    if (!inGroup) return;
    inGroup = null;
    backBtn.hidden = true;
    dive = null;
    swap(() => setScene(hubScene(), 165), [0, 0, 0]);
    opts.onView(null);
  }
  backBtn.addEventListener("click", () => {
    if (navTrail.current) navTrail.current.closeOverlay();
    else leave();
  });
  resetBtn.addEventListener("click", () => {
    cam.reset();
    loop.wake();
  });

  function paint(): void {
    const df = diveFrame(dive, performance.now());
    const [ax, ay, az] = anchor;
    scene.setAttribute("opacity", String(Math.max(0, df.a).toFixed(3)));
    for (const n of nodes) {
      const w: V3 = dive ? [ax + (n.world[0] - ax) * df.k, ay + (n.world[1] - ay) * df.k, az + (n.world[2] - az) * df.k] : n.world;
      const s = cam.project(w, 400, 400);
      n.sx = s.x;
      n.sy = s.y;
      n.f = s.f;
    }
    for (const n of nodes) {
      const sc = Math.max(0.45, Math.min(1.6, n.f));
      n.el.setAttribute("transform", `translate(${n.sx.toFixed(1)} ${n.sy.toFixed(1)}) scale(${sc.toFixed(3)})`);
      n.el.setAttribute("opacity", (0.28 + 0.72 * Math.max(0, Math.min(1, (n.f - 0.65) / 0.55))).toFixed(2));
      if (n.spoke && n.parent) {
        n.spoke.setAttribute("opacity", (0.2 + 0.8 * Math.max(0, Math.min(1, (Math.min(n.f, n.parent.f) - 0.6) / 0.7))).toFixed(2));
        n.spoke.setAttribute("x1", n.parent.sx.toFixed(1));
        n.spoke.setAttribute("y1", n.parent.sy.toFixed(1));
        n.spoke.setAttribute("x2", n.sx.toFixed(1));
        n.spoke.setAttribute("y2", n.sy.toFixed(1));
      }
    }
    // far to near, so a nearer point sits over a farther one; only when the order changed
    const by = [...nodes].sort((a, b) => a.f - b.f);
    const key = by.map((n) => nodes.indexOf(n)).join(",");
    if (key !== order) {
      order = key;
      for (const n of by) scene.append(n.el);
    }
  }

  function advance(): void {
    if (!dive) return;
    const df = diveFrame(dive, performance.now());
    if (!df.done) return;
    if (dive.pull) {
      pending?.();
      pending = null;
      anchor = [0, 0, 0];
      dive = { t0: performance.now(), pull: false };
    } else dive = null;
  }

  const loop = drawLoop(
    cam,
    () => dive !== null,
    () => {
      advance();
      const df = dive ? diveFrame(dive, performance.now()) : null;
      return `${sceneRev}|${df ? df.k.toFixed(3) + df.a.toFixed(3) : ""}`;
    },
    paint,
  );

  setScene(hubScene(), 165);

  const hit = (cx: number, cy: number): N | null => {
    const r = svg.getBoundingClientRect();
    const k = 400 / Math.max(1, r.width);
    const x = (cx - r.left) * k;
    const y = (cy - r.top) * k;
    let best: N | null = null;
    for (const n of nodes) {
      if (n.kind === "hub" && !n.spoke) continue;
      const rad = Math.max(n.r * Math.max(0.45, Math.min(1.6, n.f)), 12) + 3;
      if (Math.hypot(n.sx - x, n.sy - y) <= rad && (!best || n.f > best.f)) best = n;
    }
    return best;
  };
  const detach = attachPointer(
    svg,
    cam,
    {
      wake: () => loop.wake(),
      tap(_x, _y, e) {
        const n = dive ? null : hit(e.clientX, e.clientY);
        if (n && n.kind !== "hub") n.open();
      },
    },
    { touchAction: "pan-y", wheel: false },
  );
  loop.wake();

  return {
    el: root,
    destroy() {
      loop.stop();
      detach();
      if (inGroup) {
        inGroup = null;
        navTrail.current?.closeOverlay();
      }
    },
  };
}
