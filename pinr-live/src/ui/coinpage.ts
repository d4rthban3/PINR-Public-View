import type { NOT_TRACKED } from "./orbit";
import type { ChartResult } from "../../server/market";
import { foldPrice, type Candle } from "../world/livecandle";
import { changeWindowLabel, COIN_RANGES, formatPrice, type RangeId } from "../world/format";
import { ageText, money, signedPct } from "../world/discoverlist";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import { apartTop, eventMarkers, type ChartEvent } from "../world/chartevents";
import type { Evidence } from "../../server/evidence";
import { createBadge } from "./badge";
import { EYE_OFF_ICON } from "./hidemenu";
import { createOrbit } from "./orbit";
import { avatarChar, statusLook, type Item } from "../world/model";
import { scoreShown } from "../world/hub";
import { pictureOf } from "../world/cards";
import { attachPageGestures, createPlacer, type GestureOptions, type Placement } from "./pageoverlay";
import { tagChips } from "../world/tags";
import { pinchScene } from "./pinch";

/**
 *
 * price, the change over the range with its period in words, a full-width line coloured by direction with a dotted line at the start of the range,
 * a scrub (finger or cursor) that turns the big price and the change into that moment's, range tabs, links out for a full chart, key stats, then
 * DeepScan's report. PINR has no trading chart of its own.
 *
 *
 * and kept current by the stream's trades. Nothing is invented: a figure that is missing is a dash, and no chart says so.
 */
export interface CoinPageOptions extends GestureOptions {
  /** The eye-slash in the coin's bar: hide this coin (kept in this browser only). */
  onHide(item: Item): void;
  /** `launchpad` lets a Pump.fun or PumpSwap coin ask Pump.fun's own candle history first (via the Air; its CORS refuses a browser). */
  fetchChart(address: string, range: RangeId, launchpad?: string | null): Promise<ChartResult>;
  /** TradingView's symbol for a coin it lists (EXCHANGE:NAME), else null: the TradingView link then opens that chart. */
  fetchTvSymbol(address: string): Promise<string | null>;
  /** NOT_TRACKED (orbit.ts) when the feed does not track the coin (walk item 3). */
  fetchEvidence(address: string): Promise<Evidence | null | typeof NOT_TRACKED>;
  fetchEvents(address: string): Promise<ChartEvent[]>;
}

export interface CoinPage {
  el: HTMLElement;
  setItem(it: Item | null | undefined): void;
  place(p: Placement | null, live: boolean): void;
  update(nowSec: number): void;
  /** A live price for a coin from the stream: folded into the shown coin's newest candle, no reload. */
  livePrice(address: string, price: number, atMs: number, usd?: number): void;
  /** Where DeepScan's report goes: the second half of this page, below the key stats. */
  dossierHost: HTMLElement;
  /** Scroll the page to its top or to the report. */
  scrollTo(part: "chart" | "dossier", smooth?: boolean): void;
  scrollPos(): number;
  setScrollPos(y: number): void;
}

export const HEALTH_DOWNLOAD = false;
export const DEFAULT_RANGE: RangeId = "1D";

function setT(e: HTMLElement, t: string): void {
  if (e.textContent !== t) e.textContent = t;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The coin's own links (X, Telegram, website) as named links beside the outside chart sites. */
export function socialLinks(l: Item["links"]): { label: string; href: string }[] {
  return [l?.x ? { label: "X", href: l.x } : null, l?.telegram ? { label: "Telegram", href: l.telegram } : null, l?.website ? { label: "Website", href: l.website } : null].filter((x): x is { label: string; href: string } => x !== null);
}

export const TRADINGVIEW_CHART = "https://www.tradingview.com/chart/";
/** TradingView's chart for a listed symbol (EXCHANGE:NAME); anything else keeps the plain chart page. */
export function tradingViewHref(symbol: string | null | undefined): string {
  return symbol && /^[A-Z0-9_]{2,40}:[A-Z0-9_.\-]{2,60}$/.test(symbol) ? `${TRADINGVIEW_CHART}?symbol=${encodeURIComponent(symbol)}` : TRADINGVIEW_CHART;
}

/**
 *
 * only when tapped, so a visitor who never taps loads nothing from TradingView. The widget is TradingView's own (its logo and branding stay); it draws TradingView's
 * data for the listed symbol, never PINR's. The script address and the settings are TradingView's embed format; the site's security policy must allow them (server/staticsite.ts).
 */
/** ON since Site's security policy allows TradingView's widget (script-src https://s3.tradingview.com and frame-src https://www.tradingview-widget.com in server/staticsite.ts): switch it off together with those two entries, never alone. */
export const TV_WIDGET_ON = true;
export const TV_WIDGET_SCRIPT = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
export function tvWidgetConfig(symbol: string, theme: "dark" | "light"): Record<string, unknown> | null {
  if (!/^[A-Z0-9_]{2,40}:[A-Z0-9_.\-]{2,60}$/.test(symbol)) return null;
  return { symbol, theme, interval: "15", timezone: "Etc/UTC", locale: "en", autosize: true, allow_symbol_change: false, hide_side_toolbar: true, calendar: false, support_host: "https://www.tradingview.com" };
}

/** The outside chart sites for a coin's full chart. Only what applies to the coin's chain; the Pump.fun page only for a Pump.fun coin. */
export function chartLinks(it: Pick<Item, "address" | "chain" | "launchpad">): { label: string; href: string }[] {
  const a = it.address;
  if (!a) return [];
  const slug = ({ solana: "solana", base: "base", bsc: "bsc", bnb: "bsc", ethereum: "ethereum" } as Record<string, string>)[(it.chain ?? "").toLowerCase()];
  if (!slug) return [];
  const e = encodeURIComponent(a);
  const out = [
    { label: "DexScreener", href: `https://dexscreener.com/${slug}/${e}` },
    { label: "GeckoTerminal", href: `https://www.geckoterminal.com/${slug}/tokens/${e}` },
  ];
  const lp = it.launchpad ?? "";
  if (slug === "solana" && /pump/i.test(lp)) out.push({ label: "Pump.fun", href: `https://pump.fun/coin/${e}` });
  //
  const explorer = ({ solana: ["Solscan", "https://solscan.io/token/"], base: ["Basescan", "https://basescan.org/token/"], bsc: ["BscScan", "https://bscscan.com/token/"], ethereum: ["Etherscan", "https://etherscan.io/token/"] } as Record<string, [string, string]>)[slug];
  if (slug === "base" && /clanker/i.test(lp)) out.push({ label: "Clanker", href: `https://www.clanker.world/clanker/${e}` });
  if (slug === "base" && /zora/i.test(lp)) out.push({ label: "Zora", href: `https://zora.co/coin/base:${e}` });
  // Virtuals' own page is keyed by the address the coin trades as (CHAINS checked: it forwards to its /virtuals/<id> page, on the curve or graduated).
  if (slug === "base" && /virtuals/i.test(lp)) out.push({ label: "Virtuals", href: `https://app.virtuals.io/prototypes/${e}` });
  if (slug === "bsc" && /four\.?meme/i.test(lp)) out.push({ label: "Four.meme", href: `https://four.meme/token/${e}` });
  if (slug === "bsc" && /flap/i.test(lp)) out.push({ label: "Flap", href: `https://flap.sh/bnb/${e}` });
  // Item 168: the chain scanner goes last, never ahead of the launchpad's own page.
  if (explorer) out.push({ label: explorer[0], href: `${explorer[1]}${e}` });
  //
  return out;
}

/** The time of a candle for the scrub: "Oct 22, 2:15 PM" for a size under a day, "Oct 22, 2026" for a day. */
/** An axis label for one scale: "3:45 PM" in clock mode, "Oct 22" in date mode (UTC seconds in, the viewer's own time zone out). */
export function tickLabel(tSec: number, mode: "sec" | "time" | "date"): string {
  const d = new Date(tSec * 1000);
  if (mode === "sec") return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false });
  return mode === "time" ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The 1-second line: one point for every second from the first trade's second to `nowSec`, a second with no trade holding the last close flat (never a made-up price). */
export function heldPerSecond(cs: readonly Candle[], nowSec: number): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  if (!cs.length) return out;
  let k = 0;
  let last = cs[0]![1];
  //
  out.push({ time: (cs[0]![0] - 1) as UTCTimestamp, value: last });
  for (let t = cs[0]![0]; t <= Math.max(nowSec, cs[cs.length - 1]![0]); t++) {
    while (k < cs.length && cs[k]![0] <= t) last = cs[k++]![4];
    out.push({ time: t as UTCTimestamp, value: last });
  }
  return out;
}

/**
 *
 * runs through each candle's close. So a young coin's first jump shows, and the line starts where the header's change is measured from.
 */
export function lineFromOpen(cs: readonly Candle[], bucketSec: number): { time: UTCTimestamp; value: number }[] {
  if (!cs.length) return [];
  const step = Math.max(1, Math.round(bucketSec));
  return [{ time: (cs[0]![0] - step) as UTCTimestamp, value: cs[0]![1] }, ...cs.map((c) => ({ time: c[0] as UTCTimestamp, value: c[4] }))];
}

/** The 1-second candles with a bare second number where no trade happened, so the chart leaves that slot empty. */
export function withGaps(cs: readonly Candle[]): (Candle | number)[] {
  const out: (Candle | number)[] = [];
  let prev = 0;
  for (const c of cs) {
    if (prev) for (let t = prev + 1; t < c[0]; t++) out.push(t);
    out.push(c);
    prev = c[0];
  }
  return out;
}

export function candleTime(tSec: number, bucketSec: number): string {
  const d = new Date(tSec * 1000);
  if (bucketSec >= 86_400) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (bucketSec < 60) return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** The change from where the range starts (the first candle's open) to a price: in price, in percent, and its direction. Null with no start to measure from. */
export function changeFrom(start: number, price: number): { delta: number; pct: number; up: boolean } | null {
  if (!(start > 0) || !Number.isFinite(price)) return null;
  return { delta: price - start, pct: ((price - start) / start) * 100, up: price >= start };
}

const RANGE_SEC: Record<RangeId, number> = { "1S": 300, "1MIN": 4 * 3600, "1D": 86_400, "1W": 7 * 86_400, "1M": 30 * 86_400, "3M": 90 * 86_400, ALL: Infinity };

/** A length of time in the plainest words: "45 min", "31 h", "3 days". */
export function spanText(sec: number): string {
  const s = Math.max(0, sec);
  if (s < 5_400) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 72 * 3_600) return `${Math.round(s / 3_600)} h`;
  return `${Math.round(s / 86_400)} days`;
}

/**
 *
 * last price, so the label must match that span: the range's own words ("Past day", "Since launch (49 min)") only when the candles start where
 * the range starts (or at the coin's launch) and run up to now. A sparse answer (a few tape candles from days ago) says the span it covers and
 * how long ago it ended, never "Past day".
 */
export function periodText(a: { range: RangeId; ageMin: number; firstSec: number; lastSec: number; bucketSec: number; nowSec: number }): string {
  const end = a.lastSec + a.bucketSec;
  const fresh = a.nowSec - end <= Math.max(2 * a.bucketSec, 900);
  const rangeSec = RANGE_SEC[a.range];
  const launchedAgo = Number.isFinite(a.ageMin) && a.ageMin >= 0 ? a.ageMin * 60 : NaN;
  const slack = Math.max(3 * a.bucketSec, 1_800);
  // A coin younger than the range (or the whole history): its first candle should be at its launch. An older one: its first candle should sit AT the
  //
  const firstAgo = a.nowSec - a.firstSec;
  const startsRight = launchedAgo < rangeSec ? Math.abs(firstAgo - launchedAgo) <= slack : firstAgo >= 0.95 * rangeSec && firstAgo <= 1.05 * rangeSec + slack;
  if (fresh && startsRight) return changeWindowLabel(a.range, a.ageMin);
  const span = spanText(end - a.firstSec);
  return fresh ? `Over ${span}` : `Over ${span}, ending ${spanText(a.nowSec - end)} ago`;
}

/** "▲ $0.0123 (3.6%)" or "▼ $0.0123 (3.6%)": the arrow, the price change and the percent, without a plus sign. */
export function changeText(c: { delta: number; pct: number; up: boolean }, fmt: (v: number) => string = formatPrice): string {
  return `${c.up ? "▲" : "▼"} ${fmt(Math.abs(c.delta))} (${signedPct(Math.abs(c.pct)).replace("+", "")})`;
}

export function changePctOnly(t: string): string {
  const m = /^([▲▼]) .*\(([^()]+)\)$/.exec(t.trim());
  return m ? `${m[1]} ${m[2]}` : t;
}

/**
 *
 * coin's own market cap over its own price (the same quote pair). With either missing the factor is NaN: the chart shows price and says so.
 */
export function capFactor(mcap: number, priceUsd: number): number {
  return Number.isFinite(mcap) && mcap > 0 && Number.isFinite(priceUsd) && priceUsd > 0 ? mcap / priceUsd : NaN;
}

/** The key stats under the chart: label and value, a dash for anything not known (missing stays missing). */
export function keyStats(it: Item): { label: string; value: string }[] {
  const dash = (v: string): string => (v && v !== "—" ? v : "—");
  return [
    { label: "Market cap", value: money(it.mcap) },
    { label: "Volume (24h)", value: money(it.volume24h) },
    { label: "Liquidity", value: money(it.liquidity) },
    { label: "All-time high", value: Number.isFinite(it.ath) && it.ath > 0 ? money(it.ath) : "—" },
    { label: "Launched", value: Number.isFinite(it.ageMin) ? `${ageText(it.ageMin)} ago` : "—" },
    { label: "Launchpad", value: dash(it.launchpad ?? "") },
    { label: "Chain", value: dash(it.chain ? it.chain.charAt(0).toUpperCase() + it.chain.slice(1) : "") },
    { label: "Change (24h)", value: Number.isFinite(it.change24h) ? signedPct(it.change24h) : "—" },
    { label: "Pair", value: dash(it.quotePair ?? "") },
  ];
}

export function createCoinPage(opts: CoinPageOptions): CoinPage {
  const root = el("div", "coinpage");
  root.id = "coinpage";
  const frame = el("div", "dframe");
  const body = el("div", "dscroll cproot");
  frame.append(body);
  root.append(frame);

  // ---- the compact bar that appears when the big price scrolls away ----
  const mini = el("div", "cpmini");
  const miniName = el("b", "cpmininame");
  const miniPrice = el("b", "cpminiprice");
  const miniChange = el("span", "cpminichange");
  //
  const miniPct = el("span", "cpminipct");
  mini.append(miniName, miniPrice, miniChange, miniPct);

  // ---- the head: ticker, name, big price, change and its period ----
  const head = el("div", "cphead");
  const idRow = el("div", "cpidrow");
  const avwrap = el("div", "avwrap");
  const avatar = el("div", "avatar");
  const badge = createBadge();
  avwrap.append(avatar, badge.el);
  const tickerEl = el("span", "cpticker");
  const hideBtn = el("button", "cphide");
  hideBtn.type = "button";
  hideBtn.setAttribute("aria-label", "Hide this coin");
  hideBtn.title = "Hide this coin";
  hideBtn.innerHTML = EYE_OFF_ICON;
  hideBtn.addEventListener("click", () => {
    if (item) opts.onHide(item);
  });
  idRow.append(avwrap, tickerEl, hideBtn);
  const nameEl = el("h1", "cpname");
  const priceEl = el("div", "cpprice");
  const changeRow = el("div", "cpchangerow");
  const changeEl = el("b", "cpchange");
  const periodEl = el("span", "cpperiod");
  changeRow.append(changeEl, periodEl);
  const tagsEl = el("div", "cptags");
  //
  //
  const ringWrap = el("div", "cpring");
  const ringSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ringSvg.setAttribute("viewBox", "0 0 120 120");
  ringSvg.setAttribute("aria-hidden", "true");
  const ringTrack = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const ringArc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  for (const c of [ringTrack, ringArc]) {
    c.setAttribute("cx", "60");
    c.setAttribute("cy", "60");
    c.setAttribute("r", "52");
    c.setAttribute("fill", "none");
    c.setAttribute("stroke-width", "9");
  }
  ringTrack.style.stroke = "rgba(var(--fg-rgb), 0.09)";
  ringArc.setAttribute("stroke-linecap", "round");
  ringArc.setAttribute("transform", "rotate(-90 60 60)");
  ringSvg.append(ringTrack, ringArc);
  const ringNum = el("div", "cpringnum");
  const ringWord = el("div", "cpringword", "Token health");
  ringWrap.append(ringSvg, ringNum, ringWord);
  ringWrap.hidden = true;
  const headTop = el("div", "cpheadtop");
  const headId = el("div", "cpheadid");
  headId.append(idRow, nameEl, tagsEl);
  headTop.append(ringWrap, headId);
  head.append(headTop, priceEl, changeRow);

  //
  const chartBox = el("div", "cpchart");
  const plot = el("div", "cpplot");
  const status = el("div", "cpstatus");
  //
  const evLayer = el("div", "cpevlayer");
  evLayer.setAttribute("aria-hidden", "true");
  chartBox.append(plot, evLayer, status);

  // ---- range tabs, the source, links out ----
  const tabs = el("div", "cptabs");
  const tabBtns = new Map<RangeId, HTMLButtonElement>();
  for (const r of COIN_RANGES) {
    const b = el("button", "cptab", r === "1MIN" ? "1m" : r);
    b.setAttribute("aria-label", r === "1S" ? "1 second chart" : r === "1MIN" ? "1 minute chart" : r);
    b.type = "button";
    b.addEventListener("click", () => selectRange(r));
    tabBtns.set(r, b);
    tabs.append(b);
  }
  //
  let view: "line" | "candles" = "line";
  try {
    if (localStorage.getItem("pinr.chartview") === "candles") view = "candles";
  } catch {
    /* storage can be blocked: the default stands */
  }
  const modeBtn = el("button", "cptab cpmode", "Candles");
  modeBtn.type = "button";
  modeBtn.setAttribute("aria-pressed", "false");
  modeBtn.addEventListener("click", () => {
    view = view === "line" ? "candles" : "line";
    try {
      localStorage.setItem("pinr.chartview", view);
    } catch {
      /* not remembered */
    }
    fitted = "";
    paint();
  });
  tabs.append(modeBtn);
  //
  let unit: "mcap" | "price" = "mcap";
  const unitBtn = el("button", "cptab cpmode cpunit", "Price");
  unitBtn.type = "button";
  unitBtn.addEventListener("click", () => {
    unit = unit === "mcap" ? "price" : "mcap";
    fitted = "";
    paint();
  });
  tabs.append(unitBtn);
  /** The factor the chart's prices are multiplied by: the coin's supply when market cap is shown, else 1. */
  const scale = (): number => {
    const k = item ? capFactor(item.mcap, item.priceUsd) : NaN;
    return unit === "mcap" && Number.isFinite(k) ? k : 1;
  };
  const capShown = (): boolean => unit === "mcap" && item !== null && Number.isFinite(capFactor(item.mcap, item.priceUsd));
  const fmtV = (v: number): string => (capShown() ? money(v) : formatPrice(v));
  const caption = el("div", "cpcap");
  const quietNote = el("div", "cpquiet", "No trades in the last 24 hours.");
  quietNote.hidden = true;
  const links = el("div", "cplinks");

  // ---- key stats ----
  const statsSec = el("section", "cpstatsec");
  const statsGrid = el("div", "cpstats");
  statsSec.append(el("h2", "cpstath", "Stats"), statsGrid);

  const main = el("div", "cpmain");
  main.append(head, chartBox, tabs, caption, quietNote, links, statsSec);
  const empty = el("div", "dsempty cpempty");
  empty.append(pinchScene("waving-hello", 88), el("div", "dsemptyt", "DeepScan"), el("div", "dsemptys", "Choose a coin to see its page."));
  const top = el("div", "cptop");
  top.append(main, empty);
  //
  const orbit = createOrbit({ fetchEvidence: opts.fetchEvidence });
  const healthHead = el("h2", "cphealth", "Health file");
  // Checklist 12: the health file to keep, as the server serves it (a file download, same site, nothing secret).
  const healthGet = el("a", "cphealthget", "Download");
  healthGet.setAttribute("download", "");
  healthGet.setAttribute("aria-label", "Download this coin's health file");
  //
  if (HEALTH_DOWNLOAD) healthHead.append(healthGet);
  const dossierHost = el("div", "cpdossier");
  const toTop = el("button", "cpgo cpgoup", "↑ Chart");
  toTop.type = "button";
  toTop.addEventListener("click", () => body.scrollTo({ top: 0, behavior: "smooth" }));
  body.append(mini, top, toTop, orbit.el, healthHead, dossierHost);
  attachPageGestures(root, body, opts);
  const placer = createPlacer(root, frame, body, () => {});
  //
  let pageShown = false;
  let chartDirty = false;
  const place: CoinPage["place"] = (p, live) => {
    const shown = p !== null;
    if (shown !== pageShown) {
      pageShown = shown;
      tv?.line.applyOptions({ lastPriceAnimation: shown ? 1 : 0 });
      if (shown && chartDirty) {
        chartDirty = false;
        paint();
      }
    }
    placer(p, live);
  };
  body.addEventListener("scroll", () => mini.classList.toggle("on", body.scrollTop > head.offsetHeight - 24), { passive: true });

  // ------------------------------------------------------------------ state ---
  let item: Item | null = null;
  let range: RangeId = DEFAULT_RANGE;
  let candles: Candle[] = [];
  let events: ChartEvent[] = [];
  let bucket = 900;
  let state: ChartResult["status"] | "loading" = "loading";
  let source = "";
  /** the 1-second chart only: the coin has trades on file, but none in its window */
  let quiet = false;
  let fetchedAt = 0;
  let epoch = 0;
  let lastUpdate = 0;
  let lastSecPaint = 0;
  /** the index of the candle under the finger or cursor, or -1 */
  let scrub = -1;
  /** the range and coin the chart was last fitted to (a live update keeps the view where it is) */
  let fitted = "";

  function paintHead(): void {
    if (!item) return;
    const it = item;
    setT(nameEl, it.name);
    const look = scoreShown() ? statusLook(it) : null;
    if (look && look.numeric) {
      const sc = Number(it.value);
      ringWrap.hidden = false;
      setT(ringNum, String(it.value));
      ringNum.style.color = "var(--old-orange)";
      ringArc.style.stroke = "var(--old-orange)";
      ringArc.setAttribute("stroke-dasharray", `${(2 * Math.PI * 52 * sc) / 100} ${2 * Math.PI * 52}`);
    } else ringWrap.hidden = true;
    const tagKey = `${(it.tags ?? []).join(",")}|${it.createdCount ?? ""}`;
    if (tagsEl.dataset.k !== tagKey) {
      tagsEl.dataset.k = tagKey;
      tagsEl.replaceChildren(...tagChips(it.tags ?? [], it.createdCount));
    }
    setT(tickerEl, `${it.ticker !== "—" ? it.ticker : ""}${it.launchpad ? `${it.ticker !== "—" ? " · " : ""}${it.launchpad}` : ""}`);
    const ok = candles.length >= (range === "1S" ? 1 : 2);
    const at = scrub >= 0 && scrub < candles.length ? candles[scrub]! : null;
    const S = scale();
    const price = (at ? at[4] : candles.length ? candles[candles.length - 1]![4] : Number.isFinite(it.priceUsd) ? it.priceUsd : NaN) * S;
    setT(priceEl, fmtV(price));
    let up = true;
    if (ok) {
      const c = changeFrom(candles[0]![1] * S, price);
      if (c) {
        up = c.up;
        setT(changeEl, changeText(c, fmtV));
      } else setT(changeEl, "");
      setT(
        periodEl,
        at ? candleTime(at[0], bucket) : periodText({ range, ageMin: it.ageMin, firstSec: candles[0]![0], lastSec: candles[candles.length - 1]![0], bucketSec: bucket, nowSec: Date.now() / 1000 }),
      );
    } else {
      // No chart to measure from: the feed's own 24-hour change, or nothing.
      const pct = it.change24h;
      up = !(Number.isFinite(pct) && pct < 0);
      setT(changeEl, Number.isFinite(pct) ? `${pct >= 0 ? "▲" : "▼"} ${signedPct(Math.abs(pct)).replace("+", "")}` : "");
      setT(periodEl, Number.isFinite(pct) ? "Past day" : "");
    }
    for (const e of [root]) e.classList.toggle("down", !up);
    setT(miniName, it.ticker !== "—" ? it.ticker : it.name);
    setT(miniPrice, priceEl.textContent ?? "");
    setT(miniChange, changeEl.textContent ?? "");
    setT(miniPct, changePctOnly(changeEl.textContent ?? ""));
  }

  let statsKey = "";
  function paintStats(): void {
    if (!item) return;
    // Rebuilt only when a figure changed (it was replaced on every pass).
    const rows = keyStats(item);
    const k = rows.map((r) => `${r.label}\u0001${r.value}`).join("\u0002");
    if (k === statsKey) return;
    statsKey = k;
    statsGrid.replaceChildren(
      ...rows.map((s) => {
        const c = el("div", "cpstat");
        c.append(el("span", "cpstatl", s.label), el("b", "cpstatv", s.value));
        return c;
      }),
    );
  }

  /** The chart library loads on the first coin page (it is not part of the first screen). */
  let tv: {
    chart: IChartApi;
    candle: ISeriesApi<"Candlestick">;
    volume: ISeriesApi<"Histogram">;
    line: ISeriesApi<"Area">;
    startLine: IPriceLine | null;
    lineMarks: ISeriesMarkersPluginApi<Time>;
    candleMarks: ISeriesMarkersPluginApi<Time>;
  } | null = null;
  let marksKey = "";
  const EVENT_VIOLET = "rgb(108, 77, 251)";
  /** The labels now shown: each marker's time, the price it sits at, its tone and words. */
  let shownMarks: { time: number; value: number; tone: string; text: string; on: "line" | "candles" }[] = [];
  let placeFrame = 0;
  /** Puts each label beside its dot once the chart has drawn (coordinates come from the chart), inside the chart's box. */
  function placeLabels(): void {
    if (placeFrame) return;
    placeFrame = requestAnimationFrame(() => {
      placeFrame = 0;
      if (!tv) return;
      const W = evLayer.clientWidth;
      const H = evLayer.clientHeight;
      const labels = evLayer.children;
      // Release walk 12 Nov: labels that would land on one another are moved apart (up for a "bad" one, down otherwise), so no two overlap.
      const placed: { l: number; t: number; r: number; b: number }[] = [];
      shownMarks.forEach((m, i) => {
        const lab = labels[i] as HTMLElement | undefined;
        if (!lab) return;
        const x = tv!.chart.timeScale().timeToCoordinate(m.time as UTCTimestamp);
        const y = (m.on === "line" ? tv!.line : tv!.candle).priceToCoordinate(m.value);
        if (x === null || y === null) {
          lab.hidden = true;
          return;
        }
        lab.hidden = false;
        const w = lab.offsetWidth;
        const h = lab.offsetHeight;
        const left = Math.max(0, Math.min(W - w, x - w / 2));
        const want = Math.max(0, Math.min(H - h, m.tone === "bad" ? y - 12 - h : y + 10));
        const top = apartTop({ left, top: want, w, h }, placed, H, m.tone === "bad" ? -1 : 1);
        placed.push({ l: left, t: top, r: left + w, b: top + h });
        lab.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      });
    });
  }
  let tvLoading = false;
  let lwLineTypes: { curved: number; steps: number } = { curved: 2, steps: 1 };
  /** a "#rrggbb" or "rgb(...)" colour as its three channels (the fade is drawn in the line's own colour) */
  const rgbOf = (c: string): [number, number, number] => {
    const h = /^#([0-9a-f]{6})$/i.exec(c);
    if (h) return [parseInt(h[1]!.slice(0, 2), 16), parseInt(h[1]!.slice(2, 4), 16), parseInt(h[1]!.slice(4, 6), 16)];
    const m = /(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
    return m ? [+m[1]!, +m[2]!, +m[3]!] : [214, 255, 60];
  };
  /** which scale the time axis uses: "time" for a chart of a day or less, "date" for a longer one */
  let tickMode: "sec" | "time" | "date" = "time";
  let tickShown: "sec" | "time" | "date" = "time";
  const css = (name: string, fallback: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  /** The price line's colour: the bright lime on the dark theme, a deep green on the light one (the lime is faint on white). */
  const lineColor = (): string => (document.documentElement.dataset.theme === "light" ? "#2f4a00" : css("--live", "#d6ff3c"));
  async function ensureChart(): Promise<void> {
    if (tv || tvLoading) return;
    tvLoading = true;
    try {
      const lw = await import("lightweight-charts");
      const chart = lw.createChart(plot, {
        autoSize: true,
        layout: { background: { type: lw.ColorType.Solid, color: "transparent" }, textColor: css("--mute", "#9aa1ae"), fontFamily: css("--font", "system-ui"), attributionLogo: true },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { borderVisible: false, visible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true, rightOffset: 2, ticksVisible: false, fixLeftEdge: true, fixRightEdge: true,
          // One scale per chart: clock times when the chart spans a day or less, dates when it spans longer (never a mix of both).
          tickMarkFormatter: (t: number, type: number) => (tickMode === "date" && type > 2 ? "" : tickLabel(t, tickMode)), // in date mode only the day-boundary ticks are named
        },
        // A scrub: a vertical hairline with its time on the axis, no horizontal line (the big price above says the price).
        crosshair: {
          mode: lw.CrosshairMode.Magnet,
          vertLine: { visible: true, width: 1, style: lw.LineStyle.Solid, color: css("--mute", "#9aa1ae"), labelVisible: true, labelBackgroundColor: css("--mute", "#9aa1ae") },
          horzLine: { visible: false, labelVisible: false },
        },
        // The page scrolls under a finger: the chart only shows the crosshair (the scrub); its range is the tabs'.
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: false, axisDoubleClickReset: false },
        localization: { priceFormatter: (v: number) => fmtV(v), timeFormatter: (t: number) => candleTime(t, tickMode === "sec" ? 1 : tickMode === "time" ? 900 : 86_400) },
      });
      const candle = chart.addSeries(lw.CandlestickSeries, { upColor: css("--old-green", "#12d44f"), downColor: css("--mandarin", "#ff8c1a"), borderVisible: false, wickUpColor: css("--old-green", "#12d44f"), wickDownColor: css("--mandarin", "#ff8c1a"), lastValueVisible: false, priceLineVisible: false, priceFormat: { type: "custom", formatter: (v: number) => fmtV(v), minMove: 1e-12 } });
      const volume = chart.addSeries(lw.HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      chart.subscribeCrosshairMove((p) => {
        const t = p.time as number | undefined;
        if (t === undefined) return endScrub();
        let i = candles.findIndex((c) => c[0] === t);
        // The 1-second line holds the last price through a quiet second: the scrub there is that last trade's second.
        if (i < 0 && range === "1S") for (let k = candles.length - 1; k >= 0 && i < 0; k--) if (candles[k]![0] <= t) i = k;
        if (i < 0) return endScrub();
        scrub = i;
        paintHead();
      });
      // The default view: one smooth line over a soft fade, its live end pulsing (the library's own last-price animation).
      const line = chart.addSeries(lw.AreaSeries, {
        lineWidth: 2,
        lineType: lw.LineType.Curved,
        topColor: "rgba(214,255,60,0.22)",
        bottomColor: "rgba(214,255,60,0)",
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerRadius: 5,
        lastPriceAnimation: pageShown ? lw.LastPriceAnimationMode.Continuous : lw.LastPriceAnimationMode.Disabled,
        priceFormat: { type: "custom", formatter: (v: number) => fmtV(v), minMove: 1e-12 },
        visible: false,
      });
      lwLineTypes = { curved: lw.LineType.Curved, steps: lw.LineType.WithSteps };
      tv = { chart, candle, volume, line, startLine: null, lineMarks: lw.createSeriesMarkers(line, []), candleMarks: lw.createSeriesMarkers(candle, []) };
      // The labels follow the chart when its size or its shown span changes.
      chart.timeScale().subscribeSizeChange(placeLabels);
      chart.timeScale().subscribeVisibleLogicalRangeChange(placeLabels);
      // The colours are read again when the theme is switched (the chart is not redrawn by a stylesheet).
      new MutationObserver(() => paint()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch {
      tv = null;
    } finally {
      tvLoading = false;
    }
    if (tv) paint();
  }

  /** The coin's own price line as chart points, evenly spaced back from now over the hours it covers; null with fewer than two points. */
  function lineFallback(): { time: UTCTimestamp; value: number }[] | null {
    const s = item?.series;
    if (!s || s.length < 2 || candles.length >= 2 || range === "1S") return null;
    const hours = Number.isFinite(item!.changeWindowH) && item!.changeWindowH > 0 ? item!.changeWindowH : 24;
    const stepSec = Math.max(60, Math.round((hours * 3600) / (s.length - 1)));
    const end = Math.floor(Date.now() / 1000);
    return s.map((v, i) => ({ time: (end - (s.length - 1 - i) * stepSec) as UTCTimestamp, value: v }));
  }

  function paint(): void {
    // No candles from any source: the coin's own tracked or measured price line in the same chart, said plainly (never a made-up candle).
    const S = scale();
    const fallback = lineFallback()?.map((p) => ({ time: p.time, value: p.value * S })) ?? null;
    const capKnown = item !== null && Number.isFinite(capFactor(item.mcap, item.priceUsd));
    if (unitBtn.hidden !== !capKnown) unitBtn.hidden = !capKnown;
    setT(unitBtn, unit === "mcap" ? "Price" : "MCap");
    unitBtn.setAttribute("aria-label", unit === "mcap" ? "Show price" : "Show market cap");
    const ok = candles.length >= (range === "1S" ? 1 : 2) || fallback !== null; // one second's trade is a chart too (a single point)
    plot.style.visibility = ok ? "visible" : "hidden";
    const oneSec = range === "1S";
    if (oneSec) {
      // The window slides: only the last five minutes stay (a trade older than that is no longer on this chart).
      const from = Math.floor(Date.now() / 1000) - 300;
      while (candles.length && candles[0]![0] < from) candles.shift();
    }
    const haveCandles = candles.length >= (oneSec ? 1 : 2);
    const asCandles = haveCandles && view === "candles";
    // Candles with a line view or a thin history still draw the line; only a real candle series is ever drawn as candles.
    const asLine = !asCandles && (haveCandles || fallback !== null);
    const spanSec = haveCandles ? candles[candles.length - 1]![0] - candles[0]![0] : fallback ? fallback[fallback.length - 1]!.time - fallback[0]!.time : 0;
    tickMode = range === "1S" ? "sec" : spanSec <= 36 * 3600 ? "time" : "date";
    if (tv && tickMode !== tickShown) {
      // The axis keeps the labels it drew under the old scale until it is given a fresh formatter.
      tickShown = tickMode;
      tv.chart.applyOptions({ timeScale: { tickMarkFormatter: (t: number, type: number) => (tickMode === "date" && type > 2 ? "" : tickLabel(t, tickMode)) } });
    }
    if (modeBtn.hidden !== !haveCandles) modeBtn.hidden = !haveCandles;
    setT(modeBtn, asCandles ? "Line" : "Candles");
    if (modeBtn.getAttribute("aria-pressed") !== String(asCandles)) modeBtn.setAttribute("aria-pressed", String(asCandles));
    if (tv) {
      tv.candle.applyOptions({ visible: asCandles });
      tv.volume.applyOptions({ visible: asCandles });
      tv.chart.priceScale("right").applyOptions({ visible: asCandles });
      tv.chart.applyOptions({ layout: { textColor: css("--mute", "#9aa1ae") } });
      if (tv.startLine) {
        tv.line.removePriceLine(tv.startLine);
        tv.startLine = null;
      }
    }
    if (tv && asLine) {
      const pts0 = haveCandles ? (oneSec ? heldPerSecond(candles, Math.floor(Date.now() / 1000)) : lineFromOpen(candles, bucket)) : fallback!;
      const pts = haveCandles && S !== 1 ? pts0.map((p) => ({ ...p, value: p.value * S })) : pts0;
      const first = haveCandles ? candles[0]![1] * S : pts[0]!.value;
      const dirUp = pts[pts.length - 1]!.value >= first;
      const col = dirUp ? lineColor() : css("--mandarin", "#ff8c1a");
      const [r, g, b] = rgbOf(col);
      // A held price is a step, never a curve: a smooth line would invent a wiggle between two trades.
      tv.line.applyOptions({ lineType: oneSec ? lwLineTypes.steps : lwLineTypes.curved, visible: true, lineColor: col, topColor: `rgba(${r},${g},${b},0.22)`, bottomColor: `rgba(${r},${g},${b},0)` });
      tv.line.setData(pts);
      // Where the range started: a faint dotted level, so the line reads as above or below its start.
      tv.startLine = tv.line.createPriceLine({ price: first, color: `rgba(${rgbOf(css("--mute", "#9aa1ae")).join(",")},0.3)`, lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: "" });
      const key = (haveCandles ? "line:" + range : "fb") + ":" + (item?.id ?? "");
      if (fitted !== key || oneSec) {
        tv.chart.timeScale().fitContent();
        fitted = key;
      }
    } else if (tv) tv.line.applyOptions({ visible: false });
    if (tv && asCandles) {
      const up = css("--old-green", "#12d44f");
      const down = css("--mandarin", "#ff8c1a");
      tv.candle.applyOptions({ upColor: up, downColor: down, wickUpColor: up, wickDownColor: down });
      // On the 1-second chart a second with no trade is an empty slot (whitespace), never a bar.
      const slots = oneSec ? withGaps(candles) : candles.map((c) => c as Candle | number);
      tv.candle.setData(slots.map((c) => (typeof c === "number" ? { time: c as UTCTimestamp } : { time: c[0] as UTCTimestamp, open: c[1] * S, high: c[2] * S, low: c[3] * S, close: c[4] * S })));
      tv.volume.setData(slots.map((c) => (typeof c === "number" ? { time: c as UTCTimestamp } : { time: c[0] as UTCTimestamp, value: c[5], color: c[4] >= c[1] ? up + "66" : down + "66" })));
      if (fitted !== range + ":" + (item?.id ?? "") || oneSec) {
        tv.chart.timeScale().fitContent();
        fitted = range + ":" + (item?.id ?? "");
      }
    }
    if (tv) {
      const pts: [number, number][] = asLine ? (haveCandles ? candles.map((c) => [c[0], c[4] * S]) : fallback!.map((p) => [p.time as number, p.value])) : asCandles ? candles.map((c) => [c[0], c[4] * S]) : [];
      paintMarkers(asLine ? "line" : asCandles ? "candles" : null, pts);
    }
    // One message, from what is actually on the chart: a drawn line or candles never sit beside "Chart busy".
    const drawn = tv !== null && ok;
    const msg = drawn
      ? ""
      : ok
        ? "Loading…" // data is here, the chart library is still loading
        : state === "loading"
          ? "Loading…"
          : range === "1S" && (state === "none" || state === "ok" || state === "stale")
            ? quiet || candles.length === 0 && source
              ? "No trades in the last 5 minutes."
              : "No 1-second data yet"
          : state === "busy"
            ? "Chart not read yet. PINR asks again shortly."
            : state === "error"
              ? "Chart not read yet. PINR asks again shortly."
              : item?.chain === "bsc" || item?.chain === "base"
                ? "No trades read yet."
                : "No chart yet.";
    setT(status, msg);
    status.classList.toggle("hide", msg === "");
    //
    const what = S !== 1 ? "market cap" : "price";
    const capNote = unit === "mcap" && !capKnown ? " · market cap not known" : "";
    setT(caption, candles.length >= 2 && source ? `Chart: ${source === "PINR tape" ? "Pump.fun" : source} · ${view === "candles" ? (oneSec ? "candles for each second with a trade" : "candles with volume") : oneSec ? `${what} line, a quiet second holds the last price` : `${what} line`}${capNote}` : fallback ? `Chart: ${item?.priceSource || "PINR"} ${what} line · no candles are available for this coin yet${capNote}` : "");
    paintHead();
  }

  function paintMarkers(on: "line" | "candles" | null, pts: [number, number][]): void {
    if (!tv) return;
    const times = pts.map((p) => p[0]);
    const step = times.length > 1 ? times[1]! - times[0]! : bucket;
    // A chart of a day or less says the clock time; a longer one the date too.
    const span = times.length > 1 ? times[times.length - 1]! - times[0]! : 0;
    const when = (t: number): string => (span <= 36 * 3600 ? tickLabel(t, step < 60 ? "sec" : "time") : candleTime(t, 60));
    const marks = on ? eventMarkers(events, times, step, when) : [];
    const key = `${on}|${scale()}|${document.documentElement.dataset.theme ?? ""}|${marks.map((m) => `${m.time}:${m.text}`).join(",")}`;
    if (key !== marksKey) {
      marksKey = key;
      //
      // drawn in PINR's deep violet, whatever its tone.
      const list: SeriesMarker<Time>[] = marks.map((m) => ({ time: m.time as UTCTimestamp, position: "inBar", shape: "circle", color: EVENT_VIOLET, size: 1 }));
      tv.lineMarks.setMarkers(on === "line" ? list : []);
      tv.candleMarks.setMarkers(on === "candles" ? list : []);
      const value = new Map(pts);
      shownMarks = marks.map((m) => ({ time: m.time, value: value.get(m.time) ?? 0, tone: m.tone, text: m.text, on: on! }));
      evLayer.replaceChildren(
        ...shownMarks.map((m) => {
          const lab = el("div", `cpevlabel ${m.tone}`, m.text);
          lab.hidden = true;
          return lab;
        }),
      );
    }
    if (shownMarks.length) placeLabels();
  }

  async function load(silent: boolean): Promise<void> {
    const it = item;
    if (!it?.address) return;
    const e = epoch;
    if (!silent) {
      state = "loading";
      paint();
    }
    const res = await opts.fetchChart(it.address, range, it.launchpad);
    if (e !== epoch) return; // another coin or range was chosen meanwhile
    fetchedAt = Date.now();
    state = res.status;
    if (res.status === "ok" || res.status === "stale") {
      candles = res.candles as Candle[];
      bucket = res.bucketSec ?? (candles.length > 1 ? Math.max(1, candles[1]![0] - candles[0]![0]) : 900);
      source = res.source;
    } else if (!silent) candles = [];
    quiet = res.quiet === true;
    paint();
  }

  function selectRange(r: RangeId): void {
    if (r === range) return;
    range = r;
    for (const [id, b] of tabBtns) b.classList.toggle("on", id === r);
    epoch++;
    candles = [];
    source = "";
    endScrub();
    if (item && item.flagKind !== "VAMP") void load(false);
    else paint();
  }

  // The scrub: while a finger or cursor is on the chart the big price and the change are that candle's, with its time (the chart's crosshair says which).
  function endScrub(): void {
    if (scrub < 0) return;
    scrub = -1;
    paintHead();
  }

  function setItem(given: Item | null | undefined): void {
    const next = given ?? null;
    const same = next !== null && item !== null && next.id === item.id;
    item = next;
    if (!same) {
      statsKey = "";
      unit = "mcap";
    }
    root.classList.toggle("hastoken", next !== null);
    // A copy (VAMP) has no chart anywhere: the page shows only its report (the label page).
    root.classList.toggle("isvamp", next?.flagKind === "VAMP");
    orbit.setItem(next);
    healthGet.hidden = !next?.address;
    if (next?.address) healthGet.href = `/api/healthfile?address=${encodeURIComponent(next.address)}`;
    quietNote.hidden = next?.quiet !== true;
    if (next === null) return;
    void ensureChart();
    if (same) {
      paintHead();
      paintStats();
      if (candles.length < 2) paint(); // a line that arrived with the latest list draws now, whatever state the chart is in
      return;
    }
    epoch++;
    candles = [];
    source = "";
    state = "loading";
    // The TradingView link goes to the coin's own chart where TradingView lists it (the Air looks the symbol up), else to its chart page.
    if (next.chain === "solana" && next.address && next.flagKind !== "VAMP") {
      const e0 = epoch;
      void opts.fetchTvSymbol(next.address).then((sym) => {
        if (e0 !== epoch || !sym) return;
        const a = el("a", "cplink", "TradingView ↗");
        a.href = tradingViewHref(sym);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        if (!TV_WIDGET_ON) {
          links.append(a);
          links.hidden = false;
          return;
        }
        const b = el("button", "cplink cptvbtn", "TradingView chart");
        b.type = "button";
        b.setAttribute("aria-expanded", "false");
        let box: HTMLElement | null = null;
        b.onclick = () => {
          if (!box) {
            box = el("div", "cptvbox");
            const cfg = tvWidgetConfig(sym, document.documentElement.dataset.theme === "light" ? "light" : "dark");
            if (!cfg) return;
            const holder = el("div", "tradingview-widget-container");
            const inner = el("div", "tradingview-widget-container__widget");
            const sc = document.createElement("script");
            sc.src = TV_WIDGET_SCRIPT;
            sc.async = true;
            sc.text = JSON.stringify(cfg);
            holder.append(inner, sc);
            box.append(holder);
            links.after(box);
            b.setAttribute("aria-expanded", "true");
            return;
          }
          box.hidden = !box.hidden;
          b.setAttribute("aria-expanded", String(!box.hidden));
        };
        links.append(a, b);
        links.hidden = false;
      });
    }
    scrub = -1;
    for (const [id, b] of tabBtns) b.classList.toggle("on", id === range);
    badge.set(next);
    avatar.replaceChildren();
    if (next.image) avatar.append(pictureOf(next.image, next.name, next.address));
    else avatar.textContent = avatarChar(next.name);
    links.replaceChildren(
      ...[...chartLinks(next), ...socialLinks(next.links)].map((l) => {
        const a = el("a", "cplink", `${l.label} ↗`);
        a.href = l.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        return a;
      }),
    );
    links.hidden = links.childElementCount === 0;
    paintStats();
    paint();
    if (next.flagKind !== "VAMP") void load(false);
    //
    events = [];
    if (next.flagKind !== "VAMP" && next.address) {
      const id = next.id;
      void opts.fetchEvents(next.address).then((ev) => {
        if (item?.id !== id) return;
        events = ev;
        paint();
      });
    }
  }

  return {
    el: root,
    dossierHost,
    livePrice(address, price, atMs, usd) {
      if (!item?.address || item.address.toLowerCase() !== address.toLowerCase()) return;
      const trade = usd !== undefined;
      //
      if (state !== "ok" && state !== "stale" && !(trade && (state === "none" || state === "busy"))) return;
      if (foldPrice(candles, bucket, price, atMs, { usd, start: trade })) {
        if (state === "none" || state === "busy") state = "ok";
        // Not drawn while the page is out of sight (each draw is a chart redraw per trade); drawn once when it comes back.
        if (pageShown) paint();
        else chartDirty = true;
      }
    },
    scrollPos: () => body.scrollTop,
    setScrollPos(y) {
      body.scrollTo({ top: y, behavior: "auto" });
    },
    scrollTo(part, smooth = false) {
      body.scrollTo({ top: part === "dossier" && !root.classList.contains("isvamp") ? top.offsetHeight + 8 : 0, behavior: smooth ? "smooth" : "auto" });
    },
    setItem,
    place,
    update(nowSec) {
      if (nowSec - lastUpdate < 0.5) return;
      lastUpdate = nowSec;
      if (!item?.address || item.flagKind === "VAMP") return;
      paintStats();
      if (candles.length < 2) paint(); // a line that arrived with the latest list, or a chart library that just loaded
      // fresh candles: every 20 s; a busy or failed answer is tried again after 8 s
      const age = Date.now() - fetchedAt;
      const retry = state === "busy" || state === "error" || state === "stale" ? age > 8_000 : age > (range === "1S" ? 4_000 : 20_000);
      // The 1-second chart scrolls: drawn again each second so the line reaches now.
      if (range === "1S" && candles.length && Math.floor(nowSec) !== lastSecPaint) {
        lastSecPaint = Math.floor(nowSec);
        paint();
      }
      if (retry && state !== "loading" && scrub < 0) void load(true);
    },
  };
}
