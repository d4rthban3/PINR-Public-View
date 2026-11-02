import SwiftUI

//
enum DiscoverView: String, CaseIterable, Identifiable {
    case cards, list, gallery
    var id: String { rawValue }
    var label: String { switch self { case .cards: "Cards"; case .list: "List"; case .gallery: "Gallery" } }
    var symbol: String { switch self { case .cards: "rectangle.grid.1x2"; case .list: "list.bullet"; case .gallery: "square.grid.2x2" } }
}

/// The switch (the site's `.dviews`): three icons in a glass capsule, the chosen one in lime.
struct DiscoverViewSwitch: View {
    @Binding var view: DiscoverView
    var body: some View {
        HStack(spacing: 2) {
            ForEach(DiscoverView.allCases) { v in
                Button { view = v } label: {
                    Image(systemName: v.symbol).font(.system(size: 16, weight: .semibold))
                        .frame(width: 44, height: 34)
                        .foregroundStyle(view == v ? Brand.onLive : Brand.mute)
                        .background(Capsule().fill(view == v ? Brand.lime : .clear))
                        .contentShape(Capsule())
                }
                .accessibilityLabel(v.label)
                .accessibilityAddTraits(view == v ? .isSelected : [])
                .accessibilityIdentifier("dview-\(v.rawValue)")
            }
        }
        .padding(3)
        .background(Capsule().fill(Brand.glass))
    }
}

/// List view: one dense row per coin (picture, name and ticker, tags, market cap, the move, the score when shown). 62 points tall; every text 11.5 points or more.
struct DiscoverRow: View {
    let token: Token
    var open: (Token) -> Void = { _ in }

    var body: some View {
        Button { open(token) } label: {
            HStack(spacing: 10) {
                TokenPicture(token: token, size: 38)
                VStack(alignment: .leading, spacing: 3) {
                    Text(Format.title(token)).font(Typo.sans(15, .semibold)).foregroundStyle(Brand.paper).lineLimit(1)
                    Text(Format.ticker(token)).font(Typo.mono(11.5)).foregroundStyle(Brand.mute).lineLimit(1)
                    if token.hasTags { TagPills(token: token) }
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 3) {
                    if token.label == nil {
                        Text(Format.usdCompact(token.valuationUsd)).font(Typo.mono(12.5, .medium)).foregroundStyle(Brand.paper)
                        Text(Format.change(token.change24hPct, windowHours: token.changeWindowHours))
                            .font(Typo.mono(12.5, .bold)).foregroundStyle((token.change24hPct ?? 0) >= 0 ? Brand.lime : Brand.mandarin)
                    }
                }
                score.frame(minWidth: 36, alignment: .trailing)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(minHeight: 62)
            .glass(16)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("drow-\(token.id)")
    }

    @ViewBuilder private var score: some View {
        if let label = token.label { Text(label.rawValue).font(Typo.sans(13, .bold)).foregroundStyle(Brand.mandarin) }
        else if let s = token.score { Text(String(s)).font(Typo.sans(26, .semibold)).monospacedDigit().foregroundStyle(Brand.score(s)).opacity(token.coverage < 30 ? 0.6 : 1) }
    }
}

/// Gallery view: a tile per coin, two to a row on a phone.
struct DiscoverTile: View {
    let token: Token
    var open: (Token) -> Void = { _ in }

    var body: some View {
        Button { open(token) } label: {
            VStack(alignment: .leading, spacing: 8) {
                TokenPicture(token: token, size: 52)
                VStack(alignment: .leading, spacing: 3) {
                    Text(Format.title(token)).font(Typo.sans(15, .semibold)).foregroundStyle(Brand.paper).lineLimit(1)
                    Text(Format.ticker(token)).font(Typo.mono(11.5)).foregroundStyle(Brand.mute).lineLimit(1)
                }
                if token.hasTags { TagPills(token: token).fixedSize(horizontal: false, vertical: true) }
                Spacer(minLength: 0)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 3) {
                        if token.label == nil {
                            Text(Format.usdCompact(token.valuationUsd)).font(Typo.mono(12.5, .medium)).foregroundStyle(Brand.paper)
                            Text(Format.change(token.change24hPct, windowHours: token.changeWindowHours))
                                .font(Typo.mono(13, .bold)).foregroundStyle((token.change24hPct ?? 0) >= 0 ? Brand.lime : Brand.mandarin)
                        }
                    }
                    Spacer(minLength: 4)
                    if let label = token.label { Text(label.rawValue).font(Typo.sans(13, .bold)).foregroundStyle(Brand.mandarin) }
                    else if let s = token.score { Text(String(s)).font(Typo.sans(30, .semibold)).monospacedDigit().foregroundStyle(Brand.score(s)).opacity(token.coverage < 30 ? 0.6 : 1) }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
            .glass(20)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("dtile-\(token.id)")
    }
}
