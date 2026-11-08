import Foundation

// What the feed server answers for ONE coin (pinr-live/server/server.ts, market.ts, trades.ts,
// events.ts, dossier.ts, social.ts). Every reader is lenient: a bad row is dropped, never guessed.

/// One candle: open, high, low, close at a time, and the dollar volume.
struct Candle: Equatable, Sendable {
    let time: Date
    let open, high, low, close, volume: Double
}

/// The chart's timeframes, as the site's terminal offers them.
enum Timeframe: String, CaseIterable, Identifiable, Sendable {
    case m1 = "1m", m5 = "5m", m15 = "15m", h1 = "1h", h4 = "4h", d1 = "1D"
    var id: String { rawValue }
}

/// One point of the price line.
struct LinePoint: Identifiable, Equatable, Sendable {
    let time: Date
    let price: Double
    var id: Date { time }
}

//
/// through each close, so a young coin's first jump shows and the line starts where the change is measured from (as on the site).
func lineFromOpen(_ c: [Candle], bucket: Double) -> [LinePoint] {
    guard let f = c.first else { return [] }
    let half = max(1, bucket) / 2
    return [LinePoint(time: f.time.addingTimeInterval(-half), price: f.open)] + c.map { LinePoint(time: $0.time, price: $0.close) }
}

struct CandleSet: Sendable, Equatable {
    //
    enum Status: String, Sendable { case ok, none, busy, error, stale }
    let candles: [Candle]
    let source: String?
    let status: Status
    /// Only for `stale`: when the candles were really read. Nil when they are current.
    var asOf: Date? = nil
    //
    var bucketSec: Double? = nil

    /// Candles worth drawing: current ones, or stale ones that say when they were read.
    var drawable: Bool { (status == .ok || status == .stale) && candles.count >= 2 }

    /// "as of 2:32 PM" beside any figure taken from stale candles; nil when they are current.
    var asOfText: String? { status == .stale ? asOf.map(Format.asOf) : nil }

    /// The candles the chart draws: the newest 80, as on the site.
    var shown: [Candle] { Array(candles.suffix(80)) }

    /// The price range of the candles drawn, so they fill the chart's height.
    var range: ClosedRange<Double>? {
        guard let lo = shown.map(\.low).min(), let hi = shown.map(\.high).max(), lo > 0 else { return nil }
        return lo...max(hi, lo * 1.0001)
    }

    /// The site's rule: a log scale when the highest price drawn is over six times the lowest.
    var logScale: Bool { range.map { $0.upperBound / $0.lowerBound > 6 } ?? false }
}

struct WireCandles: Decodable, Sendable {
    let source: String?
    let status: String?
    let asOfMs: Double?
    let candles: [[Double?]]?
    let bucketSec: Double?

    private enum Key: String, CodingKey { case source, status, asOfMs, candles, bucketSec }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        source = (try? c.decodeIfPresent(String.self, forKey: .source)) ?? nil
        status = (try? c.decodeIfPresent(String.self, forKey: .status)) ?? nil
        asOfMs = (try? c.decodeIfPresent(Double.self, forKey: .asOfMs)) ?? nil
        candles = (try? c.decodeIfPresent([[Double?]].self, forKey: .candles)) ?? nil
        bucketSec = (try? c.decodeIfPresent(Double.self, forKey: .bucketSec)) ?? nil
    }

    /// Rows of six finite numbers with positive prices and high above low, oldest first; anything else is dropped.
    var set: CandleSet {
        let rows = (candles ?? []).compactMap { r -> Candle? in
            guard r.count == 6, let t = r[0], let o = r[1], let h = r[2], let l = r[3], let cl = r[4], let v = r[5],
                  [t, o, h, l, cl, v].allSatisfy(\.isFinite), t > 0, o > 0, h > 0, l > 0, cl > 0, v >= 0, h >= l else { return nil }
            return Candle(time: Date(timeIntervalSince1970: t), open: o, high: h, low: l, close: cl, volume: v)
        }.sorted { $0.time < $1.time }
        // The contract: a status the app does not know is `busy` (no chart), never current. So is a `stale` answer
        // without a real read time, since it could not say how old it is.
        let read = asOfMs.flatMap { $0.isFinite && $0 > 0 ? Date(timeIntervalSince1970: $0 / 1000) : nil }
        var st = CandleSet.Status(rawValue: status ?? "") ?? .busy
        if st == .stale && read == nil { st = .busy }
        return CandleSet(candles: rows, source: source.flatMap { $0.isEmpty ? nil : $0 }, status: st,
                         asOf: st == .stale ? read : nil, bucketSec: bucketSec.flatMap { $0.isFinite && $0 > 0 ? $0 : nil })
    }
}

/// A dated engine event on the chart (a score or flag change): plain text only.
struct ChartEvent: Decodable, Equatable, Sendable, Identifiable {
    let t: Double
    let kind: String
    let tone: String
    let text: String
    /// Score before and after, for score events.
    var from: Double? = nil
    var to: Double? = nil
    var id: String { "\(t)-\(kind)" }
    var time: Date { Date(timeIntervalSince1970: t) }
}

//
struct EventMark: Identifiable, Equatable {
    let time: Date
    let price: Double
    let tone: String
    let text: String
    var id: String { "\(time.timeIntervalSince1970)-\(text)" }

    /// At most this many on one chart, the newest kept.
    static let maxMarks = 8
    private static let kindWords = ["score_up": "Token health moved up", "score_down": "Token health moved down", "flag_raised": "Flag raised",
                                    "flag_cleared": "Flag cleared", "surge": "Surge", "verified": "Verified", "note": "Note"]
    private static let clock: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "h:mm a"
        return f
    }()
    private static let dated: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d, h:mm a"
        return f
    }()

    /// Each event inside the candles' span sits on the last candle at or before it, at its close, labelled with its own words, its scores
    /// when it moved one, and its time. Events off the chart are left out; nothing is invented.
    static func marks(_ events: [ChartEvent], candles: [Candle], bucket: TimeInterval) -> [EventMark] {
        guard let first = candles.first?.time, let last = candles.last?.time else { return [] }
        let end = last.addingTimeInterval(max(1, bucket))
        // A chart of a day or less says the clock time; a longer one the date too (as the site).
        let when = last.timeIntervalSince(first) <= 36 * 3600 ? clock : dated
        var out: [EventMark] = []
        var k = 0
        for e in events where e.time >= first && e.time < end {
            while k + 1 < candles.count && candles[k + 1].time <= e.time { k += 1 }
            //
            let words = (e.kind == "score_up" || e.kind == "score_down") ? (kindWords[e.kind] ?? e.kind) : (e.text.isEmpty ? (kindWords[e.kind] ?? e.kind) : e.text)
            let scores = (e.from).flatMap { f in e.to.map { " \(Int(f)) → \(Int($0))" } } ?? ""
            out.append(EventMark(time: candles[k].time, price: candles[k].close, tone: e.tone, text: "\(words)\(scores) · \(when.string(from: e.time))"))
        }
        return Array(out.suffix(maxMarks))
    }
}

struct WireEvents: Decodable, Sendable {
    let events: [ChartEvent]
    private enum Key: String, CodingKey { case events }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        // Each entry is read exactly once; one that cannot be read, or has no real date, is dropped.
        let list = try c.decode([Lenient<ChartEvent>].self, forKey: .events)
        events = list.compactMap(\.value).filter { $0.t.isFinite && $0.t > 0 }.sorted { $0.t < $1.t }
    }
}


/// One trade on the tape: when, buy or sell, and its size in dollars.
struct Trade: Equatable, Sendable, Identifiable {
    let time: Date
    let buy: Bool
    let usd: Double
    let index: Int
    //
    var tx: String? = nil
    var id: Int { index }

    //
    static func explorerURL(chain: String?, tx: String?) -> URL? {
        guard let tx else { return nil }
        let evm = tx.range(of: "^0x[0-9a-fA-F]{64}$", options: .regularExpression) != nil
        let sol = tx.range(of: "^[1-9A-HJ-NP-Za-km-z]{64,90}$", options: .regularExpression) != nil
        switch chain {
        case "solana": return sol ? URL(string: "https://solscan.io/tx/\(tx)") : nil
        case "bsc": return evm ? URL(string: "https://bscscan.com/tx/\(tx)") : nil
        case "base": return evm ? URL(string: "https://basescan.org/tx/\(tx)") : nil
        default: return nil
        }
    }
}

struct Tape: Sendable, Equatable {
    /// Newest first.
    let trades: [Trade]
    /// True only when the list holds every trade in its window.
    let complete: Bool
    let summary: Token.Flow?
    /// The feed has no trade list for this coin (yet, or for its chain).
    let none: Bool
    //
    var asOf: Date? = nil
    var source: String? = nil

    /// The receipt names where the rows were read, and says nothing about a source it was not told.
    static func sourceLabel(_ source: String?) -> String? {
        switch source {
        case "pinr": "PINR's trade feed"
        case "pumpfun": "Pump.fun"
        default: nil
        }
    }
}

struct WireTape: Decodable, Sendable {
    let none: Bool
    let complete: Bool
    let rows: [Trade]
    let summary: WireFlow?
    let asOf: Double?
    let source: String?

    private enum Key: String, CodingKey { case none, complete, trades, summary, asOf, source }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        none = (try? c.decodeIfPresent(Bool.self, forKey: .none)) ?? true
        complete = (try? c.decodeIfPresent(Bool.self, forKey: .complete)) ?? false
        summary = (try? c.decodeIfPresent(WireFlow.self, forKey: .summary)) ?? nil
        asOf = ((try? c.decodeIfPresent(Double.self, forKey: .asOf)) ?? nil).flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        source = (try? c.decodeIfPresent(String.self, forKey: .source)) ?? nil
        // Each row is read exactly once: [time, "buy" or "sell", dollars above zero]; anything else is dropped.
        let list = ((try? c.decodeIfPresent([Lenient<Row>].self, forKey: .trades)) ?? nil) ?? []
        rows = list.enumerated().compactMap { i, r in
            r.value.map { Trade(time: Date(timeIntervalSince1970: $0.t), buy: $0.buy, usd: $0.usd, index: i, tx: $0.tx) }
        }
    }

    private struct Row: Decodable {
        let t: Double, buy: Bool, usd: Double, tx: String?
        init(from decoder: Decoder) throws {
            var c = try decoder.unkeyedContainer()
            t = try c.decode(Double.self)
            let side = try c.decode(String.self)
            usd = try c.decode(Double.self)
            //
            tx = c.isAtEnd ? nil : (try? c.decode(String.self))
            guard t.isFinite, t > 0, usd.isFinite, usd > 0, side == "buy" || side == "sell" else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "not a trade row"))
            }
            buy = side == "buy"
        }
    }

    var tape: Tape {
        let flow = summary.flatMap { f -> Token.Flow? in
            let figures = [f.buy5m, f.sell5m, f.buy1h, f.sell1h, f.n5m, f.n1h]
            guard figures.allSatisfy({ $0.isFinite && $0 >= 0 }) else { return nil }
            return Token.Flow(buy5m: f.buy5m, sell5m: f.sell5m, buy1h: f.buy1h, sell1h: f.sell1h,
                              trades5m: Int(f.n5m), trades1h: Int(f.n1h), isCount: f.basis == "count", complete: f.complete)
        }
        return Tape(trades: rows.sorted { $0.time > $1.time }, complete: complete, summary: flow, none: none && rows.isEmpty,
                    asOf: asOf.map { Date(timeIntervalSince1970: $0) }, source: source)
    }
}

/// The engine's PINRmetric for one coin (server/metrics.ts): the score over time, a smoothed companion line and the
/// gap between them. Nil when the engine has no file (the pane then says so).
struct Metric: Equatable, Sendable {
    let timeframe: String
    let series: [(t: Date, v: Double)]
    let signal: [(t: Date, v: Double)]
    let histogram: [(t: Date, v: Double)]
    let levels: [Double]

    static func == (a: Metric, b: Metric) -> Bool {
        a.timeframe == b.timeframe && a.series.map(\.v) == b.series.map(\.v) && a.signal.map(\.v) == b.signal.map(\.v)
            && a.histogram.map(\.v) == b.histogram.map(\.v) && a.levels == b.levels
    }
}

struct WireMetric: Decodable, Sendable {
    let metric: Metric?

    private enum Key: String, CodingKey { case metric }
    private struct M: Decodable { let timeframe: String?; let series: [[Double?]]?; let signal: [[Double?]]?; let histogram: [[Double?]]?; let levels: [Double]? }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        guard let m = (try? c.decodeIfPresent(M.self, forKey: .metric)) ?? nil else { metric = nil; return }
        func points(_ rows: [[Double?]]?) -> [(t: Date, v: Double)] {
            (rows ?? []).compactMap { r in
                guard r.count == 2, let t = r[0], let v = r[1], t.isFinite, t > 0, v.isFinite else { return nil }
                return (Date(timeIntervalSince1970: t), v)
            }.sorted { $0.t < $1.t }
        }
        let series = points(m.series)
        // A metric with fewer than two points has nothing to draw: it is absent, not a flat line.
        metric = series.count < 2 ? nil : Metric(timeframe: m.timeframe ?? "", series: series, signal: points(m.signal),
                                                histogram: points(m.histogram), levels: (m.levels ?? []).filter(\.isFinite))
    }
}

/// "Similar tokens" (world/similar.ts): same chain, from measured facts only: market cap and age close to this
/// coin's (in tenfold steps), the same launchpad counting as closer. Never the score.
enum Similar {
    static func tokens(to base: Token, in all: [Token], count: Int = 5, now: Date = Date()) -> [Token] {
        guard let chain = base.chain?.lowercased(), !chain.isEmpty else { return [] }
        let myPad = base.launchpad?.lowercased() ?? ""
        let myAge = base.launchedAt.map { now.timeIntervalSince($0) / 60 }
        var scored: [(t: Token, d: Double, i: Int)] = []
        for (i, t) in all.enumerated() where t.id != base.id && t.chain?.lowercased() == chain {
            let cap = tenfold(base.valuationUsd, t.valuationUsd)
            let age = tenfold(myAge, t.launchedAt.map { now.timeIntervalSince($0) / 60 })
            let samePad = !myPad.isEmpty && myPad == (t.launchpad?.lowercased() ?? "")
            // At least one measured likeness besides the chain; more than about 30 times apart in size is not similar.
            if cap == nil && age == nil && !samePad { continue }
            if let cap, cap > 1.5 { continue }
            scored.append((t, (cap ?? 1) + (age ?? 1) * 0.6 + (samePad ? 0 : 0.5), i))
        }
        return scored.sorted { $0.d != $1.d ? $0.d < $1.d : $0.i < $1.i }.prefix(count).map(\.t)
    }

    /// 0 when equal, growing in tenfold steps apart; nil when either is missing.
    static func tenfold(_ a: Double?, _ b: Double?) -> Double? {
        guard let a, let b, a.isFinite, b.isFinite, a > 0, b > 0 else { return nil }
        return abs(log10(a / b))
    }
}
