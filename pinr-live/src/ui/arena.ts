import { chainName } from "../world/chainname";
import type { ArenaCoin, ArenaGroup } from "../../server/arena";
import { ageText, money, signedPct } from "../world/discoverlist";
import { shortAddress } from "../world/livefeed";
import { attachPageGestures, createPlacer, type GestureOptions, type Placement } from "./pageoverlay";
import { tagChips } from "../world/tags";
import { pinchScene, type Scene } from "./pinch";
import { visibleText } from "../world/visibletext";
import { moderation } from "../world/moderation";

/**
 * Item 114: with Show Mayhem off (the default), a MAYHEM member leaves its battle, and a battle left with fewer than two versions is not
 * shown; the rest keep their order, and the battle takes its title from its first version left.
 */
export function arenaShown(groups: readonly ArenaGroup[], showMayhem: boolean): ArenaGroup[] {
  if (showMayhem) return [...groups];
  const out: ArenaGroup[] = [];
  for (const g of groups) {
    const members = g.members.filter((m) => !m.mayhem);
    if (members.length < 2) continue;
    out.push(members.length === g.members.length ? g : { ...g, members, title: members[0]!.name, ticker: members[0]!.ticker, recentUsd: members.reduce((n, m) => n + m.recentUsd, 0) });
  }
  return out;
}

/**
 *
 * minutes' volume, then X presence, then the chart, so you see which version is drawing the money. Observed figures only: "not checked" (a dash on the two money figures) is a figure no
 * source gave, never a zero; "earliest launch" is what the launch times show, not a judgement.
 */
export interface ArenaOptions extends GestureOptions {
  fetchArena(): Promise<{ groups: ArenaGroup[]; asOfMs: number } | null>;
  /** A version was tapped: open its DeepScan page. */
  onOpen(address: string): void;
}
export interface ArenaPage {
  el: HTMLElement;
  place(p: Placement | null, live: boolean): void;
  update(nowSec: number): void;
  /** A page opened from another starts at its top, not where it was left. */
  toTop(): void;
}

/** An empty-state line: its fixed words, with the Pinch scene beside them (ArtDesign's picks, 1 Nov). */
function emptyNote(words: string, scene: Scene): HTMLElement {
  const p = el("p", "arempty arpinch");
  p.append(pinchScene(scene, 72), el("span", undefined, words));
  return p;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const dash = "—";
const notChecked = "not checked";
const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
export function arenaMatches(m: Pick<ArenaCoin, "name" | "ticker" | "address">, query: string): boolean {
  const q = visibleText(query).toLowerCase().replace(/^\$/, "").trim();
  if (!q) return true;
  return (m.name ?? "").toLowerCase().includes(q) || (m.ticker ?? "").toLowerCase().replace(/^\$/, "").includes(q) || (q.length >= 6 && m.address.toLowerCase().includes(q));
}
const usd = (v: number | null): string => (v === null ? dash : money(v));

function memberRow(m: ArenaCoin, rank: number, onOpen: (a: string) => void): HTMLElement {
  const row = el("button", `arrow${rank === 1 ? " lead" : ""}`);
  row.type = "button";
  const name = m.name ?? shortAddress(m.address); // a member off the lists that no source named shows its address (W1), never a blank
  row.setAttribute("aria-label", `Open ${name}`);
  row.addEventListener("click", () => onOpen(m.address));
  const pic = el("span", "arpic");
  const initial = (m.name ?? "?").trim().charAt(0).toUpperCase() || "?";
  if (m.imageUrl) {
    const img = el("img");
    img.src = m.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    // a picture that does not load is asked of PINR's own picture server once (as the tiles do), then shows the name's first letter, never
    // the browser's broken-image mark (checklist 5)
    img.addEventListener("error", () => {
      const own = `/api/img?a=${encodeURIComponent(m.address)}&v=2`;
      if (!img.src.includes("/api/img")) img.src = own;
      else pic.textContent = initial;
    });
    pic.append(img);
  } else pic.textContent = initial;
  const who = el("span", "arwho");
  who.append(el("b", undefined, `${rank}. ${name}`), el("span", "artick", m.ticker ? `$${m.ticker.replace(/^\$/, "")}` : notChecked));
  const meta = [m.launchpad ?? (m.chain ? chainName(m.chain) : ""), m.launchedAtMs ? `${ageText(Math.max(0, (Date.now() - m.launchedAtMs) / 60_000))} old` : ""].filter(Boolean).join(" · ");
  who.append(el("span", "armeta", meta || notChecked));
  if (m.earliest) who.append(el("span", "archip", "earliest launch"));
  if (m.tags?.length) {
    const t = el("span", "artags");
    t.append(...tagChips(m.tags, m.createdCount));
    who.append(t);
  }
  //
  const fig = (label: string, value: string, cls = ""): HTMLElement => {
    const f = el("span", `arfig ${cls}`, value);
    f.dataset.lab = label;
    return f;
  };
  const x = m.xPosts !== null ? `${m.xPosts} post${m.xPosts === 1 ? "" : "s"}` : m.hasX ? "linked" : notChecked;
  const chg = m.change24hPct === null ? notChecked : signedPct(m.change24hPct);
  row.append(
    pic,
    who,
    //
    fig("30 min", m.recentKnown === false ? notChecked : m.recentAtLeast ? `${money(m.recentUsd)}+ · ${m.recentTrades}+ tx` : `${money(m.recentUsd)} · ${m.recentTrades} tx`, "arhot"),
    fig("24h vol", usd(m.volume24hUsd)),
    fig("X", x),
    fig("24h", chg, m.change24hPct === null ? "" : m.change24hPct >= 0 ? "up" : "down"),
    fig("MC", usd(m.valuationUsd)),
  );
  return row;
}

export function createArenaPage(opts: ArenaOptions): ArenaPage {
  const root = el("div", "arenapage");
  root.id = "arena";
  const frame = el("div", "dframe");
  const scroller = el("div", "dscroll arscroll");
  frame.append(scroller);
  root.append(frame);
  const page = el("div", "arpage");
  scroller.append(page);
  attachPageGestures(root, scroller, opts);
  const place = createPlacer(root, frame, scroller, () => {});
  const head = el("div", "arhead");
  head.append(el("h1", undefined, "PvP Arena"), el("p", "arsub", "Every version of a contested coin, side by side. Ranked by the last 30 minutes' volume, then X, then the chart. Observed figures, not a verdict."));
  const list = el("div", "arlist");
  const foot = el("p", "arfoot");
  //
  // shows whole when any of its versions matches), and a tap on a version opens its page as before.
  const searchWrap = el("div", "dsearchwrap arsearch");
  const searchForm = el("form", "dsearch");
  searchForm.setAttribute("role", "search");
  searchForm.innerHTML = ICON_SEARCH;
  const input = el("input", "dinput");
  input.type = "search";
  input.placeholder = "Ticker, name or CA";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Search the Arena");
  input.enterKeyHint = "search";
  searchForm.append(input);
  //
  searchForm.addEventListener("pointerdown", (e) => {
    if (e.target !== input) {
      e.preventDefault();
      input.focus();
    }
  });
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    input.blur();
  });
  searchWrap.append(searchForm);
  const found = el("p", "arfound");
  found.hidden = true;
  page.append(searchWrap, head, found, list, foot);
  let groups: ArenaGroup[] = [];
  let allGroups: ArenaGroup[] = [];
  // Item 114: Show Mayhem switched on or off redraws the battles at once.
  moderation.onChange(() => {
    groups = arenaShown(allGroups, moderation.showMayhem);
    draw();
  });
  let asOfMs = 0;

  let live = false;
  let lastAsk = 0;
  let asking = false;
  let key = "";
  let hiddenAt = 0;
  async function load(): Promise<void> {
    if (asking) return;
    asking = true;
    lastAsk = Date.now();
    const got = await opts.fetchArena().catch(() => null);
    asking = false;
    if (!got) {
      if (!list.childElementCount) list.replaceChildren(emptyNote("The Arena is not read yet. PINR asks again shortly.", "sitting-waiting"));
      return;
    }
    const k = JSON.stringify(got.groups);
    if (k === key) return;
    key = k;
    allGroups = got.groups;
    groups = arenaShown(allGroups, moderation.showMayhem);
    asOfMs = got.asOfMs;
    draw();
  }
  const PAGE = 20;
  const MEMBERS = 3;
  const openGroups = new Set<string>();
  let drawn = PAGE;
  const FIRST = 4;
  const BATCH = 4;
  let drawToken = 0;
  function draw(): void {
    drawToken++;
    const q = input.value.trim();
    const shown = q ? groups.filter((g) => g.members.some((m) => arenaMatches(m, q))) : groups;
    found.hidden = !q;
    found.textContent = `Search · ${shown.length} ${shown.length === 1 ? "battle" : "battles"} found`;
    if (!groups.length) {
      list.replaceChildren(emptyNote("No active battles right now: no coin has two or more versions trading in the last 30 minutes.", "sticker-calm"));
    } else if (!shown.length) {
      list.replaceChildren(emptyNote(`Nothing in the Arena matches “${q}”.`, "sitting-waiting"));
    } else {
      const more = shown.length - drawn;
      const cardOf = (g: ArenaGroup): HTMLElement => {
        const card = el("section", "argroup");
        const h = el("div", "argh");
        h.append(el("b", undefined, `${g.title ?? dash}${g.ticker ? ` $${g.ticker.replace(/^\$/, "")}` : ""}`), el("span", "arghv", `${g.members.length} versions · ${money(g.recentUsd)} in 30 min`));
        // The first versions of a battle show; the rest wait behind a button (a search shows them all, it is looking for one of them).
        const all = g.members;
        const cut = !q && !openGroups.has(g.id) && all.length > MEMBERS ? MEMBERS : all.length;
        card.append(h, ...all.slice(0, cut).map((m, i) => memberRow(m, i + 1, opts.onOpen)));
        if (cut < all.length) {
          const b = el("button", "armore armoremem", `Show ${all.length - cut} more ${all.length - cut === 1 ? "version" : "versions"}`);
          b.type = "button";
          b.addEventListener("click", () => {
            openGroups.add(g.id);
            draw();
          });
          card.append(b);
        }
        return card;
      };
      //
      const todo = shown.slice(0, drawn);
      const token = ++drawToken;
      list.replaceChildren(...todo.slice(0, FIRST).map(cardOf));
      const rest = (from: number): void => {
        if (token !== drawToken) return;
        const batch = todo.slice(from, from + BATCH).map(cardOf);
        if (batch.length) list.append(...batch);
        if (from + BATCH < todo.length) requestAnimationFrame(() => rest(from + BATCH));
        else if (more > 0) list.append(moreButton(more));
      };
      if (todo.length > FIRST) requestAnimationFrame(() => rest(FIRST));
      else if (more > 0) list.append(moreButton(more));
    }
    foot.textContent = `Read ${new Date(asOfMs).toLocaleTimeString()}. Copy hiding is off on this page only; everywhere else PINR shows one version of each family.`;
  }
  function moreButton(left: number): HTMLElement {
    const b = el("button", "armore", `Show ${Math.min(PAGE, left)} more battles (${left} not shown)`);
    b.type = "button";
    b.addEventListener("click", () => {
      drawn += PAGE;
      draw();
    });
    return b;
  }
  input.addEventListener("input", () => {
    drawn = PAGE;
    draw();
  });
  return {
    el: root,
    toTop: () => void (scroller.scrollTop = 0),
    place(p, isLive) {
      if (p) {
        hiddenAt = 0;
        if (!list.childElementCount && groups.length) draw();
      } else if (list.childElementCount) {
        // Out of sight for a while: the battles are dropped from the page and drawn again on the next visit.
        const now = performance.now();
        if (!hiddenAt) hiddenAt = now;
        else if (now - hiddenAt > 8000) {
          list.replaceChildren();
          key = "";
          drawn = PAGE;
          hiddenAt = 0;
        }
      }
      place(p, isLive);
      if (isLive && !live) void load();
      live = isLive;
    },
    update() {
      if (live && Date.now() - lastAsk > 15_000) void load();
    },
  };
}
