/**
 *
 * cleared, a surge, a verification, a note); the page only pins each one on the price line with its own words and its time. Nothing is
 * invented: a coin with no events file has no markers.
 */
export type ChartEventKind = "score_up" | "score_down" | "flag_raised" | "flag_cleared" | "surge" | "verified" | "note";
export type ChartEventTone = "good" | "bad" | "neutral";

export interface ChartEvent {
  /** seconds since 1970 */
  t: number;
  kind: ChartEventKind;
  tone: ChartEventTone;
  /** the engine's short plain sentence */
  text: string;
  /** score before and after, for score events */
  from?: number;
  to?: number;
}

/** What happened, in the kind's plain name, when the engine's sentence is empty. */
const KIND_WORDS: Record<ChartEventKind, string> = {
  score_up: "Token health moved up",
  score_down: "Token health moved down",
  flag_raised: "Flag raised",
  flag_cleared: "Flag cleared",
  surge: "Surge",
  verified: "Verified",
  note: "Note",
};

export interface EventMarker {
  /** the chart point it sits on (the last point at or before the event) */
  time: number;
  tone: ChartEventTone;
  /** what happened and when: "Score moved up 25 → 41 · Nov 3, 2:15 PM" */
  text: string;
}

export const MAX_MARKERS = 8;

/** Read `/api/events` leniently: a row without a time, kind or tone is dropped, never guessed at. */
export function readChartEvents(raw: unknown): ChartEvent[] {
  const list = (raw as { events?: unknown } | null)?.events;
  if (!Array.isArray(list)) return [];
  const out: ChartEvent[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r.t !== "number" || !Number.isFinite(r.t) || r.t <= 0) continue;
    if (typeof r.kind !== "string" || !(r.kind in KIND_WORDS)) continue;
    if (r.tone !== "good" && r.tone !== "bad" && r.tone !== "neutral") continue;
    const e: ChartEvent = { t: r.t, kind: r.kind as ChartEventKind, tone: r.tone, text: typeof r.text === "string" ? r.text.trim() : "" };
    if (typeof r.from === "number" && Number.isFinite(r.from)) e.from = r.from;
    if (typeof r.to === "number" && Number.isFinite(r.to)) e.to = r.to;
    out.push(e);
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * The markers for the points the chart shows (`times`, ascending seconds): each event inside the shown span sits on the last point at or
 * before it, labelled with its own words, its scores when it moved one, and `when(t)`. Events before the first point or after the last
 * point's bucket are off this chart and left out.
 */
export function eventMarkers(events: readonly ChartEvent[], times: readonly number[], bucketSec: number, when: (t: number) => string): EventMarker[] {
  if (!events.length || !times.length) return [];
  const first = times[0]!;
  const end = times[times.length - 1]! + Math.max(1, bucketSec);
  const out: EventMarker[] = [];
  let k = 0;
  for (const e of events) {
    if (e.t < first || e.t >= end) continue;
    while (k + 1 < times.length && times[k + 1]! <= e.t) k++;
    //
    const words = e.kind === "score_up" || e.kind === "score_down" ? KIND_WORDS[e.kind] : e.text || KIND_WORDS[e.kind];
    const scores = e.from !== undefined && e.to !== undefined ? ` ${e.from} → ${e.to}` : "";
    out.push({ time: times[k]!, tone: e.tone, text: `${words}${scores} · ${when(e.t)}` });
  }
  return out.slice(-MAX_MARKERS);
}
