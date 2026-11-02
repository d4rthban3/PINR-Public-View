import Foundation

/// A tile's ribbon: trade streaks, lime for buys and mandarin for sells, in the real mix
/// (pinr-live/src/world/livefeed.ts and flow.ts). No trades in the last hour: no ribbon.
struct Ribbon: Equatable, Sendable {
    /// Share of buys, 0...1.
    let buyShare: Double
    /// How fast the streaks travel, in ribbon lengths a second: calm coins drift, busy ones rush.
    let speed: Double
    /// True when the mix is counted in trades, not dollars (drawn faint).
    let isCount: Bool
    //
    let lean: Double?

    /// Below this many trades a mix means little, so the streaks show an even mix (they still show it trades).
    static let minTrades = 3

    init?(_ flow: Token.Flow?) {
        guard let f = flow, f.trades1h > 0 else { return nil }
        func share(_ b: Double, _ s: Double) -> Double { b + s > 0 ? b / (b + s) : 0.5 }
        let hour = f.trades1h >= Self.minTrades ? share(f.buy1h, f.sell1h) : 0.5
        buyShare = f.trades5m >= Self.minTrades ? share(f.buy5m, f.sell5m) : hour
        let busy = f.trades5m > 0 ? min(1, log10(1 + Double(f.trades5m)) / 2.5) : 0
        speed = 0.05 + 0.35 * busy
        isCount = f.isCount
        lean = f.buy5m + f.sell5m > 0 ? (f.buy5m - f.sell5m) / (f.buy5m + f.sell5m) : nil
    }

    /// Within this of zero the two sides are level (within 5% of each other).
    static let level = 0.05
    /// How far the stream moves at full lean, as a share of the tile's height (the site's LEAN_TILE) and of a Discover ribbon's (LEAN_ROW).
    static let tileShare: CGFloat = 0.12, rowShare: CGFloat = 0.3
    /// The stream's displacement as a share of the ribbon's height, up positive (buyers ahead), down negative, 0 when level or with no tape.
    func shift(_ share: Double) -> Double { // share 1 gives -1...1: the caller scales it to points
        guard let lean, lean.isFinite, abs(lean) > Self.level else { return 0 }
        return max(-1, min(1, lean)) * share
    }
    /// The words for the accessible name: observed, never a verdict.
    var words: String {
        guard let lean else { return "no trades in the last 5 minutes" }
        if abs(lean) <= Self.level { return "balanced" }
        return lean > 0 ? "buyers ahead" : "sellers ahead"
    }

    /// Streaks on one ribbon length (fixed, so a faster ribbon never looks thicker).
    static let streaks = 12

    /// Where streak `i` is at time `t` (0 = oldest edge, 1 = now) and whether it is a buy.
    func streak(_ i: Int, at t: Double) -> (u: Double, buy: Bool) {
        let seed = Self.hash(i)
        let u = (seed + t * speed).truncatingRemainder(dividingBy: 1)
        return (u, Self.hash(i + 7919) < buyShare)
    }

    /// Each streak's height in the band (0 top, 1 bottom) and its size (0 small, 1 big): fixed per streak.
    static func lane(_ i: Int) -> (y: Double, size: Double) { (hash(i + 104_729), hash(i + 1_299_709)) }

    /// How far a trade of this size (0...1) rides from the line, in tile heights: up (negative) for a buy, down for a sell; near "now" (u = 1) it swoops further.
    static let sizeRange = 0.17, swoop = 0.6
    static func sizeOffset(_ size: Double, buy: Bool, u: Double) -> Double {
        let s = min(1, max(0, size))
        let tail = u > 0.82 ? swoop * pow((u - 0.82) / 0.18, 2) : 0
        return (buy ? -1 : 1) * s * sizeRange * (1 + tail)
    }

    /// A fixed spread in 0..<1 for each streak, the same on every frame.
    private static func hash(_ i: Int) -> Double {
        let x = sin(Double(i) * 12.9898 + 78.233) * 43758.5453
        return x - x.rounded(.down)
    }
}
