import type { Camera, View } from "../engine/camera";
import type { Item } from "../world/model";
import type { Frame, PageId } from "../world/sitemap";

/**
 *
 * zoomed out to the map, every room but PINR's shows a small finished piece of its page, in PINR's own look (the glass panels, lime and lavender,
 * the blade mark, the Art Pack's scope geometry and sonar rings), drawn from live data. The pieces sit in one layer above the shrunk live pages
 * and fade in only near the full zoom-out, so zooming into a room still grows its real page out of it. Sizes follow each room through container
 * units, so the same piece reads on a phone and a desktop. Content is rebuilt at most every 2 s, only while the layer shows, and only when it changed.
 */
export interface ArenaPreviewGroup {
  title: string | null;
  ticker: string | null;
  members: { name?: string | null; ticker?: string | null; imageUrl?: string | null }[];
}
export interface PreviewData {
  items: readonly Item[];
  tracked: number;
  subject: Item | null;
  arena: readonly ArenaPreviewGroup[];
}
export interface MapPreviews {
  setFrames(frames: Record<PageId, Frame>): void;
  /** Move the layer with the camera; `shown` 0 (hidden) to 1 (fully over the rooms); `press` how each room is swelled and pushed. */
  update(cam: Camera, view: View, shown: number, press: (id: PageId) => { scale: number; ox: number; oy: number }): void;
  /** Fill the pieces from live data (cheap when nothing changed). */
  refresh(data: PreviewData): void;
}

type Room = PageId;
const AD_LETTER: Partial<Record<Room, string>> = { ads: "A", adsne: "B", adsw: "C", adse: "D" };
const AD_GRADS = [
  "linear-gradient(120deg, #9b6bff 0%, #6c4dfb 45%, #d6ff3c 130%)",
  "linear-gradient(120deg, #d6ff3c 0%, #9be86a 50%, #6c4dfb 140%)",
  "linear-gradient(120deg, #cdb6fe 0%, #9b6bff 60%, #6c4dfb 100%)",
  "linear-gradient(120deg, #6c4dfb 0%, #9b6bff 50%, #d6ff3c 120%)",
];
const TITLES: Partial<Record<Room, string>> = { pinr: "PINR", discover: "Discover", deepscan: "Deep Scan", arena: "PvP Arena", wallet: "Wallet" };

/** PINR's blade mark (the boot veil's), lime tip on the brand's lavender and paper. */
const BLADE =
  '<svg class="mp-blade" viewBox="0 0 217 256" aria-hidden="true"><path class="b1" d="M182.75,7.01c6.93-8.26,19.39-9.34,27.63-2.38,8.24,6.96,9.29,19.5,2.37,27.78C141.79,106.89,70.86,181.39-.1,255.86,60.86,172.91,121.8,89.97,182.75,7.01Z"/>' +
  '<path class="tip" d="M182.75,7.01c6.97-8.33,19.34-9.39,27.63-2.38h0c8.29,7.01,9.34,19.45,2.37,27.78l-38.14,14.94h0l8.16-40.34h-.02Z"/>' +
  '<path class="b2" d="M183.63,92.04h0l-108.17,157.94c-5.26,6.51-14.86,7.57-21.44,2.36h0c-6.57-5.2-7.63-14.7-2.37-21.21L183.63,92.04Z"/>' +
  '<path class="tip" d="M75.49,250.04c-5.26,6.43-14.88,7.48-21.45,2.35h0c-6.59-5.14-7.65-14.51-2.36-20.94l29.42-12.04h0l-5.58,30.64h-.02Z"/></svg>';
/** The Art Pack's scope geometry (asset 22): faint radial lines and rings from the centre, without its dark field, so it sits on either theme. */
const SCOPE = (() => {
  const lines = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<line x1="50" y1="50" x2="${(50 + Math.cos(a) * 80).toFixed(1)}" y2="${(50 + Math.sin(a) * 80).toFixed(1)}"/>`;
  }).join("");
  return `<svg class="mp-scope" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="rad">${lines}</g><g class="ring"><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="27"/><circle cx="50" cy="50" r="40"/></g></svg>`;
})();
/** The Art Pack's quiet sonar (asset 55): still rings from an unseen centre, for a room waiting on a choice. */
const SONAR = '<svg class="mp-sonar" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="10"/><circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="46"/></svg>';
const ICON: Partial<Record<Room, string>> = {
  wallet:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 016.5 5H17v3"/><path d="M4 7.5V17a2 2 0 002 2h13V8H6.5A2.5 2.5 0 014 7.5z"/><circle cx="16" cy="13.5" r="1.1"/></svg>',
};

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** A coin's picture, or its first letter on the brand's glass when it has none (never a made-up picture). */
function coin(img: string | null | undefined, label: string, cls = "mp-coin"): string {
  const letter = esc((label.replace(/^\$/, "").trim()[0] ?? "?").toUpperCase());
  return img
    ? `<span class="${cls}" data-l="${letter}"><img src="${esc(img)}" alt="" decoding="async" referrerpolicy="no-referrer"/></span>`
    : `<span class="${cls} none">${letter}</span>`;
}
function spark(hist: readonly number[]): string {
  const h = hist.filter((v) => Number.isFinite(v));
  if (h.length < 2) return "";
  const lo = Math.min(...h);
  const hi = Math.max(...h);
  const pts = h.map((v, i) => `${((i / (h.length - 1)) * 100).toFixed(1)},${(hi === lo ? 20 : 38 - ((v - lo) / (hi - lo)) * 36).toFixed(1)}`).join(" ");
  const up = h[h.length - 1]! >= h[0]!;
  return `<svg class="mp-spark ${up ? "up" : "down"}" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}
function head(room: Room): string {
  return `<div class="mp-head">${BLADE}<span class="mp-title">${TITLES[room] ?? ""}</span><i class="mp-dot"></i></div>`;
}

function discoverHtml(items: readonly Item[], tracked: number): string {
  const top = items.filter((t) => t.image).slice(0, 8);
  const cells = top.map((t) => `<span class="mp-cell">${coin(t.image, t.ticker || t.name)}<b>${esc(t.ticker || t.name)}</b></span>`).join("");
  //
  const foot = tracked > 0 ? `<div class="mp-foot"><b>${tracked.toLocaleString("en-US")}</b> coins tracked</div>` : "";
  return `${head("discover")}<div class="mp-grid">${cells}</div>${foot}`;
}
function pinrHtml(items: readonly Item[], tracked: number): string {
  const top = items.filter((t) => t.image).slice(0, 8);
  const cells = top.map((t) => `<span class="mp-cell">${coin(t.image, t.ticker || t.name)}<b>${esc(t.ticker || t.name)}</b></span>`).join("");
  //
  const foot = tracked > 0 ? `<div class="mp-foot"><b>${tracked.toLocaleString("en-US")}</b> coins tracked</div>` : "";
  return `${head("pinr")}<div class="mp-grid">${cells}</div>${foot}`;
}
function deepscanHtml(t: Item | null): string {
  if (!t) return `${head("deepscan")}<div class="mp-wait">${SONAR}<span>Pick a coin to scan</span></div>`;
  return (
    `${head("deepscan")}<div class="mp-subject">${coin(t.image, t.ticker || t.name, "mp-coin big")}<div class="mp-who"><b>${esc(t.name)}</b><span>${esc(t.ticker)}</span></div></div>` +
    `<div class="mp-value">${esc(t.value || "—")}</div>${spark(t.hist)}`
  );
}
function arenaHtml(groups: readonly ArenaPreviewGroup[]): string {
  const rows = groups.slice(0, 3).map((g) => {
    const faces = g.members.slice(0, 4).map((m) => coin(m.imageUrl, m.ticker || m.name || "?", "mp-coin face")).join("");
    const name = g.ticker || g.title || g.members[0]?.ticker || "";
    return `<div class="mp-battle"><span class="mp-faces">${faces}</span><b>${esc(name)}</b><span class="mp-n">${g.members.length} versions</span></div>`;
  });
  return `${head("arena")}<div class="mp-battles">${rows.join("") || `<div class="mp-wait">${SONAR}<span>No battles right now</span></div>`}</div>`;
}
function walletHtml(): string {
  return `${head("wallet")}<div class="mp-wprof"><span class="mp-ring">${ICON.wallet}</span><span>Any wallet, read only</span></div>`;
}
function adHtml(room: Room): string {
  const L = AD_LETTER[room]!;
  const slots = [1, 2, 3, 4]
    .map((i) => `<span class="mp-slot${i === 1 || i === 4 ? " wide" : ""}" style="--g:${AD_GRADS[(i - 1 + "ABCD".indexOf(L)) % 4]}"><b>${L}${i}</b><i>Ad</i></span>`)
    .join("");
  return `<div class="mp-adhead"><span>Ad space ${L}</span><em>Apply</em></div><div class="mp-slots">${slots}</div>`;
}

export function createMapPreviews(root: HTMLElement): MapPreviews {
  const layer = document.createElement("div");
  layer.className = "mapprev";
  layer.setAttribute("aria-hidden", "true");
  layer.style.display = "none";
  root.append(layer);
  const els = new Map<Room, HTMLElement>();
  const boxes = new Map<Room, HTMLElement>();
  const sigs = new Map<Room, string>();
  let frames: Record<PageId, Frame> | null = null;
  let lastShown = -1;
  let lastT = "";
  let refreshedAt = 0;
  const lastPress = new Map<Room, string>();

  const set = (room: Room, sig: string, html: () => string): void => {
    const el = els.get(room);
    if (!el || sigs.get(room) === sig) return;
    sigs.set(room, sig);
    el.innerHTML = html();
    //
    for (const img of el.querySelectorAll<HTMLImageElement>("img")) {
      const fall = (): void => {
        const span = img.parentElement;
        if (!span) return;
        span.classList.add("none");
        span.textContent = span.dataset.l ?? "?";
      };
      if (img.complete && img.naturalWidth === 0 && img.src) fall();
      else img.addEventListener("error", fall, { once: true });
    }
  };

  return {
    setFrames(f) {
      frames = f;
      for (const id of Object.keys(f) as PageId[]) {
        let box = boxes.get(id);
        if (!box) {
          box = document.createElement("div");
          box.className = `mp mp-${id}${AD_LETTER[id] ? " mp-ad" : ""}`;
          box.innerHTML = AD_LETTER[id] ? "" : SCOPE;
          const body = document.createElement("div");
          body.className = "mp-body";
          box.append(body);
          boxes.set(id, box);
          els.set(id, body);
          if (AD_LETTER[id]) set(id, "ad", () => adHtml(id));
          layer.append(box);
        }
        const fr = f[id];
        box.style.left = `${fr.x}px`;
        box.style.top = `${fr.y}px`;
        box.style.width = `${fr.w}px`;
        box.style.height = `${fr.h}px`;
      }
    },
    update(cam, view, shown, press) {
      const q = Math.round(Math.min(1, Math.max(0, shown)) * 50) / 50;
      if (q !== lastShown) {
        if ((q > 0) !== (lastShown > 0)) layer.style.display = q > 0 ? "" : "none";
        lastShown = q;
        layer.style.opacity = String(q);
      }
      if (q <= 0 || !frames) return;
      const s = cam.scale;
      const t = `translate3d(${(view.w / 2 - cam.x * s).toFixed(2)}px,${(view.h / 2 - cam.y * s).toFixed(2)}px,0) scale(${s.toFixed(5)})`;
      if (t !== lastT) {
        lastT = t;
        layer.style.transform = t;
      }
      for (const [room, box] of boxes) {
        const p = press(room);
        const pt = `translate3d(${p.ox.toFixed(1)}px,${p.oy.toFixed(1)}px,0) scale(${p.scale.toFixed(3)})`;
        if (lastPress.get(room) !== pt) {
          lastPress.set(room, pt);
          box.style.transform = pt;
        }
      }
    },
    refresh(data) {
      if (lastShown <= 0) return;
      const now = Date.now();
      if (now - refreshedAt < 2000 && refreshedAt) return;
      refreshedAt = now;
      const top = data.items.filter((t) => t.image).slice(0, 8);
      set("discover", `${data.tracked}|${top.map((t) => `${t.id}:${t.image}:${t.ticker}`).join(",")}`, () => discoverHtml(data.items, data.tracked));
      const st = data.subject;
      set("deepscan", st ? `${st.id}|${st.value}|${st.hist.length}|${st.hist[st.hist.length - 1] ?? ""}|${st.image}` : "none", () => deepscanHtml(st));
      set("arena", data.arena.slice(0, 3).map((g) => `${g.ticker}|${g.title}|${g.members.length}|${g.members.slice(0, 4).map((m) => m.imageUrl).join(",")}`).join(";"), () => arenaHtml(data.arena));
      set("wallet", "w", walletHtml);
      set("pinr", `${data.tracked}|${top.map((t) => `${t.id}:${t.image}:${t.ticker}`).join(",")}`, () => pinrHtml(data.items, data.tracked));
    },
  };
}
