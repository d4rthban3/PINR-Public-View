import { liveImportance, NEW_LAUNCH_MIN, quantImp, type Item } from "./model";
import { isListFilter, rankList, type ListFilter } from "./lists";

/**
 * The three header filters. A filter chooses WHICH tiles show and RANKS them, best first; the grid fills
 * in that order (top-left first, reading across then down). The base view is Trending; "all" (tap the chosen filter again) ranks by long-term weight.
 * A filter is a snapshot taken when it is chosen: tiles never reshuffle by themselves afterwards.
 */
export type Filter = "all" | "trending" | "movers" | "new" | "pinrscore" | ListFilter;

export const FILTERS: { id: Exclude<Filter, "all">; label: string; hint: string }[] = [
  { id: "trending", label: "Trending", hint: "Most active right now" },
  { id: "movers", label: "Movers", hint: "Biggest moves" },
  { id: "new", label: "New Launches", hint: "Under an hour old" },
  { id: "pinrscore", label: "Token health", hint: "Tokens PINR has read, by token health" },
];

/**
 * Every filter can be ordered three ways: its own order (default), ascending or descending on the number it ranks by.
 * Default is each filter's natural order (best first; newest first for New Launches). The choice is kept per filter on the device.
 */
export type SortDir = "default" | "asc" | "desc";
export const SORTS: { id: SortDir; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "asc", label: "Ascending" },
  { id: "desc", label: "Descending" },
];
const SORT_KEY = "pinr.sort";
let sorts: Partial<Record<Filter, SortDir>> = {};
try {
  const raw = JSON.parse(localStorage.getItem(SORT_KEY) ?? "null") as Record<string, unknown> | null;
  if (raw && typeof raw === "object") {
    for (const k of ["all", "trending", "movers", "new", "pinrscore"] as Filter[]) {
      const v = raw[k];
      if (v === "asc" || v === "desc") sorts[k] = v;
    }
  }
} catch {
  /* no storage: every filter uses its default order */
}
export const getSort = (f: Filter): SortDir => sorts[f] ?? "default";
export function setSort(f: Filter, d: SortDir): void {
  sorts = { ...sorts, [f]: d };
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(sorts));
  } catch {
    /* the choice lasts until the page closes */
  }
}

/** The PINRscore as a number, or null when the token has none (unscored, flagged, error): missing stays missing, never zero. */
export function scoreOf(it: Pick<Item, "status" | "flagKind" | "coverage" | "value">): number | null {
  if (it.status === "flag" || it.flagKind || it.coverage <= 0) return null;
  const n = Number(it.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Order by a number; tokens with no number go last whichever way it runs. `natural` is the filter's own direction. */
export function sortBy<T>(list: readonly T[], measure: (t: T) => number | null, dir: SortDir, natural: "asc" | "desc", tie: (a: T, b: T) => number): T[] {
  const d = dir === "default" ? natural : dir;
  // The number is worked out once per token, not once per comparison (the list can hold thousands).
  const rows = list.map((t) => ({ t, m: measure(t) }));
  rows.sort((a, b) => {
    const x = a.m;
    const y = b.m;
    if (x === null || y === null) return x === y ? tie(a.t, b.t) : x === null ? 1 : -1;
    return (d === "desc" ? y - x : x - y) || tie(a.t, b.t);
  });
  return rows.map((r) => r.t);
}

/**
 * How many tiles the PINR page shows. Every filter shows the TOP of its own ranking, taken from everything the app knows (the
 * scored roster plus the launchpad coins): Trending the top N trending, Movers the top N movers, and so on. The base is 90 to keep the
 * site light; the user can raise it to 200. The choice is saved on the device.
 */
export const ROSTER_DEFAULT = 90;
export const ROSTER_MIN = 30;
export const ROSTER_MAX = 200;
const ROSTER_KEY = "pinr.roster";
export const clampRoster = (n: number): number => (Number.isFinite(n) ? Math.min(ROSTER_MAX, Math.max(ROSTER_MIN, Math.round(n))) : ROSTER_DEFAULT);
let roster = ROSTER_DEFAULT;
try {
  const saved = Number(localStorage.getItem(ROSTER_KEY));
  if (saved) roster = clampRoster(saved);
} catch {
  /* no storage: the base size is used */
}
export const getRoster = (): number => roster;
export function setRoster(n: number): void {
  roster = clampRoster(n);
  try {
    localStorage.setItem(ROSTER_KEY, String(roster));
  } catch {
    /* the size lasts until the page closes */
  }
}

export interface Ranked {
  id: number;
  /** Layout importance 0..1 (best = 1), in clean steps. */
  imp: number;
}

/** Turn a best-first list of ids into ranked entries: rank 0 -> 1.0, last -> 0.25. */
function byRank(ids: number[]): Ranked[] {
  const n = ids.length;
  return ids.map((id, i) => ({ id, imp: quantImp(n <= 1 ? 1 : 1 - 0.75 * (i / (n - 1))) }));
}

/**
 * What the user can take out of the PINR page and Discover. A copy (VAMP) gets a tile that says VAMP, so by default everything shows;
 * these switches remove the rubbish: copies (VAMPs and possible copies), bots and rugs (proven BOT/RUG or HONEYPOT), and serial launchers.
 */
export interface Hides {
  vamp: boolean;
  bots: boolean;
  serial: boolean;
}
const HIDE_KEY = "pinr.hide";
let hides: Hides = { vamp: false, bots: false, serial: false };
try {
  const raw = JSON.parse(localStorage.getItem(HIDE_KEY) ?? "null") as Partial<Hides> | null;
  if (raw && typeof raw === "object") hides = { vamp: raw.vamp === true, bots: raw.bots === true, serial: raw.serial === true };
} catch {
  /* no storage: nothing is hidden */
}
export const getHides = (): Hides => hides;
export function setHides(h: Hides): void {
  hides = { ...h };
  try {
    localStorage.setItem(HIDE_KEY, JSON.stringify(hides));
  } catch {
    /* the choice lasts until the page closes */
  }
}
/**
 *
 * battle". On the PINR page a coin with the Copy tag shows only while it leads its Arena battle (the Arena's own order), unless this person
 * switched "Show copies" on (off by default, kept in this browser). Discover and search are not changed.
 */
const SHOW_COPIES_KEY = "pinr.showCopies";
let showCopies = false;
try {
  showCopies = localStorage.getItem(SHOW_COPIES_KEY) === "1";
} catch {
  /* no storage: off */
}
export const getShowCopies = (): boolean => showCopies;
export function setShowCopies(on: boolean): void {
  showCopies = on;
  try {
    localStorage.setItem(SHOW_COPIES_KEY, on ? "1" : "0");
  } catch {
    /* the choice lasts until the page closes */
  }
}
let copyWinners: ReadonlySet<string> = new Set();
/** The coins leading their Arena battles now (lower-case addresses). Returns true when the set changed, so the PINR page can be laid out again. */
export function setCopyWinners(winners: Iterable<string>): boolean {
  const next = new Set([...winners].map((a) => a.toLowerCase()));
  if (next.size === copyWinners.size && [...next].every((a) => copyWinners.has(a))) return false;
  copyWinners = next;
  return true;
}
/**
 *
 * its battles). An answer with under half the battles of the last good one is not taken (the page keeps its last leaders); a real shrink is
 * believed after a few reads, as the remembered count steps down by one each read. Returns whether to take it and the count to remember.
 */
export function arenaAnswerTaken(lastBattles: number, battles: number): { taken: boolean; next: number } {
  if (lastBattles > 4 && battles < lastBattles / 2) return { taken: false, next: Math.max(battles, lastBattles - 1) };
  return { taken: true, next: battles };
}

/** Where a list is drawn: the PINR page (the copy rule applies) or Discover (it does not). */
export type ListScope = "pinr" | "discover";

/** True when the user's switches take this token out. */
export function isHidden(it: Item, h: Hides = hides, scope: ListScope = "pinr"): boolean {
  if (it.quiet === true) return true;
  if (scope === "pinr" && !showCopies && it.tags?.includes("vamp") && !copyWinners.has((it.address ?? "").toLowerCase())) return true;
  if (h.vamp && (it.flagKind === "VAMP" || it.possibleCopy !== undefined)) return true;
  if (h.bots && (it.flagKind === "BOT/RUG" || it.flagKind === "HONEYPOT")) return true;
  if (h.serial && it.serial === true) return true;
  return false;
}

/** Seconds for the "something just traded" boost to halve. */
const RECENT_HALF_S = 90;

/** What is happening now: the token's weight and recent heat, plus a boost when the launchpad saw a trade in it moments ago. */
function trendScore(it: Item, nowMs: number): number {
  let sum = 0;
  for (const v of it.hist) sum += v;
  const mean = it.hist.length ? sum / it.hist.length : it.base;
  const age = it.lastTradeMs !== undefined && Number.isFinite(it.lastTradeMs) ? Math.max(0, (nowMs - it.lastTradeMs) / 1000) : Infinity;
  const recent = Number.isFinite(age) ? 0.6 * Math.pow(0.5, age / RECENT_HALF_S) : 0;
  // How busy it is right now (trades in the last five minutes, on a log scale so a thousand is not a hundred times a tenth of that).
  const busy = it.trades5m !== undefined && it.trades5m > 0 ? Math.min(1, Math.log10(1 + it.trades5m) / 2.5) : 0;
  // What a trader looks for is what is moving NOW: busy and just-traded count most; size and long-run weight only break ties.
  return 0.2 * liveImportance(it) + 0.2 * mean + recent + 0.9 * busy;
}

/**
 *
 * one. It stays on Discover's lists, in search and on its own page. Nothing is hidden for good and nothing about the coin changes.
 */
export function hasSomethingToShow(it: Pick<Item, "image" | "chart">): boolean {
  return it.image !== null || it.chart.length >= 2;
}

/** How long a coin counts as just seen or just scored on the tile page (the same 24 hours as the feed server's first page). */
export const RECENT_MS = 24 * 3600_000;

export function selectAndRank(filter: Filter, all: readonly Item[], limit: number = roster, nowMs: number = Date.now(), dir: SortDir = getSort(filter), scope: ListScope = "pinr"): Ranked[] {
  const items = all.filter((it) => !isHidden(it, hides, scope));
  const byId = (a: Item, b: Item): number => a.id - b.id;
  //
  if (isListFilter(filter)) return byRank(rankList(filter, items, limit, nowMs).map((it) => it.id));
  if (filter === "all") {
    // Everything by long-term weight (heaviest first by default), up to the roster size.
    return sortBy(items, (it) => it.base, dir, "desc", byId).slice(0, limit).map((it) => ({ id: it.id, imp: quantImp(it.base) }));
  }
  if (filter === "new") {
    const fresh = items.filter((it) => it.ageMin < NEW_LAUNCH_MIN);
    return byRank(sortBy(fresh, (it) => it.ageMin, dir, "asc", byId).slice(0, limit).map((it) => it.id));
  }
  if (filter === "pinrscore") {
    // Only tokens with a real score: unscored, flagged and errored ones have no number to rank by, so they are not here.
    const scored = items.filter((it) => scoreOf(it) !== null);
    return byRank(sortBy(scored, scoreOf, dir, "desc", byId).slice(0, limit).map((it) => it.id));
  }
  const measure = filter === "trending" ? (it: Item) => trendScore(it, nowMs) : (it: Item) => Math.abs(it.moved);
  return byRank(sortBy(items, measure, dir, "desc", byId).slice(0, limit).map((it) => it.id));
}
