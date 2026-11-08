import type { Evidence } from "../../server/evidence";

/** Waits between tries when the evidence could not be read (a failed call, or the feed restarting): about 20 s in all. */
export const EVIDENCE_RETRY_MS = [1500, 2500, 4000, 5000, 7000];

/**
 *
 * feed that it has none is null at once; a failed call is tried again, so the page keeps saying "loading" instead of "not checked yet". Only when
 * every try failed is it null.
 */
export async function fetchEvidenceRetrying(
  address: string,
  get: (url: string) => Promise<Response>,
  waits: readonly number[] = EVIDENCE_RETRY_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Evidence | null> {
  for (let i = 0; ; i++) {
    try {
      const r = await get(`/api/evidence?address=${encodeURIComponent(address)}`);
      if (r.ok) return ((await r.json()) as { evidence?: Evidence | null }).evidence ?? null;
    } catch {
      /* a failed call: tried again below */
    }
    if (i >= waits.length) return null;
    await sleep(waits[i]!);
  }
}
