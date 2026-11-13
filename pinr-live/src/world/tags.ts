import { COIN_TAGS, type CoinTag } from "../../server/translate";

/**
 *
 * a coin's tags, in one order, for every place that draws a coin (tiles, Discover, search, the coin page, the Arena). The engine's `tags` field
 * first; a VAMP label or a "serial launcher" note the coin already carries counts too. The evidence behind each is in the coin's gate section
 * ("At launch" on its page). Observed tags, never a verdict or a price call.
 */
export const TAG_WORDS: Record<CoinTag, { chip: string; means: string }> = {
  vamp: { chip: "Copy", means: "Copies an earlier coin. The evidence is under “At launch” on its page." },
  bot: { chip: "Bot launch", means: "Bot launch pattern seen. PINR does not list it; the evidence is under “At launch” on its page." },
  serial_launcher: { chip: "Serial launcher", means: "Its creator launches many coins. The evidence is under “At launch” on its page." },
};

export function chipWords(tag: CoinTag, created?: number | null): string {
  if (tag === "serial_launcher" && typeof created === "number" && created >= 1) return `${created.toLocaleString("en-US")} ${created === 1 ? "coin" : "coins"} created`;
  return TAG_WORDS[tag].chip;
}

export function tagsOf(c: { tags?: readonly string[] | null; flagKind?: string | null; noScoreLabel?: string | null; serial?: boolean; note?: string | null }): CoinTag[] {
  const have = new Set<string>(c.tags ?? []);
  if (c.flagKind === "VAMP" || c.noScoreLabel === "VAMP") have.add("vamp");
  if (c.serial || /serial launcher/i.test(c.note ?? "")) have.add("serial_launcher");
  return COIN_TAGS.filter((t) => have.has(t));
}

/** The chips for a coin's tags (text only; the title says what it means and where its evidence is). */
export function tagChips(tags: readonly CoinTag[], created?: number | null): HTMLElement[] {
  return tags.map((t) => {
    const s = document.createElement("span");
    s.className = `tagchip tag-${t}`;
    fillChip(s, t, created);
    s.title = TAG_WORDS[t].means;
    return s;
  });
}

function fillChip(s: HTMLElement, tag: CoinTag, created?: number | null): void {
  if (tag === "serial_launcher" && typeof created === "number" && created >= 1) {
    const n = document.createElement("b");
    n.className = "tagnum";
    n.textContent = created.toLocaleString("en-US");
    s.append(n, document.createTextNode(created === 1 ? " coin created" : " coins created"));
    return;
  }
  s.textContent = chipWords(tag, created);
}

/**
 * The chips on a tile: one line only. A tile is small, and two chips wrapped onto two lines pushed its figures over the score (seen live, 26 Oct,
 * a coin that is a Copy and a Serial launcher). The first tag shows, and "+N" stands for the others; its hover names them all. Every other place
 * that draws a coin (Discover, search, the coin page, the Arena) has the room and keeps every chip.
 */
export function tileTagPlan(tags: readonly CoinTag[]): { shown: CoinTag[]; more: CoinTag[] } {
  return { shown: tags.slice(0, 1), more: tags.slice(1) };
}

export function tileTagChips(tags: readonly CoinTag[], created?: number | null): HTMLElement[] {
  const { shown, more } = tileTagPlan(tags);
  const chips = tagChips(shown, created);
  // Release walk 12 Nov: on a tile the number shortens (5,243 -> 5.2K) so the words "coins created" always fit whole.
  if (typeof created === "number" && created >= 1000) {
    for (const c of chips) {
      const n = c.querySelector(".tagnum");
      if (n) {
        n.textContent = created >= 10000 ? `${Math.round(created / 1000)}K` : `${(created / 1000).toFixed(1)}K`;
        c.title = `${created.toLocaleString("en-US")} coins created. ${c.title}`;
      }
    }
  }
  if (more.length) {
    const m = document.createElement("span");
    m.className = "tagchip tag-more";
    m.textContent = `+${more.length}`;
    m.title = more.map((t) => `${chipWords(t, created)}: ${TAG_WORDS[t].means}`).join(" ");
    chips.push(m);
  }
  return chips;
}
