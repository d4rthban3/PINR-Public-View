import type { Evidence } from "../../server/evidence";

/** Waits between tries when the evidence could not be read (a failed call, or the feed restarting): about 20 s in all. */
export const EVIDENCE_RETRY_MS = [1500, 2500, 4000, 5000, 7000];

/**
 * What a visitor is told for a coin the feed does not track (walk item 3, 9 Nov): DeepScan and the evidence web say the same words.
 * PINR holds no record of it, so nothing is "loading" and nothing is asked again.
 */
export const UNTRACKED_WORDS = "PINR has not read this coin yet.";

/** Coins (lower-case address) the feed answered 404 "unknown token" for: DeepScan shows UNTRACKED_WORDS for them and stops asking. */
export const untrackedCoins = new Set<string>();
/** Notes the coin as untracked when this answer is the feed's 404 "unknown token" (reads the body only for a 404). */
export async function noteUntracked(address: string, r: Response): Promise<boolean> {
  if (r.status !== 404) return false;
  const body = (await r.clone().json().catch(() => null)) as { error?: unknown } | null;
  if (body?.error !== "unknown token") return false;
  untrackedCoins.add(address.toLowerCase());
  return true;
}

/** A coin's paper trail as read: its evidence, none on file, a coin the feed does not track, or a read that failed every try. */
export type EvidenceState = { state: "ok"; evidence: Evidence } | { state: "none" } | { state: "untracked" } | { state: "failed" };

/**
 *
 * tracked": the feed's 404 "unknown token" is final at once (walk item 3: retried for 20 s, the evidence web sat on "Reading..."); a failed
 * call (no answer, the feed restarting, any other error) is tried again, so the page keeps saying "loading" meanwhile.
 */
export async function fetchEvidenceState(
  address: string,
  get: (url: string) => Promise<Response>,
  waits: readonly number[] = EVIDENCE_RETRY_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<EvidenceState> {
  for (let i = 0; ; i++) {
    try {
      const r = await get(`/api/evidence?address=${encodeURIComponent(address)}`);
      if (r.ok) {
        const ev = ((await r.json()) as { evidence?: Evidence | null }).evidence ?? null;
        return ev ? { state: "ok", evidence: ev } : { state: "none" };
      }
      if (await noteUntracked(address, r)) return { state: "untracked" };
    } catch {
      /* a failed call: tried again below */
    }
    if (i >= waits.length) return { state: "failed" };
    await sleep(waits[i]!);
  }
}

/** The evidence, or null (none on file, not tracked, or every try failed): the shape the coin page and Orbit read. */
export async function fetchEvidenceRetrying(
  address: string,
  get: (url: string) => Promise<Response>,
  waits: readonly number[] = EVIDENCE_RETRY_MS,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Evidence | null> {
  const s = await fetchEvidenceState(address, get, waits, sleep);
  return s.state === "ok" ? s.evidence : null;
}
