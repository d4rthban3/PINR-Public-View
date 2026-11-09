import { isListFilter } from "./lists";
import type { GroupId } from "../ui/grouppills";

/**
 *
 * `groups` (the whole list's coins in each group) and `groupsMayhem` (how many of those are MAYHEM coins; left out unless Show Mayhem is on). Missing stays missing:
 * a count that has not arrived is `null` (the pill shows no number), never a zero standing in while it loads.
 */
export type GroupTotals = Record<GroupId, number | null>;
export const GROUP_IDS: readonly GroupId[] = ["read", "closer", "partly", "unchecked"];

/** The endpoint's address for the list in view (`list:pumpfun:movers` is asked as `pumpfun:movers`; limit 1: only the totals are wanted), or null when the filter is not one list. */
export function totalsUrl(filter: string): string | null {
  if (!isListFilter(filter)) return null;
  return `/api/tokens/list?list=${encodeURIComponent(filter.slice(5))}&offset=0&limit=1`;
}

/** What the endpoint said, kept as it came so a change of the Show Mayhem setting needs no new request. */
export interface RawGroups {
  all: Partial<Record<GroupId, number>>;
  mayhem: Partial<Record<GroupId, number>>;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Reads the endpoint's answer; null when it has no `groups` (an older server, or an error answer). */
export function readGroups(body: unknown): RawGroups | null {
  const b = body as { groups?: Record<string, unknown>; groupsMayhem?: Record<string, unknown> } | null;
  if (!b || typeof b !== "object" || !b.groups || typeof b.groups !== "object") return null;
  const pick = (o: Record<string, unknown> | undefined): Partial<Record<GroupId, number>> => {
    const out: Partial<Record<GroupId, number>> = {};
    for (const g of GROUP_IDS) {
      const n = num(o?.[g]);
      if (n !== null) out[g] = n;
    }
    return out;
  };
  return { all: pick(b.groups), mayhem: pick(b.groupsMayhem) };
}

/** The four counts to show: the whole list's, less the MAYHEM coins unless Show Mayhem is on. A group the server did not give stays null; with the setting off and no MAYHEM figure for a group, that group stays null too (the total alone would count MAYHEM coins). */
export function totalsToShow(raw: RawGroups | null, showMayhem: boolean): GroupTotals {
  const out: GroupTotals = { read: null, closer: null, partly: null, unchecked: null };
  if (!raw) return out;
  for (const g of GROUP_IDS) {
    const all = raw.all[g];
    if (all === undefined) continue;
    if (showMayhem) out[g] = all;
    else if (raw.mayhem[g] !== undefined) out[g] = Math.max(0, all - raw.mayhem[g]!);
  }
  return out;
}
