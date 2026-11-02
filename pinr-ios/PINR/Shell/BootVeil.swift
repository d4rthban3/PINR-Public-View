import SwiftUI

//
/// they travel toward each other and settle exactly on the background logo and form the hero mark, the radar pulses, and the veil lifts over 2 s. It plays once per launch (the view lives with the
/// app, so never between screens or on return from the background), never holds a slow load (gone after 3.5 s at most), honours Reduce Motion
/// (a short plain fade) and a link that opens a coin directly gets none. The same in both looks, as the site's.
struct BootVeil: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme
    @Binding var hidden: Bool
    @State private var pulse = false
    @State private var met = false
    @State private var settled: (scale: Double, opacity: Double)?
    @State private var foreOpacity = 1.0
    @State private var veilOpacity = 1.0
    @State private var started = Date()

    var body: some View {
        GeometryReader { geo in
            let u = BootAnchor.unit(size: geo.size, light: scheme == .light) // one art unit of the background, in points
            let w = geo.size.width, h = geo.size.height
            ZStack {
                RadialGradient(colors: [Color(red: 0.173, green: 0.078, blue: 0.345), Color(red: 0.094, green: 0.031, blue: 0.188), .black],
                               center: .center, startRadius: 0, endRadius: 560)
                    .opacity(veilOpacity)
                ZStack {
                    Circle()
                        .fill(RadialGradient(colors: [Color(red: 0.753, green: 0.518, blue: 0.988).opacity(0.35), Color(red: 0.545, green: 0.361, blue: 0.965).opacity(0.15), .clear],
                                             center: .center, startRadius: 0, endRadius: u * 235))
                        .frame(width: u * 470, height: u * 470).blur(radius: 24)
                        .opacity(pulse ? 0.5 : 1)
                    if !reduceMotion { RadarRing(delay: 1.05, size: u * 212); RadarRing(delay: 1.45, size: u * 212) }
                    //
                    ZStack {
                        Image("boot-blade-big").resizable().scaledToFit().offset(x: met || reduceMotion ? 0 : w * 0.65, y: met || reduceMotion ? 0 : -h * 0.65).opacity(met || reduceMotion ? 1 : 0)
                        Image("boot-blade-small").resizable().scaledToFit().offset(x: met || reduceMotion ? 0 : -w * 0.65, y: met || reduceMotion ? 0 : h * 0.65).opacity(met || reduceMotion ? 1 : 0)
                            .animation(.timingCurve(0.2, 0.8, 0.25, 1, duration: 0.95).delay(0.1), value: met)
                    }
                    .animation(.timingCurve(0.2, 0.8, 0.25, 1, duration: 0.95), value: met)
                    // The hero is the background logo's own box (292.95 x 345.6 art units), centred on the screen, and just before the lift takes its breathing size and brightness.
                    .frame(width: u * BootAnchor.logoW, height: u * BootAnchor.logoH)
                    .scaleEffect(settled?.scale ?? 1)
                    .opacity(settled?.opacity ?? 1)
                    Capsule()
                        .fill(LinearGradient(colors: [.clear, Color(red: 0.745, green: 0.949, blue: 0.392), .clear], startPoint: .leading, endPoint: .trailing))
                        .frame(width: 64, height: 2).opacity(pulse ? 0.5 : 1)
                        .offset(y: u * BootAnchor.logoH / 2 + 40)
                }
                .opacity(foreOpacity)
                .position(x: w / 2, y: h / 2)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(!hidden)
        .accessibilityElement(children: .ignore).accessibilityLabel("Loading")
        .task {
            started = Date()
            if !reduceMotion { withAnimation(.easeInOut(duration: 2).repeatForever()) { pulse = true } }
            met = true
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 600 : 2100 - 450))
            settle()
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 0 : 450))
            fade()
        }
        .onChange(of: hidden) { _, h in if h { settle(); fade() } }
    }

    /// Just before the lift the hero takes the background logo's state: its breathing size and brightness (the dark look's video loops from the app's start; the light look's picture is still).
    private func settle() {
        guard settled == nil else { return }
        let b = scheme == .light ? (scale: 1.0, opacity: 1.0) : BootAnchor.breathe(Date().timeIntervalSince(started))
        withAnimation(.easeInOut(duration: reduceMotion ? 0 : 0.45)) { settled = b }
    }

    private func fade() {
        withAnimation(.linear(duration: reduceMotion ? 0.25 : 0.9)) { foreOpacity = 0 }
        withAnimation(.linear(duration: reduceMotion ? 0.25 : 2)) { veilOpacity = 0 }
    }
}

//
/// 292.95 x 345.6 art units, centred. Dark look: the 720 x 1560 video fills the screen (0.6 of a video pixel per art unit, centred). Light look: the 1600 x 1600
/// picture fills the screen (4/3 of a picture pixel per art unit). The logo breathes 0.96 to 1.045 (brightness 0.56 to 1) over 35.2 s with ease-in-out, as the art does.
enum BootAnchor {
    static let logoW = 292.95
    static let logoH = 345.6
    /// One art unit in points on a screen of this size.
    static func unit(size: CGSize, light: Bool) -> CGFloat {
        light ? max(size.width, size.height) / 1200 : 0.6 * max(size.width / 720, size.height / 1560)
    }
    /// The logo's breathing size and brightness `t` seconds into the loop.
    static func breathe(_ t: Double) -> (scale: Double, opacity: Double) {
        let period = 35.2
        let ph = (t.truncatingRemainder(dividingBy: period) + period).truncatingRemainder(dividingBy: period) / period
        let h = ph < 0.5 ? ph * 2 : (1 - ph) * 2
        // CSS ease-in-out, cubic-bezier(.42, 0, .58, 1): find the curve parameter whose x is h, return its y.
        var lo = 0.0, hi = 1.0, x = h
        for _ in 0..<24 {
            x = (lo + hi) / 2
            let bx = 3 * (1 - x) * (1 - x) * x * 0.42 + 3 * (1 - x) * x * x * 0.58 + x * x * x
            if bx < h { lo = x } else { hi = x }
        }
        let e = 3 * (1 - x) * x * x + x * x * x
        return (0.96 + (1.045 - 0.96) * e, 0.56 + (1 - 0.56) * e)
    }
}

/// One pulse of the radar: a lime ring grows from the hero and fades.
private struct RadarRing: View {
    let delay: Double
    var size: CGFloat = 120
    @State private var on = false
    @State private var p = 0.0
    var body: some View {
        Circle().strokeBorder(Color(red: 0.839, green: 1, blue: 0.235), lineWidth: 2).frame(width: size, height: size)
            .scaleEffect(0.4 + 3.8 * p).opacity(on ? 0.7 * (1 - p) : 0)
            .task {
                try? await Task.sleep(for: .seconds(delay))
                on = true
                withAnimation(.easeOut(duration: 1.3)) { p = 1 }
            }
    }
}
