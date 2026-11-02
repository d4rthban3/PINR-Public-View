import SwiftUI

/// The PINR room (north on the map): the top of the chosen filter's ranking as tiles, 4 across on a phone, over
/// the live background. The ranking is taken when a filter is chosen, on pull to refresh, and again every 10 seconds
//
/// filter lives behind the header's funnel; each tile's own figures stay live.
struct PinrRoom: View {
    let insets: RoomInsets
    @Environment(FeedStore.self) private var store
    @Environment(PinrPrefs.self) private var prefs
    @Environment(CoinSelection.self) private var selection
    @Environment(ModerationStore.self) private var moderation
    @Environment(Camera.self) private var camera
    @State private var order: [String] = []
    @State private var lastKnown: [String: Token] = [:]
    @State private var rankedWholeSet = false
    @State private var rerankCount = 0
    @Namespace private var cardSpace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    //
    @State private var grown: Token?

    var body: some View {
        GeometryReader { geo in
            let gap: CGFloat = 10
            // Turned to landscape, twice as many across, so a tile keeps about its upright size.
            let perRow = geo.size.width > geo.size.height ? prefs.perRow * 2 : prefs.perRow
            let cols = CGFloat(perRow)
            let w = floor((geo.size.width - 20 - gap * (cols - 1)) / cols)
            ScrollView {
                VStack(spacing: 0) {
                    content(tileWidth: w, gap: gap, perRow: perRow)
                }
                .padding(.horizontal, 10)
                .padding(.top, insets.top + LaunchpadPills.height)
                .padding(.bottom, insets.bottom)
            }
            .scrollIndicators(.hidden)
            .refreshable { rerank() }
        }
        .overlay {
            if let t = grown {
                FullCard(token: t, ns: cardSpace, insets: insets, close: { shrink() }, deepScan: { grown = nil; selection.id = t.id; camera.go(.terminal) })
                    .ignoresSafeArea()
            }
        }
        .overlay(alignment: .top) {
            //
            LaunchpadPills().padding(.top, insets.top - 4)
        }
        .onChange(of: prefs.filter) { rerank() }
        .onChange(of: prefs.list) { rerank() }
        .onChange(of: store.ownRev) { rerank() }
        .onChange(of: prefs.roster) { rerank() }
        .onChange(of: moderation.hidden) { rerank() }
        .onChange(of: store.all.isEmpty) { if order.isEmpty { rerank() } }
        .onChange(of: wholeSetRead) { if wholeSetRead && !rankedWholeSet { rankedWholeSet = true; rerank() } }
        .onAppear { if order.isEmpty { rerank() } }
        .task {
            //
            var ranked: Date?
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                if let heard = store.lastHeard, heard != ranked {
                    ranked = heard
                    rerank()
                }
            }
        }
    }

    @ViewBuilder private func content(tileWidth w: CGFloat, gap: CGFloat, perRow: Int) -> some View {
        let tiles = current
        if case .mismatch = store.state {
            Notice(text: "The feed speaks a different data contract than this app. Results are not shown until the two agree.")
        } else if tiles.isEmpty {
            if store.all.isEmpty { ProgressView().tint(Brand.lime).padding(.top, 120) } else { Notice(text: emptyText) }
        } else {
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(w), spacing: gap), count: perRow), spacing: gap + 2) {
                ForEach(tiles) { t in
                    // As on the site, a tile opens its coin in PINRterminal + DeepScan.
                    Button { grow(t) } label: { TileView(token: t, width: w).equatable() }
                        .buttonStyle(PressScale())
                        .matchedGeometryEffect(id: t.id, in: cardSpace, isSource: grown?.id != t.id)
                        .opacity(grown?.id == t.id ? 0 : 1)
                        .contextMenu { HideButton(token: t) }
                }
            }
        }
    }

    private func grow(_ t: Token) {
        withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .easeInOut(duration: 0.32)) { grown = t }
    }

    private func shrink() {
        withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .easeInOut(duration: 0.32)) { grown = nil }
    }

    private var wholeSetRead: Bool { store.restTotal.map { store.restLoaded >= $0 } ?? false }

    private var current: [Token] {
        order.compactMap { store.byId[$0] ?? lastKnown[$0] }
    }

    private var emptyText: String {
        if prefs.list != nil { return "Nothing here right now." }
        switch prefs.filter {
        case .new: return "No coins under an hour old right now."
        case .movers: return "No score has moved since the app opened."
        case .pinrscore: return "No scored coins yet."
        case .trending: return "Nothing to show yet."
        }
    }

    /// Takes the ranking again. The ranking of the whole set (42 to 57 ms for 44,000 coins) runs away from the main thread
    //
    private func rerank() {
        rerankCount += 1
        let mine = rerankCount
        let have = Set(store.all.map(\.id))
        let tokens = moderation.visible(store.all + store.ownCoins.filter { !have.contains($0.id) })
        let filter = prefs.filter, list = prefs.list, moved = store.moved, limit = prefs.roster
        Task {
            let ranked = await Task.detached(priority: .userInitiated) {
                //
                let shown = list != nil ? tokens : tokens.filter(\.hasSomethingToShow)
                if let list { return Lists.rank(list, shown, limit: limit) }
                return Ranking.rank(filter, shown, moved: moved, limit: limit)
            }.value
            guard mine == rerankCount else { return }
            order = ranked.map(\.id)
            lastKnown = Dictionary(ranked.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        }
    }
}

struct Notice: View {
    let text: String
    /// ArtDesign's pick (1 Nov): a 2.5D Pinch scene (an image-set name) beside the words; the words never change.
    var scene: String? = nil

    var body: some View {
        VStack(spacing: 6) {
            if let scene { PinchScene(name: scene, size: 80) }
            Text(text)
                .font(Typo.sans(13))
                .foregroundStyle(Brand.paper.opacity(0.75))
                .multilineTextAlignment(.center)
        }
        .padding(.top, scene == nil ? 60 : 36)
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity)
    }
}

/// A small 2.5D Pinch scene (the image sets carry the dark and the light picture).
struct PinchScene: View {
    let name: String
    var size: CGFloat = 72

    var body: some View {
        Image(name).resizable().scaledToFit().frame(width: size, height: size).accessibilityHidden(true)
    }
}
