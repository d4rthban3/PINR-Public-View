import type { Launchpad } from "../world/lists";

/**
 *
 * launchpad's own mark (public/art/lp-*, sources in lp-SOURCES.md), the same size, in one fixed order: no pill is ahead of another by rule.
 * A tap picks the launchpad exactly as the picker in the funnel panel does (the header passes the same function), and that launchpad opens on its
 * own first list. A row wider than the screen scrolls sideways; the page never does.
 */
export const LP_ORDER = ["pumpfun", "flap", "fourmeme", "zora", "clanker", "bonkfun"] as const;
const LOGO: Record<string, string> = {
  pumpfun: "/art/lp-pumpfun.png",
  flap: "/art/lp-flap.svg",
  fourmeme: "/art/lp-fourmeme.png",
  zora: "/art/lp-zora.png",
  clanker: "/art/lp-clanker.png",
  bonkfun: "/art/lp-bonkfun.png",
};
/** Where the row ends, measured down from the header bar's bottom edge: 4 px of air, then 4 px of padding and the 32 px pill (the main.ts inset adds the tiles' own row gap after it). */
export const LP_ROW_BOTTOM = 40;

export interface LpPills {
  el: HTMLElement;
  render(pads: readonly Launchpad[], picked: string, list?: { title: string; order: string; pinr: boolean } | null): void;
  show(on: boolean): void;
  setTail(b: HTMLElement): void;
}

export function createLpPills(onPick: (lp: Launchpad) => void): LpPills {
  const el = document.createElement("div");
  el.id = "lprow";
  const scroller = document.createElement("div");
  scroller.id = "lpbar";
  scroller.setAttribute("role", "radiogroup");
  scroller.setAttribute("aria-label", "Launchpad");
  el.append(scroller);
  return {
    el,
    show(on) {
      el.hidden = !on;
    },
    setTail(b) {
      b.classList.add("lptail");
      el.append(b);
    },
    render(pads, picked, list) {
      const ordered = LP_ORDER.map((id) => pads.find((p) => p.id === id)).filter((p): p is Launchpad => !!p);
      //
      const same = scroller.children.length === ordered.length && ordered.every((lp, i) => (scroller.children[i] as HTMLElement).dataset.lp === lp.id);
      if (!same) {
        scroller.replaceChildren(
          ...ordered.map((lp) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "lppill";
            b.setAttribute("role", "radio");
            b.dataset.lp = lp.id;
            const img = document.createElement("img");
            img.src = LOGO[lp.id] ?? "";
            img.alt = "";
            img.draggable = false;
            b.append(img);
            b.addEventListener("click", () => onPick(lp));
            return b;
          }),
        );
      }
      ordered.forEach((lp, i) => {
        const b = scroller.children[i] as HTMLButtonElement;
        // The chosen pill says which list is in view; where that list is PINR's own order it says so (nothing is written under the row).
        const on = lp.id === picked;
        b.classList.toggle("on", on);
        b.setAttribute("aria-checked", String(on));
        const label = on ? `${lp.name}, selected${list ? `: ${list.title}${list.pinr ? ", PINR's list" : ""}` : ""}` : lp.name;
        if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
        const title = on && list ? `${list.title}${list.pinr ? ` (PINR's list, ordered ${list.order})` : ` (${list.order})`}` : lp.name;
        if (b.title !== title) b.title = title;
      });
    },
  };
}
