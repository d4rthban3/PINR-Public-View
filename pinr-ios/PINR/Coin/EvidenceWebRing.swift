import SwiftUI

//
/// point on its group. Solid line and outline = ● read on chain, dashed = ○ reported, faint dots = nothing recorded ("not checked yet", never "clean").
/// Tapping a group or a point opens its rows under the picture. Only this coin's own evidence; no other coin appears.
enum EvidenceWebGeometry {
    static let box = 400.0, center = 200.0, ring = 112.0, satAt = 48.0, maxPoints = 6
    static let offsets: [Double] = [55, -55, 85, -85, 115, -115]
    struct Pt { let x: Double, y: Double, onchain: Bool, fact: Int }
    struct Node { let x: Double, y: Double, points: [Pt], more: Int, line: Line }
    enum Line { case chain, reported, none }

    static func layout(_ groups: [EvidenceWords.Group]) -> [Node] {
        groups.enumerated().map { i, g in
            let a = (-90.0 + Double(i) * 60.0) * .pi / 180
            let x = center + cos(a) * ring, y = center + sin(a) * ring
            let pts = g.facts.prefix(maxPoints).enumerated().map { k, f -> Pt in
                let b = a + offsets[k] * .pi / 180
                return Pt(x: x + cos(b) * satAt, y: y + sin(b) * satAt, onchain: f.onchain, fact: k)
            }
            let line: Line = g.facts.isEmpty ? .none : (g.facts.contains { $0.onchain } ? .chain : .reported)
            return Node(x: x, y: y, points: pts, more: max(0, g.facts.count - maxPoints), line: line)
        }
    }
}

struct EvidenceWebRing: View {
    let groups: [EvidenceWords.Group]
    let ticker: String
    /// What is open under the picture: a whole group, or one fact of it.
    @Binding var open: (group: Int, fact: Int?)?

    var body: some View {
        let nodes = EvidenceWebGeometry.layout(groups)
        GeometryReader { geo in
            let side = min(geo.size.width, 360)
            let k = side / EvidenceWebGeometry.box
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in
                    let c = CGPoint(x: EvidenceWebGeometry.center * k, y: EvidenceWebGeometry.center * k)
                    for n in nodes {
                        var p = Path(); p.move(to: c); p.addLine(to: CGPoint(x: n.x * k, y: n.y * k))
                        let style: StrokeStyle = n.line == .reported ? StrokeStyle(lineWidth: 1, dash: [4, 4]) : n.line == .none ? StrokeStyle(lineWidth: 1, dash: [1, 5]) : StrokeStyle(lineWidth: 1.5)
                        ctx.stroke(p, with: .color(n.line == .chain ? Brand.lime.opacity(0.7) : Brand.fg.opacity(n.line == .none ? 0.25 : 0.5)), style: style)
                        for q in n.points {
                            var s = Path(); s.move(to: CGPoint(x: n.x * k, y: n.y * k)); s.addLine(to: CGPoint(x: q.x * k, y: q.y * k))
                            ctx.stroke(s, with: .color(q.onchain ? Brand.lime.opacity(0.55) : Brand.fg.opacity(0.4)), style: StrokeStyle(lineWidth: 1, dash: q.onchain ? [] : [3, 3]))
                        }
                    }
                }
                Circle().fill(Brand.lime.opacity(0.14)).overlay(Circle().stroke(Brand.lime.opacity(0.7), lineWidth: 1.5))
                    .frame(width: 76 * k, height: 76 * k)
                    .overlay(Text(verbatim: String(ticker.prefix(8))).font(Typo.sans(14 * k, .bold)).foregroundStyle(Brand.paper))
                    .position(x: EvidenceWebGeometry.center * k, y: EvidenceWebGeometry.center * k)
                ForEach(Array(groups.enumerated()), id: \.offset) { i, g in
                    let n = nodes[i]
                    ForEach(n.points, id: \.fact) { q in
                        Circle().fill(Brand.glass)
                            .overlay(Circle().stroke(q.onchain ? Brand.lime : Brand.fg.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: q.onchain ? [] : [3, 2])))
                            .frame(width: 14 * k, height: 14 * k)
                            .padding(7)
                            .contentShape(Circle())
                            .onTapGesture { open = (i, q.fact) }
                            .position(x: q.x * k, y: q.y * k)
                            .accessibilityLabel("\(g.label): \(g.facts[q.fact].text)")
                            .accessibilityAddTraits(.isButton)
                    }
                    Circle().fill(Brand.glass)
                        .overlay(Circle().stroke(g.facts.isEmpty ? Brand.fg.opacity(0.35) : Brand.lime.opacity(0.65), style: StrokeStyle(lineWidth: 1.5, dash: g.facts.isEmpty ? [3, 3] : [])))
                        .frame(width: 62 * k, height: 62 * k)
                        .overlay(VStack(spacing: 1) {
                            Text(g.facts.isEmpty ? "○" : String(g.facts.count)).font(Typo.sans(14 * k, .semibold)).foregroundStyle(Brand.paper)
                            Text(verbatim: g.label).font(Typo.sans(10.5 * k)).foregroundStyle(Brand.mute)
                        })
                        .contentShape(Circle())
                        .onTapGesture { open = (i, nil) }
                        .position(x: n.x * k, y: n.y * k)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(g.label): \(g.facts.isEmpty ? "not checked yet" : "\(g.facts.count) facts")")
                        .accessibilityAddTraits(.isButton)
                }
            }
            .frame(width: side, height: side)
            .frame(maxWidth: .infinity)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 360)
        .frame(maxWidth: .infinity)
    }
}
