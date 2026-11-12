import type { Item } from "../world/model";
import { tagChips } from "../world/tags";
import { pictureOf } from "../world/cards";

/**
 *
 * happened (the newest launches, the most trades in the last five minutes, how many coins are new today, which launchpads the coins came from). Equal size, no
 * ranking by importance, no verdict: each card only says what was seen. A number that is not known is left out, never a zero.
 * `eventsOf` is the plain arithmetic over the page's full list (the caller leaves hidden and quiet coins out); `createPageEvents` draws it.
 */
export const EVENTS_H = 166;
export const EVENTS_H_PHONE = 186;

export interface EventRow {
  /** The coin's own picture, or null (the card draws its initial). */
  image: string | null;
  /** The coin's address, so a picture that fails can be asked of the Air the way the tiles do. */
  address?: string | null;
  label: string;
  /** What was seen about it, in plain words ("3 min ago", "1,932 trades"). */
  note: string;
  /** The coin's tags (copy, bot launch, serial launcher), shown on its row like everywhere it appears (release checklist line 18). */
  tags?: Item["tags"];
  created?: number;
}
export interface EventCard {
  id: "launched" | "trading" | "today" | "where";
  kicker: string;
  title: string;
  /** A single big number (the "today" card); null for a list card. */
  big: number | null;
  bigNote: string;
  rows: EventRow[];
}

export const ageWords = (min: number): string => (min < 1 ? "just now" : min < 60 ? `${Math.round(min)} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`);

export function eventsOf(items: readonly Item[]): EventCard[] {
  const known = items.filter((it) => Number.isFinite(it.ageMin) && it.ageMin >= 0);
  const newest = [...known].sort((a, b) => a.ageMin - b.ageMin).slice(0, 3);
  const busy = items.filter((it) => (it.trades5m ?? 0) > 0).sort((a, b) => (b.trades5m ?? 0) - (a.trades5m ?? 0)).slice(0, 3);
  const today = known.filter((it) => it.ageMin < 1440).length;
  const pads = new Map<string, number>();
  for (const it of items) if (it.launchpad) pads.set(it.launchpad, (pads.get(it.launchpad) ?? 0) + 1);
  const topPads = [...pads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return [
    { id: "launched", kicker: "Just launched", title: "The newest coins PINR has seen", big: null, bigNote: "", rows: newest.map((it) => ({ image: it.image, address: it.address, label: it.name, note: ageWords(it.ageMin), tags: it.tags, created: it.createdCount })) },
    { id: "trading", kicker: "Trading now", title: "Most trades in the last 5 minutes", big: null, bigNote: "", rows: busy.map((it) => ({ image: it.image, address: it.address, label: it.name, note: `${(it.trades5m ?? 0).toLocaleString("en-US")} trades`, tags: it.tags, created: it.createdCount })) },
    { id: "today", kicker: "Today", title: "New in the last 24 hours", big: known.length ? today : null, bigNote: "coins launched and now being read", rows: [] },
    { id: "where", kicker: "Where from", title: "Launchpads on the page", big: null, bigNote: "", rows: topPads.map(([name, n]) => ({ image: null, label: name, note: `${n} coins` })) },
  ];
}

export interface PageEvents {
  el: HTMLElement;
  /** Open, close or flip the quick view; a close also happens on a tap outside, the close mark and Escape. */
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  refresh(items: readonly Item[]): void;
  /** Called when the view opens or closes, so the button can show it is pressed. */
  onChange(fn: (open: boolean) => void): void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createPageEvents(): PageEvents {
  const el = node("div");
  el.id = "pevents";
  el.hidden = true;
  const back = node("div", "evback");
  const panel = node("section", "evpanel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "What is happening");
  const close = node("button", "evclose", "\u00d7");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  const grid = node("div", "evgrid");
  // The bottom fade says the panel scrolls (the phone's panel is shorter than its four cards); it hides once the end is in view.
  const fade = node("div", "evfade");
  panel.append(close, grid, fade);
  el.append(back, panel);
  const checkMore = (): void => {
    panel.classList.toggle("evmore", panel.scrollHeight - panel.clientHeight - panel.scrollTop > 6);
  };
  panel.addEventListener("scroll", checkMore, { passive: true });
  let last = "";
  const pictures = new Map<string, HTMLElement>();
  let open = false;
  let listener: ((o: boolean) => void) | null = null;
  const set = (on: boolean): void => {
    if (on === open) return;
    open = on;
    el.hidden = !on;
    if (on) requestAnimationFrame(checkMore);
    listener?.(on);
  };
  back.addEventListener("pointerdown", () => set(false));
  close.addEventListener("click", () => set(false));
  addEventListener("keydown", (e) => {
    if (open && e.key === "Escape") set(false);
  });
  return {
    el,
    open: () => set(true),
    close: () => set(false),
    toggle: () => set(!open),
    isOpen: () => open,
    onChange(fn) {
      listener = fn;
    },
    refresh(items) {
      const cards = eventsOf(items);
      const key = JSON.stringify(cards);
      if (key === last) return;
      last = key;
      if (pictures.size > 80) pictures.clear();
      grid.replaceChildren(
        ...cards.map((c, i) => {
          const card = node("section", "evc");
          card.style.setProperty("--tex", `${17 + i * 2}s`);
          card.append(node("div", "evtex"));
          const body = node("div", "evin");
          body.append(node("div", "evk", c.kicker), node("h3", "evt", c.title));
          if (c.big !== null) body.append(node("div", "evbig", String(c.big)), node("p", "evp", c.bigNote));
          for (const r of c.rows) {
            const row = node("div", "evr");
            if (r.image) {
              // The same picture loader as the tiles: a picture that fails is asked of the Air, tried once more, then the plain initial stays (no broken-picture icon).
              // The picture is drawn over the coin's initial and shown only once it has loaded, so a picture that is waiting for its retry never shows the browser's broken
              // icon; a redraw of the rows keeps the same picture element (and what it already loaded), so the wait never starts again.
              const pk = `${r.address ?? r.label}|${r.image}`;
              let holder = pictures.get(pk);
              if (!holder) {
                holder = node("span", "evi");
                holder.append(node("span", "evini", (r.label[0] ?? "?").toUpperCase()));
                const img = pictureOf(r.image, r.label, r.address);
                img.classList.add("evimg");
                img.style.opacity = "0";
                img.addEventListener("load", () => (img.style.opacity = ""));
                holder.append(img);
                pictures.set(pk, holder);
              }
              row.append(holder);
            } else if (c.id !== "where") row.append(node("span", "evi evini", (r.label[0] ?? "?").toUpperCase()));
            row.append(node("span", "evn", r.label));
            if (r.tags?.length) row.append(...tagChips(r.tags, r.created));
            row.append(node("span", "evw", r.note));
            body.append(row);
          }
          card.append(body);
          return card;
        }),
      );
      requestAnimationFrame(checkMore);
    },
  };
}
