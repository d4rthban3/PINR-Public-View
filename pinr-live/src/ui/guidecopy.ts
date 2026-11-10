/**
 *
 *
 * list only; the page draws whatever is here, in this order. Public wording follows PINR-HQ.md section 5 (no promises,
 *
 */
export interface GuideBlock {
  /** "p" is a paragraph, "li" a bullet. */
  kind: "p" | "li";
  /** A short bold opening (a page name, a kind of trader), or none. */
  lead?: string;
  text: string;
}

export interface GuideSection {
  title: string;
  blocks: GuideBlock[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Where everything is",
    blocks: [
      { kind: "p", lead: "PINR", text: "is the home page: live coins as tiles, each with its picture, a small price line and its Token health. Pick a launchpad and one of its lists at the top." },
      { kind: "p", lead: "Discover", text: "is search. Type a ticker, a name, a contract address or a link, or browse the launchpads' lists." },
      { kind: "p", lead: "DeepScan", text: "is one coin's full page. Tap any coin to open it: chart, trades, the paper trail, checks, the pool's history, PINRai's reading and links." },
      { kind: "p", lead: "PvP Arena", text: "shows competing versions of the same coin side by side." },
      { kind: "p", lead: "Wallet", text: "looks up a wallet's public activity. It is read-only: PINR never asks you to connect, sign or send." },
      { kind: "p", lead: "The map:", text: "the compass at the bottom zooms out to every room at once." },
    ],
  },
  {
    title: "Why it is laid out this way",
    blocks: [
      { kind: "p", text: "New coins move in seconds. The tiles put the picture, the price line and the evidence in the same place, so the facts are there at the moment you look, not three clicks away." },
    ],
  },
  {
    title: "What Token health is, and is not",
    blocks: [
      { kind: "p", text: "Token health is a reading of what PINR's checks found, shown with its coverage: how much was actually read. A low-coverage reading is early and says so. It is not a verdict: it does not say a coin is good, and it says nothing about price." },
    ],
  },
  {
    title: "How to read a coin",
    blocks: [
      { kind: "li", lead: "●", text: "observed on chain, with the transaction to open." },
      { kind: "li", lead: "○", text: "reported somewhere else (an X post, a launchpad's page, someone's label), with where it was said." },
      { kind: "li", lead: "not checked yet / not read yet / —:", text: "PINR has not read it. A blank never means \"nothing there\"." },
      { kind: "li", lead: "Copy tag:", text: "this coin copies an earlier one. Copies live in the PvP Arena; only a battle's leading version stays on the lists." },
      { kind: "li", lead: "Serial launcher tag:", text: "the creator has launched many coins. The coin still shows like any other." },
      { kind: "li", text: "X findings say who read them: **GrokBot (X search)** or **Cursor (X, browser)**." },
    ],
  },
  {
    title: "The lists",
    blocks: [
      { kind: "p", text: "The lists follow each launchpad's own lists and names. Where a launchpad's list cannot be read, PINR builds its own and labels it **PINR's list**, with how it is ordered." },
      { kind: "p", text: "Some coins leave the lists, and their contract address still finds them in search: a coin with no trade for a day (its next trade brings it back), a copy that is not leading its battle (it is in the Arena), and a coin launched with clear bot patterns (with the tag that says why)." },
    ],
  },
  {
    title: "What PINR does for you",
    blocks: [
      { kind: "p", text: "It reads every free public source for a coin, keeps it as a paper trail with links, checks every new coin for copies and relaunches before anything else, and says what it observed in plain words. PINRai adds a reading of what the developer appears to intend, in fixed sentences with their receipts." },
    ],
  },
  {
    title: "What PINR does not do",
    blocks: [
      { kind: "p", text: "PINR does not give financial advice, predict prices, rank coins as buys, hold your money or touch your wallet. It describes what was observed; what you do with it is your call." },
    ],
  },
];

/**
 *
 * for the day the switch is turned on; this is the wording used while it is off. It is NEW public copy (it only removes claims that would be false and
 *
 */
const HUB_TITLES_DROPPED = new Set(["What Token health is, and is not"]);
const HUB_BLOCKS: Record<string, { lead?: string; text: string }> = {
  PINR: { lead: "PINR", text: "is the home page: live coins as tiles, each with its picture and a small price line. Pick a launchpad and one of its lists at the top." },
};

/** The guide's sections as the site shows them now: the approved text, or the hidden-score wording. */
export function guideSections(shown: boolean): GuideSection[] {
  if (shown) return GUIDE_SECTIONS;
  return GUIDE_SECTIONS.filter((s) => !HUB_TITLES_DROPPED.has(s.title)).map((s) => ({
    title: s.title,
    blocks: s.blocks.map((b) => {
      const alt = HUB_BLOCKS[b.lead ?? ""];
      return alt ? { kind: b.kind, lead: alt.lead, text: alt.text } : b;
    }),
  }));
}

