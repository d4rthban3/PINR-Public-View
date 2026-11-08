import Foundation

//
/// (`world/livefeed.ts`): its price becomes the trade's price, its market cap is scaled by newPrice / oldPrice (supply is fixed; a coin with
/// no cap keeps none), its line and ribbon take the trade. The figures a slower list message brings do not undo it for a minute.
enum LiveFold {
    /// How long a trade's price is kept over a list price that is older than it.
    static let holdSeconds: TimeInterval = 60
}

extension Token {
    /// This coin at `price`: the price, the market cap scaled by the move (only when both an old price and a cap are known), and the line's newest point.
    func repriced(to price: Double) -> Token {
        guard price > 0, price.isFinite else { return self }
        var t = self
        if let old = priceUsd, old > 0, let cap = valuationUsd, cap >= 0 { t.valuationUsd = cap * price / old }
        t.priceUsd = price
        t.priceSeries = priceSeries.map { LiveCandle.head($0, price: price) }
        return t
    }

    /// This coin after one trade: repriced, the ribbon's figures and trade counts taking it (dollars, or a count where the feed gave counts),
    /// and the time of its last trade.
    func folded(_ trade: LiveTick) -> Token {
        // As the site (livefeed.ts): only a trade at least as new as the coin's last one sets the price and the time; an older one still counts in the ribbon.
        let newest = lastTrade.map { trade.at >= $0 } ?? true
        var t = newest ? repriced(to: trade.price) : self
        if newest { t.lastTrade = trade.at }
        if let f = flow, let buy = trade.isBuy {
            let amount = f.isCount ? 1 : (trade.usd.flatMap { $0 > 0 && $0.isFinite ? $0 : nil } ?? 0)
            t.flow = Flow(buy5m: f.buy5m + (buy ? amount : 0), sell5m: f.sell5m + (buy ? 0 : amount),
                          buy1h: f.buy1h + (buy ? amount : 0), sell1h: f.sell1h + (buy ? 0 : amount),
                          trades5m: f.trades5m + 1, trades1h: f.trades1h + 1, isCount: f.isCount, complete: f.complete)
        }
        return t
    }
}

//
/// `hearTrade`): the last 40 heard within 15 seconds, for a ribbon to turn each into one dot, and when the coin last traded. A coin heard
/// within 30 minutes is "real"; before any trade, or after, a ribbon has nothing to draw. Nothing here is observed by SwiftUI: a drawer reads it
/// each frame, so a burst of trades never redraws a screen.
@MainActor
final class RealTrades {
    struct Heard: Equatable {
        /// when the app heard it
        let at: Date
        let buy: Bool
        /// 0...1 from the dollars, as the site's `sizeOfTrade`
        let size: Double
    }
    private struct Coin {
        var trades: [Heard] = []
        var lastRealAt: Date?
        var heardAt: Date = .distantPast
    }

    static let keepCount = 40
    static let keepSeconds: TimeInterval = 15
    static let realFor: TimeInterval = 30 * 60
    static let maxCoins = 3000
    private var coins: [String: Coin] = [:]

    /// The site's size of a trade: log of its dollars, a small fixed size when the dollars are unknown.
    static func size(usd: Double?) -> Double {
        guard let usd, usd.isFinite, usd > 0 else { return 0.05 }
        return min(1, log10(1 + usd) / 3)
    }

    /// One trade from the stream (a price alone, with no side, is not a trade).
    func hear(_ tick: LiveTick, heard: Date = Date()) {
        guard let buy = tick.isBuy else { return }
        let key = tick.address.lowercased()
        var c = coins[key] ?? Coin()
        c.trades.append(Heard(at: heard, buy: buy, size: Self.size(usd: tick.usd)))
        while c.trades.count > Self.keepCount || (c.trades.first.map { heard.timeIntervalSince($0.at) > Self.keepSeconds } ?? false) { c.trades.removeFirst() }
        if c.lastRealAt.map({ tick.at > $0 }) ?? true { c.lastRealAt = tick.at }
        c.heardAt = heard
        coins[key] = c
        if coins.count > Self.maxCoins {
            for (k, _) in coins.sorted(by: { $0.value.heardAt < $1.value.heardAt }).prefix(coins.count - Self.maxCoins + 200) where k != key { coins[k] = nil }
        }
    }

    /// The trades heard for a coin lately, oldest first (each drawer keeps its own cursor and takes each once).
    func trades(_ address: String) -> [Heard] { coins[address.lowercased()]?.trades ?? [] }
    /// When the coin's latest real trade happened (its own time), or nil.
    func lastRealAt(_ address: String) -> Date? { coins[address.lowercased()]?.lastRealAt }
    /// True while the coin has had a real trade heard in the last 30 minutes.
    func isReal(_ address: String, now: Date = Date()) -> Bool {
        guard let c = coins[address.lowercased()] else { return false }
        return now.timeIntervalSince(c.heardAt) < Self.realFor
    }
}
