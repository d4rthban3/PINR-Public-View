import SwiftUI

//
/// launchpad with its own mark (Assets lp-*, sources in pinr-live/public/art/lp-SOURCES.md), the same size, in one fixed order. A tap picks the
/// launchpad as the funnel's picker does, and it opens on its own first list. A row wider than the screen scrolls sideways.
struct LaunchpadPills: View {
    @Environment(PinrPrefs.self) private var prefs
    static let order = ["pumpfun", "flap", "fourmeme", "zora", "clanker", "bonkfun"]
    /// The height the row takes, kept free above the tiles.
    static let height: CGFloat = 42 // the pills end 30 pt under the top inset; then the tiles' own row gap (12 pt)

    var body: some View {
        let pads = Self.order.compactMap { Lists.launchpad($0) }
        //
        HStack(spacing: 6) {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(pads) { lp in
                    let on = prefs.list?.lp == lp.id
                    Button { prefs.list = Lists.first(of: lp) } label: {
                        //
                        // The whole logo, never cropped: fitted by its own aspect ratio, no round clip over the art (Clanker's white square gets rounded corners only).
                        Image("lp-\(lp.id)").resizable().scaledToFit().frame(width: 26, height: 26).clipShape(RoundedRectangle(cornerRadius: lp.id == "clanker" ? 6 : 0))
                            .frame(width: 52, height: 32)
                            .background(Capsule().fill(Brand.glass))
                            // The chosen pill: a heavier lime ring and a check (not colour alone); exactly one at a time.
                            .overlay(Capsule().strokeBorder(on ? Brand.lime : .clear, lineWidth: 2))
                            .overlay(alignment: .bottomTrailing) {
                                if on { Image(systemName: "checkmark.circle.fill").font(.system(size: 14)).foregroundStyle(Brand.lime, Brand.ink).offset(x: 1, y: 2) }
                            }
                    }
                    .contentShape(Rectangle().inset(by: -6)) // a 44 pt tall touch area around the 32 pt pill
                    .buttonStyle(.plain)
                    .accessibilityLabel(on ? "\(lp.name), selected" : lp.name)
                    .accessibilityAddTraits(on ? [.isSelected] : [])
                    .accessibilityIdentifier("lppill-\(lp.id)")
                }
            }
            .padding(.horizontal, 10)
            // Short rows sit in the middle, as the site's.
            .frame(minWidth: UIScreen.main.bounds.width - 64, alignment: .center)
        }
        FilterButton().padding(.trailing, 10)
        }
        .frame(height: 34)
    }
}
