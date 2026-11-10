/**
 *
 *
 * `long` is for a wide screen (one line), `short` for a phone.
 */
export const RIBBON_LEGEND = {
  long: "Each dash is one real trade: lime a buy, orange a sell; big buys sit above the line, big sells below.",
  short: "Each dash is one real trade: lime a buy, orange a sell.",
};

/** A legend element: both wordings, the CSS shows the one that fits the width. */
export function ribbonLegendEl(cls: string): HTMLElement {
  const e = document.createElement("div");
  e.className = cls;
  const l = document.createElement("span");
  l.className = "rl-long";
  l.textContent = RIBBON_LEGEND.long;
  const s = document.createElement("span");
  s.className = "rl-short";
  s.textContent = RIBBON_LEGEND.short;
  e.append(l, s);
  return e;
}
