> [!WARNING]
> **Work in progress.** PINR is live at pinr.io but early and unfinished. It runs on free nodes that can only fully scan a few coins a minute, so most coins are read but not fully scanned. Readings can be incomplete or wrong because PINR needs more data. Paid data streams are what get it to full coverage, and community funding pays for those.

# PINR

PINR is an evidence hub for memecoins. For any token it lays out every link, wallet, funder, holder and trade behind it, each one with its receipt: where the fact was read, and when, so anyone can check it at the source.

PINR is a doctor, not a judge. It shows what was observed and never gives verdicts: it never calls a coin good or bad, never tells anyone to buy or sell, and makes no promises about any coin. It is read-only. It never connects to, signs for, or moves anything in anyone's wallet.

Live at **https://pinr.io**.

> **Early and unfinished.** This is a working project, not a finished product. Things change often, some parts are rough, and some tests exercise code that is not in this copy.

## What is in this repository

The public copy shows what PINR looks like and what it presents. How PINR runs and how it reads are private.

| Folder | What it is |
|---|---|
| `pinr-live/src`, `pinr-live/public` | The website as a visitor sees it (Vite + TypeScript): pages, evidence presentation, styles and brand art. |
| `pinr-ios/PINR` | The iPhone app source (SwiftUI). |
| `pinr-android/app/src` | The Android app source (Kotlin, Jetpack Compose). |

### What is withheld

PINR keeps two kinds of material private:

- **Operational:** schedules, queues, servers, deploys, limits and caps, settings, keys, hosts, workers and the control module.
- **Proprietary:** scoring, the gate, detection and matching methods, the AI readers and their prompts, calibration and tuning.

That covers the whole engine (readers, exporters, scanner), the feed server, build and deploy files, tests and test data. This copy is not a complete build.

## Status

PINR is a work in progress. The site at https://pinr.io is live, but it is early and unfinished.

- PINR currently runs on free nodes, which can only fully scan a few coins a minute.
- Most coins are read but not fully scanned, so readings can be incomplete or wrong.
- Every fact shown still carries its receipt, so you can check it at the source.
- Bug reports are welcome: if a reading looks off, tell us.

## Help fund the data

Full coverage needs paid data streams: RPC nodes and indexers that can scan every coin, not just a few a minute. Community funding is what pays for those.

If you want to help fund the data streams, reach out via [@PINRofficial](https://x.com/PINRofficial) on X. Founders: @d4rthban3(d4rthban3). @MehMintMake(Coozin)

## Feedback

Questions, bug reports and ideas are welcome on X: [@PINRofficial](https://x.com/PINRofficial) and [@PINRsupport](https://x.com/PINRsupport).

## License

MIT: see `LICENSE`. Third-party files keep their own licenses (`THIRD-PARTY-NOTICES.md`). The PINR name and logos are not licensed as trademarks.
