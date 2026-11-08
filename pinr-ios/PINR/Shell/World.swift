import SwiftUI

/// The site's map (pinr-live/src/ui/pages.ts and compass.ts): every page is a room on one canvas, laid out
/// like a compass. PINR at the centre, the PvP Arena to the north, Discover to the west, the Wallet to the
/// east, PINRterminal + DeepScan to the south, and a labelled advertisement placeholder in each corner.
enum Room: String, CaseIterable, Identifiable, Hashable {
    case pinr, arena, discover, wallet, terminal, adNW, adNE, adSW, adSE

    var id: String { rawValue }

    /// Column and row on the 3 by 3 map.
    var cell: (c: Int, r: Int) {
        switch self {
        case .adNW: (0, 0)
        case .arena: (1, 0)
        case .adNE: (2, 0)
        case .discover: (0, 1)
        case .pinr: (1, 1)
        case .wallet: (2, 1)
        case .adSW: (0, 2)
        case .terminal: (1, 2)
        case .adSE: (2, 2)
        }
    }

    var isAd: Bool { [.adNW, .adNE, .adSW, .adSE].contains(self) }

    /// The rooms whose page is solid behind its content on the site.
    var solid: Bool { [.terminal, .wallet].contains(self) }

    /// The footer's five rooms, left to right, as on the site (tabbar.ts).
    static let footer: [Room] = [.discover, .pinr, .terminal, .wallet]

    var title: String {
        switch self {
        case .pinr: "PINR"
        case .discover: "Discover"
        case .arena: "PvP Arena"
        case .terminal: "PINRterminal + DeepScan"
        case .wallet: "Wallet and profile"
        default: "Advertisement · placeholder"
        }
    }
}

//
/// PINR filter, and Discover's search text and tab.
struct Screen: Equatable {
    var room: Room
    var coin: String?
    var list: ListChoice?
    var filter: PinrFilter
    var query: String
    var tab: DiscoverTab
    /// How far the room was scrolled when it was left (the site keeps the PINR grid's, Discover's and the coin page's): nil when not read.
    var scroll: CGFloat? = nil
}

//
/// anything; a restore is a request the room takes when it is next shown. Offsets need iOS 18 (`ScrollPosition`); on iOS 17 Back keeps all
/// but the scroll.
@MainActor
@Observable
final class ScrollMemory {
    @ObservationIgnored var offsets: [Room: CGFloat] = [:]
    struct Request: Equatable { let room: Room; let y: CGFloat; let seq: Int; let at: Date }
    private(set) var request: Request?
    private var seq = 0
    /// A restore holds this long: during the flight the room is drawn once on the map and again in place, and each copy puts the scroll back.
    static let hold: TimeInterval = 1.5
    func restore(_ room: Room, to y: CGFloat, now: Date = Date()) {
        seq += 1
        request = Request(room: room, y: y, seq: seq, at: now)
    }
    /// The room's pending restore, while it holds.
    func pending(_ room: Room, now: Date = Date()) -> CGFloat? {
        guard let r = request, r.room == room, now.timeIntervalSince(r.at) < Self.hold else { return nil }
        return r.y
    }
}

extension View {
    //
    func remembersScroll(_ room: Room) -> some View { modifier(RememberScroll(room: room)) }
}

private struct RememberScroll: ViewModifier {
    let room: Room
    func body(content: Content) -> some View {
        if #available(iOS 18, *) { content.modifier(RememberScroll18(room: room)) } else { content }
    }
}

@available(iOS 18, *)
private struct RememberScroll18: ViewModifier {
    let room: Room
    @Environment(ScrollMemory.self) private var memory
    @State private var position = ScrollPosition(edge: .top)

    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .onScrollGeometryChange(for: CGFloat.self, of: { $0.contentOffset.y + $0.contentInsets.top }) { _, y in memory.offsets[room] = max(0, y) }
            .onAppear {
                // A room shown afresh starts at its top unless Back is putting it back.
                memory.offsets[room] = 0
                apply()
            }
            .onChange(of: memory.request) { apply() }
    }

    private func apply() {
        guard let y = memory.pending(room) else { return }
        memory.offsets[room] = y
        // The room's content (a ranking, a coin's sections) lands a moment after it is shown; the scroll is set again once it has.
        position.scrollTo(y: y)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            // Set again only if the room was held short of it (its content was not there yet); a room the user has already moved is left alone.
            let now = memory.offsets[room] ?? 0
            if now < y - 4 && now < 4 { position.scrollTo(y: y) }
        }
    }
}

/// Discover's search text and tab, held here (not inside the screen) so Back can put them back.
@MainActor
@Observable
final class DiscoverMemory {
    var query = ""
    var tab: DiscoverTab = .list
}

//
@MainActor
@Observable
final class Camera {
    private(set) var room: Room = .pinr
    private(set) var map = false
    private(set) var trail: [Screen] = []
    /// The rooms of the saved path, oldest first.
    var history: [Room] { trail.map(\.room) }
    /// The app sets these: how to read the screen as it is, and how to put a saved one back.
    @ObservationIgnored var capture: (() -> Screen)?
    private var plain: Screen { Screen(room: room, coin: nil, list: Lists.defaultChoice, filter: .pinrscore, query: "", tab: .list) }
    @ObservationIgnored var restore: ((Screen) -> Void)?
    /// The rooms drawn right now: the one you are in, plus all of them while flying or on the map.
    private(set) var drawn: Set<Room> = [.pinr]
    /// True when the camera rests in one room (not flying, not on the map): that room is then shown in place.
    private(set) var settled = true
    private var settle: Task<Void, Never>?

    static let flight = Animation.spring(response: 0.6, dampingFraction: 0.86)

    func go(_ to: Room) {
        guard to != room || map else { return }
        if to != room { step() }
        // A flight draws the room it leaves and the room it reaches (all of them when leaving the map).
        fly(drawing: map ? Set(Room.allCases) : [room, to]) { self.room = to; self.map = false }
    }

    func toggleMap() { fly(drawing: Set(Room.allCases)) { self.map.toggle() } }

    /// Save the screen being left (also when one coin opens another from the coin page).
    func step() {
        trail.append(capture?() ?? plain)
        if trail.count > 200 { trail.removeFirst() }
    }

    func back() {
        if map { fly(drawing: Set(Room.allCases)) { self.map = false }; return }
        // The first screen of a visit goes to the PINR page, not out of the app.
        guard let last = trail.popLast() else {
            if room != .pinr { let from = room; fly(drawing: [from, .pinr]) { self.room = .pinr } }
            return
        }
        restore?(last)
        if last.room == room { return }
        fly(drawing: [room, last.room]) { self.room = last.room }
    }

    var canGoBack: Bool { map || !trail.isEmpty || room != .pinr }

    private func fly(drawing: Set<Room>, _ change: @escaping () -> Void) {
        settle?.cancel()
        settled = false
        drawn = drawing
        // The moving map is drawn once at the starting place before the camera moves, so the flight animates.
        DispatchQueue.main.async { withAnimation(Self.flight) { change() } }
        settle = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(750))
            guard let self, !Task.isCancelled else { return }
            if !self.map { self.drawn = [self.room]; self.settled = true }
        }
    }
}

/// The whole app: the live background, the map of rooms under the camera, and the glass header and footer.
struct WorldShell: View {
    @Environment(\.dynamicTypeSize) private var textSize
    @Environment(Camera.self) private var camera
    @Environment(WatchStore.self) private var watch

    var body: some View {
        let _ = (Typo.scale = Typo.factor(textSize))
        GeometryReader { outer in
            let safe = outer.safeAreaInsets
            GeometryReader { geo in
                let size = geo.size
                let layout = MapLayout(screen: size)
                let s = camera.map ? layout.mapScale : 1
                let origin = camera.map ? layout.mapOrigin : layout.roomOrigin(camera.room)
                let clipTop = safe.top + 6 + 52 + 2
                let clipBottom = max(8, safe.bottom - 6) + 56 + 2
                ZStack(alignment: .topLeading) {
                    LiveBackground()
                    DotGrid(offset: origin, scale: s)
                    // Each room is placed straight on the screen at its own spot and scale (its place on the map,
                    // moved and scaled by the camera), rather than inside one large moving map. The room you are in
                    // then sits exactly on screen by layout, so its scroll view and buttons receive their touches.
                    // The site's band (main.ts --clip-top / --clip-bottom): page content is cut cleanly at the header's
                    // bottom edge and the footer's top edge, so nothing scrolls up behind the header or the clock.
                    ZStack(alignment: .topLeading) {
                        if camera.settled {
                            // At rest, the room you are in is shown plainly, created in place, so its scroll view and
                            // buttons take their touches (a room that arrived by an animated flight did not, in the Simulator).
                            RoomFrame(room: camera.room, insets: RoomInsets(top: safe.top + 64, bottom: safe.bottom + 76, side: max(safe.leading, safe.trailing)), onMap: false)
                                .frame(width: size.width, height: size.height)
                                .id("rest-\(camera.room.rawValue)")
                        } else {
                            // Flying, or on the whole map: the map moves as one piece (its rooms take no touches then,
                            // except the map's own tap-to-fly-in).
                            Color.clear.overlay(alignment: .topLeading) {
                                ZStack(alignment: .topLeading) {
                                    ForEach(Room.allCases) { room in
                                        if camera.drawn.contains(room) {
                                            RoomFrame(room: room, insets: RoomInsets(top: safe.top + 64, bottom: safe.bottom + 76, side: max(safe.leading, safe.trailing)), onMap: camera.map)
                                                .frame(width: size.width, height: size.height)
                                                .offset(x: layout.position(room).x, y: layout.position(room).y)
                                        }
                                    }
                                }
                                .frame(width: layout.world.width, height: layout.world.height, alignment: .topLeading)
                                .scaleEffect(s, anchor: .topLeading)
                                .offset(x: origin.x, y: origin.y)
                            }
                        }
                    }
                    .frame(width: size.width, height: size.height, alignment: .topLeading)
                    .mask(alignment: .top) {
                        Rectangle().frame(height: max(0, size.height - clipTop - clipBottom)).padding(.top, clipTop)
                    }
                    VStack(spacing: 0) {
                        HeaderBar().padding(.top, safe.top + 6)
                        if let toast = watch.toast {
                            Text(toast).font(Typo.sans(13, .semibold)).foregroundStyle(Brand.onLive)
                                .padding(.horizontal, 16).frame(height: 36).background(Capsule().fill(Brand.lime))
                                .padding(.top, 8).transition(.opacity)
                        }
                        Spacer()
                        FooterBar().padding(.bottom, max(8, safe.bottom - 6))
                    }
                    .padding(.horizontal, 10)
                    // Pinned to the screen: turned to landscape, the column was otherwise laid out far taller than the
                    // screen and the footer fell off the bottom.
                    .frame(width: size.width, height: size.height, alignment: .top)
                }
                .frame(width: size.width, height: size.height, alignment: .topLeading)
                .clipped()
            }
            .ignoresSafeArea()
        }
        .background(Brand.ink.ignoresSafeArea())
        // The keyboard covers the footer, as it does the site's; the glass bars never ride up on it.
        .ignoresSafeArea(.keyboard)
        // A new text size redraws every room with it.
        .id(textSize)
    }
}

struct RoomInsets {
    let top: CGFloat
    let bottom: CGFloat
    /// Turned to landscape, the camera housing's side: room content keeps clear of it (0 upright).
    var side: CGFloat = 0
}

/// The map's geometry: rooms are screen-sized, with a gap between them.
struct MapLayout {
    let screen: CGSize
    var gap: CGFloat { screen.width * 0.09 }
    var world: CGSize { CGSize(width: screen.width * 3 + gap * 2, height: screen.height * 3 + gap * 2) }

    func position(_ r: Room) -> CGPoint {
        CGPoint(x: CGFloat(r.cell.c) * (screen.width + gap), y: CGFloat(r.cell.r) * (screen.height + gap))
    }

    /// The camera offset that puts one room exactly on screen.
    func roomOrigin(_ r: Room) -> CGPoint { let p = position(r); return CGPoint(x: -p.x, y: -p.y) }

    /// The whole map fitted between the header and the footer.
    var mapScale: CGFloat { min((screen.width - 16) / world.width, (screen.height - 150) / world.height) }

    var mapOrigin: CGPoint {
        CGPoint(x: (screen.width - world.width * mapScale) / 2, y: (screen.height - world.height * mapScale) / 2 + 8)
    }
}

/// One room: its page, and on the map a glass frame around it that can be tapped to fly in.
struct RoomFrame: View {
    let room: Room
    let insets: RoomInsets
    let onMap: Bool
    @Environment(Camera.self) private var camera

    var body: some View {
        ZStack {
            content
                .padding(.horizontal, insets.side)
                .allowsHitTesting(!onMap && camera.room == room)
            if onMap {
                RoundedRectangle(cornerRadius: 44, style: .continuous)
                    .fill(Color.white.opacity(0.001))
                    .onTapGesture { camera.go(room) }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 44, style: .continuous)
                .fill(Brand.glass.opacity(onMap ? 1 : 0))
        )
        // The site keeps these pages solid behind their content (style.css: the frame at 93% panel); PINR, Discover
        // and the ad corners stand on the live background.
        .background(room.solid ? Brand.panel.opacity(0.93) : .clear)
        .overlay(
            RoundedRectangle(cornerRadius: 44, style: .continuous)
                .strokeBorder(Brand.fg.opacity(onMap ? 0.22 : 0), lineWidth: 5)
        )
        .clipShape(RoundedRectangle(cornerRadius: onMap ? 44 : 0, style: .continuous))
        .accessibilityElement(children: onMap ? .ignore : .contain)
        .accessibilityLabel(onMap ? room.title : "")
        .accessibilityAddTraits(onMap ? .isButton : [])
    }

    @ViewBuilder private var content: some View {
        switch room {
        case .pinr: PinrRoom(insets: insets)
        case .discover: DiscoverRoom(insets: insets)
        case .arena: ArenaRoom(insets: insets)
        case .terminal: TerminalRoom(insets: insets)
        case .wallet: WalletRoom(insets: insets)
        default: AdRoom(room: room, insets: insets)
        }
    }
}
