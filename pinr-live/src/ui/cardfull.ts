import { money, signedPct, ageText } from "../world/discoverlist";
import { formatPrice } from "../world/format";
import { chainName } from "../world/chainname";
import { statusLook, type Item } from "../world/model";
import { tagChips } from "../world/tags";
import { highlightShown, lookupTradeLink } from "./highlightline";

/**
 *
 * viewer and sets it large on the site's glass tablet (the `.glass` panel every tile uses: the same edge, shadow, radius and light), with all of the
 * coin's data beside it and a Deep Scan button that goes on to the DeepScan page. Observed words only; a missing figure is a dash. Close sends the card
 * back to its place.
 *
 *
 * the tile's place is measured once when the card opens and once when it closes, never while it moves. Reduced motion: a short fade only.
 */
export interface CardParts {
  el: HTMLElement;
  glass: HTMLElement;
  /** The tile's design size in px (what its own CSS box is before the camera scales it). */
  w: number;
  h: number;
  /** Hide the real tile while its copy is lifted, and show it again. */
  hide(on: boolean): void;
}

export interface CardFullOptions {
  /** Open this coin's DeepScan page (the full card is already closed). */
  onDeepScan(item: Item): void;
  /** The tile's elements, or null when it is not drawn. */
  partsOf(item: Item): CardParts | null;
  /** Where the tile is on screen now (null when not drawn): the card lifts from and returns to it. */
  rectOf(item: Item): DOMRect | null;
  /** The real #stage and #glassLayer, whose look (zoom level, fit, sizes) the copy keeps. */
  stage(): HTMLElement;
  glassLayer(): HTMLElement;
  /** The card was closed by the Close button, Escape or a tap beside it (not by Back): the caller steps Back so the path stays in step. */
  onCloseRequest(): void;
}

export interface CardFull {
  readonly isOpen: boolean;
  readonly item: Item | null;
  open(item: Item): void;
  /** On a press that may become a tap: build the card and lay the tablet out (unseen) so open() only starts the move. Safe to call any time; dropped if unused. */
  prepare(item: Item): void;
  /** The press became a scroll or a pinch: throw the card built ahead away. */
  cancelPrepare(): void;
  /** Close it (Back, Close, or a new page): the card returns to its tile, or fades when the tile is not drawn. Safe to call twice. */
  close(animate?: boolean): void;
}

/**
 * A card built at press time is used again only for the same coin whose tile element is still the same one (the tile's parts object is new on every
 * call, so the element is the stable part to compare).
 */
export function canReuse<T extends { item: Item; p: { el: HTMLElement } }>(ready: T | null, item: Item, el: HTMLElement | null): ready is T {
  return ready !== null && ready.item === item && el !== null && ready.p.el === el;
}

const MS = 340;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createCardFull(opts: CardFullOptions): CardFull {
  const root = el("div", "cfull");
  root.hidden = true;
  const veil = el("div", "cfveil");
  const tablet = el("section", "glass cftablet");
  tablet.setAttribute("role", "dialog");
  tablet.setAttribute("aria-modal", "true");
  root.append(veil, tablet);
  document.body.append(root);

  let current: Item | null = null;
  let parts: CardParts | null = null;
  let hero: HTMLElement | null = null;
  let slot: HTMLElement | null = null;
  let factor = 1;
  let closing = false;
  let timer = 0;
  let ready: { item: Item; p: CardParts; hero: HTMLElement; factor: number; to: DOMRect } | null = null;
  let readyTimer = 0;
  const still = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function figure(label: string, value: string, tone?: "up" | "down"): HTMLElement {
    const f = el("div", "cffig");
    // A long figure (a price with many zeros) shrinks to stay on one line; it never breaks in the middle of a number.
    const b = el("b", [tone, value.length > 13 ? "xl" : value.length > 10 ? "lg" : ""].filter(Boolean).join(" ") || undefined, value);
    f.append(el("i", undefined, label), b);
    return f;
  }

  /** An exact copy of the tile (its glass and its text) in the same surroundings the site's styles expect. */
  function buildHero(p: CardParts): HTMLElement {
    const h = el("div", "cfhero");
    h.style.width = `${p.w}px`;
    h.style.height = `${p.h}px`;
    const gl = document.createElement("div");
    gl.id = "glassLayer";
    gl.dataset.lod = opts.glassLayer().dataset.lod ?? "2";
    const st = document.createElement("div");
    st.id = "stage";
    const real = opts.stage();
    for (const k of Object.keys(real.dataset)) st.dataset[k] = real.dataset[k]!;
    st.style.cssText = real.style.cssText;
    for (const [src, host] of [[p.glass, gl], [p.el, st]] as const) {
      const c = src.cloneNode(true) as HTMLElement;
      c.classList.remove("off", "gone");
      c.style.transform = "none";
      c.style.visibility = "";
      c.removeAttribute("id");
      host.append(c);
    }
    h.append(gl, st);
    return h;
  }

  function fill(it: Item): void {
    tablet.replaceChildren();
    tablet.setAttribute("aria-label", `${it.name} ${it.ticker}`);
    slot = el("div", "cfslot");
    const close = el("button", "cfclose", "Close");
    close.type = "button";
    close.setAttribute("aria-label", "Close this card");
    close.addEventListener("click", () => opts.onCloseRequest());
    const top = el("div", "cftop");
    top.append(slot);
    // The card on the tablet is the tile as it is (its words may be cut to fit it): the full name, ticker and tags are written out here, whole.
    const ident = el("div", "cfident");
    ident.append(el("h2", "cfname", it.name), el("div", "cftick", it.ticker));
    const tags = el("div", "cftags");
    tags.append(...tagChips(it.tags ?? [], it.createdCount));
    if (tags.childElementCount) ident.append(tags);

    const look = statusLook(it);
    const change = it.change24h;
    const figs = el("div", "cffigs");
    figs.append(
      figure("Market cap", money(it.mcap)),
      figure("All-time high", Number.isFinite(it.ath) ? money(it.ath) : "—"),
      figure("24h change", signedPct(change), Number.isFinite(change) ? (change >= 0 ? "up" : "down") : undefined),
      figure("Price", Number.isFinite(it.priceUsd) ? formatPrice(it.priceUsd) : "—"),
      figure("24h volume", money(it.volume24h)),
      figure("Liquidity", money(it.liquidity)),
      figure("Age", ageText(it.ageMin)),
      figure("Trades, last hour", typeof it.trades1h === "number" ? it.trades1h.toLocaleString("en-US") : "—"),
      figure("Pair", it.quotePair || "—"),
      figure("Chain · launchpad", [it.chain ? chainName(it.chain) : "", it.launchpad ?? ""].filter(Boolean).join(" · ") || "—"),
    );
    if (look.kind !== "hidden") figs.prepend(figure("Token health", look.numeric ? `${look.text} · coverage ${Math.round(it.coverage)}%` : look.text));

    const links = el("div", "cflinks");
    for (const [label, href] of [["X", it.links?.x], ["Telegram", it.links?.telegram], ["Website", it.links?.website]] as const) {
      if (!href) continue;
      const a = el("a", "cflink", label);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.append(a);
    }
    const go = el("button", "cfgo", "Deep Scan");
    go.type = "button";
    go.addEventListener("click", () => {
      if (current) opts.onDeepScan(current);
    });
    //
    hl = el("div", "cfhl");
    hl.hidden = true;
    hlKey = "";
    tablet.append(close, top, ident, hl, figs, links, go);
  }

  /** The tile's "Large buy $540" line on the opened card for as long as the tile's note lasts, linking that trade; a volume surge or any other highlight shows none. */
  let hl: HTMLElement | null = null;
  let hlKey = "";
  let hlTimer = 0;
  function refreshHighlight(): void {
    const it = current;
    if (!hl || !it) return;
    const t = it.noteTrade;
    if (!t || !highlightShown(it)) {
      hl.hidden = true;
      hlKey = "";
      return;
    }
    const key = `${t.atMs}|${t.side}|${t.usd}`;
    if (key === hlKey) return;
    hlKey = key;
    const line = hl;
    line.dataset.side = t.side;
    line.replaceChildren(el("span", "cfhltext", t.text));
    line.hidden = false;
    void lookupTradeLink(it).then((href) => {
      if (!href || hlKey !== key || hl !== line) return;
      const a = el("a", "cflink cfhllink", "View transaction");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      line.append(a);
    });
  }
  function startHighlight(): void {
    window.clearInterval(hlTimer);
    refreshHighlight();
    hlTimer = window.setInterval(refreshHighlight, 400);
  }

  /** Throw away a card built ahead of a tap that never came. */
  function drop(): void {
    if (current) return;
    ready = null;
    root.hidden = true;
    root.style.pointerEvents = "";
    tablet.replaceChildren();
    slot = null;
  }

  const place = (r: { left: number; top: number }, s: number): string => `translate(${r.left}px, ${r.top}px) scale(${s})`;

  function moveHero(to: string, dur: number, done: () => void): void {
    const h = hero!;
    h.style.transition = `transform ${dur}ms ${EASE}`;
    h.style.transform = to;
    window.clearTimeout(timer);
    timer = window.setTimeout(done, dur + 30);
  }

  function tabletFade(on: boolean, dur: number): void {
    tablet.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ${EASE}`;
    veil.style.transition = `opacity ${dur}ms ease`;
    tablet.style.opacity = on ? "1" : "0";
    tablet.style.transform = on ? "none" : "scale(0.96)";
    veil.style.opacity = on ? "1" : "0";
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape" && current && !closing) opts.onCloseRequest();
  }
  veil.addEventListener("click", () => {
    if (current && !closing) opts.onCloseRequest();
  });

  /** Put the lifted card into the tablet's slot, where it stays (scrolls with the tablet). */
  function seat(): void {
    if (!hero || !slot) return;
    hero.style.transition = "none";
    hero.style.position = "absolute";
    hero.style.transform = `scale(${factor})`;
    slot.append(hero);
  }

  return {
    get isOpen() {
      return current !== null;
    },
    get item() {
      return current;
    },
    prepare(item) {
      if (current || closing) return;
      if (ready?.item === item) return;
      const p = opts.partsOf(item);
      if (!p) return;
      fill(item);
      const h = buildHero(p);
      // Laid out but not painted (a near-transparent layer, no pointer events, so its first paint is done before the tap): the slot's place is measured here, so the tap itself forces no layout.
      root.style.pointerEvents = "none";
      root.hidden = false;
      tablet.style.opacity = "0.01";
      tablet.style.transform = "scale(0.96)";
      veil.style.opacity = "0.01";
      const f = Math.max(120, Math.min(340, tablet.clientWidth - 44)) / p.w;
      slot!.style.width = `${p.w * f}px`;
      slot!.style.height = `${p.h * f}px`;
      ready = { item, p, hero: h, factor: f, to: slot!.getBoundingClientRect() };
      window.clearTimeout(readyTimer);
      readyTimer = window.setTimeout(drop, 1500);
    },
    cancelPrepare() {
      window.clearTimeout(readyTimer);
      if (ready) drop();
    },
    open(item) {
      if (current) return;
      window.clearTimeout(readyTimer);
      const pre = canReuse(ready, item, opts.partsOf(item)?.el ?? null) ? ready : null;
      ready = null;
      if (!pre) drop();
      const p = pre ? pre.p : opts.partsOf(item);
      current = item;
      closing = false;
      parts = p;
      if (!pre) fill(item);
      startHighlight();
      root.style.pointerEvents = "";
      root.hidden = false;
      document.addEventListener("keydown", onKey);
      if (!p) {
        // The tile is not drawn: the tablet alone fades in.
        tablet.style.opacity = "0";
        void tablet.offsetWidth;
        tabletFade(true, 160);
        return;
      }
      hero = pre ? pre.hero : buildHero(p);
      tablet.style.opacity = "0";
      tablet.style.transform = "scale(0.96)";
      veil.style.opacity = "0";
      let to: DOMRect;
      if (pre) {
        factor = pre.factor;
        to = pre.to;
      } else {
        // The card's size on the tablet: as wide as the slot allows, up to 340 px.
        const slotW = Math.max(120, Math.min(340, tablet.clientWidth - 44));
        factor = slotW / p.w;
        slot!.style.width = `${p.w * factor}px`;
        slot!.style.height = `${p.h * factor}px`;
        void tablet.offsetWidth; // one forced layout, before the move starts, never during it
        to = slot!.getBoundingClientRect();
      }
      const from = opts.rectOf(item);
      hero.style.position = "fixed";
      hero.style.left = "0";
      hero.style.top = "0";
      root.append(hero);
      p.hide(true);
      const dur = still() || !from ? 160 : MS;
      hero.style.transition = "none";
      hero.style.transform = from && !still() ? place(from, from.width / p.w) : place(to, factor);
      hero.style.opacity = from && !still() ? "1" : "0";
      void hero.offsetWidth;
      hero.style.opacity = "1";
      hero.style.transition = `transform ${dur}ms ${EASE}, opacity ${dur}ms ease`;
      hero.style.transform = place(to, factor);
      tabletFade(true, dur);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (current === item && !closing) {
          seat();
          tablet.querySelector<HTMLElement>(".cfgo")?.focus({ preventScroll: true });
        }
      }, dur + 30);
    },
    close(animate = true) {
      const it = current;
      if (!it || closing) return;
      closing = true;
      window.clearInterval(hlTimer);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      const finish = (): void => {
        parts?.hide(false);
        root.hidden = true;
        hero?.remove();
        hero = null;
        slot = null;
        parts = null;
        tablet.replaceChildren();
        current = null;
        closing = false;
      };
      if (!animate || !hero || !parts) return finish();
      const from = opts.rectOf(it);
      const here = hero.parentElement === slot ? slot!.getBoundingClientRect() : null;
      if (here) {
        // The card leaves the tablet from where it sits.
        hero.style.transition = "none";
        hero.style.position = "fixed";
        hero.style.left = "0";
        hero.style.top = "0";
        hero.style.transform = place(here, factor);
        root.append(hero);
        void hero.offsetWidth;
      }
      const dur = still() || !from ? 160 : MS;
      tabletFade(false, dur);
      if (from && !still()) moveHero(place(from, from.width / parts.w), dur, finish);
      else {
        hero.style.transition = `opacity ${dur}ms ease`;
        hero.style.opacity = "0";
        timer = window.setTimeout(finish, dur + 30);
      }
    },
  };
}
