import Foundation

//
/// Pump.fun, Flap and Four.meme refuse every reader we can use for free, so their lists here are PINR's own, built from the coins PINR lists.
/// A plain sort (New, Market cap, Oldest, Last trade) carries the launchpad's name; a ranked board (Movers, Trending, Hot) is labelled
/// "PINR's list" with the ordering said in words. A coin with no figure for a list goes last: never first, never a zero.
struct LaunchList: Identifiable, Hashable, Sendable {
    enum Kind: Sendable { case sort, pinr, own }
    let id: String
    let name: String
    let kind: Kind
    let order: String
}

struct Launchpad: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    /// The launchpad's mark; none for a launchpad whose own list is read (its coins are the list's).
    let mark: Mark?
    let lists: [LaunchList]
    /// True for a launchpad whose OWN lists the engine reads (Zora, Clanker, BONKfun): shown in the launchpad's own order.
    var own = false
}

/// One chosen list: a launchpad and one of its lists.
struct ListChoice: Hashable, Sendable {
    let lp: String
    let list: String
}

enum Lists {
    private static let sorts: [LaunchList] = [
        .init(id: "new", name: "New", kind: .sort, order: "newest first"),
        .init(id: "marketcap", name: "Market cap", kind: .sort, order: "biggest market cap first"),
        .init(id: "lasttrade", name: "Last trade", kind: .sort, order: "most recent trade first"),
    ]

    static let launchpads: [Launchpad] = [
        .init(id: "pumpfun", name: "Pump.fun", mark: .pump, lists: [
            .init(id: "movers", name: "Movers", kind: .pinr, order: "biggest 24h price move first, up or down"),
        ] + sorts + [.init(id: "oldest", name: "Oldest", kind: .sort, order: "oldest first")]),
        .init(id: "flap", name: "Flap", mark: .flap, lists: [
            .init(id: "trending", name: "Trending", kind: .pinr, order: "most trades in the last hour first"),
        ] + sorts),
        .init(id: "fourmeme", name: "Four.meme", mark: .fourmeme, lists: [
            .init(id: "hot", name: "Hot", kind: .pinr, order: "most trades in the last hour first"),
        ] + sorts),
    ]

    //
    static let defaultChoice = ListChoice(lp: "pumpfun", list: "movers")

    /// The launchpads whose own lists the engine reads (`/api/lists`), set when they arrive; their order is kept as ranks.
    nonisolated(unsafe) private static var ownPads: [Launchpad] = []
    nonisolated(unsafe) private static var ownRanks: [String: [String: Int]] = [:]
    static var all: [Launchpad] { launchpads + ownPads }

    static func launchpad(_ id: String) -> Launchpad? { all.first { $0.id == id } }

    /// Takes the launchpads' own lists in, and returns the coins as tokens the page can hold (a coin the page already has keeps its own figures).
    static func setOwn(_ doc: OwnListsDoc, feedBase: URL?) -> [Token] {
        var pads: [Launchpad] = []
        var ranks: [String: [String: Int]] = [:]
        var tokens: [String: Token] = [:]
        for lp in doc.launchpads {
            var lists: [LaunchList] = []
            for l in lp.lists.sorted(by: { ($0.isDefault ?? false) && !($1.isDefault ?? false) }) {
                lists.append(.init(id: l.id, name: l.name, kind: .own, order: "the launchpad's own order"))
                ranks["\(lp.id):\(l.id)"] = Dictionary(l.coins.map { ($0.id.lowercased(), $0.rank) }, uniquingKeysWith: { a, _ in a })
                for c in l.coins where tokens[c.id.lowercased()] == nil {
                    var o: [String: Any] = ["address": c.id, "coverage": 0, "launchpad": lp.name, "note": "Not scored yet", "asOfMs": Date().timeIntervalSince1970 * 1000]
                    if let ch = c.chain ?? lp.chain { o["chain"] = ch }
                    if let v = c.name { o["name"] = v }
                    if let v = c.ticker { o["ticker"] = v }
                    if let v = c.mcapUsd { o["valuationUsd"] = v }
                    if let v = c.createdMs { o["launchedAtMs"] = v }
                    if let v = c.lastTradeMs { o["lastTradeMs"] = v }
                    if let v = c.imageUrl { o["imageUrl"] = v }
                    guard let data = try? JSONSerialization.data(withJSONObject: o), let w = try? JSONDecoder().decode(WireToken.self, from: data),
                          case .success(let t) = Token.make(from: w, feedBase: feedBase) else { continue }
                    tokens[c.id.lowercased()] = t
                }
            }
            pads.append(Launchpad(id: lp.id, name: lp.name, mark: nil, lists: lists, own: true))
        }
        ownPads = pads
        ownRanks = ranks
        return Array(tokens.values)
    }
    static func spec(_ c: ListChoice) -> (lp: Launchpad, list: LaunchList)? {
        guard let lp = launchpad(c.lp), let l = lp.lists.first(where: { $0.id == c.list }) else { return nil }
        return (lp, l)
    }
    static func first(of lp: Launchpad) -> ListChoice { ListChoice(lp: lp.id, list: lp.lists[0].id) }

    /// What the page says it is showing: the launchpad's name for a plain sort, "PINR's list" for a ranked board; the order in words.
    static func label(_ c: ListChoice) -> (title: String, order: String, pinr: Bool)? {
        guard let s = spec(c) else { return nil }
        return s.list.kind == .pinr
            ? ("\(s.lp.name) · \(s.list.name) (PINR's list)", s.list.order, true)
            : ("\(s.lp.name) · \(s.list.name)", s.list.order, false)
    }

    /// The number a list orders by (bigger first); nil when the coin has none.
    private static func measure(_ id: String, _ t: Token, now: Date) -> Double? {
        switch id {
        case "movers": return t.change24hPct.map(abs)
        case "trending", "hot": return t.flow.map { Double($0.trades1h) }
        case "new": return t.launchedAt.map { -max(0, now.timeIntervalSince($0)) }
        case "oldest": return t.launchedAt.map { max(0, now.timeIntervalSince($0)) }
        case "marketcap": return t.valuationUsd
        case "lasttrade": return t.lastTrade?.timeIntervalSince1970
        default: return nil
        }
    }

    /// The coins of one list, in order (a coin without the figure goes after those with it, in the feed's order).
    static func rank(_ c: ListChoice, _ tokens: [Token], now: Date = Date(), limit: Int) -> [Token] {
        guard let s = spec(c) else { return [] }
        if s.lp.own {
            // The launchpad's own list: its coins in its own order (a coin the page does not hold yet is not drawn).
            let ranks = ownRanks["\(c.lp):\(c.list)"] ?? [:]
            return Array(tokens.filter { ranks[$0.address.lowercased()] != nil }.sorted { ranks[$0.address.lowercased()]! < ranks[$1.address.lowercased()]! }.prefix(limit))
        }
        let rows = tokens.enumerated().filter { Mark.pad($0.element) == s.lp.mark }.map { (i: $0.offset, t: $0.element, m: measure(s.list.id, $0.element, now: now)) }
        let sorted = rows.sorted { a, b in
            switch (a.m, b.m) {
            case let (x?, y?) where x != y: return x > y
            case (nil, _?): return false
            case (_?, nil): return true
            default: return a.i < b.i
            }
        }
        return Array(sorted.prefix(limit).map(\.t))
    }
}

/// `/api/lists` as the server sends it (server/launchlists.ts): the launchpads' own lists, each coin with its rank in the launchpad's own order.
struct OwnListsDoc: Decodable, Sendable {
    struct Coin: Decodable, Sendable { let id: String; let rank: Int; let name: String?; let ticker: String?; let mcapUsd: Double?; let createdMs: Double?; let lastTradeMs: Double?; let chain: String?; let imageUrl: String? }
    struct List: Decodable, Sendable { let id: String; let name: String; let isDefault: Bool?; let coins: [Coin]
        private enum CodingKeys: String, CodingKey { case id, name, coins, isDefault = "default" } }
    struct Pad: Decodable, Sendable { let id: String; let name: String; let chain: String?; let lists: [List] }
    let launchpads: [Pad]
}
