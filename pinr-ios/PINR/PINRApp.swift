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
    @State private var watch = WatchStore()
    @State private var wallet = WalletStore()
    @State private var moderation = ModerationStore()
    //
    @State private var veilGone = false
    @State private var veilCut = false
    @Environment(\.colorScheme) private var system

    var body: some Scene {
        WindowGroup {
            WorldShell()
                .overlay { if !veilGone { BootVeil(hidden: $veilCut) } }
                .task { try? await Task.sleep(for: .seconds(3.5)); veilCut = true; try? await Task.sleep(for: .seconds(2.1)); veilGone = true }
                .environment(feed)
                .environment(store)
                .environment(camera)
                .environment(look)
                .environment(prefs)
                .environment(selection)
                .environment(discover)
                .task {
                    //
                    camera.capture = { Screen(room: camera.room, coin: camera.room == .terminal ? selection.id : nil, list: prefs.list, filter: prefs.filter, query: discover.query, tab: discover.tab) }
                    camera.restore = { s in
                        prefs.list = s.list
                        prefs.filter = s.filter
                        discover.query = s.query
                        discover.tab = s.tab
                        if let c = s.coin { selection.id = c }
                    }
                }
                .environment(watch)
                .environment(wallet)
                .environment(moderation)
                .onChange(of: store.all) { watch.check(store.all) }
                .task { await feed.watch() }
                // A link to one coin (`pinr://coin/<address>`, or the site's `?coin=<address>`) opens that coin's page.
                .onOpenURL { url in
                    guard let address = CoinAddress.parse(url) else { return }
                    veilGone = true
                    Task { if let t = await store.find(address) { selection.id = t.id; camera.go(.terminal) } }
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
