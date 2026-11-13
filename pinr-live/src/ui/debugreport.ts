/**
 *
 * It only counts what the page itself did: script errors, requests that failed, pictures that fell back to a letter, how the stream
 * and the frame rate are doing. Nothing is sent anywhere, and nothing here reads a key, a score's workings or a response body.
 */
export interface DebugEvent {
  at: number;
  kind: "error" | "promise" | "request" | "picture";
  what: string;
}

const KEEP = 60;

/** A request address cut down to its path (same site) or host (any other); a query string can carry a typed address, so it is never kept. */
export function shortUrl(raw: string, base: string): string {
  try {
    const u = new URL(raw, base);
    const b = new URL(base);
    return u.origin === b.origin ? u.pathname : u.host;
  } catch {
    return "(unreadable address)";
  }
}

export class DebugLog {
  events: DebugEvent[] = [];
  counts = { error: 0, promise: 0, request: 0, picture: 0 };
  requests = 0;
  private frames: number[] = [];
  private longFrames = 0;
  private last = 0;
  private slowest = 0;
  private start = 0;

  constructor(private now: () => number = () => Date.now()) {
    this.start = this.now();
  }

  add(kind: DebugEvent["kind"], what: string): void {
    this.counts[kind]++;
    this.events.push({ at: this.now(), kind, what: what.slice(0, 200) });
    if (this.events.length > KEEP) this.events.splice(0, this.events.length - KEEP);
  }

  /** One drawn frame; `t` is a high-resolution time in ms. */
  frame(t: number): void {
    if (this.last) {
      const d = t - this.last;
      if (d > 50) this.longFrames++;
      if (d > this.slowest) this.slowest = d;
      this.frames.push(t);
      while (this.frames.length && t - this.frames[0]! > 2000) this.frames.shift();
    }
    this.last = t;
  }

  /** Frames a second over the last two seconds, or null before enough frames are in. */
  fps(): number | null {
    if (this.frames.length < 3) return null;
    const span = this.frames[this.frames.length - 1]! - this.frames[0]!;
    return span > 0 ? Math.round(((this.frames.length - 1) * 10000) / span) / 10 : null;
  }

  report(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      page: "PINR debug report",
      at: new Date(this.now()).toISOString(),
      openForS: Math.round((this.now() - this.start) / 1000),
      counts: { ...this.counts, requestsSeen: this.requests },
      frames: { perSecond: this.fps(), over50ms: this.longFrames, slowestMs: Math.round(this.slowest) },
      ...extra,
      recent: this.events.slice(-30),
    };
  }
}
