import { groupOf, type Group } from "../world/groups";
import type { Item } from "../world/model";

/**
 *
 *
 * doctor-not-judge rule: the pills say what was observed, never a verdict. Missing stays missing: a fact with nothing behind it shows a dash.
 */
export const STATEMENT = "PINR reads every free source for every token and keeps the paper trail. PINR shows the evidence; you decide.";
export const STATE_H = 46;
export const STATE_H_PHONE = 62;
const DAY_MS = 86_400_000;

export interface Facts {
  coins: number | null;
  chains: number | null;
  trading: number | null;
}
export function factsOf(items: readonly Item[], nowMs: number): Facts {
  if (items.length === 0) return { coins: null, chains: null, trading: null };
  const chains = new Set<string>();
  let trading = 0;
  let read = 0;
  for (const it of items) {
    if (it.coverage > 0) read++; // a coin PINR has read something about; launchpad coins not read yet are not counted as read
    if (it.chain) chains.add(it.chain);
    if (it.lastTradeMs !== undefined && nowMs - it.lastTradeMs < DAY_MS) trading++;
  }
  return { coins: read, chains: chains.size || null, trading };
}
export function groupCounts(items: readonly Item[]): Record<Group, number> {
  const n: Record<Group, number> = { read: 0, closer: 0, unchecked: 0 };
  for (const it of items) n[groupOf(it)]++;
  return n;
}

export interface PageStatement {
  el: HTMLElement;
  show(on: boolean): void;
  /** Fresh facts from the store (cheap: a few times a second at most). */
  update(items: readonly Item[], nowMs: number): void;
}

export function createPageStatement(): PageStatement {
  const el = document.createElement("div");
  el.id = "pstate";
  el.hidden = true;
  const line = document.createElement("div");
  line.className = "psline";
  line.textContent = STATEMENT;
  const facts = document.createElement("div");
  facts.className = "psfacts";
  const factEls = (["coins read", "chains", "trading now"] as const).map((label) => {
    const f = document.createElement("span");
    const b = document.createElement("b");
    b.textContent = "—";
    f.append(b, ` ${label}`);
    facts.append(f);
    return b;
  });
  el.append(line, facts);
  return {
    el,
    show(on) {
      el.hidden = !on;
    },
    update(items, nowMs) {
      const f = factsOf(items, nowMs);
      [f.coins, f.chains, f.trading].forEach((v, i) => (factEls[i]!.textContent = v === null ? "—" : String(v)));
    },
  };
}
