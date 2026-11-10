import type { GuideSection } from "./guidecopy";

/**
 *
 *
 * It follows PINR-HQ.md section 5: a doctor, not a judge; missing stays missing; no price talk; wallets, not people.
 * Same shape as the guide's sections (guidecopy.ts); `**...**` is bold, drawn as text, never as HTML.
 */
export const WHITEPAPER_SECTIONS: GuideSection[] = [
  {
    title: "What PINR is",
    blocks: [
      {
        kind: "p",
        text: "PINR is an evidence hub for new crypto coins. For every coin it can, it reads every free public source, keeps what it found as a paper trail, and shows it to you in plain words with a link to where each piece came from.",
      },
      {
        kind: "p",
        text: "New coins launch by the thousand every day. Most traders decide in seconds, from a picture, a name and a chart. PINR puts the facts behind a coin next to that picture, so the look of a coin is not the only thing you see.",
      },
    ],
  },
  {
    title: "A doctor, not a judge",
    blocks: [
      {
        kind: "p",
        text: "PINR says what it observed. It does not give verdicts. You will read words like **observed**, **not checked yet** and **worth a closer look**, never \"safe\", \"scam\" or a price prediction. What you do with the evidence is your call.",
      },
      {
        kind: "p",
        text: "PINR talks about wallets and what they did, never about who a person is.",
      },
    ],
  },
  {
    title: "The paper trail",
    blocks: [
      {
        kind: "p",
        text: "Every fact PINR shows has the same parts: who sent it, who received it, what it was, how much, when, and a link to the record.",
      },
      { kind: "li", lead: "● Observed on chain", text: "read from the blockchain itself, with the transaction you can open." },
      { kind: "li", lead: "○ Reported", text: "said somewhere else: a post on X, a launchpad's own page, or someone else's label. PINR shows where it was said and does not treat it as proven." },
      {
        kind: "p",
        text: "Findings from X carry who read them: **GrokBot (X search)** for posts found through Grok's own search, and **Cursor (X, browser)** for posts read in a browser. Both are reported (○).",
      },
    ],
  },
  {
    title: "Missing stays missing",
    blocks: [
      {
        kind: "p",
        text: "When PINR has not read something yet, it says so: **not checked yet**, **not read yet**, or a dash where a figure has not been measured. It never fills a gap with a guess or a zero. A blank on PINR means \"not read\", not \"nothing there\".",
      },
    ],
  },
  {
    title: "Token health",
    blocks: [
      {
        kind: "p",
        text: "Token health is a reading of what PINR's checks found on a coin, shown with its **coverage**: how much of the evidence was actually read. A reading with low coverage is an early reading and says so.",
      },
      {
        kind: "p",
        text: "It is a reading, not a verdict. A higher reading means fewer worrying patterns were observed in what was read. It does not mean a coin is good, and it says nothing about where its price will go.",
      },
    ],
  },
  {
    title: "The gate",
    blocks: [
      {
        kind: "p",
        text: "Before PINR spends time reading a coin's social posts or writing about it, every coin passes a gate. The gate looks at the coin's own data for copies of earlier coins, relaunches of the same coin, and wallets that launch coin after coin. What the gate observed is shown on the coin's page.",
      },
    ],
  },
  {
    title: "PINRai",
    blocks: [
      {
        kind: "p",
        text: "PINRai is PINR's AI reading of what a coin's developer appears to intend, built only on the evidence PINR collected. On the site it speaks in fixed plain sentences, each with the receipts it was built from. It describes what was observed; it does not judge the coin or advise anyone.",
      },
    ],
  },
  {
    title: "What leaves the lists, and how to find it",
    blocks: [
      { kind: "li", lead: "Quiet coins", text: "a coin with no trade for a day leaves the lists. Nothing is deleted: search its contract address to find it, and its next trade brings it back." },
      { kind: "li", lead: "Copies", text: "when several versions of a coin compete, they meet in the **PvP Arena**, each with its copy tag. The leading version stays on the lists; the others live in the Arena. A coin whose picture only looks like another's stays listed, with a note saying so." },
      { kind: "li", lead: "Bot launches", text: "a coin launched with clear bot patterns leaves the lists. Its contract address still finds it, with the tag that says why." },
      { kind: "p", text: "Serial launchers are not hidden: their coins show like any other, with a tag that says how many coins the creator has launched." },
    ],
  },
  {
    title: "Where the data comes from",
    blocks: [
      {
        kind: "p",
        text: "PINR reads public sources that anyone could check: the blockchains themselves (Solana, Base and BNB Chain), the launchpads' own public lists and pages, public market data, and public posts on X. Each figure on the site names its source.",
      },
      {
        kind: "p",
        text: "The lists follow each launchpad's own lists and names. Where a launchpad's list cannot be read, PINR builds its own version and labels it **PINR's list**, with how it is ordered.",
      },
    ],
  },
  {
    title: "The pages",
    blocks: [
      { kind: "li", lead: "PINR", text: "the home view: live coins as tiles, with their pictures, charts and Token health." },
      { kind: "li", lead: "Discover", text: "search any coin by ticker, name, contract address or link, and browse the launchpads' lists." },
      { kind: "li", lead: "DeepScan", text: "one coin's full page: chart, trades, the paper trail, checks, the pool's history, PINRai's reading and links." },
      { kind: "li", lead: "PvP Arena", text: "competing versions of a coin side by side." },
      { kind: "li", lead: "Wallet", text: "look up a wallet's public activity. It is read-only: PINR never asks you to connect a wallet, sign or send anything." },
      { kind: "li", lead: "The map", text: "the compass at the bottom zooms out to every room at once." },
    ],
  },
  {
    title: "What PINR does not do",
    blocks: [
      {
        kind: "p",
        text: "PINR does not give financial advice, predict prices, rank coins as buys, hold your money or touch your wallet. It does not sell placement: an ad application on PINR is only an application, with no promise of where or how an ad would show.",
      },
    ],
  },
  {
    title: "How PINR works",
    blocks: [
      {
        kind: "p",
        text: "PINR is built like a body: PINRai is the brain, and every reader and check is a part that feeds it or serves you. The map below shows each part and what it does.",
      },
    ],
  },
];
