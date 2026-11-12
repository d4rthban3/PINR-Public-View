import type { Venue } from "../../server/venues";

/**
 *
 * holds there. "on record" means PINR holds a record at that place; "not read yet" means PINR read nothing there (a link, when shown, is only a way to look).
 * The callout tiles below name places PINR does not read yet, so every one says so: no count, no "zero shills", no outlook.
 */
const GROUPS: { kind: Venue["kind"]; title: string }[] = [
  { kind: "terminal", title: "Live terminals" },
  { kind: "scanner", title: "Chain scanners" },
  { kind: "launchpad", title: "Launchpad" },
  { kind: "social", title: "Social" },
];
/** Places where callouts and chatter happen. PINR reads none of them yet, so each tile says it. */
export const CALLOUT_TILES: readonly string[] = [
  "pump.fun callouts",
  "GMGN callouts",
  "FOMO",
  "DexTools",
  "CoinMarketCap and CoinGecko community",
  "Birdeye",
  "Telegram rooms",
  "Livestreams",
  "Paid callouts",
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const ICONS: [RegExp, string][] = [
  [/^solscan\b/i, "solscan"],
  [/^zora\b/i, "zora"],
  [/^dexscreener\b/i, "dexscreener"],
  [/^geckoterminal\b/i, "geckoterminal"],
  [/^x$/i, "x"],
  [/^basescan\b/i, "basescan"],
  [/^bscscan\b/i, "bscscan"],
  [/^pump\.fun\b/i, "pumpfun"],
  [/^four\.meme\b/i, "fourmeme"],
  [/^goplus\b/i, "gopluslabs"],
];

/** A venue's mark: the site's own icon when its file is kept, else the first letter on a small tile. */
export function siteMark(label: string): HTMLElement {
  const hit = ICONS.find(([re]) => re.test(label.trim()));
  if (!hit) return el("i", "rdmark", label.trim().charAt(0).toUpperCase());
  const m = el("i", "rdmark rdicon");
  const img = el("img");
  img.src = `/art/logo-${hit[1]}.png`;
  img.alt = "";
  img.width = 16;
  img.height = 16;
  img.decoding = "async";
  m.append(img);
  return m;
}

export function createRadar(): { el: HTMLElement; render(venues: readonly Venue[] | undefined): void } {
  const sec = el("section", "dssec dsradar");
  sec.append(el("h2", "dsh", "Venues and callouts"));
  const body = el("div", "rdbody");
  sec.append(body);
  return {
    el: sec,
    render(venues) {
      const parts: HTMLElement[] = [];
      for (const g of GROUPS) {
        const list = (venues ?? []).filter((v) => v.kind === g.kind);
        if (!list.length) continue;
        const box = el("div", "rdgroup");
        box.append(el("h3", "rdh", g.title));
        const chips = el("div", "rdchips");
        for (const v of list) {
          const chip = v.url ? el("a", "rdchip") : el("span", "rdchip");
          if (v.url && chip instanceof HTMLAnchorElement) {
            chip.href = v.url;
            chip.target = "_blank";
            chip.rel = "noopener noreferrer nofollow";
          }
          chip.append(siteMark(v.label), el("span", "rdlabel", v.label), el("b", `rdstate ${v.state}`, v.state === "onrecord" ? "on record" : "not read yet"));
          chips.append(chip);
        }
        box.append(chips);
        parts.push(box);
      }
      if (!parts.length) parts.push(el("p", "dsnone", venues ? "No venues listed for this coin." : "Not read yet."));
      const calls = el("div", "rdgroup");
      calls.append(el("h3", "rdh", "Callouts and chatter"));
      const grid = el("div", "rdtiles");
      for (const name of CALLOUT_TILES) {
        const t = el("div", "rdtile");
        t.append(el("b", undefined, name), el("span", undefined, "Not read yet."));
        grid.append(t);
      }
      calls.append(grid);
      parts.push(calls);
      body.replaceChildren(...parts);
    },
  };
}
