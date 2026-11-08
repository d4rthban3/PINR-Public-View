import SwiftUI

//
/// more, in clear view, and a Deep Scan button that goes on to the coin's DeepScan page. Observed words only; a missing figure is a dash.
/// Reduce Motion: a short fade instead of the move.
struct FullCard: View {
    let token: Token
    let ns: Namespace.ID
    let insets: RoomInsets
    var close: () -> Void
    var deepScan: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea().onTapGesture(perform: close)
            ScrollView {
                VStack(spacing: 18) {
                    HStack(alignment: .top) {
                        //
                        TileView(token: token, width: 200)
                            .matchedGeometryEffect(id: token.id, in: ns)
                            .frame(width: 200)
                        Spacer(minLength: 0)
                        Button(action: close) {
                            Text("Close").font(Typo.sans(14, .semibold)).foregroundStyle(Brand.paper)
                                .padding(.horizontal, 18).frame(height: 40)
                                .background(Capsule().fill(Brand.fg.opacity(0.09)))
                        }
                        .accessibilityIdentifier("fullcard-close")
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        if let s = token.score { fig("Token health", "\(s) · \(Format.coverage(token.coverage))") }
                        fig("Market cap", Format.usdCompact(token.valuationUsd))
                        fig("All-time high", Format.usdCompact(token.athUsd))
                        fig("24h change", Format.change(token.change24hPct, windowHours: token.changeWindowHours), tone: token.change24hPct.map { $0 >= 0 ? Brand.lime : Brand.mandarin })
                        fig("Price", Format.price(token.priceUsd))
                        fig("24h volume", Format.usdCompact(token.volume24hUsd))
                        fig("Liquidity", Format.usdCompact(token.liquidityUsd))
                        fig("Age", age)
                        fig("Trades, last hour", token.hourTrades.map { $0.formatted(.number.locale(Locale(identifier: "en_US"))) } ?? Format.dash)
                        fig("Pair", (token.quotePair?.isEmpty == false) ? token.quotePair! : Format.dash)
                    }
                    Button(action: deepScan) {
                        Text("Deep Scan").font(Typo.sans(17, .semibold)).foregroundStyle(Brand.onLive)
                            .frame(maxWidth: .infinity).frame(height: 52)
                            .background(Capsule().fill(Brand.lime))
                    }
                    .accessibilityIdentifier("fullcard-deepscan")
                }
                .padding(20)
                .glass(28)
                .padding(.horizontal, 16).padding(.top, insets.top + 8).padding(.bottom, insets.bottom + 20)
            }
            .scrollIndicators(.hidden)
        }
        .transition(reduceMotion ? .opacity : .identity)
        .accessibilityIdentifier("fullcard-\(token.id)")
    }

    private func fig(_ label: String, _ value: String, tone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Typo.mono(12.5)).foregroundStyle(Brand.mute)
            Text(value).font(Typo.mono(20, .semibold)).foregroundStyle(tone ?? Brand.paper).minimumScaleFactor(0.7).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Brand.fg.opacity(0.06)))
    }

    private var age: String {
        guard let l = token.launchedAt else { return Format.dash }
        let m = max(0, Date().timeIntervalSince(l) / 60)
        if m < 60 { return "\(max(1, Int(m.rounded())))m" }
        if m < 60 * 48 { return "\(Int((m / 60).rounded()))h" }
        return "\(Int((m / 1440).rounded()))d"
    }
}
