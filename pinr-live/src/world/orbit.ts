import type { Evidence, EvidenceRow, Gate, GateCoin, Grokbot, Pinrai } from "../../server/evidence";
import { scoredAgo } from "./format";
import { shortAddress } from "./livefeed";

/**
 *
 * what it is in plain words, whether it was read on chain (●) or only reported (○), how long ago PINR read it, and where to see it. Nothing here is a
 * verdict: a group with nothing in it says "not checked yet" (missing stays missing), never "clean".
 */
export type GroupId = "creator" | "funders" | "holders" | "pool" | "socials" | "links";
export const GROUPS: { id: GroupId; label: string; empty: string }[] = [
  { id: "creator", label: "Creator", empty: "Who created and launched this coin: not checked yet." },
  { id: "funders", label: "Funders", empty: "Where the creator's money came from: not checked yet." },
  { id: "holders", label: "Holders", empty: "Who holds this coin: not checked yet." },
  { id: "pool", label: "Pool", empty: "Where it trades: not checked yet." },
  { id: "socials", label: "Socials", empty: "The accounts the coin lists: not checked yet." },
  { id: "links", label: "Links", empty: "The coin's own documents: not checked yet." },
];

export interface OrbitFact {
  text: string;
  /** ● read on chain, ○ reported by the source named. */
  onchain: boolean;
  /** "read 5 min ago", and "happened 2 days ago" when the fact states a time of its own. */
  readText: string | null;
  happenedText: string | null;
  source: string | null;
  link: string | null;
  checks?: { label: string; url: string }[];
}
export interface OrbitGroup {
  id: GroupId;
  label: string;
  empty: string;
  facts: OrbitFact[];
}

export const LINKED = ["bought in the creation block", "funded by the creator before launch", "received tokens from the creator", "linked to the creator"];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
function amount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  // under 1: three significant digits, written out (0.001, 0.000999), so a small real payment never reads as 0 (CHAINS, checklist 7)
  if (n > 0 && n < 1) return n.toLocaleString("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 12 });
  return String(Math.round(n * 100) / 100);
}
/** Below this percent a share reads "under 0.0001%" (written out, never "1.2e-18%"); the apps use the same rule. */
export const TINY_PERCENT = 0.0001;
/** A share (0 to 1) as a percent, never rounded up to 100% and never down to a made-up 0%; null when not a share. */
export function share(s: number | null): string | null {
  if (s === null || s < 0 || s > 1) return null;
  const p = s * 100;
  if (p > 0 && p < TINY_PERCENT * (1 - 1e-9)) return `under ${TINY_PERCENT}%`; // the tolerance keeps 1e-6 * 100 (0.0000999…) at 0.0001%
  return `${p >= 1 ? String(Math.floor(p * 100) / 100) : String(Number(p.toPrecision(2)))}%`;
}
function duration(sec: number): string {
  if (sec < 120) return `${Math.round(sec)} s`;
  if (sec < 7200) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}
function rec(v: EvidenceRow["value"]): Record<string, string | number | boolean> {
  return typeof v === "object" && v !== null ? v : {};
}

/**
 * Release checklist line 7 (nothing fake, missing says so): a source's words can carry a raw "null", "undefined" or "NaN" where a value was not there (the GrokBot account line
 * read "verified as shown: none: null"). Such a piece is never shown as it is: it reads "not checked yet". A word is only taken for a raw null when it stands alone between
 * the separators (start, ": ", " · ", ", " and the end), so a coin or a name that merely contains the letters is left as it is.
 */
export function noRawNull(text: string): string {
  return text.replace(/(^|:\s+|\s·\s|,\s+)(null|undefined|NaN)(?=$|\s*:|\s·|,)/gi, (_m, pre: string) => `${pre}not checked yet`);
}

/** Which group a row belongs to and how it reads. Unknown rows still show (under Links), in the words the source gave. */
export function describe(r: EvidenceRow): { group: GroupId; text: string } {
  const w = r.what;
  const to = shortAddress(r.to.id);
  const from = shortAddress(r.from.id);
  if (w === "created by") return { group: "creator", text: `Created by ${to}` };
  if (w === "launched by") return { group: "creator", text: `Launched by ${to}` };
  if (w === "fee receiver at launch") return { group: "creator", text: `Launch fees went to ${to}` };
  if (w === "coins launched (the launchpad's list)") {
    const n = typeof r.value === "number" || typeof r.value === "string" ? r.value : null;
    return { group: "creator", text: n === null ? `${from} has launched other coins (the launchpad's list)` : `${from} has launched ${n} coins (the launchpad's list)` };
  }
  if (w === "copies of this coin launched") return { group: "creator", text: `${typeof r.value === "number" ? r.value : "Some"} copies of this coin were launched by the same creator` };
  // A wallet tied to the creator, in the plain observed words DATA writes (the file never states a rule, a window or a share).
  if (LINKED.includes(w)) return { group: "creator", text: `Linked wallet ${to} · ${w}` };
  if (w === "funded") {
    const sol = num(r.value);
    return { group: "funders", text: sol === null ? `${from} funded ${to}` : `${from} sent ${amount(sol)} ${r.unit ?? "SOL"} to ${to}` };
  }
  if (w === "holds") {
    const v = rec(r.value);
    const amt = num(v.amount);
    const marks = ["dev", "sniper", "bundler"].filter((k) => v[k] === true);
    const tail = marks.length ? ` · the source marks it: ${marks.join(", ")}` : "";
    // Base and BNB rows give a share of the supply, and a note on who the wallet is (a burn address, a launchpad's curve)
    const s = share(num(v.share));
    const held = amt !== null ? `${amount(amt)} of it` : s !== null ? `${s} of the supply` : "this coin";
    const note = typeof v.note === "string" ? ` · ${v.note}` : "";
    return { group: "holders", text: `${from} holds ${held}${tail}${note}` };
  }
  if (w === "holds (dev team)") {
    const v = rec(r.value);
    const s = share(num(v.share));
    return { group: "holders", text: s === null ? "The dev team's wallets hold this coin" : `The dev team's wallets hold ${s} of it` };
  }
  if (w === "holders counted") {
    const n = num(r.value);
    return { group: "holders", text: n === null ? "Holders counted" : `${n.toLocaleString("en-US")} ${n === 1 ? "wallet holds" : "wallets hold"} this coin` };
  }
  // Base and BNB (CHAINS' rows): the creator side
  if (w === "dev moves") {
    const v = rec(r.value);
    const got = num(v.acquired);
    const half = num(v.half_out_after_s);
    const parts = [num(v.members) !== null ? `${num(v.members)} ${num(v.members) === 1 ? "wallet" : "wallets"}` : "", got !== null ? `${amount(got)} tokens acquired` : "", half !== null ? `half sent on after ${duration(half)}` : ""].filter(Boolean);
    return { group: "creator", text: `The creator's tokens moved${parts.length ? " · " + parts.join(", ") : ""}` };
  }
  if (w.startsWith("dev team: ")) return { group: "creator", text: `Dev team wallet, ${w.slice(10)}: ${to}` };
  if (w === "bought at launch") {
    const v = rec(r.value);
    const coin = (r.unit ?? "").split("/")[0]!.trim() || "ETH";
    const parts = [num(v.tokens) !== null ? `${amount(num(v.tokens)!)} tokens` : "", num(v.eth) !== null ? `for ${num(v.eth)} ${coin}` : ""].filter(Boolean);
    return { group: "creator", text: `${from} bought at launch${parts.length ? " · " + parts.join(" ") : ""}` };
  }
  if (w === "is a contract (a launch service, not a person)") return { group: "creator", text: `${from} is a contract (a launch service, not a person)` };
  if (w === "owned by (contract owner)") {
    const v = rec(r.value);
    const parts = [typeof v.template === "string" ? v.template : "", typeof v.can === "string" ? `the owner can: ${v.can}` : ""].filter(Boolean);
    return { group: "creator", text: `Contract owner: ${to}${parts.length ? " · " + parts.join(" · ") : ""}` };
  }
  if (w === "creator rewards paid to") return { group: "creator", text: `Creator rewards go to ${to}` };
  if (w === "tax paid to") return { group: "creator", text: `Tax goes to ${to}` };
  // Base and BNB: the pool side
  if (w === "launched on") return { group: "pool", text: `Launched on ${r.to.id}` };
  if (w === "trades in pool (Uniswap v4)") return { group: "pool", text: `Trades in the Uniswap v4 pool ${to}` };
  if (w === "liquidity locked") {
    const s = share(num(r.value));
    return { group: "pool", text: `Liquidity locked${s === null ? "" : `: ${s} of the pool`} · ${r.to.id}` };
  }
  if (w === "liquidity held by Zora's hook") {
    const v = rec(r.value);
    const s = share(num(v.locked_share));
    //
    const can = typeof v.owners_can === "string" ? `; its owners can ${v.owners_can}` : "";
    return { group: "pool", text: `Zora's hook holds ${s ?? "some"} of the pool's liquidity${can}` };
  }
  if (w === "trading tax") {
    const v = rec(r.value);
    const b = num(v.buy_pct);
    const s = num(v.sell_pct);
    return { group: "pool", text: `Trading tax: buy ${b === null ? "–" : `${b}%`}, sell ${s === null ? "–" : `${s}%`}` };
  }
  if (w === "trades in pool") {
    const burned = share(num(rec(r.value).lp_burned_share));
    return { group: "pool", text: `Trades in the pool ${to}${burned === null ? "" : ` · ${burned} of its LP tokens burned`}` };
  }
  if (w === "market pair") {
    const v = rec(r.value);
    const parts = [typeof v.dex === "string" ? `on ${v.dex}` : "", num(v.market_cap) !== null ? `market cap ${money(num(v.market_cap)!)}` : "", num(v.liquidity_usd) !== null ? `liquidity ${money(num(v.liquidity_usd)!)}` : ""].filter(Boolean);
    return { group: "pool", text: `Market pair ${to}${parts.length ? " · " + parts.join(", ") : ""}` };
  }
  if (w === "trades on") return { group: "pool", text: `Trades on ${r.to.id}` };
  if (w === "launched") return { group: "pool", text: "Launched" };
  if (w === "lists its own link") {
    const name = r.to.kind === "x" ? "X account" : r.to.kind === "telegram" ? "Telegram" : r.to.kind === "site" ? "website" : "link";
    return { group: "socials", text: `Lists its own ${name}` };
  }
  if (w === "X check") return { group: "socials", text: "X check ran" };
  if (w === "creator's Zora profile") return { group: "socials", text: `Creator's Zora profile @${r.to.id}` };
  if (w === "creator's linked account") {
    const v = rec(r.value);
    const who = typeof v.username === "string" ? `@${v.username}` : r.to.id;
    const f = num(v.followers);
    return { group: "socials", text: `Creator's linked account ${who}${f === null ? "" : ` · ${f.toLocaleString("en-US")} followers`}` };
  }
  if (w === "metadata document") return { group: "links", text: "Metadata document" };
  if (w === "copy of the template") return { group: "links", text: typeof r.value === "string" ? `Contract is a copy of ${r.value}` : "Contract is a copy of a template" };
  if (w === "GoPlus security check (a lead)") return { group: "links", text: `GoPlus check (a lead): ${typeof r.value === "string" ? r.value : "read"}` };
  return { group: "links", text: w };
}

/** The six groups, always, in ring order; a group with no facts says so. */
export function orbitGroups(ev: Evidence | null, nowMs: number): OrbitGroup[] {
  const groups: OrbitGroup[] = GROUPS.map((g) => ({ ...g, facts: [] }));
  for (const r of ev?.rows ?? []) {
    const d = describe(r);
    const read = scoredAgo(r.readMs, nowMs);
    const at = scoredAgo(r.atMs, nowMs);
    groups.find((g) => g.id === d.group)!.facts.push({
      text: noRawNull(d.text),
      onchain: r.onchain,
      readText: read ? `read ${read}` : null,
      happenedText: at ? `happened ${at}` : null,
      source: r.source,
      link: r.link,
      checks: (r.checks ?? []).map((c) => ({ label: c.label, url: c.url })),
    });
  }
  //
  const funders = groups.find((g) => g.id === "funders")!;
  if (ev?.fundingNote && !funders.facts.length) funders.empty = ev.fundingNote;
  return groups;
}


/**
 *
 * (plain observations); this adds only how long before this coin an earlier look-alike launched, and links to see each coin and the creator's others.
 */
export interface GateLine {
  words: string;
  /** "launched 3 min earlier" for an earlier look-alike, from the two launch times. */
  when: string | null;
  links: { label: string; href: string }[];
}
export interface GateView {
  /** One plain heading line: what the gate found, or that nothing matching was found, or that it has not been read yet. */
  headline: string;
  lines: GateLine[];
  /** The creator's other coins (newest first), when the file lists them. */
  others: { label: string; when: string | null; href: string | null }[];
  creatorLink: string | null;
  readText: string | null;
}

const short = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
/** How long before this coin the other one launched: "3 min earlier", "2 h earlier"; null when either time is missing or the other is not earlier. */
export function earlierBy(thisMs: number | null, thatMs: number | null): string | null {
  if (thisMs === null || thatMs === null || thatMs >= thisMs) return null;
  const min = Math.max(1, Math.round((thisMs - thatMs) / 60_000));
  if (min < 60) return `${min} min earlier`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h earlier`;
  return `${Math.round(h / 24)} days earlier`;
}
/**
 *
 * the server gives each gate coin `pageLink`, the launchpad's own page for it where the feed knows the coin's launchpad. That is the link; a coin with none
 * keeps the engine's scanner link, and the label then names the scanner so nobody takes it for the launchpad.
 */
export interface PageLink {
  label: string;
  url: string;
}
type WithPage = { link: string | null; pageLink?: PageLink | null };
const SCANNERS: Record<string, string> = { "solscan.io": "Solscan", "basescan.org": "BaseScan", "bscscan.com": "BscScan", "etherscan.io": "Etherscan" };
function scannerName(url: string | null): string | null {
  try {
    return url ? SCANNERS[new URL(url).hostname.replace(/^www\./, "")] ?? null : null;
  } catch {
    return null;
  }
}
/** The link to follow and the words that name its place: the launchpad page first, the scanner only when that is all there is (and said so). */
export function sourceLink(c: WithPage): { href: string | null; place: string | null } {
  const p = c.pageLink;
  if (p && /^https:\/\//.test(p.url)) return { href: p.url, place: p.label };
  return { href: c.link, place: scannerName(c.link) };
}
const coinLink = (c: GateCoin, nowMs: number): { label: string; when: string | null; href: string | null } => {
  const ago = scoredAgo(c.launchedAtMs, nowMs);
  const { href, place } = sourceLink(c as GateCoin & WithPage);
  return { label: place && href ? `${short(c.coin)} on ${place}` : short(c.coin), when: ago ? `launched ${ago}` : null, href };
};

/** True when the evidence file has loaded and carries no gate section: the coin page then says "Not checked yet." instead of staying silent. */
export function gateNotChecked(ev: { gate?: Gate } | null | undefined, loaded: boolean): boolean {
  return loaded && !ev?.gate;
}

const coinSee = (c: GateCoin): { label: string; href: string }[] => {
  const { href, place } = sourceLink(c as GateCoin & WithPage);
  return href ? [{ label: `see ${short(c.coin)}${place ? ` on ${place}` : ""}`, href }] : [];
};

export function gateView(g: Gate | undefined, nowMs: number): GateView | null {
  if (!g) return null;
  const lines: GateLine[] = [];
  for (const it of g.items) {
    if (it.kind === "earlier_lookalike") {
      const e = earlierBy(g.launchedAtMs, it.launchedAtMs);
      const links: GateLine["links"] = [];
      const sl = sourceLink(it as WithPage);
      if (sl.href) links.push({ label: `${it.coin ? `see the earlier coin ${short(it.coin)}` : "see the earlier coin"}${sl.place ? ` on ${sl.place}` : ""}`, href: sl.href });
      const cp = (it as { creatorPageLink?: PageLink | null }).creatorPageLink;
      const cl = cp && /^https:\/\//.test(cp.url) ? { href: cp.url, place: cp.label } : { href: it.creatorLink, place: scannerName(it.creatorLink) };
      if (cl.href) links.push({ label: `${it.creator ? `its creator ${short(it.creator)}` : "its creator"}${cl.place ? ` on ${cl.place}` : ""}`, href: cl.href });
      lines.push({ words: it.words, when: e ? `launched ${e}` : null, links });
    } else if (it.kind === "same_creator_relaunch") {
      lines.push({ words: it.words, when: null, links: it.coins.flatMap((c) => coinSee(c)) });
    } else if (it.kind === "serial_launcher") {
      lines.push({ words: it.words, when: null, links: [] });
    } else if (it.kind === "fast_launcher") {
      lines.push({ words: it.words, when: null, links: it.coins.flatMap((c) => coinSee(c)).slice(0, 8) });
    } else if (it.kind === "bot_launch") {
      // each wallet as the label source names it (an observed label, with where it comes from), linked to the wallet itself
      const links = it.wallets.filter((w) => w.link).map((w) => ({ label: `${w.label ?? "wallet"} ${short(w.id)}${w.source ? ` (${w.source})` : ""}`, href: w.link! }));
      //
      for (const r of it.receipts ?? []) if (r.link) links.push({ label: `${r.what}${r.value !== null && typeof r.value === "string" ? ` ${short(r.value)}` : ""}`, href: r.link });
      lines.push({ words: it.words, when: null, links });
    } else lines.push({ words: it.words, when: null, links: [] });
  }
  const headline =
    g.status === "not read yet"
      ? "Not checked yet."
      : g.status === "bot"
        ? "Observed at launch: bot launch pattern seen. PINR does not list it."
        : lines.length
          ? "Observed at launch:"
          : g.words[0] ?? "Nothing matching was found at launch.";
  // A line the items did not carry (the file's own words) still shows once.
  const seen = new Set(lines.map((l) => l.words));
  for (const w of g.words) if (!seen.has(w) && g.status !== "not read yet" && lines.length) lines.push({ words: w, when: null, links: [] });
  // Release checklist line 7: a raw null in the file's words or in a link's label reads "not checked yet", like the Evidence rows.
  for (const l of lines) {
    l.words = noRawNull(l.words);
    for (const k of l.links) k.label = noRawNull(k.label);
  }
  const others = (g.creator?.otherCoins ?? []).map((c) => coinLink(c, nowMs));
  const read = scoredAgo(g.readMs, nowMs);
  return { headline: noRawNull(headline), lines, others, creatorLink: g.creator?.link ?? null, readText: read ? `read ${read}${g.source ? ` · ${g.source}` : ""}` : g.source ? `source: ${g.source}` : null };
}


/**
 *
 * stands on (what, value, source, when, ● on chain / ○ reported). The reading's own words are DATA's and shown as sent; this adds only labels.
 */
export interface PinraiReceiptLine {
  text: string;
  mark: "●" | "○";
  when: string | null;
  href: string | null;
}
export interface PinraiLine {
  words: string;
  reviewed: boolean;
  receipts: PinraiReceiptLine[];
}
export interface PinraiView {
  headline: string;
  lines: PinraiLine[];
  readText: string | null;
}
const plainText = (v: string | number | boolean | null): string => (v === null ? "" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
export function pinraiView(p: Pinrai | undefined, nowMs: number): PinraiView | null {
  if (!p) return null;
  const lines: PinraiLine[] = p.items.map((it) => ({
    words: noRawNull(it.words),
    reviewed: it.reviewed,
    receipts: it.receipts.map((r) => {
      const v = plainText(r.value);
      const text = noRawNull([r.source, v].filter(Boolean).join(": ") || "see the source");
      return { text, mark: r.onchain ? "●" : "○", when: scoredAgo(r.asOfMs, nowMs), href: r.link };
    }),
  }));
  const headline =
    p.status === "off" ? "PINRai is switched off." : p.status === "not read yet" ? "Not read yet." : lines.length ? "Observed in the evidence:" : "Read, and no sign of the developer's intent was found in the evidence.";
  const ago = scoredAgo(p.readMs, nowMs);
  return { headline, lines: p.status === "read" ? lines : [], readText: ago ? `read ${ago}` : null };
}

/** GrokBot's checked findings as the evidence list shows a reported (○) read: what it found, where it opened it, and when. No verdict, no handle. */
export interface GrokbotLine {
  kind: string;
  text: string;
  when: string | null;
  href: string;
  note: string | null;
}
export interface GrokbotView {
  source: string;
  lines: GrokbotLine[];
  readText: string | null;
}
const GROK_KINDS: Record<string, string> = { post: "Post", account: "Account", partner: "Partner source", original: "Original source", auditor: "Auditor list" };
export function grokbotView(g: Grokbot | undefined, nowMs: number): GrokbotView | null {
  if (!g || !g.rows.length) return null;
  const lines = g.rows.map((r) => {
    const v = plainText(r.value);
    return {
      kind: GROK_KINDS[r.kind] ?? r.kind,
      text: noRawNull(v ? `${r.what}: ${v}` : r.what),
      when: scoredAgo(r.asOfMs, nowMs),
      href: r.link ?? "",
      note: r.removed ? "the post was removed when opened" : r.ownAccount ? "read from the account's own page" : null,
    };
  });
  const ago = scoredAgo(g.readMs, nowMs);
  return { source: g.source, lines, readText: ago ? `read ${ago}` : null };
}
