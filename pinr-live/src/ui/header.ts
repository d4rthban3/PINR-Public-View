import { scoreShown } from "../world/hub";
import { createLpPills } from "./lppills";
import { allLaunchpads, DEFAULT_LIST, isListFilter, listKey, listLabel, parseList } from "../world/lists";
import { FILTERS, getHides, getRoster, getShowCopies, getSort, setShowCopies, setSort, SORTS, ROSTER_DEFAULT, ROSTER_MAX, setHides, type Filter, type Hides } from "../world/filters";

/** The sizes offered for the PINR page roster: the base (90), a few steps and the most (200). */
const ROSTER_CHOICES = [60, ROSTER_DEFAULT, 120, 160, ROSTER_MAX];
import { onLook, toggleLook } from "./theme";
import { createGroupPills, GROUPS_IN_ROW_FROM, type GroupCounts, type GroupId, type PillId } from "./grouppills";
import type { PageId } from "../world/sitemap";
import { moderation } from "../world/moderation";
import { HIDDEN_COINS_MENU_LINE } from "./settings";

/**
 * The header: a glass bar in the same material as the tiles, with no outline.
 *
 *   centre : "PINR GUIDE" (the PINR wordmark and its matching GUIDE wordmark), opening a choice of the PINR guide or the Whitepaper
 *
 *
 * Everything else about the interface stays free of visible navigation.
 */
/** The classic filter funnel: filters and the page's customisation live behind it. */
const ICON_FILTER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h17l-6.4 7.6V19l-4.2-2v-4.4z"/></svg>';
const ICON_PIPE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h3.5A1.5 1.5 0 0112 7.5V10M12 14v2a2 2 0 002 2h3"/></svg>';
const ICON_DIAG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2.2-6 4.2 12 2.2-6H21"/></svg>';
const ICON_MENU =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>';
const ICON_MOON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>';
const ICON_BACK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const ICON_PAPER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>';
const ICON_BOOK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5z"/></svg>';
const ICON_GEAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/></svg>';

/** Where the menu can take you, in the order shown. */
/**
 *
 * a sheet titled "Menu", its own order (`phone`) and words (`phoneLabel`), no icons, no Whitepaper row (see style.css).
 */
const MENU_ITEMS: { id: PageId | "map" | "guide"; label: string; icon: string; phone: number; phoneLabel: string }[] = [
  { id: "pinr", label: "PINR", phone: 2, phoneLabel: "PINR", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.4" height="6.4" rx="1.8"/><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.8"/><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.8"/><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.8"/></svg>' },
  { id: "discover", label: "Discover", phone: 1, phoneLabel: "Discover", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>' },
  { id: "guide", label: "PINR guide", phone: 3, phoneLabel: "PINR guide", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5M14 5h5v5"/></svg>' },
  { id: "deepscan", label: "DeepScan", phone: 4, phoneLabel: scoreShown() ? "PINRbot DeepScan" : "DeepScan", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5a8.5 8.5 0 015.5 5.5H15z"/></svg>' },
  { id: "arena", label: "PvP Arena", phone: 5, phoneLabel: "PvP Arena", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l9.5 9.5M4 4h4M4 4v4M20 4l-9.5 9.5M20 4h-4M20 4v4M8.5 15.5l-3 3M15.5 15.5l3 3M6.5 14l3.5 3.5M17.5 14L14 17.5"/></svg>' },
  { id: "wallet", label: "Wallet / Profile", phone: 6, phoneLabel: "Wallet and profile", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 016.5 5H17v3"/><path d="M4 7.5V17a2 2 0 002 2h13V8H6.5A2.5 2.5 0 014 7.5z"/><circle cx="16" cy="13.5" r="1.1"/></svg>' },
  { id: "map", label: "Site map", phone: 7, phoneLabel: "The whole map", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>' },
];

const FILTER_ICONS: Record<string, string> = {
  trending: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  movers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20V5M8 5l-4 4M8 5l4 4M16 4v15M16 19l-4-4M16 19l4-4"/></svg>',
  pinrscore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V10M10 19V5M16 19v-7M22 19H2"/></svg>',
  new: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
};

/** One line of a header panel: a label, its value, and (optionally) a tone for the value. */
export interface PanelRow {
  label: string;
  value: string;
  tone?: "live" | "warn";
}

export interface HeaderOptions {
  onFilter(f: Filter): void;
  onGroup?(g: GroupId | null): void;
  onQuickView?(): void;
  /** A tile count chosen in the funnel panel. */
  onCols(n: number): void;
  /** A roster size chosen in the funnel panel (how many tiles the PINR page shows). */
  onRoster(n: number): void;
  /** The "hide" switches changed (copies, bots and rugs, serial launchers). */
  onHide(): void;
  /** The sort of the chosen filter changed (default, ascending, descending). */
  onSort(): void;
  /** The Discovery Pipeline panel: where tokens stand right now. Asked for each time it is open. */
  pipeline(): PanelRow[];
  /** The Diagnostics panel: how healthy the data is. */
  diagnostics(): PanelRow[];
  /** The line under the pipeline and diagnostics panels about where the data comes from. */
  dataNote(): string;
  /** The Whitepaper row in the menu (under Settings). */
  onPaper(): void;
  /** The Back button. `overlay` is true while Settings, the PINR guide or the Whitepaper is open (back then just closes it). */
  onBack(overlay: boolean): void;
  /** A page chosen in the menu. */
  onNavigate(id: PageId): void;
  /** "Site map" in the menu: zoom out to see every page. */
  onMap(): void;
  /** "PINR guide" in the header's centre choice and in the menu: open the PINR guide over the page. */
  onGuide(): void;
  /** "Settings" in the menu. */
  onSettings(): void;
}

export interface Header {
  el: HTMLElement;
  setFilter(f: Filter): void;
  filterButton(): HTMLButtonElement;
  filter(): Filter;
  refreshLists(): void;
  setGroupCounts(c: GroupCounts | null): void;
  /** Which group is picked (null: none). Marks the pills only. */
  setGroup(g: GroupId | null): void;
  /** True while the group row shows, so the page adds GROUP_ROW to its tile inset. */
  groupRowShown(): boolean;
  setGroupEmpty(on: boolean): void;
  /**
   * What the funnel can do on this page: filters work on PINR and Discover, tiles per row on PINR only. The part that does not
   * apply fades and stops responding; with neither, the whole funnel fades. Pipeline, Diagnostics and the menu always work.
   */
  setActive(filters: boolean, tiles: boolean): void;
  /** Which tile counts this screen offers and which one is chosen. */
  setCols(allowed: number[], current: number): void;
  /** Which page the camera is on (marks it in the menu, and tells Back whether Settings or the Whitepaper is open). */
  setPage(id: PageId | "settings" | "paper" | "guide"): void;
  /** The small label beside the wordmark that says what the data is (e.g. Simulated / Replay). */
  setDataLabel(long: string, short: string): void;
  /** Whether there is anywhere to go back to (Back also works while Settings or the Whitepaper is open). */
  setBack(canGoBack: boolean): void;
  /** Close any open panel (e.g. when the page changes). */
  closePanels(): void;
  /** Bottom edge of the bar in CSS pixels: tiles scroll under it, so content starts below this. */
  bottom(): number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html; // only ever our own constant strings
  return e;
}

export function createHeader(opts: HeaderOptions): Header {
  const bar = el("header", "bar");
  bar.id = "bar";

  const btn = (cls: string, html: string, label: string, popup = true): HTMLButtonElement => {
    const b = el("button", cls, html);
    b.setAttribute("aria-label", label);
    if (popup) {
      b.setAttribute("aria-haspopup", "true");
      b.setAttribute("aria-expanded", "false");
    }
    return b;
  };

  // Left: the Back button, then the wordmark and the simulated-data label.
  const left = el("div", "left");
  const btnBack = btn("icon back", ICON_BACK, "Back", false);
  btnBack.addEventListener("click", () => {
    closeAll();
    opts.onBack(overlayOpen);
  });
  const sim = el("div", "simtag", '<span class="long"></span><span class="short"></span>');
  sim.hidden = true;
  const simLong = sim.querySelector(".long") as HTMLElement;
  const simShort = sim.querySelector(".short") as HTMLElement;

  // Right: pipeline, diagnostics, filters, menu.
  const actions = el("div", "actions");
  const btnPipe = btn("icon", ICON_PIPE, "Discovery pipeline");
  const btnDiag = btn("icon", ICON_DIAG, "Diagnostics");
  //
  // Discover in its own bar); they all open the one panel and show the same state.
  const filterBtns: HTMLButtonElement[] = [];
  function makeFilterBtn(cls: string): HTMLButtonElement {
    const b = btn(cls, ICON_FILTER, "Filters");
    b.type = "button";
    b.append(el("span", "dot"));
    b.addEventListener("click", () => toggle(popFilter, b));
    filterBtns.push(b);
    return b;
  }
  const btnMenu = btn("icon menu", ICON_MENU, "Menu");
  // Light/dark: shows the look a tap will switch TO (a sun while dark, a moon while light).
  const btnLook = btn("icon", ICON_SUN, "Switch between light and dark", false);
  onLook((l) => {
    btnLook.innerHTML = l === "dark" ? ICON_SUN : ICON_MOON;
    btnLook.title = l === "dark" ? "Switch to light" : "Switch to dark";
  });
  btnLook.addEventListener("click", toggleLook);
  //
  left.append(btnBack, btnLook, sim);
  actions.append(btnPipe, btnMenu);

  // Filter panel
  const popFilter = el("div", "pop pop-filter");
  popFilter.hidden = true;
  const filterSec = el("div", "psec");
  filterSec.append(el("div", "ptitle pfiltitle", "Filter"));
  //
  // build (the launchpad refuses readers) is marked "PINR's list" and says its order in words.
  const lpRows = el("div", "plprows");
  const listRows = el("div", "plprows");
  const ownRows = el("div", "plprows");
  const lpTitle = el("div", "ptitle", "Launchpad");
  const listTitle = el("div", "ptitle", "List");
  const listNote = el("div", "phint plnote");
  let pickedLp = parseList(DEFAULT_LIST)!.lp.id;
  // Each launchpad opens on its own first list (the funnel's picker and the pills along the header both come here).
  function pickLp(lp: ReturnType<typeof allLaunchpads>[number]): void {
    pickedLp = lp.id;
    const next = listKey(lp, lp.lists[0]!);
    setFilter(next);
    opts.onFilter(next);
  }
  //
  const lpPills = createLpPills(pickLp);
  lpPills.setTail(makeFilterBtn("fbtn"));
  //
  const ICON_QUICK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>';
  const quickBtn = btn("fbtn quickbtn", ICON_QUICK, "Quick view of the four event cards", false);
  quickBtn.type = "button";
  quickBtn.title = "Quick view";
  quickBtn.classList.add("lptail");
  quickBtn.addEventListener("click", () => opts.onQuickView?.());
  lpPills.el.append(quickBtn);
  const groupPills = createGroupPills((g) => opts.onGroup?.(g as GroupId | null));
  function renderRows(): void {
    const sel = parseList(current);
    if (sel) pickedLp = sel.lp.id;
    lpPills.render(allLaunchpads(), pickedLp, listLabel(current));
    lpRows.replaceChildren(
      ...allLaunchpads().map((lp) => {
        const row = el("button", "row", `<span class="rt"><b>${lp.name}</b></span><span class="tick"></span>`);
        row.setAttribute("role", "menuitemradio");
        row.classList.toggle("on", lp.id === pickedLp);
        row.addEventListener("click", () => pickLp(lp));
        return row;
      }),
    );
    const lp = allLaunchpads().find((x) => x.id === pickedLp) ?? allLaunchpads()[0]!;
    listRows.replaceChildren(
      ...lp.lists.map((l) => {
        const key = listKey(lp, l);
        const row = el("button", "row", `<span class="rt"><b>${l.name}${l.kind === "pinr" ? ' <em class="pinrlist">PINR\'s list</em>' : ""}</b><i>${l.order}</i></span><span class="tick"></span>`);
        row.setAttribute("role", "menuitemradio");
        row.classList.toggle("on", key === current);
        row.addEventListener("click", () => {
          setFilter(key);
          opts.onFilter(key);
          closeAll();
        });
        return row;
      }),
    );
    listNote.textContent = lp.own
      ? `These are ${lp.name}'s own lists, read from ${lp.name} and shown in its own order.`
      : `These are PINR's lists of the ${lp.name} coins PINR lists. ${lp.name} does not let anyone read its own lists, so a plain sort carries its name and ranked boards say they are PINR's.`;
    ownRows.replaceChildren(
      ...FILTERS.filter((x) => x.id === "pinrscore" && scoreShown()).map((f) => {
        const row = el("button", "row", `${FILTER_ICONS[f.id]}<span class="rt"><b>${f.label}</b><i>${f.hint}</i></span><span class="tick"></span>`);
        row.setAttribute("role", "menuitemradio");
        row.classList.toggle("on", current === f.id);
        row.addEventListener("click", () => {
          // Choosing Token health again goes back to the launchpad list.
          const own = allLaunchpads().find((x) => x.id === pickedLp) ?? allLaunchpads()[0]!;
          const next: Filter = current === f.id ? listKey(own, own.lists[0]!) : f.id;
          setFilter(next);
          opts.onFilter(next);
          closeAll();
        });
        return row;
      }),
    );
  }
  filterSec.append(lpTitle, lpRows, listTitle, listRows, listNote, ownRows);
  // Sort: how the chosen filter is ordered. Each filter keeps its own choice.
  const sortSec = el("div", "psec psort");
  const sortSeg = el("div", "seg");
  for (const sd of SORTS) {
    const b = el("button", "segb", sd.label);
    b.addEventListener("click", () => {
      setSort(current, sd.id);
      syncSort();
      opts.onSort();
    });
    sortSeg.append(b);
  }
  function syncSort(): void {
    [...sortSeg.children].forEach((b, i) => {
      const on = SORTS[i]!.id === getSort(current);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  sortSec.append(el("div", "ptitle", "Sort"), sortSeg, el("div", "phint", "Default is the filter's own order. Ascending: lowest first. Descending: highest first."));
  // Tiles per row, the other half of the funnel: the PINR page's customisation.
  const tilesSec = el("div", "psec");
  const tilesTitle = el("div", "ptitle", "Tiles per row");
  const seg = el("div", "seg");
  const tilesHint = el("div", "phint", "PINR page. You can also pinch the grid.");
  tilesSec.append(tilesTitle, seg, tilesHint);
  // How many tiles the PINR page shows: the top of the chosen filter's own ranking. Base 90, up to 200.
  const rosterSec = el("div", "psec");
  const rosterSeg = el("div", "seg");
  for (const n of ROSTER_CHOICES) {
    const b = el("button", "segb", String(n));
    b.addEventListener("click", () => {
      opts.onRoster(n);
      syncRoster();
      closeAll();
    });
    rosterSeg.append(b);
  }
  function syncRoster(): void {
    [...rosterSeg.children].forEach((b, i) => {
      const on = ROSTER_CHOICES[i] === getRoster();
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  syncRoster();
  const rosterHint = el("div", "phint", "The top tokens of the chosen filter. 90 keeps the site light; the most is 200.");
  rosterSec.append(el("div", "ptitle", '<span class="lw">Tokens on the PINR page</span><span class="lp">Tiles on the page</span>'), rosterSeg, rosterHint);
  // What to take out: the rubbish PINR identifies. Copies keep a VAMP tile unless switched off here.
  const hideSec = el("div", "psec ptakeout");
  const hideRows = new Map<keyof Hides, HTMLButtonElement>();
  const HIDE_ROWS: [keyof Hides, string, string][] = [
    ["vamp", "Hide copies", "VAMPs and possible copies of another token's picture"],
    ["bots", "Hide bot-like coins", "Coins where bot-like trading was observed"],
    ["serial", "Hide serial launchers", "Creators with many launches"],
  ];
  hideSec.append(el("div", "ptitle", "Take out"));
  for (const [k, label, hint] of HIDE_ROWS) {
    const row = el("button", "row", `<span class="rt"><b>${label}</b><i>${hint}</i></span><span class="tick"></span>`);
    row.setAttribute("role", "menuitemcheckbox");
    row.addEventListener("click", () => {
      setHides({ ...getHides(), [k]: !getHides()[k] });
      syncHides();
      opts.onHide();
    });
    hideRows.set(k, row);
    hideSec.append(row);
  }
  //
  const mayhemRow = el("button", "row", `<span class="rt"><b>Show Mayhem</b><i>Coins labelled MAYHEM; left out by default</i></span><span class="tick"></span>`);
  mayhemRow.setAttribute("role", "menuitemcheckbox");
  mayhemRow.addEventListener("click", () => moderation.setShowMayhem(!moderation.showMayhem));
  // Its own section, so it also shows on a phone, where the sheet leaves "Take out" off (as the apps' sheet does).
  //
  const copiesRow = el("button", "row", `<span class="rt"><b>Show copies</b><i>Every coin tagged Copy on the PINR page; by default only the one leading its Arena battle</i></span><span class="tick"></span>`);
  copiesRow.setAttribute("role", "menuitemcheckbox");
  const syncCopies = (): void => {
    copiesRow.classList.toggle("on", getShowCopies());
    copiesRow.setAttribute("aria-checked", String(getShowCopies()));
  };
  copiesRow.addEventListener("click", () => {
    setShowCopies(!getShowCopies());
    syncCopies();
    opts.onHide();
  });
  syncCopies();
  const mayhemSec = el("div", "psec pmayhem");
  mayhemSec.append(mayhemRow, copiesRow);
  const syncMayhem = (): void => {
    mayhemRow.classList.toggle("on", moderation.showMayhem);
    mayhemRow.setAttribute("aria-checked", String(moderation.showMayhem));
  };
  moderation.onChange(syncMayhem);
  syncMayhem();
  function syncHides(): void {
    for (const [k, row] of hideRows) {
      row.classList.toggle("on", getHides()[k]);
      row.setAttribute("aria-checked", String(getHides()[k]));
    }
  }
  syncHides();
  popFilter.append(filterSec, el("div", "sep"), sortSec, el("div", "sep psortsep"), hideSec, mayhemSec, el("div", "sep"), tilesSec, el("div", "sep"), rosterSec);

  // At phone width the sheet ends as the apps' does: how many coins are hidden, and how to hide one. (On a wide
  // screen these live in Settings only; this part is shown under 600 px, see style.css.)
  const phoneSec = el("div", "psec pphone");
  const hiddenLine = el("div", "phidden");
  hiddenLine.hidden = !HIDDEN_COINS_MENU_LINE;
  const holdHint = el("div", "pholdhint", "Long-press a coin to hide it. Kept in this browser only.");
  phoneSec.append(...(HIDDEN_COINS_MENU_LINE ? [hiddenLine] : []), holdHint);
  const syncPhone = (): void => {
    hiddenLine.textContent = `Hidden coins: ${moderation.hiddenCount}`;
  };
  syncPhone();
  moderation.onChange(syncPhone);
  popFilter.append(el("div", "sep pphonesep"), phoneSec);

  // Menu panel: every place on the site, then Settings.
  const popMenu = el("div", "pop pop-menu");
  popMenu.hidden = true;
  const menuRows = new Map<string, HTMLButtonElement>();
  popMenu.append(el("div", "ptitle mtitle", "Menu")); // shown at phone width only, as in the apps
  for (const m of MENU_ITEMS) {
    const row = el("button", "row", `${m.icon}<span class="rt"><b><span class="lw">${m.label}</span><span class="lp">${m.phoneLabel}</span></b></span><span class="tick"></span>`);
    row.style.setProperty("--po", String(m.phone));
    row.addEventListener("click", () => {
      closeAll();
      if (m.id === "map") opts.onMap();
      else if (m.id === "guide") opts.onGuide();
      else opts.onNavigate(m.id);
    });
    menuRows.set(m.id, row);
    popMenu.append(row);
  }
  popMenu.append(el("div", "sep"));
  const settingsRow = el("button", "row", `${ICON_GEAR}<span class="rt"><b>Settings</b></span><span class="tick"></span>`);
  settingsRow.style.setProperty("--po", "7");
  settingsRow.addEventListener("click", () => {
    closeAll();
    opts.onSettings();
  });
  menuRows.set("settings", settingsRow);
  popMenu.append(settingsRow);
  //
  const diagRow = el("button", "row mdiag", `${ICON_DIAG}<span class="rt"><b>Diagnostics</b></span><span class="tick"></span>`);
  diagRow.style.setProperty("--po", "8");
  diagRow.addEventListener("click", () => toggle(diag.pop, btnDiag, diag.fill));
  menuRows.set("diagnostics", diagRow);
  popMenu.append(diagRow);
  // The Whitepaper lives under Settings.
  const paperRow = el("button", "row mpaper", `${ICON_PAPER}<span class="rt"><b>Whitepaper</b></span><span class="tick"></span>`);
  paperRow.addEventListener("click", () => {
    closeAll();
    opts.onPaper();
  });
  menuRows.set("paper", paperRow);
  popMenu.append(paperRow);

  // Pipeline and diagnostics panels: a title and a list of label / value lines, rebuilt while open.
  const makePanel = (title: string, rowsOf: () => PanelRow[]) => {
    const pop = el("div", "pop pop-info");
    pop.hidden = true;
    const body = el("div", "irows");
    const hint = el("div", "phint");
    pop.append(el("div", "ptitle", title), body, hint);
    const fill = (): void => {
      hint.textContent = opts.dataNote();
      body.replaceChildren();
      for (const r of rowsOf()) {
        const line = el("div", "irow");
        const k = el("span", "ik");
        k.textContent = r.label;
        const v = el("b", `iv${r.tone ? ` ${r.tone}` : ""}`);
        v.textContent = r.value;
        line.append(k, v);
        body.append(line);
      }
    };
    return { pop, fill };
  };
  const pipe = makePanel("Discovery pipeline", opts.pipeline);
  const diag = makePanel("Diagnostics", opts.diagnostics);
  let infoTimer: ReturnType<typeof setInterval> | undefined;

  //
  const guide = el(
    "button",
    "guidebtn",
    '<img class="gwm wmdark" src="/art/pinr-wordmark-dark.svg" alt="" draggable="false" /><img class="gwm wmlight" src="/art/pinr-wordmark-light.svg" alt="" draggable="false" />',
  ) as HTMLButtonElement;
  guide.type = "button";
  guide.setAttribute("aria-label", "PINR guide and Whitepaper");
  guide.setAttribute("aria-haspopup", "true");
  guide.setAttribute("aria-expanded", "false");
  guide.title = "PINR guide and Whitepaper";
  const popGuide = el("div", "pop pop-guide");
  popGuide.hidden = true;
  const guideRow = el("button", "row", `${ICON_BOOK}<span class="rt"><b>PINR guide</b><i>How to read PINR</i></span>`);
  guideRow.addEventListener("click", () => {
    closeAll();
    opts.onGuide();
  });
  const paperChoice = el("button", "row", `${ICON_PAPER}<span class="rt"><b>Whitepaper</b><i>Coming soon</i></span>`);
  paperChoice.addEventListener("click", () => {
    closeAll();
    opts.onPaper();
  });
  popGuide.append(guideRow, paperChoice);
  bar.append(left, guide, actions);
  // The panels live beside the bar, not inside it: a blur cannot be nested inside another blur.
  document.body.append(bar, lpPills.el, groupPills.el, popFilter, popMenu, pipe.pop, diag.pop, popGuide);
  //
  const wideRow = matchMedia(`(min-width: ${GROUPS_IN_ROW_FROM}px)`);
  const placeGroups = (): void => {
    const home = wideRow.matches ? lpPills.el : document.body;
    if (groupPills.el.parentElement !== home) home.append(groupPills.el);
  };
  placeGroups();
  const groupEmpty = el("div", "grpempty", "No coin in this list is in that group.");
  groupEmpty.hidden = true;
  groupEmpty.setAttribute("role", "status");
  document.body.append(groupEmpty);
  wideRow.addEventListener("change", placeGroups);

  let current: Filter = DEFAULT_LIST;
  //
  // in words) in its tooltip and its accessible name, and the funnel's list rows still mark "PINR's list".
  let pageNow: string = "pinr";
  function syncLabel(): void {
    lpPills.show(pageNow === "pinr");
    groupPills.show(pageNow === "pinr");
    lpPills.render(allLaunchpads(), pickedLp, listLabel(current));
  }
  function setFilter(f: Filter): void {
    current = f;
    renderRows();
    syncLabel();
    for (const b of filterBtns) b.classList.toggle("on", f !== "all");
    // A launchpad list keeps its own order; the Ascending/Descending choice is for the Token health filter only.
    sortSec.hidden = isListFilter(f);
    syncSort();
  }
  setFilter(current);

  const pops: [HTMLElement, HTMLElement][] = [
    [popMenu, btnMenu],
    [pipe.pop, btnPipe],
    [diag.pop, btnDiag],
    [popGuide, guide],
  ];
  function closeAll(): void {
    clearInterval(infoTimer);
    popFilter.hidden = true;
    for (const [p, b] of pops) {
      p.hidden = true;
      b.setAttribute("aria-expanded", "false");
      b.classList.remove("open");
    }
    for (const b of filterBtns) {
      b.setAttribute("aria-expanded", "false");
      b.classList.remove("open");
    }
  }
  function toggle(pop: HTMLElement, b: HTMLElement, fill?: () => void): void {
    const wasOpen = !pop.hidden;
    closeAll();
    if (!wasOpen) {
      pop.hidden = false;
      b.setAttribute("aria-expanded", "true");
      b.classList.add("open");
      if (fill) {
        fill();
        infoTimer = setInterval(fill, 1000);
      }
    }
  }
  btnMenu.addEventListener("click", () => toggle(popMenu, btnMenu));
  guide.addEventListener("click", () => toggle(popGuide, guide));
  btnPipe.addEventListener("click", () => toggle(pipe.pop, btnPipe, pipe.fill));
  btnDiag.addEventListener("click", () => toggle(diag.pop, btnDiag, diag.fill));
  // Tapping anywhere else, or pressing Escape, closes the panels.
  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as Node;
      if (!bar.contains(t) && !pops.some(([p]) => p.contains(t)) && !filterBtns.some((b) => b.contains(t)) && !popFilter.contains(t)) closeAll();
    },
    true,
  );
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  let activeKey = "";
  function setActive(filters: boolean, tiles: boolean): void {
    //
    const key = `${filters}${tiles}`;
    if (key === activeKey) return;
    activeKey = key;
    const any = filters || tiles;
    if (!any) {
      popFilter.hidden = true;
    }
    for (const b of filterBtns) {
      b.classList.toggle("off", !any);
      b.disabled = !any;
      b.setAttribute("aria-disabled", String(!any));
      if (!any) {
        b.classList.remove("open");
        b.setAttribute("aria-expanded", "false");
      }
    }
    // Inside the panel, the half that does not apply to this page is faded and inert.
    filterSec.classList.toggle("off", !filters);
    tilesSec.classList.toggle("off", !tiles);
    rosterSec.classList.toggle("off", !tiles);
    tilesHint.textContent = tiles ? "PINR page. You can also pinch the grid." : "Tiles per row applies to the PINR page.";
  }

  function setCols(allowed: number[], currentCols: number): void {
    seg.replaceChildren();
    for (const n of allowed) {
      const b = el("button", "segb", String(n));
      b.setAttribute("aria-pressed", String(n === currentCols));
      b.classList.toggle("on", n === currentCols);
      b.addEventListener("click", () => {
        opts.onCols(n);
        closeAll();
      });
      seg.append(b);
    }
  }

  function setPage(id: PageId | "settings" | "paper" | "guide"): void {
    pageNow = id;
    syncLabel();
    for (const [k, row] of menuRows) {
      row.classList.toggle("on", k === id);
      row.setAttribute("aria-current", k === id ? "page" : "false");
    }
    overlayOpen = id === "paper" || id === "settings" || id === "guide";
    // The centre button glows while the guide or the Whitepaper it opens is up.
    guide.classList.toggle("on", id === "guide" || id === "paper");
    syncBack();
  }
  let overlayOpen = false;
  let canBack = false;
  function syncBack(): void {
    const on = canBack || overlayOpen;
    btnBack.classList.toggle("off", !on);
    btnBack.disabled = !on;
    btnBack.setAttribute("aria-disabled", String(!on));
  }
  syncBack();

  function setDataLabel(long: string, short: string): void {
    simLong.textContent = long;
    simShort.textContent = short;
    //
    sim.hidden = long === "";
  }

  return {
    el: bar,
    setFilter,
    filterButton: () => {
      const b = makeFilterBtn("fbtn");
      b.classList.toggle("on", current !== "all");
      b.classList.toggle("off", activeKey === "falsefalse");
      b.disabled = activeKey === "falsefalse";
      return b;
    },
    filter: () => current,
    refreshLists: () => renderRows(),
    setGroupCounts: (c) => groupPills.setCounts(c),
    setGroup: (g: PillId | null) => groupPills.set(g),
    groupRowShown: () => groupPills.visible(),
    setGroupEmpty: (on) => {
      if (groupEmpty.hidden === on) groupEmpty.hidden = !on;
    },
    setActive,
    setCols,
    setPage,
    setBack: (b) => {
      if (b !== canBack) {
        canBack = b;
        syncBack();
      }
    },
    setDataLabel,
    closePanels: closeAll,
    bottom: () => bar.getBoundingClientRect().bottom,
  };
}
