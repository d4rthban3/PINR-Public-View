/**
 *
 * read, the words, how many coins sit there now): Read in full, Worth a closer look, Not checked yet. A tap picks that group (the page then shows only its coins,
 * which the page's own code decides); a tap on the picked one puts every coin back. The pills only say what was observed, never a verdict.
 * This file only draws the pills: the counts come in, the picked group goes out. It stays hidden until counts have been given.
 */
export type GroupId = "read" | "closer" | "unchecked";
export const GROUPS: readonly { id: GroupId; label: string; hint: string }[] = [
  { id: "read", label: "Read in full", hint: "Most sources read, nothing unusual observed" },
  { id: "closer", label: "Worth a closer look", hint: "Something was observed: see the line on the coin" },
  { id: "unchecked", label: "Not checked yet", hint: "PINR has not finished reading these" },
];
/** How far the row reaches below the launchpad row's bottom (its drawn pill 32 px plus 12 px of air; the two rows' 44 px tap boxes touch, never overlap), as LP_ROW_BOTTOM counts the first row; the page's tile inset adds it while the row shows. */
export const GROUP_ROW = 44;
export const GROUP_ROW_PHONE = 48;

export type GroupCounts = Record<GroupId, number>;

export interface GroupPills {
  el: HTMLElement;
  /** How many coins sit in each group now; null (or never called) hides the row. */
  setCounts(c: GroupCounts | null): void;
  /** Which group is picked (null: none, every coin shows). Marks the pills only; does not call the page back. */
  set(g: GroupId | null): void;
  /** The page lets the row show (the PINR page) or not. */
  show(on: boolean): void;
  /** True while the row is on screen, so the page can add GROUP_ROW to its tile inset. */
  visible(): boolean;
}

export function createGroupPills(onPick: (g: GroupId | null) => void): GroupPills {
  const el = document.createElement("div");
  el.id = "grprow";
  el.hidden = true;
  const bar = document.createElement("div");
  bar.id = "grpbar";
  bar.setAttribute("role", "radiogroup");
  bar.setAttribute("aria-label", "Groups by what was observed");
  el.append(bar);
  let counts: GroupCounts | null = null;
  let allowed = true;
  let picked: GroupId | null = null;
  const nums = new Map<GroupId, HTMLElement>();
  for (const g of GROUPS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "grppill";
    b.dataset.g = g.id;
    b.setAttribute("role", "radio");
    b.title = g.hint;
    b.innerHTML = `<span class="gd"></span><span class="gl">${g.label}</span><b class="gn"></b>`;
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
        const t = String(c[g.id]);
        if (n.textContent !== t) n.textContent = t;
      }
      sync();
    },
    set(g) {
      picked = g;
      mark();
    },
    show(on) {
      allowed = on;
      sync();
    },
    visible() {
      return !el.hidden;
    },
  };
}
