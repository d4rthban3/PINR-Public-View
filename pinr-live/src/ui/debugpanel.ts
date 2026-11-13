import { DebugLog, shortUrl } from "./debugreport";

/**
 * The hidden ?debug panel: a small corner box listing what went wrong on the page (errors, failed requests, pictures that fell back to
 * a letter), the stream's state and the frame rate, with one Copy report button. It exists only when "debug" is in the address.
 * Everything stays in this browser tab; `window.__pinrDebug()` returns the same report as plain data for a crawler.
 */
export interface DebugSources {
  link: () => { state: string; tokens: number; heardMs: number | null; mode: unknown };
  tradeLag: () => unknown;
  tiles: () => number;
}

export function mountDebug(src: DebugSources): () => Record<string, unknown> {
  const log = new DebugLog();
  const base = location.href;

  window.addEventListener("error", (e) => {
    // a picture or script that failed to load fires "error" on its element and does not reach here as a script error
    if (e.target && e.target !== window) return;
    log.add("error", `${e.message || "error"} (${shortUrl(e.filename || "", base)}:${e.lineno ?? 0})`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    log.add("promise", String((e.reason && (e.reason as Error).message) || e.reason || "rejected").slice(0, 160));
  });
  // a picture that fails to load (the page then asks again or shows the letter)
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLImageElement) {
        const raw = t.currentSrc || t.src;
        const coin = /\/api\/img/.test(raw) ? new URL(raw, base).searchParams.get("a") : null; // a coin's public address, so the broken one can be found
        log.add("picture", `picture did not load: ${shortUrl(raw, base)}${coin ? ` coin ${coin.slice(0, 12)}…` : ""}`);
      }
    },
    true,
  );
  // requests: only status and path are kept, never a body, a header or a query
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    log.requests++;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
      const r = await realFetch(input, init);
      if (!r.ok && r.status !== 304) log.add("request", `${r.status} ${shortUrl(url, base)}`);
      return r;
    } catch (err) {
      if ((err as Error).name !== "AbortError") log.add("request", `failed ${shortUrl(url, base)}`);
      throw err;
    }
  };

  const report = (): Record<string, unknown> => {
    const l = src.link();
    const letters = document.querySelectorAll(".pletter").length;
    return log.report({
      stream: {
        state: l.state,
        tokens: l.tokens,
        heardSecondsAgo: l.heardMs == null ? null : Math.round((Date.now() - l.heardMs) / 1000),
        mode: l.mode,
        tradeToScreenMs: src.tradeLag(),
      },
      tiles: src.tiles(),
      lettersShowingNow: letters,
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 },
    });
  };
  (window as unknown as { __pinrDebug?: () => unknown }).__pinrDebug = report;

  const box = document.createElement("div");
  box.id = "pinr-debug";
  box.setAttribute("role", "status");
  box.innerHTML =
    '<div class="dbg-h"><b>debug</b><button type="button" class="dbg-c">Copy report</button><button type="button" class="dbg-x" aria-label="Hide">–</button></div><div class="dbg-b"></div>';
  document.body.append(box);
  const body = box.querySelector<HTMLElement>(".dbg-b")!;
  const draw = (): void => {
    const r = report() as { counts: Record<string, number>; frames: { perSecond: number | null; over50ms: number }; stream: { state: string; heardSecondsAgo: number | null }; lettersShowingNow: number; tiles: number };
    const c = r.counts;
    body.textContent = "";
    const row = (k: string, v: string, bad = false): void => {
      const d = document.createElement("div");
      d.className = bad ? "dbg-r dbg-bad" : "dbg-r";
      const a = document.createElement("span");
      a.textContent = k;
      const b = document.createElement("span");
      b.textContent = v;
      d.append(a, b);
      body.append(d);
    };
    row("stream", `${r.stream.state}${r.stream.heardSecondsAgo != null ? `, heard ${r.stream.heardSecondsAgo}s ago` : ""}`, r.stream.state !== "live");
    row("frames/s", r.frames.perSecond == null ? "–" : String(r.frames.perSecond), r.frames.perSecond != null && r.frames.perSecond < 30);
    row("slow frames", String(r.frames.over50ms));
    row("tiles", String(r.tiles));
    row("errors", String(c.error! + c.promise!), c.error! + c.promise! > 0);
    row("failed requests", `${c.request} of ${c.requestsSeen}`, c.request! > 0);
    row("pictures failed", String(c.picture), c.picture! > 0);
    row("letters showing", String(r.lettersShowingNow));
    const recent = log.events.slice(-4).reverse();
    for (const e of recent) {
      const d = document.createElement("div");
      d.className = "dbg-e";
      d.textContent = `${e.kind}: ${e.what}`;
      body.append(d);
    }
  };
  box.querySelector(".dbg-c")!.addEventListener("click", (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const text = JSON.stringify(report(), null, 2);
    const done = (): void => {
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy report"), 1500);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  });
  box.querySelector(".dbg-x")!.addEventListener("click", () => box.classList.toggle("dbg-min"));

  const tick = (t: number): void => {
    log.frame(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(draw, 1000);
  draw();
  return report;
}

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-999px;top:0";
  document.body.append(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch {
    /* the report is still readable through window.__pinrDebug() */
  }
  ta.remove();
}
