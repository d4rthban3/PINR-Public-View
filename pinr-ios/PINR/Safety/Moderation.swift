import SwiftUI
import Foundation
import Observation

/// Coin names and pictures are made by strangers (PLAN.md, Apple's review, risk 2). One tool, kept on this phone only:
//
/// The coins this person has hidden (long-press a tile or card, or the coin page's menu).
@MainActor
@Observable
final class ModerationStore {
    private(set) var hidden: Set<String>
    private let defaults: UserDefaults

    //
    var showMayhem: Bool {
        didSet { defaults.set(showMayhem, forKey: "pinr.showMayhem") }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hidden = Set(defaults.stringArray(forKey: "pinr.hidden") ?? [])
        showMayhem = defaults.bool(forKey: "pinr.showMayhem")
    }

    func isHidden(_ t: Token) -> Bool { hidden.contains(t.id) }

    func hide(_ t: Token) { hidden.insert(t.id); save() }
    func unhide(_ id: String) { hidden.remove(id); save() }
    func unhideAll() { hidden.removeAll(); save() }

    //
    func add(_ ids: some Sequence<String>) { hidden.formUnion(ids.map { $0.lowercased() }); save() }

    /// The list without the coins this person hid, and without the MAYHEM coins unless Show Mayhem is on.
    func visible(_ tokens: [Token]) -> [Token] {
        if hidden.isEmpty && showMayhem { return tokens }
        return tokens.filter { !hidden.contains($0.id) && (showMayhem || $0.label != .mayhem) }
    }

    private func save() { defaults.set(Array(hidden), forKey: "pinr.hidden") }
}

/// "Hide this coin" (a long press on a tile or a Discover card, or the coin page's menu).
struct HideButton: View {
    let token: Token
    @Environment(ModerationStore.self) private var moderation
    var body: some View {
        Button(role: .destructive) { moderation.hide(token) } label: { Label("Hide this coin", systemImage: "eye.slash") }
    }
}
