import { scrollEdge } from "./scrolledge";
/**
 *
 * how many coins sit there now): Read in full, Worth a closer look, Partly read, Not checked yet. A tap picks that group (the page then shows only its coins,
 * which the page's own code decides); a tap on the picked one puts every coin back. The pills only say what was observed, never a verdict.
 * This file only draws the pills: the counts come in, the picked group goes out. It stays hidden until counts have been given.
 */
export type GroupId = "read" | "closer" | "partly" | "unchecked";
/** Every pill drawn: the same four. */
export type PillId = GroupId;
const ICONS: Record<PillId, string> = {
  read: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  closer: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>`,
  partly: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>`,
  unchecked: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.2 3.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/></svg>`,
};
export const GROUPS: readonly { id: PillId; label: string; hint: string }[] = [
  { id: "read", label: "Read in full", hint: "Most sources read, nothing unusual observed" },
  { id: "closer", label: "Worth a closer look", hint: "Something was observed: see the line on the coin" },
  { id: "partly", label: "Partly read", hint: "A health reading exists; some sources are still to read" },
  { id: "unchecked", label: "Not checked yet", hint: "No reading yet" },
];
/** How far the row reaches below the launchpad row's bottom (its drawn pill 32 px plus 12 px of air; the two rows' 44 px tap boxes touch, never overlap), as LP_ROW_BOTTOM counts the first row; the page's tile inset adds it while the row shows. */
export const GROUP_ROW = 44;
export const GROUP_ROW_PHONE = 48;
export const GROUPS_IN_ROW_FROM = 800;

export type GroupCounts = Record<GroupId, number | null>;

export interface GroupPills {
  el: HTMLElement;
  /** How many coins sit in each group now; null (or never called) hides the row. */
  setCounts(c: GroupCounts | null): void;
  /** Which group is picked (null: none, every coin shows). Marks the pills only; does not call the page back. */
  set(g: PillId | null): void;
  /** The page lets the row show (the PINR page) or not. */
  show(on: boolean): void;
  /** True while the row is on screen, so the page can add GROUP_ROW to its tile inset. */
  visible(): boolean;
}

export function createGroupPills(onPick: (g: PillId | null) => void): GroupPills {
  const el = document.createElement("div");
  el.id = "grprow";
  el.hidden = true;
  const bar = document.createElement("div");
  bar.id = "grpbar";
  bar.setAttribute("role", "radiogroup");
  bar.setAttribute("aria-label", "Groups by what was observed");
  el.append(bar);
  const edge = scrollEdge(bar);
  let counts: GroupCounts | null = null;
  let allowed = true;
  let picked: PillId | null = null;
  const nums = new Map<PillId, HTMLElement>();
  for (const g of GROUPS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "grppill";
    b.dataset.g = g.id;
    b.setAttribute("role", "radio");
    b.title = `${g.label}: ${g.hint}`;
    b.setAttribute("aria-label", g.label);
    b.innerHTML = `<span class="gi">${ICONS[g.id]}</span><b class="gn"></b>`;
    nums.set(g.id, b.querySelector(".gn") as HTMLElement);
    b.addEventListener("click", () => {
      picked = picked === g.id ? null : g.id;
      mark();
      onPick(picked);
    });
    bar.append(b);
  }
  function mark(): void {
    for (const b of Array.from(bar.children) as HTMLButtonElement[]) {
      const on = b.dataset.g === picked;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    }
  }
  function sync(): void {
    el.hidden = !(allowed && counts);
  }
  mark();
  return {
    el,
    setCounts(c) {
      counts = c;
      if (c) for (const g of GROUPS) {
        const n = nums.get(g.id)!;
        const v = c[g.id];
        const b = n.parentElement as HTMLElement;
        b.hidden = v === undefined;
        const t = v === undefined || v === null ? "" : String(v);
        if (n.textContent !== t) n.textContent = t;
      }
      sync();
      edge.update();
    },
    set(g) {
      picked = g;
      mark();
    },
    show(on) {
      allowed = on;
      sync();
      if (on) edge.update();
    },
    visible() {
      return !el.hidden;
    },
  };
}
