package io.pinr.app.ui

import android.provider.Settings
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import io.pinr.app.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 *
 * they travel toward each other and settle exactly on the background logo, the radar pulses, and the veil lifts over 2 s. It plays once per launch (it lives with the
 * activity's content, so never between screens or on return from the background), never holds a slow load (gone after 3.5 s at most), honours
 * the system's "remove animations" setting (a short plain fade) and a link that opens a coin directly gets none. The same in both looks, as the site's.
 */
@Composable
fun BootVeil(skip: Boolean) {
    var gone by remember { mutableStateOf(skip) }
    if (gone) return
    val motion = Settings.Global.getFloat(LocalContext.current.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    val veil = remember { Animatable(1f) }
    val fore = remember { Animatable(1f) }
    val bigIn = remember { Animatable(0f) }
    val smallIn = remember { Animatable(0f) }
    val ring1 = remember { Animatable(0f) }
    val ring2 = remember { Animatable(0f) }
    val settleScale = remember { Animatable(1f) }
    val settleAlpha = remember { Animatable(1f) }
    val started = remember { System.nanoTime() }
    LaunchedEffect(Unit) {
        if (motion) {
            kotlinx.coroutines.coroutineScope {
                launch { bigIn.animateTo(1f, tween(950, easing = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0.8f, 0.25f, 1f))) }
                launch { delay(100); smallIn.animateTo(1f, tween(950, easing = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0.8f, 0.25f, 1f))) }
                launch { delay(1050); ring1.animateTo(1f, tween(1300, easing = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0.6f, 0.3f, 1f))) }
                launch { delay(1450); ring2.animateTo(1f, tween(1300, easing = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0.6f, 0.3f, 1f))) }
                launch { delay(2100 - 450) }
            }
            // Just before the lift the hero takes the background logo's state (its breathing size and brightness).
            val b = if (ThemeState.light) BootAnchor.Breath(1.0, 1.0) else BootAnchor.breathe((System.nanoTime() - started) / 1e9)
            kotlinx.coroutines.coroutineScope {
                launch { settleScale.animateTo(b.scale.toFloat(), tween(450, easing = androidx.compose.animation.core.CubicBezierEasing(0.42f, 0f, 0.58f, 1f))) }
                launch { settleAlpha.animateTo(b.opacity.toFloat(), tween(450, easing = androidx.compose.animation.core.CubicBezierEasing(0.42f, 0f, 0.58f, 1f))) }
            }
        } else { bigIn.snapTo(1f); smallIn.snapTo(1f); delay(600) }
        // the foreground leaves faster than the veil, as on the site
        kotlinx.coroutines.coroutineScope {
            launch { fore.animateTo(0f, tween(if (motion) 900 else 250, easing = LinearEasing)) }
            veil.animateTo(0f, tween(if (motion) 2000 else 250, easing = LinearEasing))
        }
        gone = true
    }
    val t = rememberInfiniteTransition(label = "boot")
    val pulse by t.animateFloat(1f, if (motion) 0.5f else 1f, infiniteRepeatable(tween(2000), RepeatMode.Reverse), label = "pulse")
    BoxWithConstraints(Modifier.fillMaxSize().semantics { contentDescription = "Loading" }) {
        val u = BootAnchor.unit(maxWidth.value, maxHeight.value, ThemeState.light).dp // one art unit of the background
        val w = maxWidth; val h = maxHeight
        Box(
            Modifier.fillMaxSize().alpha(veil.value).background(
                Brush.radialGradient(listOf(Color(0xFF2C1458), Color(0xFF180830), Color.Black), radius = 1100f),
            ),
        )
        Box(Modifier.fillMaxSize().alpha(fore.value), contentAlignment = Alignment.Center) {
            Box(
                Modifier.size(u * 470f).alpha(pulse).blur(24.dp).background(
                    Brush.radialGradient(listOf(Color(0x59C084FC), Color(0x268B5CF6), Color.Transparent)), CircleShape,
                ),
            )
            for (r in listOf(ring1, ring2)) {
                if (r.value > 0f && r.value < 1f) Box(Modifier.size(u * 212f).scale(0.4f + 3.8f * r.value).alpha(0.7f * (1f - r.value)).border(2.dp, Color(0xFFD6FF3C), CircleShape))
            }
            // The large blade comes in from the northeast, the small one from the southwest (324b). The hero is the background logo's own box (292.95 x 345.6 art units), centred.
            Box(Modifier.size(u * BootAnchor.LOGO_W, u * BootAnchor.LOGO_H).graphicsLayer { scaleX = settleScale.value; scaleY = settleScale.value; alpha = settleAlpha.value }) {
                Image(painterResource(R.drawable.boot_blade_big), null, Modifier.fillMaxSize().graphicsLayer { translationX = w.toPx() * 0.65f * (1f - bigIn.value); translationY = -h.toPx() * 0.65f * (1f - bigIn.value); alpha = bigIn.value })
                Image(painterResource(R.drawable.boot_blade_small), null, Modifier.fillMaxSize().graphicsLayer { translationX = -w.toPx() * 0.65f * (1f - smallIn.value); translationY = h.toPx() * 0.65f * (1f - smallIn.value); alpha = smallIn.value })
            }
            Box(
                Modifier.offset(y = u * (BootAnchor.LOGO_H / 2f) + 40.dp).width(64.dp).height(2.dp).alpha(pulse)
                    .background(Brush.horizontalGradient(listOf(Color.Transparent, Color(0xFFBEF264), Color.Transparent))),
            )
        }
    }
}

/**
 *
 * logo 292.95 x 345.6 art units, centred. Dark look: the 720 x 1560 video fills the screen, oversized 1.14 (0.6 of a video pixel per art unit). Light look: the 1600 x 1600 picture fills the
 * screen (4/3 of a picture pixel per art unit). The logo breathes 0.96 to 1.045 (brightness 0.56 to 1) over 35.2 s with ease-in-out, as the art does.
 */
object BootAnchor {
    const val LOGO_W = 292.95f
    const val LOGO_H = 345.6f
    data class Breath(val scale: Double, val opacity: Double)

    /** One art unit in dp on a screen of this size. */
    fun unit(w: Float, h: Float, light: Boolean): Float =
        if (light) maxOf(w, h) / 1200f else 0.6f * 1.14f * maxOf(w / 720f, h / 1560f)

    /** The logo's breathing size and brightness `t` seconds into the loop. */
    fun breathe(t: Double): Breath {
        val period = 35.2
        val ph = ((t % period) + period) % period / period
        val hh = if (ph < 0.5) ph * 2 else (1 - ph) * 2
        var lo = 0.0; var hi = 1.0; var x = hh
        repeat(24) {
            x = (lo + hi) / 2
            val bx = 3 * (1 - x) * (1 - x) * x * 0.42 + 3 * (1 - x) * x * x * 0.58 + x * x * x
            if (bx < hh) lo = x else hi = x
        }
        val e = 3 * (1 - x) * x * x + x * x * x
        return Breath(0.96 + (1.045 - 0.96) * e, 0.56 + (1 - 0.56) * e)
    }
}
