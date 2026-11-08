import { padOf, type PadMark } from "./marks";
import type { Item } from "./model";
import type { OwnLaunchpad } from "../../server/launchlists";
import type { WireToken } from "../../server/translate";

/**
 *
 *
 * Pump.fun, Flap and Four.meme refuse every reader we can use for free (their list calls answer a Cloudflare challenge, and a visitor's browser is
 * refused too), so their lists here are PINR's own, built from the coins PINR lists. A plain sort (New, Market cap, Oldest, Last trade) carries the
 * launchpad's name; the launchpad's curated or ranked boards (Movers, Trending, Hot) are labelled "PINR's list" with the ordering said in words.
 * Zora, Clanker and BONKfun come with their own lists, read from the launchpad by the engine (`lists/1`, read by the feed server, not here yet).
 * Nothing is made up: a coin with no figure for a list's order goes last, and a list PINR cannot build is not offered.
 */
export type ListId = "movers" | "trending" | "hot" | "new" | "marketcap" | "oldest" | "lasttrade";

export interface ListSpec {
  id: ListId | string;
  /** The launchpad's own word for the list. */
  name: string;
  /** "sort": a plain sort of the coins PINR lists, named after the launchpad. "pinr": PINR's list, ordering said in words. "own": the launchpad's own list, in its own order. */
  kind: "sort" | "pinr" | "own";
  /** The ordering, in words, shown under the picker and on the page. */
  order: string;
}

export interface Launchpad {
  id: string;
  name: string;
  /** The launchpad mark the coins carry (marks.ts), which says whose coin it is; none for a launchpad whose own list is read (its coins are the list's). */
  pad: PadMark | null;
  lists: ListSpec[];
  /** True for a launchpad whose OWN lists the engine reads (Zora, Clanker, BONKfun): shown in the launchpad's own order. */
  own?: true;
}

const SORTS: ListSpec[] = [
  { id: "new", name: "New", kind: "sort", order: "newest first" },
  { id: "marketcap", name: "Market cap", kind: "sort", order: "biggest market cap first" },
  { id: "lasttrade", name: "Last trade", kind: "sort", order: "most recent trade first" },
];

export const LAUNCHPADS: Launchpad[] = [
  {
    id: "pumpfun",
    name: "Pump.fun",
    pad: "pump",
    lists: [
      { id: "movers", name: "Movers", kind: "pinr", order: "biggest 24h price move first, up or down" },
      ...SORTS,
      { id: "oldest", name: "Oldest", kind: "sort", order: "oldest first" },
    ],
  },
  {
    id: "flap",
    name: "Flap",
    pad: "flap",
    lists: [{ id: "trending", name: "Trending", kind: "pinr", order: "most trades in the last hour first" }, ...SORTS],
  },
  {
    id: "fourmeme",
    name: "Four.meme",
    pad: "fourmeme",
    lists: [{ id: "hot", name: "Hot", kind: "pinr", order: "most trades in the last hour first" }, ...SORTS],
  },
];

export const DEFAULT_LIST = "list:pumpfun:movers";

export type ListFilter = `list:${string}`;
export const isListFilter = (f: string): f is ListFilter => f.startsWith("list:");

/** The launchpads whose own lists the engine reads (`/api/lists`), set when they arrive. */
let ownPads: Launchpad[] = [];
const ownRanks = new Map<string, Map<string, number>>();
export const allLaunchpads = (): Launchpad[] => [...LAUNCHPADS, ...ownPads];
export const isOwnList = (f: string): boolean => parseList(f)?.lp.own === true;

export function parseList(f: string): { lp: Launchpad; list: ListSpec } | null {
  if (!isListFilter(f)) return null;
  const [, lpId, listId] = f.split(":");
  const lp = allLaunchpads().find((x) => x.id === lpId);
  const list = lp?.lists.find((x) => x.id === listId);
  return lp && list ? { lp, list } : null;
}

export const listKey = (lp: Launchpad, list: ListSpec): ListFilter => `list:${lp.id}:${list.id}`;

/** The launchpad's own lists as the server sends them: kept as the picker's launchpads, their order kept as ranks, and the coins as tokens the store can hold. */
export function setOwnLists(lps: readonly OwnLaunchpad[], nowMs: number = Date.now()): WireToken[] {
  ownPads = [];
  ownRanks.clear();
  const tokens = new Map<string, WireToken>();
  for (const lp of lps) {
    const lists: ListSpec[] = [];
    // The launchpad's own default list first.
    for (const l of [...lp.lists].sort((a, b) => Number(b.default) - Number(a.default))) {
      lists.push({ id: l.id, name: l.name, kind: "own", order: "the launchpad's own order" });
      ownRanks.set(`${lp.id}:${l.id}`, new Map(l.coins.map((c) => [c.id.toLowerCase(), c.rank])));
      for (const c of l.coins) {
        if (tokens.has(c.id.toLowerCase())) continue;
        tokens.set(c.id.toLowerCase(), {
          address: c.id,
          chain: c.chain ?? lp.chain ?? null,
          launchpad: lp.name,
          name: c.name,
          ticker: c.ticker,
          imageUrl: c.imageUrl ?? null,
          score: null,
          coverage: 0,
          noScoreLabel: null,
          note: "No health reading yet",
          valuationUsd: c.mcapUsd,
          volume24hUsd: null,
          change24hPct: null,
          priceSeries: null,
          launchedAtMs: c.createdMs,
          asOfMs: nowMs,
          rank: null,
          priceUsd: null,
          liquidityUsd: null,
          quotePair: null,
          changeWindowH: null,
          priceSource: null,
          flow: null,
          lastTradeMs: c.lastTradeMs,
        } as unknown as WireToken);
      }
    }
    ownPads.push({ id: lp.id, name: lp.name, pad: null, lists, own: true });
  }
  return [...tokens.values()];
}

/** What the page says it is showing: the launchpad's name for a plain sort, "PINR's list" for a ranked board, the launchpad's own list in its own order. */
export function listLabel(f: string): { title: string; order: string; pinr: boolean } | null {
  const p = parseList(f);
  if (!p) return null;
  if (p.list.kind === "own") return { title: `${p.lp.name} · ${p.list.name}`, order: p.list.order, pinr: false };
  return p.list.kind === "sort"
    ? { title: `${p.lp.name} · ${p.list.name}`, order: p.list.order, pinr: false }
    : { title: `${p.lp.name} · ${p.list.name} (PINR's list)`, order: p.list.order, pinr: true };
}

const num = (n: number | undefined): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

/** The number a list orders by (bigger first), or null when the coin has none: such a coin goes last, never first and never as a zero. */
function measure(id: string, it: Item, _nowMs: number): number | null {
  switch (id) {
    case "movers":
      return num(it.change24h) === null ? null : Math.abs(it.change24h);
    case "trending":
    case "hot":
      return num(it.trades1h);
    case "new":
      return num(it.ageMin) === null ? null : -it.ageMin;
    case "oldest":
      return num(it.ageMin);
    case "marketcap":
      return num(it.mcap);
    case "lasttrade":
      return it.lastTradeMs !== undefined && Number.isFinite(it.lastTradeMs) ? it.lastTradeMs : null;
    default:
      return null;
  }
}

/** The coins of one list, in order (a coin without the figure goes after those with it, in the feed's order). */
export function rankList(f: string, all: readonly Item[], limit: number, nowMs: number = Date.now()): Item[] {
  const p = parseList(f);
  if (!p) return [];
  if (p.lp.own) {
    // The launchpad's own list: its coins in its own order (a coin the page does not hold yet is not drawn).
    const ranks = ownRanks.get(`${p.lp.id}:${p.list.id}`) ?? new Map<string, number>();
    return all
      .filter((it) => it.address !== null && ranks.has(it.address.toLowerCase()))
      .sort((a, b) => ranks.get(a.address!.toLowerCase())! - ranks.get(b.address!.toLowerCase())!)
      .slice(0, limit);
  }
  const mine = all.filter((it) => padOf(it) === p.lp.pad);
  const rows = mine.map((it) => ({ it, m: measure(p.list.id, it, nowMs) }));
  rows.sort((a, b) => {
    if (a.m === null || b.m === null) return a.m === b.m ? a.it.id - b.it.id : a.m === null ? 1 : -1;
    return b.m - a.m || a.it.id - b.it.id;
  });
  return rows.slice(0, limit).map((r) => r.it);
}
