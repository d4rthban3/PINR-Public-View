import { scoreOf } from "./filters";
import type { Item } from "./model";
import type { GroupId } from "../ui/grouppills";

/**
 *
 *   read      : a Token health reading and most of the readings loaded (66% or more), and nothing unusual observed
 *   closer    : something was observed (the engine's own findings on the coin)
 *   unchecked : the rest: nothing read yet, or too little read to say
 * The rules are the ones the sandbox mockup used (item 115). A coin is in exactly one group, and `look` comes before `read`.
 */
export type Group = GroupId;
export const READ_COVERAGE = 66;

/** The words a coin carries when nothing has been read yet: a status, not something observed about the coin. */
const UNREAD_NOTE = /^(no health reading yet|not scored yet)$/i;

export function groupOf(it: Pick<Item, "status" | "flagKind" | "coverage" | "value" | "findings">): Group {
  if ((it.findings ?? []).some((f) => !UNREAD_NOTE.test(f.trim()))) return "closer";
  if (scoreOf(it) !== null && it.coverage >= READ_COVERAGE) return "read";
  return "unchecked";
}
