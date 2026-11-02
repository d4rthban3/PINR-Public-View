package io.pinr.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.unit.dp
import io.pinr.app.feed.EvidenceWords
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 *
 * point on its group. Solid = ● read on chain, dashed = ○ reported, faint dots = nothing recorded ("not checked yet", never "clean"). A tap on a group
 * or a point opens its rows under the picture. Only this coin's own evidence; no other coin appears.
 */
object EvidenceWebGeometry {
    const val BOX = 400f
    const val CENTER = 200f
    const val RING = 112f
    const val SAT_AT = 48f
    const val MAX_POINTS = 6
    private val OFFSETS = floatArrayOf(55f, -55f, 85f, -85f, 115f, -115f)
    enum class Line { Chain, Reported, None }
    data class Pt(val x: Float, val y: Float, val onchain: Boolean, val fact: Int)
    data class Node(val x: Float, val y: Float, val points: List<Pt>, val more: Int, val line: Line)

    fun layout(groups: List<EvidenceWords.Group>): List<Node> = groups.mapIndexed { i, g ->
        val a = Math.toRadians((-90.0 + i * 60.0))
        val x = CENTER + (cos(a) * RING).toFloat()
        val y = CENTER + (sin(a) * RING).toFloat()
        val pts = g.facts.take(MAX_POINTS).mapIndexed { k, f ->
            val b = a + Math.toRadians(OFFSETS[k].toDouble())
            Pt(x + (cos(b) * SAT_AT).toFloat(), y + (sin(b) * SAT_AT).toFloat(), f.onchain, k)
        }
        val line = if (g.facts.isEmpty()) Line.None else if (g.facts.any { it.onchain }) Line.Chain else Line.Reported
        Node(x, y, pts, maxOf(0, g.facts.size - MAX_POINTS), line)
    }
}

@Composable
fun EvidenceWebRing(groups: List<EvidenceWords.Group>, ticker: String, onOpen: (group: Int, fact: Int?) -> Unit) {
    val nodes = EvidenceWebGeometry.layout(groups)
    val measurer = rememberTextMeasurer()
    val lime = Brand.lime
    val fg = Brand.fg
    val paper = Brand.paper
    val mute = Brand.mute
    val glass = Brand.glass
    Canvas(
        Modifier.fillMaxWidth().widthIn(max = 360.dp).aspectRatio(1f)
            .pointerInput(groups) {
                detectTapGestures { p ->
                    val k = size.width / EvidenceWebGeometry.BOX
                    val x = p.x / k
                    val y = p.y / k
                    // A point first (small, on top), then a group's circle.
                    nodes.forEachIndexed { i, n -> n.points.forEach { q -> if (hypot(x - q.x, y - q.y) <= 14f) { onOpen(i, q.fact); return@detectTapGestures } } }
                    nodes.forEachIndexed { i, n -> if (hypot(x - n.x, y - n.y) <= 31f) { onOpen(i, null); return@detectTapGestures } }
                }
            },
    ) {
        val k = size.width / EvidenceWebGeometry.BOX
        fun o(x: Float, y: Float) = Offset(x * k, y * k)
        val c = o(EvidenceWebGeometry.CENTER, EvidenceWebGeometry.CENTER)
        for (n in nodes) {
            val dash = when (n.line) {
                EvidenceWebGeometry.Line.Chain -> null
                EvidenceWebGeometry.Line.Reported -> PathEffect.dashPathEffect(floatArrayOf(4f * k, 4f * k))
                EvidenceWebGeometry.Line.None -> PathEffect.dashPathEffect(floatArrayOf(1f * k, 5f * k))
            }
            drawLine(if (n.line == EvidenceWebGeometry.Line.Chain) lime.copy(alpha = 0.7f) else fg.copy(alpha = if (n.line == EvidenceWebGeometry.Line.None) 0.25f else 0.5f), c, o(n.x, n.y), strokeWidth = 1.5f * k, pathEffect = dash)
            for (q in n.points) {
                drawLine(if (q.onchain) lime.copy(alpha = 0.55f) else fg.copy(alpha = 0.4f), o(n.x, n.y), o(q.x, q.y), strokeWidth = 1f * k,
                    pathEffect = if (q.onchain) null else PathEffect.dashPathEffect(floatArrayOf(3f * k, 3f * k)))
            }
        }
        drawCircle(lime.copy(alpha = 0.14f), 38f * k, c)
        drawCircle(lime.copy(alpha = 0.7f), 38f * k, c, style = Stroke(1.5f * k))
        fun label(text: String, at: Offset, size: Float, color: androidx.compose.ui.graphics.Color, w: FontWeight = FontWeight.Normal) {
            val r = measurer.measure(text, TextStyle(color = color, fontSize = (size * k).toSp(), fontWeight = w))
            drawText(r, topLeft = Offset(at.x - r.size.width / 2f, at.y - r.size.height / 2f))
        }
        label(ticker.take(8), c, 14f, paper, FontWeight.Bold)
        groups.forEachIndexed { i, g ->
            val n = nodes[i]
            for (q in n.points) {
                drawCircle(glass, 7f * k, o(q.x, q.y))
                drawCircle(if (q.onchain) lime else fg.copy(alpha = 0.6f), 7f * k, o(q.x, q.y),
                    style = Stroke(1.5f * k, pathEffect = if (q.onchain) null else PathEffect.dashPathEffect(floatArrayOf(3f * k, 2f * k))))
            }
            drawCircle(glass, 31f * k, o(n.x, n.y))
            drawCircle(if (g.facts.isEmpty()) fg.copy(alpha = 0.35f) else lime.copy(alpha = 0.65f), 31f * k, o(n.x, n.y),
                style = Stroke(1.5f * k, pathEffect = if (g.facts.isEmpty()) PathEffect.dashPathEffect(floatArrayOf(3f * k, 3f * k)) else null))
            label(if (g.facts.isEmpty()) "○" else g.facts.size.toString(), o(n.x, n.y - 8f), 14f, paper, FontWeight.SemiBold)
            label(g.label, o(n.x, n.y + 10f), 10.5f, mute)
        }
    }
}
