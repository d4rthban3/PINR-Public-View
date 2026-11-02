/**
 *
 * With either missing the value is a dash and the page says "not read yet". A figure that has no source concept (the age, the chain, the contract) passes as it is.
 */
export type FigureSource = [source: string | null, readAtMs: number | null] | undefined;

export function figureOrNotRead(value: string, receipt: FigureSource): { value: string; notRead: boolean } {
  if (receipt === undefined) return { value, notRead: false };
  if (value === "—") return { value, notRead: true };
  const [source, at] = receipt;
  return !source || at === null ? { value: "—", notRead: true } : { value, notRead: false };
}

/**
 *
 * Observed words for a coin whose pool file is missing: on its curve, or not checked yet.
 */
export const ON_CURVE_WORDS = "On its bonding curve; no pool yet.";
export function noPoolWords(launchpad: string | null | undefined): string {
  const lp = launchpad ?? "";
  return /curve/i.test(lp) || (/launchlab/i.test(lp) && !/graduat/i.test(lp)) ? ON_CURVE_WORDS : "Not checked yet.";
}
