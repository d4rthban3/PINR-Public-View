import { scoreShown } from "./hub";
import { onLook, palette } from "../ui/theme";
import type { Camera, View } from "../engine/camera";
import { makeSpring, stepSpring, type Spring } from "../engine/spring";
import { layoutGrid } from "./layout";
import { pressureOffsets, type Body } from "./pressure";
import { createBadge, type Badge } from "../ui/badge";
import { avatarChar, liveImportance, SIM, statusLook, type Item, type LookKind, type Store } from "./model";
import { DEFAULT_LIST, isListFilter } from "./lists";
import { prof } from "../engine/prof";
import { getRoster, hasSomethingToShow, selectAndRank, type Filter } from "./filters";
import { groupOf, type Group } from "./groups";
import { isNameless, tickerText } from "./nameless";
import { tileNumber } from "./scoretile";
import { scoreColor } from "./scorecolor";
import { money } from "./discoverlist";
import { ADVICE_LINE, SCORE_NOTICE, SCORE_TAG } from "../ui/scorenotice";
import { lastTradeText, realOf, ribbonMode } from "./flow";
import { scoredAgoShort } from "./format";
import { feeShort } from "../../server/transferfee";
import { makeEarlyTag, setEarly, showsEarly } from "../ui/earlytag";
import { tileTagChips } from "./tags";

/** One tile, in world units. At home on a phone, 5 of these (plus gaps) fill the screen width. */
export const CARD_W = 66;
export const GAP = 8;

/**
 * Semantic zoom. Tiles are laid out at one of four design widths and then scaled to the real
 * on-screen size, so text never gets absurdly small or huge: past each threshold the tile
 * re-lays itself out with more detail instead of just magnifying.
 *   level 0: name + score          (the overview, 5+ tiles per row)
 *   level 1: + coverage + event line
 *   level 2: + token/SIM label
 *   level 3: + description (full card)
 */
export const LOD_DESIGN_W = [66, 104, 150, 220];
/** On-screen tile width (px) at which each next level begins. Geometric mean of neighbours. */
export const LOD_AT = [83, 125, 182];

/**
 *
 * By priority from the top: name and score (never dropped), coverage, market cap, all-time high; lines are dropped from the bottom until the rest fits.
 * Numbers are design units at each level.
 */
export const LABEL_PX = 9.3;
export const TEXT_MIN_PX = 10;
export const NUM_MIN_PX = 12.5;
export const PHONE_TEXT_MIN_PX = 12;
export const PHONE_NUM_MIN_PX = 14;
//
let vw = -1;
let vh = -1;
const readWindow = (): void => {
  vw = typeof innerWidth === "number" ? innerWidth : 1280;
  vh = typeof innerHeight === "number" ? innerHeight : 800;
};
if (typeof addEventListener === "function") addEventListener("resize", readWindow);
const winW = (): number => (vw < 0 ? (readWindow(), vw) : vw);
const winH = (): number => (vh < 0 ? (readWindow(), vh) : vh);
const textMinPx = (): number => (winW() < 600 ? PHONE_TEXT_MIN_PX : TEXT_MIN_PX);
const numMinPx = (): number => (winW() < 600 ? PHONE_NUM_MIN_PX : NUM_MIN_PX);
export const PAD_Y2 = [13, 20, 26, 36];
export const FIMG = [27, 37, 48, 61];
export const SCORE_H = [21, 29, 36, 44];
export const PRICE_H = [14, 16, 18, 20];
export const COV_H = [2, 2, 3, 3];
/** The extra height of the "Not investment advice" line on the wider tiles (zoom levels 2 and 3). */
export const ADV_H = [0, 0, 11, 13];
/** The extra height of the name and ticker when they stand under the picture instead of beside it (a narrow tile, so the name can use the tile's whole width). */
export const STACK_H = [22, 28, 34, 42];
/** A tile narrower than this on screen (CSS pixels) puts its name under the picture. */
export const STACK_BELOW_PX = 120;
/** The least a tile's content may be shrunk to before a line is dropped instead. */
export const SHRINK_MIN = 0.85;
/** The least the market cap and all-time-high rows may be shrunk to before they are dropped (R1: a tile carries them where it can). */
export const SHRINK_FIGS = 0.8;

/** Which level to use for an on-screen tile width, with a little hysteresis so it never flickers at a boundary. */
export function lodFor(screenW: number, current: number): number {
  let l = current;
  while (l < 3 && screenW > LOD_AT[l]! * 1.06) l++;
  while (l > 0 && screenW < LOD_AT[l - 1]! / 1.06) l--;
  return l;
}

/**
 *
 * that glows in its Token health colour, like a star map; names and the card's own look come back on zoom-in. Decided from the tile's width on screen,
 * with a gap between going in and coming out so it never flickers at the edge.
 */
export const DOT_IN_PX = 38;
export const DOT_OUT_PX = 46;
export function dotFor(screenW: number, current: boolean): boolean {
  return current ? screenW < DOT_OUT_PX : screenW < DOT_IN_PX;
}

/** What the stream layer needs to know about a tile that is on screen right now. */
export interface StreamTile {
  id: number;
  /** On-screen box in CSS pixels, including swell and push. */
  x: number;
  y: number;
  w: number;
  h: number;
  heat: number;
  imp: number;
  item: Item;
}

interface CardView {
  item: Item;
  /** The text layer (sits above the streams). */
  el: HTMLElement;
  /** The glass layer (sits below the streams): blur, tint, rim, light. */
  glass: HTMLElement;
  valueEl: HTMLElement;
  /** The pair and launchpad logos on the picture. */
  badge: Badge;
  covEl: HTMLElement;
  /** Last status look written to the DOM (a cheap key), and its kind. */
  lookKey: string;
  lookKind: LookKind | "";
  noteEl: HTMLElement;
  spec: HTMLElement;
  /** Identity text, kept so a name or picture that arrives later (real results) can be written in. */
  nameEl: HTMLElement;
  tickEl: HTMLElement;
  avatarEl: HTMLElement;
  tagEl: HTMLElement;
  /** The trader's facts line (market cap, age, price change) and the PINR chips (serial launcher, copy of, not scored). */
  factsEl: HTMLElement;
  chipsEl: HTMLElement;
  ttagsEl: HTMLElement;
  covWordEl: HTMLElement;
  earlyEl: HTMLElement;
  /** The one label row above the score: "Chain only · 41m". */
  ctagEl: HTMLElement;
  factsKey: string;
  idKey: string;
  tagsKey: string;
  picKey: string;
  /** Resting place and size. Set by the layout; only a deliberate change of filter or tile count moves them. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Swelling and neighbour push, both springs so everything eases. */
  grow: Spring;
  ox: Spring;
  oy: Spring;
  seq: number;
  heat: number;
  /** Last values written to the DOM, so a tile is only touched when it actually changed. */
  tx: number;
  ty: number;
  ts: number;
  z: number;
  off: boolean;
  /** True while a filter hides this tile. */
  gone: boolean;
  tier: number;
  /** The score colour last written. */
  valueColor: string;
  /** The glow colour of the card's dot (its Token health colour, or the muted colour when there is no reading); written only when it changes. */
  dotColor: string;
  /** performance.now() of this tile's last flash restart. */
  flashAt: number;
  /** Which sizing round this tile's CSS width/height was last written in (see `epoch`). */
  sizedAt: number;
  /** Last event colour written to the DOM: 1 lime, 0 mandarin, -1 never. */
  ev: number;
  /** The score rolls to its new value instead of jumping. */
  num: Spring;
  shown: number;
  specX: number;
  specY: number;
}

/** Event colours. Good news / buying is lime; red flags / selling is mandarin. */
export let EV_LIME = "#d6ff3c";
export let EV_MANDARIN = "#ff8c1a";
export let EV_NEUTRAL = "#9aa1ae";
onLook(() => {
  const hex = (rgb: string): string => "#" + rgb.split(",").map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  EV_LIME = hex(palette().live);
  EV_MANDARIN = hex(palette().mandarin);
  EV_NEUTRAL = hex(palette().mute);
});

/**
 * A token's picture. If it cannot be loaded (the host refuses to share it, the link is dead, or it is not a picture at all) the
 * circle shows the plain letter instead of a broken-picture icon.
 */
/** The coin's own links as small chips on the tile (X, Telegram, website). A press on a chip opens the link and never the tile. */
export function socialChips(links: Item["links"]): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const [label, url] of [["X", links?.x], ["TG", links?.telegram], ["Web", links?.website]] as const) {
    if (!url) continue;
    const a = document.createElement("a");
    a.className = "chip chiplink";
    a.textContent = label;
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
    for (const ev of ["pointerdown", "pointerup", "click"] as const) a.addEventListener(ev, (e) => e.stopPropagation());
    out.push(a);
  }
  return out;
}

export function pictureOf(src: string, name: string, address?: string | null): HTMLImageElement {
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.referrerPolicy = "no-referrer";
  img.loading = "lazy";
  // A picture loaded straight from its own host that fails (the host is down or refuses) is asked of the Air once instead; one more try a few
  // seconds later for a picture our own server was still fetching; after that the plain initial stays.
  let tried = false;
  let current = src;
  img.addEventListener("error", () => {
    if (!src.startsWith("/api/img") && address && current === src) {
      current = `/api/img?a=${encodeURIComponent(address)}`;
      img.src = current;
      return;
    }
    if (!tried && current.startsWith("/api/img")) {
      tried = true;
      setTimeout(() => (img.src = `${current}&again=1`), 6000);
      return;
    }
    const holder = img.parentElement;
    img.remove();
    if (holder && holder.childElementCount === 0) holder.textContent = avatarChar(name);
  });
  img.src = src;
  return img;
}

function build(item: Item): Pick<CardView, "el" | "glass" | "valueEl" | "badge" | "covEl" | "noteEl" | "spec" | "nameEl" | "tickEl" | "avatarEl" | "tagEl" | "factsEl" | "chipsEl" | "ttagsEl" | "covWordEl" | "earlyEl" | "ctagEl"> {
  // TEXT layer: name, event line, score. Crisp, above the streams.
  const el = document.createElement("div");
  el.className = "card";
  const k = document.createElement("div");
  k.className = "k";
  const tag = document.createElement("span");
  tag.className = "sim";
  tag.textContent = item.tag;
  k.append(tag);
  k.classList.toggle("none", !item.tag); // no row at all for real results (the tag is only "SIM" for made-up data)

  // Identity: a circle for the token's picture, then its name (main font) with the $ticker beneath it (small mono).
  const ident = document.createElement("div");
  ident.className = "ident";
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (item.image) avatar.append(pictureOf(item.image, item.name, item.address));
  else avatar.textContent = avatarChar(item.name);
  // The picture wears its pair and launchpad logos in the lower-right corner.
  const avwrap = document.createElement("div");
  avwrap.className = "avwrap";
  const badge = createBadge();
  badge.set(item);
  avwrap.append(avatar, badge.el);
  const idtxt = document.createElement("div");
  idtxt.className = "idtxt";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = item.name;
  const tick = document.createElement("div");
  tick.className = "tick";
  tick.textContent = tickerText(item);
  tick.classList.toggle("nl", isNameless(item));
  const ttags = document.createElement("div");
  ttags.className = "ttags";
  // The chips are drawn when the tile is made: render() only redraws them when a coin's tags CHANGE after that (release checklist line 18: a tile made
  // after its coin's tags were known showed none).
  ttags.append(...tileTagChips(item.tags ?? [], item.createdCount));
  idtxt.append(name, tick, ttags);
  ident.append(avwrap, idtxt);
  const detail = document.createElement("div");
  detail.className = "detail";
  detail.textContent = item.detail;
  const noteEl = document.createElement("div");
  noteEl.className = "note";
  // What a trader sees on Pump.fun or Fomo (market cap, age, price move), then what PINR adds (chips).
  const factsEl = document.createElement("div");
  factsEl.className = "facts";
  const chipsEl = document.createElement("div");
  chipsEl.className = "chips";

  const n = document.createElement("div");
  n.className = "n";
  const valueEl = document.createElement("span");
  valueEl.textContent = item.value;
  valueEl.className = "val";
  // Bottom right of every card: the share of readings that loaded, with the word "coverage" beneath it.
  const cov = document.createElement("div");
  cov.className = "cov";
  const covPct = document.createElement("b");
  covPct.textContent = `${item.coverage}%`;
  const covWord = document.createElement("i");
  covWord.textContent = "coverage";
  const earlyTag = makeEarlyTag();
  const adv = document.createElement("div");
  adv.className = "advtag";
  adv.textContent = ADVICE_LINE;
  cov.append(earlyTag, covPct, covWord, adv);
  // "Chain only" and "scored ... ago" stand on their own lines above the score row, so on the narrowest tile they never sit over the number.
  const stags = document.createElement("div");
  stags.className = "stags";
  const ctag = document.createElement("div");
  ctag.className = "ctag";
  ctag.title = SCORE_NOTICE;
  // "Not investment advice" under the coverage, beside the score, on tiles wide enough to carry the line (zoom levels 2 and 3); the smaller tiles carry it one tap away, on Discover and DeepScan.
  stags.append(ctag);
  n.append(stags, valueEl, cov);

  const top = document.createElement("div");
  top.className = "top";
  top.append(k, ident, factsEl, chipsEl, detail, noteEl);
  el.append(top, n);

  // GLASS layer: blurs the live background behind it. Moving light slides across it like tilting an object.
  const glass = document.createElement("div");
  glass.className = "glass";
  const flash = document.createElement("div");
  flash.className = "flash";
  const spec = document.createElement("div");
  spec.className = "spec";
  glass.append(flash, spec);
  return { el, glass, valueEl, badge, covEl: covPct, noteEl, spec, nameEl: name, tickEl: tick, avatarEl: avatar, tagEl: tag, factsEl, chipsEl, ttagsEl: ttags, covWordEl: covWord, earlyEl: earlyTag, ctagEl: ctag };
}

/**
 * Owns every card. Each card has ONE permanent place, decided once from its long-term
 * importance. Live events never move a card: they make it swell in place, flash, and show a
 * short line, while the pressure field gently nudges its neighbours aside and back.
 */
function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

const TILES_PER_FRAME = 10;

export class CardField {
  private cards: CardView[] = [];
  private seenRev = 0;
  /** Tokens whose tile could not be made. */
  private bad = new Set<number>();
  /** The tiles the current filter shows, in the order the layout used. Everything live loops over these. */
  private active: CardView[] = [];
  private byId = new Map<number, CardView>();
  private cols = 5;
  /** Tile height in world units. The app sets it so that 15 rows fill one screen. */
  private cellH = 40;
  /** When set, tiles that extend below this world y are hidden: the map shows only each page's first screen. */
  private frameClip: number | null = null;
  /** The tile being hovered or held, and how much it swells. */
  /** In the map view the whole PINR room can swell and be pushed; its tiles follow it. */
  private group = { scale: 1, ox: 0, oy: 0, cx: 0, cy: 0 };
  private pressedId: number | null = null;
  private pressedSwell = 0;
  private filter: Filter = DEFAULT_LIST;
  /** 1 = fully shown; dips to 0 and back whenever the arrangement is changed on purpose. */
  private fade = 1;
  private fadeDir: -1 | 0 | 1 = 0;
  private firstLayout = true;
  private storeRef: Store | null = null;
  /** Counts up each time the arrangement is rebuilt, so other layers know to start fresh. */
  layoutVersion = 0;
  private lod = -1;
  private dot = false;
  /** Bumped whenever tile sizes change (zoom level or new layout). Tiles catch up lazily, only while on screen. */
  private epoch = 0;
  /** CSS size of a tile = world size x m; the transform scales it back to its true on-screen size. */
  private m = 1;
  private needsLayout = true;
  private growWanted = false;
  private growing: { ids: number[]; todo: number[]; byItem: Map<number, Item> } | null = null;
  private warmed = new Set<string>();
  private warmEl: HTMLElement | null = null;
  private warmTimer = 0;
  private building: { ranked: { id: number }[]; todo: number[]; byItem: Map<number, Item> } | null = null;
  private offsets = new Float32Array(0);
  private bodies: Body[] = [];

  /** Every tile lives in these two containers (glass, text). Panning moves only the containers: two writes per frame, however many tiles. */
  private gWorld: HTMLElement;
  private cWorld: HTMLElement;
  private vis: StreamTile[] = [];
  private nVis = 0;

  constructor(
    private glassRoot: HTMLElement,
    private stage: HTMLElement,
  ) {
    this.gWorld = document.createElement("div");
    this.gWorld.className = "world";
    glassRoot.appendChild(this.gWorld);
    this.cWorld = document.createElement("div");
    this.cWorld.className = "world";
    stage.appendChild(this.cWorld);
  }

  /** Show this many tiles per row. The grid dissolves and re-forms; it never slides tiles around. */
  setCols(cols: number): void {
    if (cols !== this.cols) {
      this.cols = cols;
      this.needsLayout = true;
    }
  }

  /** Height of every tile, in world units. A change rebuilds the grid. */
  setCellHeight(h: number): void {
    if (Math.abs(h - this.cellH) > 0.01) {
      this.cellH = h;
      this.needsLayout = true;
    }
  }

  /** Swell one tile (hover or touch-hold) so it presses against its neighbours; null lets go. */
  setPressed(id: number | null, swell = 0): void {
    this.pressedId = id;
    this.pressedSwell = id === null ? 0 : swell;
  }

  /** Which tile is at this world position (its resting box), or null. */
  tileAt(x: number, y: number): number | null {
    for (const c of this.active) {
      if (Math.abs(x - c.cx) <= c.w / 2 && Math.abs(y - c.cy) <= c.h / 2) return c.item.id;
    }
    return null;
  }

  tileParts(id: number): { el: HTMLElement; glass: HTMLElement; w: number; h: number; hide(on: boolean): void } | null {
    const c = this.byId.get(id);
    if (!c) return null;
    const w = parseFloat(c.el.style.width);
    const h = parseFloat(c.el.style.height);
    if (!(w > 0) || !(h > 0)) return null;
    return {
      el: c.el,
      glass: c.glass,
      w,
      h,
      hide: (on) => {
        c.el.style.visibility = on ? "hidden" : "";
        c.glass.style.visibility = on ? "hidden" : "";
      },
    };
  }

  tileBox(id: number): { cx: number; cy: number; w: number; h: number } | null {
    for (const c of this.active) if (c.item.id === id) return { cx: c.cx, cy: c.cy, w: c.w, h: c.h };
    return null;
  }

  setGroup(g: { scale: number; ox: number; oy: number; cx: number; cy: number }): void {
    this.group = g;
  }

  setFrameClip(maxBottom: number | null): void {
    this.frameClip = maxBottom;
  }

  private pickedGroup: Group | null = null;
  setCoinGroup(g: Group | null): void {
    if (g !== this.pickedGroup) {
      this.pickedGroup = g;
      this.needsLayout = true;
    }
  }
  get currentCoinGroup(): Group | null {
    return this.pickedGroup;
  }

  setFilter(f: Filter): void {
    if (f !== this.filter) {
      this.filter = f;
      this.needsLayout = true;
    }
  }

  /** The roster size changed: pick the tiles again. */
  relayout(): void {
    this.needsLayout = true;
  }

  /**
   *
   * fade-out and no rebuild; the tiles already shown stay exactly as they are. If the ranking is not the shown tiles followed by new ones (anything moved, left
   * or was reordered) it falls back to the ordinary dissolve and rebuild, so a grow can never leave a wrong page.
   */
  grow(): void {
    this.growWanted = true;
  }

  get currentFilter(): Filter {
    return this.filter;
  }

  /** Vertical extent of the tiles now shown, in world units. */
  bounds(): { top: number; bottom: number } {
    let top = Infinity;
    let bottom = -Infinity;
    for (const c of this.active) {
      top = Math.min(top, c.cy - c.h / 2);
      bottom = Math.max(bottom, c.cy + c.h / 2);
    }
    return top === Infinity ? { top: 0, bottom: 0 } : { top, bottom };
  }

  /** Set by the page while the camera flies or flings: tiles already placed are not rewritten and no flash starts. */
  frozen = false;
  /** Set by the page while a page other than PINR (and not the map) is shown. */
  paused = false;
  private wasPaused = false;

  get count(): number {
    return this.active.length;
  }

  /** Where every card rests. Exposed so tests can prove nothing ever moves. */
  restingPlaces(): [number, number, number, number][] {
    return this.active.map((c) => [c.cx, c.cy, c.w, c.h]);
  }

  tick(store: Store, dt: number, cam: Camera, view: View, light: { x: number; y: number }): void {
    this.storeRef = store;
    // Tiles exist only for the tokens the current filter shows (see layout), never for the whole pool the app knows about.
    if (store.rev !== this.seenRev) {
      this.seenRev = store.rev;
      this.warmGlyphs(store);
      // A token that has left the roster takes its tile away.
      const live = new Set(store.items.map((i) => i.id));
      for (const c of [...this.cards]) {
        if (live.has(c.item.id)) continue;
        this.dropCard(c);
        this.needsLayout = true;
      }
      // An under-full screen (first load, or a short list like New Launches) takes in what has arrived; a full one never reshuffles by itself.
      if (!this.building && this.active.length < Math.min(getRoster(), store.items.length)) this.needsLayout = true;
    }
    // While another page is shown the tiles are out of sight: nothing of theirs is worked out, and no streak is drawn for them.
    if (this.paused) {
      this.nVis = 0;
      this.wasPaused = true;
      return;
    }
    if (this.wasPaused) {
      // Back from another page: events that came meanwhile are not replayed as ninety flashes at once.
      this.wasPaused = false;
      for (const c of this.active) c.seq = c.item.noteSeq;
    }
    const lod = lodFor(CARD_W * cam.scale, this.lod < 0 ? 0 : this.lod);
    //
    if (lod !== this.lod && (!this.frozen || this.lod < 0)) {
      this.lod = lod;
      this.m = LOD_DESIGN_W[lod]! / CARD_W;
      this.stage.dataset.lod = String(lod);
      this.glassRoot.dataset.lod = String(lod);
      this.applySizes();
    }
    //
    const dot = dotFor(CARD_W * cam.scale, this.dot);
    if (dot !== this.dot && !this.frozen) {
      this.dot = dot;
      this.stage.dataset.dot = dot ? "1" : "0";
      this.glassRoot.dataset.dot = dot ? "1" : "0";
    }
    prof.mark("cards:prelude");
    this.labelsFor(cam, lod);
    prof.mark("cards:labelsFor");
    this.arrange(dt);
    prof.mark("cards:arrange");
    this.live(dt);
    prof.mark("cards:live");
    this.render(cam, view, light);
    prof.mark("cards:render");
  }

  /**
   * Decides, from the tile's size on screen, how much of a tile is drawn (see the priority note by LABEL_PX): `data-fit` is "row" (name, score, the
   * label row, coverage, price), "rowless" (no price), "rowbare" (no price, no coverage), and the same three as "plain", "plainnp", "plainbare" when there is no label row (too narrow or too short for one). The content is
   * shrunk a little (`--hs`) before anything is dropped. `--lab` is the row's size in the tile's own units, so it is 9 screen pixels.
   */
  private labScale = 0;
  private labLod = -1;
  private labEpoch = -1;
  private labW = 0;
  private labAt = 0;
  private labPending = false;
  private labKey = "";
  private labelsFor(cam: Camera, lod: number): void {
    //
    // for a change of more than about 1%, and once more when the zoom stops. It reads no layout: the size comes from the camera and the tile's own box.
    //
    if (this.frozen && this.labKey !== "") {
      this.labPending = true;
      return;
    }
    const now = performance.now();
    const key = `${this.active.length}|${this.cellH}|${winH()}`;
    const moved = Math.abs(Math.log(cam.scale / this.labScale)) > 0.012 || lod !== this.labLod || this.epoch !== this.labEpoch || winW() !== this.labW || key !== this.labKey;
    if (!moved && !this.labPending) return;
    if (now - this.labAt < 100 && lod === this.labLod && this.epoch === this.labEpoch && winW() === this.labW) {
      this.labPending = true;
      return;
    }
    this.labPending = false;
    this.labAt = now;
    this.labScale = cam.scale;
    this.labLod = lod;
    this.labEpoch = this.epoch;
    this.labW = winW();
    this.labKey = key;
    let sw = CARD_W * cam.scale;
    let sh = this.cellH * cam.scale;
    for (let i = 0; i < Math.min(this.active.length, 4); i++) {
      const c = this.active[i]!;
      const w = c.w * c.grow.x * this.group.scale * cam.scale;
      const h = c.h * c.grow.x * this.group.scale * cam.scale;
      if (w > 20 && h > 20) {
        sw = w;
        sh = h;
        break;
      }
    }
    const k = sw / LOD_DESIGN_W[lod]!;
    const avail = sh / k;
    // At phone width (under 600 px, PHONE_WIDTH in grid.ts) the picture always sits above the name, as in the apps, whatever the tile size.
    const stack = sw < STACK_BELOW_PX || winW() < 600;
    if (stack !== (this.stage.dataset.stack === "1")) this.stage.dataset.stack = stack ? "1" : "0";
    //
    // their heights are counted at the floor, so lines that no longer fit are dropped instead of printed over each other.
    const tm = textMinPx();
    const chipRow = lod <= 1 ? (tm * 1.5) / k : 0;
    //
    const scoreRow = !scoreShown() && lod <= 1 ? 0 : Math.max(SCORE_H[lod]!, (tm * 2.7) / k);
    const base = PAD_Y2[lod]! + FIMG[lod]! + scoreRow + 2 + (stack ? STACK_H[lod]! : 0) + ADV_H[lod]! + chipRow;
    //
    const cov = COV_H[lod]!;
    const rowH = Math.max(PRICE_H[lod]!, (tm * 1.45) / k);
    const mcH = rowH;
    const athH = rowH;
    //
    const options: [string, number][] = [["fee", base + cov + mcH + athH + rowH], ["all", base + cov + mcH + athH + (lod <= 1 ? rowH * 0.12 : 0)], ["mc", base + cov + mcH], ["cov", base + cov], ["bare", base]];
    let pick: [string, number] | undefined;
    for (const o of options) {
      // The figures may shrink a little more than the rest before they are dropped, so a short tile on a desktop still carries them where it can.
      if (avail >= o[1] * (lod <= 1 ? 0.95 : o[0] === "fee" || o[0] === "all" || o[0] === "mc" ? SHRINK_FIGS : SHRINK_MIN)) {
        pick = o;
        break;
      }
    }
    // Nothing fits at 85%: the content is shrunk further instead.
    pick ??= ["bare", base];
    const [fit, content] = pick;
    if (this.stage.dataset.fit !== fit) this.stage.dataset.fit = fit;
    // The tile's own padding does not shrink; everything else does.
    const hs = Math.max(0.3, Math.min(1, (0.93 * (avail - PAD_Y2[lod]!)) / (content - PAD_Y2[lod]!))).toFixed(3);
    if (this.stage.style.getPropertyValue("--hs") !== hs) this.stage.style.setProperty("--hs", hs);
    this.stage.style.setProperty("--lab", `${(LABEL_PX / k / Number(hs)).toFixed(2)}px`);
    this.stage.style.setProperty("--nmin", `${(LABEL_PX / k / Number(hs)).toFixed(2)}px`);
    this.stage.style.setProperty("--tmin", `${(tm / k / Number(hs)).toFixed(2)}px`);
    this.stage.style.setProperty("--chipnum", `${(numMinPx() / k / Number(hs)).toFixed(2)}px`);
  }

  /** Rebuild the arrangement when asked: the very first time at once, afterwards dissolve out, rebuild, dissolve in. */
  private arrange(dt: number): void {
    if (this.growWanted && !this.needsLayout && this.fadeDir === 0 && !this.building && !this.firstLayout) {
      if (this.growStep()) this.growWanted = false;
    }
    if (this.needsLayout && this.fadeDir === 0) {
      if (this.firstLayout) {
        // The first arrangement fades in from nothing.
        this.firstLayout = false;
        this.layout(true);
        this.fade = 0;
        this.fadeDir = 1;
      } else this.fadeDir = -1;
    }
    if (this.fadeDir === -1) {
      this.fade = Math.max(0, this.fade - dt / 0.16);
      // The new tiles are made a few per frame while nothing shows; the fade in starts when all are there (a swap of ninety tiles in one frame was a 1 s frame).
      if (this.fade === 0 && this.layout(false)) this.fadeDir = 1;
    } else if (this.fadeDir === 1) {
      this.fade = Math.min(1, this.fade + dt / 0.26);
      if (this.fade === 1) this.fadeDir = 0;
    }
    if (this.fadeDir !== 0 || this.fade < 1) {
      const o = this.fadeDir === 0 ? "" : String(this.fade.toFixed(3));
      this.gWorld.style.opacity = o;
      this.cWorld.style.opacity = o;
    }
  }

  private add(item: Item): void {
    const parts = build(item);
    const c: CardView = {
      item,
      ...parts,
      cx: 0,
      cy: 0,
      w: CARD_W,
      h: 100,
      grow: makeSpring(1),
      ox: makeSpring(),
      oy: makeSpring(),
      seq: item.noteSeq,
      heat: -1,
      tx: NaN,
      ty: NaN,
      ts: NaN,
      z: -1,
      off: false,
      gone: false,
      tier: -1,
      sizedAt: -1,
      ev: -1,
      num: makeSpring(Number(item.value)),
      shown: Number(item.value),
      lookKey: "",
      lookKind: "",
      factsKey: "",
      idKey: `${item.name}|${item.ticker}|${item.image ?? ""}|${item.tag}|${(item.tags ?? []).join(",")}|${item.createdCount ?? ""}`,
      tagsKey: `${(item.tags ?? []).join(",")}|${item.createdCount ?? ""}`,
      picKey: `${item.image ?? ""}|${item.name}`,
      specX: 1e9,
      specY: 1e9,
      flashAt: 0,
      valueColor: "",
      dotColor: "",
    };
    this.gWorld.appendChild(c.glass);
    this.cWorld.appendChild(c.el);
    this.cards.push(c);
    this.byId.set(item.id, c);
  }

  private dropCard(c: CardView): void {
    c.el.remove();
    c.glass.remove();
    this.byId.delete(c.item.id);
    this.cards.splice(this.cards.indexOf(c), 1);
  }

  /**
   * The first time a character such as an emoji or a flag is laid out, the browser looks its font up and shapes it: a swap to a list full of new ones then
   *
   * once in the tile name's own font, a few per idle moment, in an element nobody sees.
   */
  private warmGlyphs(store: Store): void {
    if (this.warmTimer || typeof requestIdleCallback !== "function") return;
    const fresh: string[] = [];
    for (const it of store.items) {
      for (const ch of `${it.name}${it.ticker}`) {
        if (ch.length === 1 && ch.charCodeAt(0) < 0x250) continue;
        if (this.warmed.has(ch)) continue;
        this.warmed.add(ch);
        fresh.push(ch);
      }
    }
    if (fresh.length === 0) return;
    const run = (): void => {
      this.warmTimer = 0;
      const part = fresh.splice(0, 6).join(" ");
      if (!part) return;
      if (!this.warmEl) {
        const w = document.createElement("div");
        w.className = "card glyphwarm";
        w.setAttribute("aria-hidden", "true");
        w.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;visibility:hidden;pointer-events:none;";
        const n = document.createElement("div");
        n.className = "name";
        w.append(n);
        document.body.append(w);
        this.warmEl = n;
      }
      this.warmEl.textContent = part;
      void this.warmEl.offsetWidth; // shaped here, at an idle moment
      if (fresh.length) this.warmTimer = requestIdleCallback(run, { timeout: 2000 });
      else this.warmEl.textContent = "";
    };
    this.warmTimer = requestIdleCallback(run, { timeout: 2000 });
  }

  /** Decide every shown tile's place from the current filter's ranking. Returns false while tiles are still being made (call again next frame); `all` makes them in one go. */
  private layout(all: boolean): boolean {
    // A new request while one is being built (another filter): start again from the new ranking.
    if (this.building && this.needsLayout) this.building = null;
    if (!this.building) {
      this.needsLayout = false;
      this.growing = null; // an append in progress is dropped: this is a full arrangement
      const allItems = this.storeRef?.items ?? [];
      const items = this.pickedGroup ? allItems.filter((it) => groupOf(it) === this.pickedGroup) : allItems;
      //
      const ranked = selectAndRank(this.filter, isListFilter(this.filter) ? items : items.filter(hasSomethingToShow));
      // Tiles for the ranked tokens only: the ones no longer shown are taken away, the newly shown ones are made.
      const wanted = new Set(ranked.map((r) => r.id));
      for (const c of [...this.cards]) if (!wanted.has(c.item.id)) this.dropCard(c);
      this.building = { ranked, todo: ranked.map((r) => r.id).filter((id) => !this.byId.has(id) && !this.bad.has(id)), byItem: new Map(items.map((it) => [it.id, it])) };
      // The old arrangement is gone from here: nothing of it is worked out while the new one is made.
      this.active = [];
      this.bodies = [];
      this.offsets = new Float32Array(0);
      this.pressedId = null;
    }
    const b = this.building;
    let made = 0;
    while (b.todo.length && (all || made < TILES_PER_FRAME)) {
      const id = b.todo.shift()!;
      const it = b.byItem.get(id);
      if (!it || this.byId.has(id)) continue;
      made++;
      try {
        this.add(it);
      } catch (e) {
        // A token whose tile cannot be made is left out (once), not retried every frame, and never stops the others.
        this.bad.add(id);
        if (this.storeRef) this.storeRef.skipped++;
        console.error("PINR: a tile could not be made and was skipped:", id, e);
      }
    }
    if (b.todo.length) return false;
    this.building = null;
    this.layoutVersion++;
    const ranked = b.ranked;
    const rects = layoutGrid(
      ranked.map((r) => r.id).filter((id) => this.byId.has(id)),
      this.cols,
      CARD_W,
      this.cellH,
      GAP,
    );
    this.active = [];
    this.pressedId = null;
    for (const c of this.cards) {
      const r = rects.get(c.item.id);
      const gone = r === undefined;
      if (gone !== c.gone) {
        c.gone = gone;
        c.el.classList.toggle("gone", gone);
        c.glass.classList.toggle("gone", gone);
      }
      if (!r) continue;
      c.cx = r.x + r.w / 2;
      c.cy = r.y + r.h / 2;
      c.w = r.w;
      c.h = r.h;
      if (c.tier !== 1) {
        c.el.classList.add("t1");
        c.tier = 1;
      }
      c.tx = NaN; // force a fresh write of its position
      c.grow.x = 1;
      c.grow.v = 0;
      c.ox.x = c.oy.x = 0;
      c.ox.v = c.oy.v = 0;
      this.active.push(c);
    }
    this.applySizes();
    this.bodies = this.active.map((c) => ({ cx: c.cx, cy: c.cy, w: c.w, h: c.h, grow: 1 }));
    this.offsets = new Float32Array(this.active.length * 2);
    return true;
  }

  /**
   * One frame of an append (see `grow`). Returns true when it is finished or has handed over to the ordinary rebuild, false while more tiles are still to be made.
   * The tiles shown keep their place, size, motion and opacity: only the new ones are made and placed, in the grid's own order (row after row, so the old rows do not move).
   */
  private growStep(): boolean {
    if (!this.growing) {
      const allItems = this.storeRef?.items ?? [];
      const items = this.pickedGroup ? allItems.filter((it) => groupOf(it) === this.pickedGroup) : allItems;
      const ranked = selectAndRank(this.filter, isListFilter(this.filter) ? items : items.filter(hasSomethingToShow));
      const ids = ranked.map((r) => r.id).filter((id) => !this.bad.has(id));
      const shown = new Set(this.active.map((c) => c.item.id));
      // Only an append is allowed: every tile shown is still wanted and sits in the first places of the new ranking, and no tile shown is hidden.
      let ok = shown.size <= ids.length && this.cards.every((c) => shown.has(c.item.id) === !c.gone);
      for (let i = 0; ok && i < shown.size; i++) if (!shown.has(ids[i]!)) ok = false;
      if (!ok) {
        this.needsLayout = true; // not an append: the ordinary dissolve and rebuild
        return true;
      }
      this.growing = { ids, todo: ids.filter((id) => !this.byId.has(id)), byItem: new Map(items.map((it) => [it.id, it])) };
    }
    const g = this.growing;
    let made = 0;
    while (g.todo.length && made < TILES_PER_FRAME) {
      const id = g.todo.shift()!;
      const it = g.byItem.get(id);
      if (!it || this.byId.has(id)) continue;
      made++;
      try {
        this.add(it);
      } catch (e) {
        this.bad.add(id);
        if (this.storeRef) this.storeRef.skipped++;
        console.error("PINR: a tile could not be made and was skipped:", id, e);
      }
    }
    if (g.todo.length) return false;
    this.growing = null;
    const shown = new Set(this.active.map((c) => c.item.id));
    const rects = layoutGrid(
      g.ids.filter((id) => this.byId.has(id)),
      this.cols,
      CARD_W,
      this.cellH,
      GAP,
    );
    const added: CardView[] = [];
    for (const c of this.cards) {
      if (shown.has(c.item.id)) continue;
      const r = rects.get(c.item.id);
      const gone = r === undefined;
      if (gone !== c.gone) {
        c.gone = gone;
        c.el.classList.toggle("gone", gone);
        c.glass.classList.toggle("gone", gone);
      }
      if (!r) continue;
      c.cx = r.x + r.w / 2;
      c.cy = r.y + r.h / 2;
      c.w = r.w;
      c.h = r.h;
      if (c.tier !== 1) {
        c.el.classList.add("t1");
        c.tier = 1;
      }
      c.tx = NaN;
      c.grow.x = 1;
      c.grow.v = 0;
      c.ox.x = c.oy.x = 0;
      c.ox.v = c.oy.v = 0;
      added.push(c);
    }
    if (added.length) {
      for (const c of added) this.active.push(c);
      for (const c of added) this.bodies.push({ cx: c.cx, cy: c.cy, w: c.w, h: c.h, grow: 1 });
      const o = new Float32Array(this.active.length * 2);
      o.set(this.offsets.subarray(0, Math.min(this.offsets.length, o.length)));
      this.offsets = o;
      this.layoutVersion++; // the scroll limits are read again; the epoch is left alone so no tile already shown is touched
    }
    return true;
  }

  /** Sizes changed. Nothing is written here: each tile updates itself the moment it is next on screen. */
  private applySizes(): void {
    this.epoch++;
  }

  /**
   *
   * nothing else. The all-time high shows only where a launchpad's own record states it (receipt on DeepScan), else a dash. Rewritten only when the words change.
   */
  private writeFacts(c: CardView): void {
    const it = c.item;
    const flagged = it.status === "flag";
    const mc = flagged ? "" : money(it.mcap);
    const ath = flagged ? "" : Number.isFinite(it.ath) && it.ath > 0 ? money(it.ath) : "—";
    //
    const txns = flagged ? "" : it.trades1h !== undefined && Number.isFinite(it.trades1h) ? `${countShort(it.trades1h)} /1h` : "—";
    //
    // first; a rewards program's fee at its standard rate comes last, after ATH, so it is the first line a short tile drops.
    const fee = flagged || !it.transferFee ? "" : feeShort(it.transferFee);
    const lk = it.links ? `${it.links.x ?? ""}|${it.links.telegram ?? ""}|${it.links.website ?? ""}` : "";
    const key = `${fee}|${mc}|${txns}|${ath}|${lk}`;
    if (key === c.factsKey) return;
    c.factsKey = key;
    const row = (label: string, value: string): HTMLDivElement => {
      const d = document.createElement("div");
      d.className = "frow";
      const l = document.createElement("span");
      l.className = "flab";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "fmc";
      v.textContent = value;
      d.append(l, v);
      return d;
    };
    const rows: HTMLElement[] = [];
    const feeFirst = fee !== "" && it.transferFee?.kind === "outside_norm";
    if (feeFirst) rows.push(row("Fee", fee));
    if (mc !== "") {
      const r = row("MC", mc);
      //
      if (txns !== "") {
        const x = document.createElement("span");
        x.className = "ftx";
        x.textContent = ` · ${txns === "—" ? "— tx" : txns.replace(" /1h", " tx/1h")}`;
        r.querySelector(".fmc")!.append(x);
      }
      rows.push(r);
    }
    if (txns !== "") {
      const r = row("TX/1h", txns.replace(" /1h", ""));
      r.classList.add("ftxrow");
      rows.push(r);
    }
    if (ath !== "") rows.push(row("ATH", ath));
    if (fee !== "" && !feeFirst) rows.push(row("Fee", fee));
    c.factsEl.replaceChildren(...rows);
    c.chipsEl.replaceChildren(...socialChips(it.links));
  }

  private factsDue = false;
  private factsAt = 0;

  /** Live state: swelling, neighbour push, flash and event line. */
  private frameNo = 0;
  /** The zoom the tiles' transforms were written at, how long the camera's zoom has rested, and the container transform last written. */
  private sW = 0;
  private sRest = 0;
  private lastS = 0;
  private lastWt = "";
  /** The tiles worked on this frame (on screen, with the margin, or pressed): their places in `active`, their bodies and their pushes. Reused every frame. */
  private workIdx: number[] = [];
  private workBodies: Body[] = [];
  private workOut = new Float32Array(0);
  private live(dt: number): void {
    this.frameNo++;
    const work = this.workIdx;
    work.length = 0;
    const clock = performance.now();
    this.factsDue = clock - this.factsAt > 1000;
    if (this.factsDue) this.factsAt = clock;
    for (let i = 0; i < this.active.length; i++) {
      const c = this.active[i]!;
      const it = c.item;
      const pressed = it.id === this.pressedId;
      //
      // Decided first, before anything about the tile is read: with thousands of tiles this line is the whole cost of the ones far off screen.
      if (c.off && !pressed && c.lookKey !== "") continue;
      work.push(i);
      const flagged = it.status === "flag";
      const heat = flagged ? 0 : Math.min(1, it.spike / 0.6);
      c.grow.target = 1 + Math.max(SIM.maxSwell * heat, pressed ? this.pressedSwell : 0);
      // Pressing is snappier than the slow swell of an event.
      stepSpring(c.grow, pressed || this.pressedId !== null ? 12 : 7, dt);
      this.bodies[i]!.grow = c.grow.x;

      // IDENTITY: a name, ticker or picture that arrives after the tile was made (real results) is written in.
      // The keys that notice a changed name, picture or reading are built about seven times a second per tile, spread over the frames (not 90 tiles every frame).
      const checkNow = (this.frameNo + i) % 8 === 0 || c.lookKey === "";
      const idKey = checkNow ? `${it.name}|${it.ticker}|${it.image ?? ""}|${it.tag}|${(it.tags ?? []).join(",")}|${it.createdCount ?? ""}` : c.idKey;
      if (idKey !== c.idKey) {
        c.idKey = idKey;
        //
        const tagsKey = `${(it.tags ?? []).join(",")}|${it.createdCount ?? ""}`;
        if (tagsKey !== c.tagsKey) {
          c.tagsKey = tagsKey;
          c.ttagsEl.replaceChildren(...tileTagChips(it.tags ?? [], it.createdCount));
        }
        setText(c.nameEl, it.name);
        setText(c.tickEl, tickerText(it));
        c.tickEl.classList.toggle("nl", isNameless(it));
        setText(c.tagEl, it.tag);
        c.tagEl.parentElement?.classList.toggle("none", !it.tag);
        const picKey = `${it.image ?? ""}|${it.name}`;
        if (picKey !== c.picKey) {
          c.picKey = picKey;
          c.avatarEl.replaceChildren();
          if (it.image) c.avatarEl.append(pictureOf(it.image, it.name, it.address));
          else c.avatarEl.textContent = avatarChar(it.name);
        }
      }

      // STATUS: a flagged token shows its label instead of a score, and a missing reading is a dash, never a number.
      const ago = checkNow ? scoredAgoShort(it.scoredAtMs, Date.now()) : null;
      const key = checkNow ? `${it.status}|${it.flagKind ?? ""}|${it.coverage}|${showsEarly(it)}|${ago}|${ribbonMode(it, Date.now())}|${lastTradeText(realOf(it.address)?.lastRealMs, Date.now())}` : c.lookKey;
      if (key !== c.lookKey) {
        c.lookKey = key;
        const look = statusLook(it);
        if (look.kind !== c.lookKind) {
          c.el.classList.toggle("st-flag", look.kind === "flag");
          c.lookKind = look.kind;
        }
        // A longer label (MAYHEM, HONEYPOT) is set smaller so it never runs into the coverage figure.
        c.el.dataset.flen = look.kind === "flag" ? (look.text.length <= 4 ? "s" : look.text.length <= 7 ? "m" : "l") : "";
        // Coverage is how much of PINR's reading loaded. A coin PINR has not read yet says so instead of a "0%".
        setText(c.covEl, it.coverage > 0 ? `${it.coverage}%` : "—");
        setEarly(c.earlyEl, showsEarly(it));
        (c.el.querySelector(".advtag") as HTMLElement | null)?.toggleAttribute("hidden", !look.numeric);
        setText(c.ctagEl, look.numeric ? (ago !== null ? `${SCORE_TAG} · ${ago}` : SCORE_TAG) : "");
        //
        const rm = ribbonMode(it, Date.now());
        const lt = rm === "real" ? lastTradeText(realOf(it.address)?.lastRealMs, Date.now()) : "";
        c.ctagEl.title = rm === "real" ? `${SCORE_NOTICE} Each dot is one real trade${lt ? `; ${lt}` : ""}.` : `${SCORE_NOTICE} No trades yet.`;
        setText(c.covWordEl, look.kind === "flag" ? "no data" : it.coverage > 0 ? "coverage" : "unread");
        if (!scoreShown()) {
          //
          // The ribbon's label stays, as the tile's hover text.
          setText(c.covEl, "");
          setText(c.covWordEl, look.kind === "flag" ? "no data" : "");
          setEarly(c.earlyEl, false);
          setText(c.ctagEl, "");
          c.ctagEl.title = "";
          (c.el.querySelector(".advtag") as HTMLElement | null)?.toggleAttribute("hidden", true);
          c.el.title = rm === "real" ? `Each dot is one real trade${lt ? `; ${lt}` : ""}.` : "No trades yet.";
        }
        if (look.numeric) {
          c.shown = Number(it.value);
          c.num.x = c.shown;
          c.num.v = 0;
          c.valueEl.style.color = scoreColor(c.shown);
        } else c.valueEl.style.color = look.kind === "flag" ? "" : "var(--mute)";
        if (c.valueEl.textContent !== look.text) c.valueEl.textContent = look.text;
        //
        c.valueEl.title = look.numeric ? SCORE_NOTICE : "";
      }
      if (c.lookKind === "ok" || (c.lookKind === "thin" && it.coverage > 0 && Number.isFinite(Number(it.value)))) {
        c.num.target = Number(it.value);
        stepSpring(c.num, 9, dt);
        // One place decides what the number may say: the coin's own score, or a dash (scoretile.ts); a spring left over from another value cannot stay.
        const t = tileNumber(it.value, c.num.x, c.shown);
        c.num.x = t.x;
        if (!Number.isFinite(t.x)) c.num.v = 0;
        if (t.text !== null) {
          c.shown = t.shown;
          //
          if (c.valueEl.textContent !== t.text) c.valueEl.textContent = t.text;
          const col = Number.isFinite(t.shown) ? scoreColor(t.shown) : "var(--mute)";
          if (c.valueColor !== col) {
            c.valueColor = col;
            c.valueEl.style.color = col;
          }
        }
      }
      // The dot's glow: the card's Token health colour; a coin with no reading is a dim ring that says "not read", never a score colour.
      // A card that shows a number (a thin reading with a coverage above 0 still shows one) glows in that number's colour, exactly as its number does.
      const showsNumber = c.lookKind === "ok" || (c.lookKind === "thin" && it.coverage > 0 && Number.isFinite(Number(it.value)));
      const dc = showsNumber && Number.isFinite(c.shown) ? scoreColor(c.shown) : "var(--mute)";
      if (dc !== c.dotColor) {
        c.dotColor = dc;
        c.el.style.setProperty("--dot", dc);
        c.el.classList.toggle("noread", dc === "var(--mute)");
      }
      // The glow colour follows the latest event.
      const evSide = it.evSide;
      if (evSide !== c.ev) {
        c.ev = evSide;
        const col = evSide === 1 ? EV_LIME : evSide === 0 ? EV_MANDARIN : EV_NEUTRAL;
        c.el.style.setProperty("--ev", col);
        c.glass.style.setProperty("--ev", col);
      }
      if (it.noteSeq !== c.seq && (this.frozen || c.off)) c.seq = it.noteSeq; // not flashed: out of sight or the camera is flying
      if (it.noteSeq !== c.seq) {
        c.seq = it.noteSeq;
        // Restart the flash animation on every new event.
        // Two classes take turns, so the animation restarts without forcing the page to lay itself out (no offsetWidth read).
        // At most one restart per tile every 350 ms: a busy coin otherwise rewrites its class every frame.
        if (clock - c.flashAt > 350) {
          c.flashAt = clock;
          const next = c.glass.classList.contains("ping") ? "pong" : "ping";
          c.glass.classList.remove("ping", "pong");
          c.glass.classList.add(next);
        }
      }
      if (this.factsDue) {
        this.writeFacts(c);
        c.badge.set(it);
      }
      const text = it.note ?? "";
      if (c.noteEl.textContent !== text) c.noteEl.textContent = text;
      c.noteEl.classList.toggle("on", it.note !== null && it.noteLeft > 0.8);

      const h = Math.round(heat * 10) / 10; // each step repaints the tile's blurred shadows: ten steps, not fifty
      if (h !== c.heat) {
        c.heat = h;
        c.el.style.setProperty("--heat", String(h));
        c.glass.style.setProperty("--heat", String(h));
      }
    }
    // Item 134 (lag): with lists that hold thousands of tiles, only the tiles worked on above (on screen with the margin, or pressed) swell, push their neighbours and
    // spring this frame; a tile far off screen is passed over without a visit. Its push and spring catch up on the frames after it scrolls in.
    const n = work.length;
    const wb = this.workBodies;
    wb.length = n;
    for (let j = 0; j < n; j++) {
      const b = this.bodies[work[j]!]!;
      b.grow = this.active[work[j]!]!.grow.x;
      wb[j] = b;
    }
    if (this.workOut.length < n * 2) this.workOut = new Float32Array(n * 2 + 64);
    pressureOffsets(wb, this.workOut, CARD_W / 170);
    for (let j = 0; j < n; j++) {
      const c = this.active[work[j]!]!;
      c.ox.target = this.workOut[j * 2]!;
      c.oy.target = this.workOut[j * 2 + 1]!;
      stepSpring(c.ox, 8, dt);
      stepSpring(c.oy, 8, dt);
    }
  }

  /** The tiles currently on screen, with their boxes. Valid until the next tick; read only the first `count`. */
  visibleTiles(): { list: StreamTile[]; count: number } {
    return { list: this.vis, count: this.nVis };
  }

  private render(cam: Camera, view: View, light: { x: number; y: number }): void {
    this.nVis = 0;
    // Pan and zoom move the container, not the tiles. The tiles' own transforms are written for the zoom `s` (`sW`); while the camera zooms, the
    // containers carry the difference as one scale `k` (exactly: a tile's screen place is wx + k * its place at `sW`), so a fly-out or a pinch
    // writes two styles a frame, not two for every tile. Once the zoom has rested a few frames the tiles are written once at the new zoom.
    const sCur = cam.scale;
    if (this.sW === 0) this.sW = sCur;
    this.sRest = Math.abs(sCur - this.lastS) <= sCur * 1e-6 ? this.sRest + 1 : 0;
    this.lastS = sCur;
    const off = sCur / this.sW;
    if ((this.sRest >= 6 && Math.abs(off - 1) > 1e-3) || off > 3 || off < 0.33) this.sW = sCur;
    const s = this.sW;
    const k = sCur / s;
    const wx = view.w / 2 - cam.x * sCur;
    const wy = view.h / 2 - cam.y * sCur;
    const wt = `translate3d(${wx.toFixed(2)}px,${wy.toFixed(2)}px,0)${k === 1 ? "" : ` scale(${k.toFixed(5)})`}`;
    if (wt !== this.lastWt) {
      this.lastWt = wt;
      this.gWorld.style.transform = wt;
      this.cWorld.style.transform = wt;
    }

    for (const c of this.active) {
      const g = c.grow.x;
      // Swell is a scale about the tile's own centre, so its place never changes.
      const gr = this.group;
      const gs = gr.scale;
      const sw = c.w * g * gs * s;
      const sh = c.h * g * gs * s;
      // A swelled/pushed PINR room (map view) carries its tiles with it: scale about the room's centre, then shift.
      const ex = gr.cx + (c.cx + c.ox.x - gr.cx) * gs + gr.ox;
      const ey = gr.cy + (c.cy + c.oy.x - gr.cy) * gs + gr.oy;
      const px = ex * s - sw / 2;
      const py = ey * s - sh / 2;
      // Visible if any part is on screen (screen position = container offset + local position).
      const X = wx + k * px;
      const Y = wy + k * py;
      const vis =
        X + k * sw > -120 &&
        Y + k * sh > -120 &&
        X < view.w + 120 &&
        Y < view.h + 120 &&
        (this.frameClip === null || c.cy + c.h / 2 <= this.frameClip);
      if (vis && c.sizedAt !== this.epoch) {
        // Off-screen tiles are out of layout entirely, so zoom-level changes only ever touch what you can see.
        const w = `${(c.w * this.m).toFixed(2)}px`;
        const h = `${(c.h * this.m).toFixed(2)}px`;
        c.el.style.width = c.glass.style.width = w;
        c.el.style.height = c.glass.style.height = h;
        c.sizedAt = this.epoch;
      }
      if (vis === c.off) {
        c.off = !vis;
        c.el.classList.toggle("off", !vis);
        c.glass.classList.toggle("off", !vis);
      }
      if (!vis) continue;

      let t = this.vis[this.nVis];
      if (!t) t = this.vis[this.nVis] = { id: 0, x: 0, y: 0, w: 0, h: 0, heat: 0, imp: 0, item: c.item };
      this.nVis++;
      t.id = c.item.id;
      t.x = X;
      t.y = Y;
      t.w = sw * k;
      t.h = sh * k;
      t.heat = Math.min(1, c.item.spike / 0.6);
      t.imp = liveImportance(c.item);
      t.item = c.item;

      const sc = (s * g * gs) / this.m;
      // Written when NOT within tolerance of the last value, so a never-written tile (NaN) is always written.
      // While the camera is flying or flinging (`frozen`) a tile that has been placed once is left alone: nobody can read it, and it is caught up when the camera slows.
      if ((!this.frozen || Number.isNaN(c.tx)) && !(Math.abs(px - c.tx) <= 0.05 && Math.abs(py - c.ty) <= 0.05 && Math.abs(sc - c.ts) <= 5e-4)) {
        c.tx = px;
        c.ty = py;
        c.ts = sc;
        //
        const tf = `translate(${px.toFixed(2)}px,${py.toFixed(2)}px) scale(${sc.toFixed(5)})`;
        c.el.style.transform = tf;
        c.glass.style.transform = tf;
      }
      // Light position inside the tile. Only touched when it has visibly moved.
      const lx = Math.round((light.x * c.w * this.m * 0.5) / 2) * 2;
      const ly = Math.round((light.y * c.h * this.m * 0.5) / 2) * 2;
      if ((!this.frozen || c.specX === 1e9) && (lx !== c.specX || ly !== c.specY)) {
        c.specX = lx;
        c.specY = ly;
        c.spec.style.transform = `translate(${lx}px,${ly}px)`;
      }
      // Hotter tiles sit above the tiles they push against.
      const z = 1 + Math.round((g - 1) * 100);
      if (z !== c.z && !this.frozen) {
        c.z = z;
        c.el.style.zIndex = String(z);
        c.glass.style.zIndex = String(z);
      }
    }
  }
}

const INT = new Intl.NumberFormat("en-US");
/** A count of trades, short: 87, 1,240, 12.4K, 1.2M. */
export function countShort(n: number): string {
  if (n < 10_000) return INT.format(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
