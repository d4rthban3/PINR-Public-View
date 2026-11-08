import Foundation

/// A tile's ribbon: one dot for each REAL trade the app heard from the stream, lime for a buy and mandarin for a sell
//
//
struct Ribbon: Equatable, Sendable {
    //
    let lean: Double?

    init(_ flow: Token.Flow?) {
        if let f = flow, f.buy5m + f.sell5m > 0 { lean = (f.buy5m - f.sell5m) / (f.buy5m + f.sell5m) } else { lean = nil }
    }

    /// Ribbon lengths a second (the site's REAL_SPEED): a dot crosses in about 3 seconds.
    static let speed = 0.33
    /// A dot gone past the right edge by this much is not drawn.
    static let pastEdge = 1.08

    /// One heard trade as a dot: where it is (0 = old edge, 1 = now), buy or sell, size 0...1, and its fixed height in the band (0 top, 1 bottom).
    struct Dot: Equatable {
        let u: Double, buy: Bool, size: Double, y: Double
    }

    /// The dots at `now`, from the trades heard for this coin: each is born at the old edge when heard and rides on; a fixed spread per trade, the same on every frame.
    static func dots(_ trades: [RealTrades.Heard], now: Date) -> [Dot] {
        var out: [Dot] = []
        var k = 0, prev: Date?
        for t in trades {
            k = (prev == t.at) ? k + 1 : 0 // trades heard at one instant are a burst: spaced along the ribbon, not stacked (the site's stepReal)
            prev = t.at
            let age = now.timeIntervalSince(t.at)
            guard age >= 0 else { continue }
            let h = (t.at.timeIntervalSinceReferenceDate * 1000).truncatingRemainder(dividingBy: 100_000)
            let u = age * speed + Double(min(k, 10)) * 0.02 + hash(h + Double(k) * 7) * 0.03
            guard u <= pastEdge else { continue }
            out.append(Dot(u: min(u, 1), buy: t.buy, size: t.size, y: (hash(h + 17 + Double(k) * 7) * 3).rounded(.down) / 2 * 0.9 + 0.05 + (hash(h + 31) - 0.5) * 0.12))
        }
        return out
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

    /// How far a trade of this size (0...1) rides from the line, in tile heights: up (negative) for a buy, down for a sell; near "now" (u = 1) it swoops further.
    static let sizeRange = 0.17, swoop = 0.6
    static func sizeOffset(_ size: Double, buy: Bool, u: Double) -> Double {
        let s = min(1, max(0, size))
        let tail = u > 0.82 ? swoop * pow((u - 0.82) / 0.18, 2) : 0
        return (buy ? -1 : 1) * s * sizeRange * (1 + tail)
    }

    /// A fixed spread in 0..<1 for each streak, the same on every frame.
    private static func hash(_ i: Double) -> Double {
        let x = sin(i * 12.9898 + 78.233) * 43758.5453
        return x - x.rounded(.down)
    }
}
