import type { PageId } from "./sitemap";

/**
 *
 * the launchpad pill and list, the scroll, the search text); Back returns to the newest saved screen and puts all of that back, one step at a time.
 * The header button, the browser's back button and the phone's back all go through here, so they agree: the browser history gets one entry per
 * saved screen. On the first screen of a visit Back goes to the PINR page, not out of the site.
 */
export interface NavState {
  /** The launchpad pill and list, or the PINR filter, as the header holds it. */
  filter: string;
  /** How far the PINR grid was scrolled (the camera's y), when it was the page. */
  pinrY: number | null;
  /** The Discover search text and how far its list was scrolled. */
  query: string;
  discoverScroll: number;
  /** How far the coin page was scrolled. */
  coinScroll: number;
}

export interface NavEntry {
  page: PageId;
  /** The coin the page showed (its address), when it showed one. */
  coin: string | null;
  state: NavState;
  /** Set on an overlay's entry (a fullscreen card): Back closes the overlay instead of restoring a page. */
  undo?: () => void;
}

export interface HistoryLike {
  pushState(state: unknown, title: string): void;
  replaceState(state: unknown, title: string): void;
  back(): void;
}

export interface NavHooks {
  /** The screen as it is right now. */
  capture(): NavEntry;
  /** Put a saved screen back. */
  restore(e: NavEntry): void;
  /** Go to the PINR page (nothing saved to return to). */
  home(): void;
  current(): PageId;
}

const MAX = 200;
const KEY = "pinrNav";

export class NavTrail {
  private readonly stack: NavEntry[] = [];

  constructor(
    private readonly hist: HistoryLike,
    private readonly hooks: NavHooks,
  ) {
    hist.replaceState({ [KEY]: 0 }, "");
  }

  get depth(): number {
    return this.stack.length;
  }

  /** True when Back has somewhere to go: a saved screen, or (on any page but PINR) the PINR page itself. */
  get canBack(): boolean {
    return this.stack.length > 0 || this.hooks.current() !== "pinr";
  }

  /** Call just before the user moves to another screen (or another coin): saves this one. */
  leave(): void {
    this.stack.push(this.hooks.capture());
    if (this.stack.length > MAX) this.stack.shift();
    this.hist.pushState({ [KEY]: this.stack.length }, "");
  }

  /** An overlay opens over the current page: Back (header, browser or phone) closes it first. Call `closeOverlay` from its own close button. */
  openOverlay(close: () => void): void {
    this.stack.push({ ...this.hooks.capture(), undo: close });
    this.hist.pushState({ [KEY]: this.stack.length }, "");
  }

  /** The overlay's own close button: steps back through the history, so the entry is removed and `close` runs once. */
  closeOverlay(): void {
    if (this.stack[this.stack.length - 1]?.undo) this.hist.back();
  }

  /** The header's Back button. The browser history steps back and `popped` does the work, so both stay in step. */
  back(): void {
    if (this.stack.length > 0) this.hist.back();
    else if (this.hooks.current() !== "pinr") this.hooks.home();
  }

  /** The browser moved to a history entry (its back button, a phone's back, or `back()` above). */
  popped(state: unknown): void {
    const n = (state as Record<string, unknown> | null)?.[KEY];
    const target = typeof n === "number" ? n : 0;
    // Forward into a screen that was not saved: step back out again.
    if (target > this.stack.length) {
      this.hist.back();
      return;
    }
    let to: NavEntry | undefined;
    while (this.stack.length > target) {
      const e = this.stack.pop();
      if (e?.undo) e.undo();
      else to = e;
    }
    if (to) this.hooks.restore(to);
  }
}

/** The one trail the page uses (set by main.ts), so any screen can open an overlay on it: `navTrail.current?.openOverlay(close)`. */
export const navTrail: { current: NavTrail | null } = { current: null };
