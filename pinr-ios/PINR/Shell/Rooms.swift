import SwiftUI

/// Which coin the PINRterminal + DeepScan room shows: the last one opened anywhere.
@MainActor
@Observable
final class CoinSelection {
    var id: String?
}

// MARK: - The centre: the PINR guide

//
struct GuideRoom: View {
    let insets: RoomInsets

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                // 1 Nov (ArtDesign): the 3D Pinch banner at the head of the guide, as on the site.
                Image("pinch-banner").resizable().scaledToFit().frame(maxWidth: .infinity).padding(.top, 10).accessibilityHidden(true)
                Text("PINR guide").font(Typo.sans(34, .bold)).tracking(-1.0).foregroundStyle(Brand.paper)
                ForEach(GuideCopy.sections) { section in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(section.title).font(Typo.sans(20, .bold)).foregroundStyle(Brand.paper)
                        ForEach(section.blocks) { b in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                if b.bullet { Text("•").foregroundStyle(Brand.lime) }
                                Text(b.attributed).font(Typo.sans(14.5)).lineSpacing(5).foregroundStyle(Brand.paper)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    // The site's guide sections: a soft 5% fill, 22 round (style.css .gdsec), not the tile glass.
                    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Brand.fg.opacity(0.05)))
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, insets.top)
            .padding(.bottom, insets.bottom)
        }
        .scrollIndicators(.hidden)
    }
}

//
enum GuideCopy {
    struct Block: Identifiable {
        let id = UUID()
        let lead: String?
        let text: String
        let bullet: Bool
        var attributed: AttributedString {
            var s = AttributedString()
            if let lead { var l = AttributedString(lead + " "); l.font = Typo.sans(14.5, .semibold); s += l }
            // The source marks one word bold with **…**.
            let parts = text.components(separatedBy: "**")
            for (i, p) in parts.enumerated() {
                var a = AttributedString(p)
                if i % 2 == 1 { a.font = Typo.sans(14.5, .semibold) }
                s += a
            }
            return s
        }
    }
    struct Section: Identifiable { let id = UUID(); let title: String; let blocks: [Block] }

    private static func p(_ lead: String?, _ text: String) -> Block { Block(lead: lead, text: text, bullet: false) }
    private static func li(_ lead: String?, _ text: String) -> Block { Block(lead: lead, text: text, bullet: true) }

    static let sections: [Section] = [
        Section(title: "Where everything is", blocks: [
            p("Discover", "is the search page and the market pulse: Trending, Top Movers, Fresh Launches and Token health lists, each card showing the coin, its market cap and all-time high, a small chart, and its token health with its coverage."),
            p("PINR", "is the home page: every coin PINR has read as a tile, biggest and most active first, so you see what the scanner is looking at."),
            p("PINRbot DeepScan", "is one page per coin: the live chart on top, then the dossier below it: the token health, the recent trades, the checks, the facts, the written read, the coin's own links and what the posts about it say."),
            p("Wallet / Profile", "reads a wallet's public holdings. It cannot sign, send or approve anything."),
            p("PvP Arena", "sits above PINR: every version of a contested coin side by side, the leader first."),
            p(nil, "PINR is the centre of the map. The compass in the centre of the footer opens the whole map. The PINR GUIDE button in the centre of the header opens this guide or the Whitepaper. The footer takes you to the main pages."),
        ]),
        Section(title: "Why the site is laid out this way", blocks: [
            p(nil, "Every page answers one question. PINR: what is moving. Discover: where is the coin I am looking for. DeepScan: what is the evidence for this one coin. Wallet: what do I hold. Everything starts at a coin, and every figure on the way carries where it came from and when it was read, so you can check it yourself instead of trusting a label."),
        ]),
        Section(title: "What token health is, and is not", blocks: [
            p(nil, "Token health is PINR's reading of the evidence its checks found, from 1 to 99: a reading, not a verdict. Beside every reading is its **coverage**: how much of the picture was actually read. A reading with low coverage is an early, partial look. A high reading means \"no bad pattern found\". It does not say the coin is good, and it does not say what the price will do. When PINR has not read something, the page says \"not read\" and the reason. It never fills a gap with a guess, and a dash means \"not measured\"."),
        ]),
        Section(title: "How PINR scans", blocks: [
            p(nil, "New launches are watched as they appear. A coin gets its token health reading on its own; the busiest coins are read first, so the list you see is led by what the market is paying attention to. A first reading is often chain-only and early, and it is read again as more can be read. Social posts are read separately: what a post claims is set beside what the chain shows, the lines are shown to you, and they never change a token health reading."),
        ]),
        Section(title: "The data, one kind at a time", blocks: [
            li("Chain facts:", "who created the coin, who paid for the launch, how many coins that wallet launched before, the pool and what it holds. Source: the public Solana chain, with a link to the explorer for each figure."),
            li("Launchpad facts:", "the coin's own record on its launchpad (its name, picture, links, market cap, all-time high). Source: the launchpad."),
            li("Market figures:", "price, liquidity, volume, pair. Source: the market data service named on each figure, with the time it was read."),
            li("Social lines:", "what the coin's linked posts say, shown with a link to the post, never part of token health."),
            p(nil, "Every figure shows its source, how long ago it was read, and where to look. If a figure has no source, it says \"no source\" and is not used."),
        ]),
        Section(title: "What PINR does for each kind of trader", blocks: [
            p("New to this:", "start on PINR or Discover, tap a coin, read the token health with its coverage first, then scroll the dossier from the top. The plain words (Strong, Fair, Weak, Clear, Not read) are there so you do not need to know what a check does."),
            p("Everyday trader:", "use Fresh Launches and Top Movers to find coins fast, and read the checks and the recent trades before you decide anything. Compare the market cap with the all-time high."),
            p("Experienced:", "the chart has timeframes, indicators and drawing tools, and every dossier figure links to its source so you can verify it. Use the facts list for the launcher's history."),
            p("Large holders:", "watch who launched the coin, how long it has traded and how much liquidity sits behind it, and look at the top-holder check once it is read. A coin with low coverage tells you what has not been looked at yet."),
            p("Funds and desks:", "the whole site is a research tool built on sourced, timestamped readings. Nothing on it is advice or a recommendation, and every number with a source line can be traced to its source."),
        ]),
        Section(title: "What PINR does not do", blocks: [
            p(nil, "It does not tell you what to buy or sell. It does not predict price. It does not move your wallet. It shows what was read, from where, and when, and it says plainly what it could not read."),
        ]),
    ]
}

// MARK: - South: PINRterminal + DeepScan (filled by steps 5 and 6)

struct TerminalRoom: View {
    let insets: RoomInsets
    @Environment(CoinSelection.self) private var selection
    @Environment(FeedStore.self) private var store

    var body: some View {
        if let id = selection.id, let t = store.box(id).token ?? store.found[id] {
            CoinPage(token: t, insets: insets, client: CoinClient(baseURL: store.baseURL, session: .shared))
        } else {
            VStack(spacing: 14) {
                Glyph.deepscan.view(size: 40).foregroundStyle(Brand.lime)
                Text("PINRterminal").font(Typo.sans(22, .bold)).foregroundStyle(Brand.paper)
                Text(selection.id == nil ? "Choose a token on the PINR page or Discover." : "This coin is not in the feed right now.")
                    .font(Typo.sans(14)).foregroundStyle(Brand.paper.opacity(0.75)).multilineTextAlignment(.center)
            }
            .padding(.horizontal, 28)
            .padding(.top, insets.top)
            .padding(.bottom, insets.bottom)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - The four corners: advertisement placeholders

/// A corner of the map: four labelled placeholder slots, as on the site (pages.ts). Nothing here is a real placement.
struct AdRoom: View {
    let room: Room
    let insets: RoomInsets

    //
    /// AD_AREAS): "Ad space A1" to "D4" (A north-west, B north-east, C south-west, D south-east), slots 1 and 4 wide.
    static let areas: [Room: [(String, String)]] = Dictionary(uniqueKeysWithValues: [(Room.adNW, "A"), (.adNE, "B"), (.adSW, "C"), (.adSE, "D")].map { room, letter in
        (room, (1...4).map { i in ("Ad space \(letter)\(i)", i == 1 || i == 4 ? "Wide placeholder" : "Square placeholder") })
    })
    private static let gradients: [[UInt32]] = [
        [0x9B6BFF, 0x5EC6C0, 0x7DFFB4], [0x4AA8FF, 0x8F7BFF, 0xD6FF3C], [0xFF8C1A, 0xFF5E8A, 0xB86BFF],
        [0xD6FF3C, 0x5EE0A0, 0x4AA8FF], [0xFF5E8A, 0xFF8C1A, 0xFFD23C], [0x5EC6C0, 0x4AA8FF, 0x9B6BFF],
    ]

    var body: some View {
        // The site lays a room out about 340 points wide and scales it to the screen (about 1.29 at 440), so the
        // slots are drawn at the site's sizes times that.
        GeometryReader { geo in
            // Height counts too, so a phone turned on its side still fits all four slots.
            let k = max(0.6, min(1.4, (geo.size.width - 2 * insets.side) / 340, (geo.size.height - insets.top - insets.bottom) / 560))
            let slots = Self.areas[room] ?? []
            let offset = [Room.adNW, .adNE, .adSW, .adSE].firstIndex(of: room).map { $0 * 2 } ?? 0
            VStack(spacing: 12 * k) {
                Text("ADVERTISEMENT · PLACEHOLDER").font(Typo.fmono(10 * k, .medium)).tracking(1.8 * k).foregroundStyle(Brand.mute)
                slotView(slots[0], gradient: Self.gradients[offset % 6], wide: true, k: k)
                HStack(spacing: 12 * k) {
                    slotView(slots[1], gradient: Self.gradients[(offset + 1) % 6], wide: false, k: k)
                    slotView(slots[2], gradient: Self.gradients[(offset + 2) % 6], wide: false, k: k)
                }
                slotView(slots[3], gradient: Self.gradients[(offset + 3) % 6], wide: true, k: k)
            }
            .padding(.horizontal, 16)
            .padding(.top, insets.top)
            .padding(.bottom, insets.bottom)
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private func slotView(_ s: (String, String), gradient: [UInt32], wide: Bool, k: CGFloat) -> some View {
        VStack(spacing: 10 * k) {
            Text(s.0).font(Typo.fsans((wide ? 34 : 19) * k, .bold)).tracking((wide ? -1.2 : -0.6) * k)
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(LinearGradient(colors: gradient.map { Color(hex: $0) }, startPoint: .leading, endPoint: .trailing))
            Text(s.1.uppercased()).font(Typo.fmono(10 * k, .medium)).tracking(1 * k).foregroundStyle(Brand.mute).multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .topTrailing) {
            Text("AD").font(Typo.fmono(8 * k, .semibold)).tracking(1.1 * k).foregroundStyle(Brand.mute)
                .padding(.horizontal, 5 * k).padding(.vertical, 3 * k)
                .overlay(RoundedRectangle(cornerRadius: 5 * k).strokeBorder(Brand.fg.opacity(0.18), lineWidth: 1))
                .padding(.top, 9 * k).padding(.trailing, 11 * k)
        }
        .overlay(RoundedRectangle(cornerRadius: 20 * k).strokeBorder(Brand.fg.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - The header's panels

struct HeaderSheetView: View {
    let kind: HeaderSheet
    var open: (HeaderSheet) -> Void = { _ in }
    @Environment(PinrPrefs.self) private var prefs
    @Environment(Camera.self) private var camera
    @Environment(ModerationStore.self) private var moderation
    @Environment(\.dismiss) private var dismiss
    //
    private static let showHiddenCoinsLine = false

    var body: some View {
        // The filters panel is longer than the half-height sheet (its last rows, Show Mayhem among them, were below the edge): it scrolls.
        // Settings keeps its own scrolling.
        if kind == .filters {
            ScrollView { panel.frame(maxWidth: .infinity, alignment: .leading) }
        } else {
            panel
        }
    }

    @ViewBuilder private var panel: some View {
        @Bindable var prefs = prefs
        @Bindable var moderation = moderation
        VStack(alignment: .leading, spacing: 14) {
            switch kind {
            case .filters:
                Text("Launchpad").font(Typo.sans(17, .bold))
                ForEach(Lists.all) { lp in
                    Button { prefs.list = Lists.first(of: lp) } label: {
                        HStack {
                            Text(lp.name).font(Typo.sans(15, .semibold))
                            Spacer()
                            if prefs.list?.lp == lp.id { Image(systemName: "checkmark").foregroundStyle(Brand.lime) }
                        }
                    }
                    .accessibilityIdentifier("launchpad-\(lp.id)")
                }
                if let pick = prefs.list.flatMap({ Lists.launchpad($0.lp) }) {
                    Text("List").font(Typo.sans(15, .bold)).padding(.top, 4)
                    ForEach(pick.lists) { l in
                        Button { prefs.list = ListChoice(lp: pick.id, list: l.id); dismiss() } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(l.name).font(Typo.sans(15, .semibold))
                                        if l.kind == .pinr { Text("PINR's list").font(Typo.sans(10, .semibold)).foregroundStyle(Brand.lime).padding(.horizontal, 6).overlay(Capsule().strokeBorder(Brand.lime, lineWidth: 1)) }
                                    }
                                    Text(l.order).font(Typo.mono(11)).foregroundStyle(Brand.mute)
                                }
                                Spacer()
                                if prefs.list == ListChoice(lp: pick.id, list: l.id) { Image(systemName: "checkmark").foregroundStyle(Brand.lime) }
                            }
                        }
                        .accessibilityIdentifier("list-\(l.id)")
                    }
                    Text(pick.own ? "These are \(pick.name)'s own lists, read from \(pick.name) and shown in its own order." : "These are PINR's lists of the \(pick.name) coins PINR lists. \(pick.name) does not let anyone read its own lists, so a plain sort carries its name and ranked boards say they are PINR's.")
                        .font(Typo.mono(10.5)).foregroundStyle(Brand.mute).fixedSize(horizontal: false, vertical: true)
                }
                Button { prefs.filter = .pinrscore; prefs.list = nil; dismiss() } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(PinrFilter.pinrscore.label).font(Typo.sans(15, .semibold))
                            Text(PinrFilter.pinrscore.hint).font(Typo.mono(11)).foregroundStyle(Brand.mute)
                        }
                        Spacer()
                        if prefs.list == nil { Image(systemName: "checkmark").foregroundStyle(Brand.lime) }
                    }
                }
                .padding(.top, 4)
                .accessibilityIdentifier("filter-pinrscore")
                Text("Tiles per row").font(Typo.sans(15, .bold)).padding(.top, 6)
                Picker("Tiles per row", selection: $prefs.perRow) { ForEach(PinrPrefs.rowChoices, id: \.self) { Text("\($0)").tag($0) } }
                    .pickerStyle(.segmented)
                Text("Tiles on the page").font(Typo.sans(15, .bold))
                Picker("Tiles on the page", selection: $prefs.roster) { ForEach(PinrPrefs.rosterChoices, id: \.self) { Text("\($0)").tag($0) } }
                    .pickerStyle(.segmented)
                //
                Button { moderation.showMayhem.toggle() } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Show Mayhem").font(Typo.sans(15, .semibold))
                            Text("Coins labelled MAYHEM; left out by default").font(Typo.mono(11)).foregroundStyle(Brand.mute)
                        }
                        Spacer()
                        if moderation.showMayhem { Image(systemName: "checkmark").foregroundStyle(Brand.lime) }
                    }
                }
                .padding(.top, 4)
                .accessibilityIdentifier("show-mayhem")
                .accessibilityAddTraits(moderation.showMayhem ? .isSelected : [])
                //
                if Self.showHiddenCoinsLine {
                    HStack {
                        Text("Hidden coins: \(moderation.hidden.count)").font(Typo.sans(14)).foregroundStyle(Brand.mute)
                        Spacer()
                        if !moderation.hidden.isEmpty {
                            Button("Show them again") { moderation.unhideAll() }.font(Typo.sans(14, .semibold))
                        }
                    }
                }
                Text("Long-press a coin to hide it. Kept on this phone only.").font(Typo.mono(11)).foregroundStyle(Brand.mute)
            case .menu:
                Text("Menu").font(Typo.sans(17, .bold))
                ForEach(Room.footer) { r in
                    Button { dismiss(); camera.go(r) } label: { Text(r == .terminal ? "PINRbot DeepScan" : r.title).font(Typo.sans(16, .semibold)) }
                }
                Button { dismiss(); camera.toggleMap() } label: { Text("The whole map").font(Typo.sans(16, .semibold)) }
                // As on the site's menu: Settings.
                Button { open(.settings) } label: { Text("Settings").font(Typo.sans(16, .semibold)) }
                    .accessibilityIdentifier("menu-settings")
                //
                Button { open(.diagnostics) } label: { Text("Diagnostics").font(Typo.sans(16, .semibold)) }
                    .accessibilityIdentifier("menu-diagnostics")
            case .settings:
                SettingsPanel()
            case .diagnostics:
                Text("Diagnostics").font(Typo.sans(17, .bold))
                FeedStatusLine()
            case .pipeline:
                Text("Discovery pipeline").font(Typo.sans(17, .bold))
                Text("New launches are watched as they appear; the busiest coins are read first. The feed on this phone reads the first page every 5 seconds and the rest of the Token health set every minute.")
                    .font(Typo.sans(14)).foregroundStyle(Brand.paper.opacity(0.8))
                FeedStatusLine()
            }
            Spacer()
        }
        .foregroundStyle(Brand.paper)
        .tint(Brand.lime)
        .padding(20)
    }
}

/// One line saying whether the feed answers, in the site's words ("Mismatch" for a wrong contract), with what was read.
struct FeedStatusLine: View {
    @Environment(FeedLink.self) private var feed
    @Environment(FeedStore.self) private var store

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(dot).frame(width: 8, height: 8)
            Text(text).font(Typo.mono(11)).foregroundStyle(Brand.paper.opacity(0.85))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Capsule().fill(Brand.glass))
        .overlay(Capsule().strokeBorder(Brand.fg.opacity(0.08)))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("feed-status")
    }

    private var text: String {
        if case .mismatch(let contract) = store.state { return "Mismatch · the feed speaks contract \(contract)" }
        switch feed.state {
        case .connecting: return "Connecting to the feed…"
        case .live(let contract): return "Feed live · contract \(contract)" + counts
        case .offline(let reason): return "Offline · \(reason)"
        case .mismatch(let contract): return "Mismatch · the feed speaks contract \(contract)"
        }
    }

    private var counts: String {
        guard store.state == .live else { return "" }
        var s = " · \(store.firstPage.count.formatted()) coins"
        if let total = store.restTotal {
            s += store.restLoaded < total ? " + \(store.restLoaded.formatted()) of \(total.formatted()) read" : " + \(total.formatted()) read"
        }
        return s
    }

    private var dot: Color {
        if case .mismatch = store.state { return .red }
        switch feed.state {
        case .connecting: return Brand.lilac
        case .live: return Brand.lime
        case .offline: return .gray
        case .mismatch: return .red
        }
    }
}
