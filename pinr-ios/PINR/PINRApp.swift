import SwiftUI

@main
struct PINRApp: App {
    @State private var feed = FeedLink()
    @State private var store = FeedStore()
    @State private var camera = Camera()
    @State private var look = Look()
    @State private var prefs = PinrPrefs()
    @State private var selection = CoinSelection()
    @State private var discover = DiscoverMemory()
    @State private var scrolls = ScrollMemory()
    @State private var watch = WatchStore()
    @State private var wallet = WalletStore()
    @State private var moderation = ModerationStore()
    //
    @State private var veilGone = false
    @State private var veilCut = false
    //
    @State private var linkNote: String?
    @Environment(\.colorScheme) private var system

    var body: some Scene {
        WindowGroup {
            WorldShell()
                .overlay { if !veilGone { BootVeil(hidden: $veilCut) } }
                .overlay(alignment: .bottom) { if let n = linkNote { LinkNote(text: n) { linkNote = nil } } }
                .task { try? await Task.sleep(for: .seconds(3.5)); veilCut = true; try? await Task.sleep(for: .seconds(2.1)); veilGone = true }
                .environment(feed)
                .environment(store)
                .environment(camera)
                .environment(look)
                .environment(prefs)
                .environment(selection)
                .environment(discover)
                .environment(scrolls)
                .task {
                    //
                    camera.capture = { Screen(room: camera.room, coin: camera.room == .terminal ? selection.id : nil, list: prefs.list, filter: prefs.filter, query: discover.query, tab: discover.tab, scroll: scrolls.offsets[camera.room]) }
                    camera.restore = { s in
                        prefs.list = s.list
                        prefs.filter = s.filter
                        discover.query = s.query
                        discover.tab = s.tab
                        if let c = s.coin { selection.id = c }
                        if let y = s.scroll { scrolls.restore(s.room, to: y) }
                    }
                }
                .environment(watch)
                .environment(wallet)
                .environment(moderation)
                .background(WatchCheck(store: store, watch: watch))
                .task { await feed.watch() }
                // A link to one coin (`pinr://coin/<address>`, or the site's `?coin=<address>`) opens that coin's page.
                .onOpenURL { url in
                    guard let address = CoinAddress.parse(url) else { return }
                    veilGone = true
                    Task {
                        let why = await store.findWhy(address)
                        if let t = why.token { linkNote = nil; selection.id = t.id; camera.go(.terminal) }
                        else { linkNote = CoinAddress.linkNote(notice: why.notice, address: address) }
                    }
                }
                .task { await store.run() }
                .preferredColorScheme(look.choice)
                .tint(Brand.lime)
                #if DEBUG
                // Test builds only: launched with -PINRLandscape, the app turns to landscape (for the layout pass).
                .task {
                    guard UserDefaults.standard.bool(forKey: "PINRLandscape"),
                          let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
                    scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight)) { _ in }
                }
                #endif
        }
    }
}

/// Checks the price alerts on each change of the feed. A view of its own, so only it (not the whole app) is redrawn per stream message.
private struct WatchCheck: View {
    let store: FeedStore
    let watch: WatchStore

    var body: some View {
        Color.clear.onChange(of: store.rev) { watch.check { store.byId[$0.lowercased()]?.priceUsd } }
    }
}

//
private struct LinkNote: View {
    let text: String
    let close: () -> Void
    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Color.primary)
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 16).padding(.vertical, 10)
            .frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 22).fill(.regularMaterial))
            .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(Color.primary.opacity(0.14)))
            .shadow(color: .black.opacity(0.35), radius: 14, y: 8)
            .padding(.horizontal, 16).padding(.bottom, 104)
            .contentShape(Rectangle())
            .onTapGesture(perform: close)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Tap to close")
            .transition(.opacity)
    }
}
