/**
 *
 *
 */

const HIDDEN_KEY = "pinr.hidden";

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** The coins this person has hidden. Kept in the browser (any failure to read or write it just means "this visit only"). */
export class Moderation {
  private hidden: Set<string>;
  /** Bumped on every change, so a reader can tell cheaply that it has to look again. */
  rev = 0;
  private listeners = new Set<() => void>();

  constructor(private storage: KeyValueStore | null = null) {
    this.hidden = new Set();
    try {
      const raw = storage?.getItem(HIDDEN_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) this.hidden = new Set(list.filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase()));
    } catch {
      /* blocked or damaged storage: defaults */
    }
  }

  get hiddenCount(): number {
    return this.hidden.size;
  }
  isHidden(address: string | null | undefined): boolean {
    return !!address && this.hidden.has(address.toLowerCase());
  }
  hide(address: string): void {
    this.hidden.add(address.toLowerCase());
    this.save(HIDDEN_KEY, JSON.stringify([...this.hidden]));
    this.changed();
  }
  unhide(address: string): void {
    this.hidden.delete(address.toLowerCase());
    this.save(HIDDEN_KEY, JSON.stringify([...this.hidden]));
    this.changed();
  }
  /** Add coins to the hidden ones (nothing is un-hidden), with one change for the whole lot. Returns how many were new. */
  addHidden(addresses: readonly string[]): number {
    const before = this.hidden.size;
    for (const a of addresses) if (a.trim()) this.hidden.add(a.trim().toLowerCase());
    const added = this.hidden.size - before;
    if (added > 0) {
      this.save(HIDDEN_KEY, JSON.stringify([...this.hidden]));
      this.changed();
    }
    return added;
  }
  /** The hidden coins, lower-case (for the choices code). */
  hiddenList(): string[] {
    return [...this.hidden];
  }
  unhideAll(): void {
    this.hidden.clear();
    this.save(HIDDEN_KEY, "[]");
    this.changed();
  }
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private changed(): void {
    this.rev++;
    for (const fn of this.listeners) fn();
  }
  private save(k: string, v: string): void {
    try {
      this.storage?.setItem(k, v);
    } catch {
      /* kept for this visit only */
    }
  }
}

function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The one set of choices the page uses. */
export const moderation = new Moderation(browserStorage());
