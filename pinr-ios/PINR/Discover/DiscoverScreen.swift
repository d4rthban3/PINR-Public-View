import SwiftUI

/// The Discover room (west on the map), in the site's look: the PINR wordmark, "clean up the
/// trenches" and the blurb, the search pill, the market pulse with Refresh, the four tabs, then 30 cards. As on
/// the site the list is a snapshot: re-ranked on a tab, a search, Refresh or pull to refresh.
struct DiscoverRoom: View {
    let insets: RoomInsets
    @Environment(FeedStore.self) private var store
    @Environment(Camera.self) private var camera
    @Environment(CoinSelection.self) private var selection
    @Environment(ModerationStore.self) private var moderation
    @Environment(PinrPrefs.self) private var prefs
    @Environment(DiscoverMemory.self) private var memory
    private var tab: DiscoverTab { get { memory.tab } nonmutating set { memory.tab = newValue } }
    private var query: String { get { memory.query } nonmutating set { memory.query = newValue } }
    @AppStorage("pinr.discoverView") private var viewRaw = DiscoverView.cards.rawValue
    private var view: DiscoverView { DiscoverView(rawValue: viewRaw) ?? .cards }
    @State private var order: [String] = []
    @State private var lastKnown: [String: Token] = [:]
    @State private var rankedWholeSet = false
    @State private var rankedAt = Date()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12, pinnedViews: [.sectionHeaders]) {
                hero
                Section {
                    pulse
                    content
                } header: {
                    search
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, insets.top)
            .padding(.bottom, insets.bottom)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .refreshable { rerank() }
        .remembersScroll(.discover)
        .onChange(of: store.ownRev) { rerank() }
        .onChange(of: prefs.list) { if tab != .basebnb { tab = prefs.list == nil ? .pinrscore : .list }; rerank() }
        .onChange(of: tab) { rerank(); if tab == .basebnb { Task { await store.loadChainCoins(); rerank() } } }
        .onChange(of: query) { rerank() }
        //
        .task(id: query) {
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard CoinAddress.isAddress(q), !store.byId.keys.contains(q.lowercased()), let t = await store.find(q) else { return }
            order = [t.id]; lastKnown[t.id] = t
        }
        .onChange(of: moderation.hidden) { rerank() }
        .onChange(of: moderation.showMayhem) { rerank() }
        .onChange(of: store.isEmpty) { if order.isEmpty { rerank() } }
        .onChange(of: wholeSetRead) { if wholeSetRead && !rankedWholeSet { rankedWholeSet = true; rerank() } }
        .onAppear { if order.isEmpty { rerank() } }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            WordmarkImage().scaledToFit().frame(width: 190)
                .padding(.top, 24)
                .accessibilityLabel("PINR")
            Text("clean up the trenches").font(Typo.sans(20, .semibold)).foregroundStyle(Brand.paper)
            Text("Deep scans contract architecture, custody protocol, quote pairing synergy, launchpad reward protocols, and social media posts to help traders see what the developer did, real efforts, and strategy for the endgame.")
                .font(Typo.sans(13)).foregroundStyle(Brand.paper.opacity(0.72)).multilineTextAlignment(.center)
                .lineSpacing(3).padding(.horizontal, 8)
        }
        .padding(.bottom, 8)
    }

    /// The search pill, pinned under the header while the list scrolls, as on the site.
    private var search: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").font(.system(size: 18)).foregroundStyle(Brand.paper.opacity(0.8))
            TextField("", text: Bindable(memory).query, prompt: Text("Ticker, name, CA, X, social, or website").foregroundStyle(Brand.mute))
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .font(Typo.sans(15)).foregroundStyle(Brand.paper)
                .accessibilityIdentifier("discover-search")
            if !query.isEmpty {
                Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Brand.mute) }
                    .accessibilityLabel("Clear the search")
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .glass(26)
        .padding(.vertical, 6)
    }

    private var pulse: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(Brand.lime).frame(width: 7, height: 7)
                Text("TRENCHES MARKET PULSE").font(Typo.mono(11, .bold)).tracking(2.2).foregroundStyle(Brand.paper)
            }
            HStack {
                TimelineView(.periodic(from: .now, by: 5)) { _ in
                    Text("Engine feed · updated \(Format.ago(store.lastHeard ?? rankedAt))")
                        .font(Typo.mono(10.5)).foregroundStyle(Brand.mute)
                }
                Spacer()
                Button("Refresh") { rerank() }
                    .font(Typo.mono(11, .medium)).foregroundStyle(Brand.paper)
                    .padding(.horizontal, 12).frame(height: 26)
                    .background(Capsule().fill(Brand.fg.opacity(0.07)))
            }
            if query.isEmpty {
                // The site's tabs (style.css .dtabs): four equal pills in one row, 40 high, 13-point type; a long
                // name wraps inside its pill rather than the row scrolling.
                //
                HStack(spacing: 6) {
                    ForEach(Lists.all) { lp in
                        pill(lp.name, on: tab == .list && prefs.list?.lp == lp.id, id: "dtab-\(lp.id)") { prefs.list = Lists.first(of: lp); tab = .list }
                    }
                    pill("Token health", on: tab == .pinrscore, id: "dtab-pinrscore") { prefs.filter = .pinrscore; prefs.list = nil; tab = .pinrscore }
                    pill("Base/BNB", on: tab == .basebnb, id: "dtab-basebnb") { tab = .basebnb }
                }
                .padding(.horizontal, 2)
                if tab == .list, let pick = prefs.list.flatMap({ Lists.launchpad($0.lp) }) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(pick.lists) { l in
                                pill(l.kind == .pinr ? "\(l.name) · PINR's list" : l.name, on: prefs.list == ListChoice(lp: pick.id, list: l.id), id: "dlist-\(l.id)", fill: false) { prefs.list = ListChoice(lp: pick.id, list: l.id) }
                            }
                        }
                        .padding(.horizontal, 2)
                    }
                }
                noteRow(noteLine)
            } else {
                noteRow("Every coin, biggest first · \(order.count)")
            }
        }
        .padding(.horizontal, 4)
    }

    //
    private func noteRow(_ text: String) -> some View {
        HStack(spacing: 10) {
            Text(text).font(Typo.mono(11.5)).foregroundStyle(Brand.mute).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            DiscoverViewSwitch(view: Binding(get: { view }, set: { viewRaw = $0.rawValue }))
            FilterButton()
        }
    }

    /// One tab pill, in the site's look; `fill` false lets it keep its own width (the list row scrolls sideways).
    private func pill(_ title: String, on: Bool, id: String, fill: Bool = true, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(Typo.sans(12, .medium)).multilineTextAlignment(.center)
                .lineLimit(1).minimumScaleFactor(0.6)
                .padding(.horizontal, fill ? 0 : 12)
                .frame(maxWidth: fill ? .infinity : nil).frame(height: fill ? 40 : 34)
                .foregroundStyle(on ? Brand.onLive : Brand.mute)
                .background(Capsule().fill(on ? Brand.lime : Brand.glass))
                .overlay(Capsule().strokeBorder(on ? .clear : Brand.fg.opacity(0.12), lineWidth: 1))
                .contentShape(Capsule())
        }
        .accessibilityIdentifier(id)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// The line under the tabs: the list and its order in words, then how many coins.
    private var noteLine: String {
        if tab == .list, let c = prefs.list, let l = Lists.label(c) { return "\(l.title) · \(l.order) · \(order.count)" }
        return "\(tab.hint) · \(order.count)"
    }

    @ViewBuilder private var content: some View {
        if case .mismatch = store.state {
            Notice(text: "The feed speaks a different data contract than this app. Results are not shown until the two agree.")
        } else if order.isEmpty {
            if store.isEmpty || (tab == .basebnb && query.isEmpty && !store.chainCoinsLoaded) { ProgressView().tint(Brand.lime).padding(.top, 60) }
            else { Notice(text: query.isEmpty ? emptyText : "No coin matches “\(query)”.", scene: "pinch-magnifier-links") }
        } else {
            let client = CoinClient(baseURL: store.baseURL, session: .shared)
            let go: (Token) -> Void = { tok in selection.id = tok.id; camera.go(.terminal) }
            switch view {
            // The page lists ids; each card reads its own coin (REPORT-15), so a price change redraws one card, not the list.
            case .cards:
                ForEach(order, id: \.self) { id in
                    LiveCoin(id: id, fallback: lastKnown[id]) { t in
                        DiscoverCard(token: t, client: client, open: go)
                            .contextMenu { HideButton(token: t) }
                    }
                }
            case .list:
                LazyVStack(spacing: 6) {
                    ForEach(order, id: \.self) { id in LiveCoin(id: id, fallback: lastKnown[id]) { t in DiscoverRow(token: t, open: go).contextMenu { HideButton(token: t) } } }
                }
            case .gallery:
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(order, id: \.self) { id in LiveCoin(id: id, fallback: lastKnown[id]) { t in DiscoverTile(token: t, open: go).contextMenu { HideButton(token: t) } } }
                }
            }
        }
    }

    private var wholeSetRead: Bool { store.restTotal.map { store.restLoaded >= $0 } ?? false }

    private var emptyText: String {
        switch tab {
        case .fresh: "No coins under an hour old right now."
        case .pinrscore: "No coins with a health reading yet."
        case .basebnb: "No Base or BNB Chain coins yet."
        case .movers, .trending, .list: "Nothing to show yet."
        }
    }

    private func rerank() {
        // The Base/BNB tab reads those coins on their own, so it fills in a second or two; the rest of the sweep adds nothing it lacks.
        var pool = store.all
        if tab == .list, query.isEmpty { let have = Set(pool.map(\.id)); pool += store.ownCoins.filter { !have.contains($0.id) } }
        if tab == .basebnb, query.isEmpty { let have = Set(pool.map(\.id)); pool += store.chainCoins.filter { !have.contains($0.id) } }
        let ranked = DiscoverRanking.rank(tab, moderation.visible(pool), query: query, list: prefs.list)
        order = ranked.map(\.id)
        lastKnown = Dictionary(ranked.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        rankedAt = Date()
    }
}
