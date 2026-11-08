import type { Item } from "../world/model";
import { txUrl } from "./tradeslist";

/**
 *
 * that one trade on the chain's explorer. A volume surge has no single trade, so it gets no line. The trade's id is found in the coin's own trade
 * list by its time, side and size, the same rows the DeepScan list links from; no id found means the line stays without a link (never a guessed one).
 */
export type TradeRow = [number, "buy" | "sell", number, string?];

/** The transaction id of the trade a large-trade highlight was drawn for, or null when the list holds no row that matches it. */
export function matchTrade(trades: readonly TradeRow[], t: Pick<NonNullable<Item["noteTrade"]>, "side" | "usd" | "atMs">): string | null {
  const sec = Math.floor(t.atMs / 1000);
  let best: string | null = null;
  let bestGap = Infinity;
  for (const r of trades) {
    if (!r[3] || r[1] !== t.side || r[0] !== sec) continue;
    const gap = Math.abs(r[2] - t.usd);
    // The tape computed the size from this very row; a rounding difference is allowed, another trade in the same second is not.
    if (gap > Math.max(0.01, t.usd * 0.005) || gap >= bestGap) continue;
    best = r[3];
    bestGap = gap;
  }
  return best;
}

export const GLOW_MS = 1100;
export const AFTER_GLOW_MS = 6000;
export function highlightShown(it: Item, now: number = Date.now()): boolean {
  const t = it.noteTrade;
  return t !== undefined && now - t.litAt < GLOW_MS + AFTER_GLOW_MS;
}

/** The link for the trade the card's highlight is about, or null while it cannot be found. Looked up once per highlight. */
const found = new Map<string, Promise<string | null>>();
export function lookupTradeLink(it: Item, get: (url: string) => Promise<unknown> = defaultGet): Promise<string | null> {
  const t = it.noteTrade;
  if (!t || !it.address) return Promise.resolve(null);
  const key = `${it.address}|${t.atMs}|${t.side}|${t.usd}`;
  const have = found.get(key);
  if (have) return have;
  const run = async (): Promise<string | null> => {
    // The tape may be a moment behind the stream that lit the tile: one more try a second and a half later.
    for (let i = 0; i < 2; i++) {
      try {
        const body = (await get(`/api/trades?address=${encodeURIComponent(it.address!)}`)) as { trades?: TradeRow[] } | null;
        const tx = matchTrade(body?.trades ?? [], t);
        const url = tx ? txUrl(it.chain, tx) : null;
        if (url) return url;
      } catch {
        // no list: no link
      }
      if (i === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  };
  const p = run();
  found.set(key, p);
  if (found.size > 20) found.delete(found.keys().next().value!);
  return p;
}

async function defaultGet(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store" });
  return r.ok ? r.json() : null;
}
