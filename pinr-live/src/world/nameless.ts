import { shortAddress } from "./livefeed";
import type { Item } from "./model";

/**
 *
 * (livefeed.ts already puts it there) and the words "name not read" stand where the ticker goes. Missing stays missing: nothing is guessed, and a coin
 * with only its ticker missing keeps the dash it always had.
 */
export const NAME_NOT_READ = "name not read";

export function isNameless(it: Pick<Item, "name" | "ticker" | "address">): boolean {
  return it.ticker === "—" && !!it.address && it.name === shortAddress(it.address);
}

/** The ticker line a tile, card, Discover row or fullscreen card draws. */
export function tickerText(it: Pick<Item, "name" | "ticker" | "address">): string {
  return isNameless(it) ? NAME_NOT_READ : it.ticker;
}
