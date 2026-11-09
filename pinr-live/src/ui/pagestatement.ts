import { groupOf, type Group } from "../world/groups";
import type { Item } from "../world/model";

export function groupCounts(items: readonly Item[]): Record<Group, number> {
  const n: Record<Group, number> = { read: 0, closer: 0, partly: 0, unchecked: 0 };
  for (const it of items) n[groupOf(it)]++;
  return n;
}
