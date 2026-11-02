package io.pinr.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.pinr.app.R
import io.pinr.app.feed.Lists

/** The height the row takes under the header, kept free above the tiles. */
val LP_PILLS_H: Dp = 40.dp // the pills (32 dp, in a 44 dp touch area) end 28 dp under the top inset; then the tiles' own row gap (12 dp)

private val LP_ORDER = listOf("pumpfun", "flap", "fourmeme", "zora", "clanker", "bonkfun")
private fun logo(id: String): Int? = when (id) {
    "pumpfun" -> R.drawable.lp_pumpfun
    "flap" -> R.drawable.lp_flap
    "fourmeme" -> R.drawable.lp_fourmeme
    "zora" -> R.drawable.lp_zora
    "clanker" -> R.drawable.lp_clanker
    "bonkfun" -> R.drawable.lp_bonkfun
    else -> null
}

/**
 *
 * page). One pill per launchpad with its own mark (pinr-live/public/art/lp-SOURCES.md), the same size, in one fixed order. A tap picks the
 * launchpad as the funnel's picker does, and it opens on its own first list. A row wider than the screen scrolls sideways.
 */
@Composable
fun LaunchpadPills(listKey: String, onPick: (String) -> Unit, modifier: Modifier = Modifier) {
    val picked = Lists.launchpad(listKey)?.id
    val pads = LP_ORDER.mapNotNull { id -> Lists.all().firstOrNull { it.id == id } }
    //
    Row(modifier.fillMaxWidth().padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
    Row(
        Modifier.weight(1f).horizontalScroll(rememberScrollState()).testTag("lp-pills"),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        for (lp in pads) {
            val on = lp.id == picked
            val shape = RoundedCornerShape(50)
            //
            Box(
                Modifier.width(52.dp).height(44.dp).clickable(remember { MutableInteractionSource() }, indication = null, role = Role.RadioButton) { onPick(Lists.first(lp)) }
                    .semantics { contentDescription = if (on) "${lp.name}, selected" else lp.name; selected = on }.testTag("lppill-${lp.id}"),
                contentAlignment = Alignment.Center,
            ) { Box(
                Modifier.width(52.dp).height(32.dp).clip(shape).background(Brand.glass, shape)
                    // The chosen pill: a heavier lime ring and a check (not colour alone); exactly one at a time.
                    .then(if (on) Modifier.border(2.dp, Brand.lime, shape) else Modifier)
                    ,
                contentAlignment = Alignment.Center,
            ) {
                logo(lp.id)?.let { // The whole logo, never cropped: fitted by its own aspect ratio, no round clip over the art (Clanker's white square gets rounded corners only).
                    Image(painterResource(it), null, Modifier.size(26.dp).clip(RoundedCornerShape(if (lp.id == "clanker") 6.dp else 0.dp)), contentScale = ContentScale.Fit) }
                if (on) BasicText("✓", Modifier.align(Alignment.BottomEnd).padding(end = 3.dp, bottom = 1.dp).background(Brand.lime, CircleShape).size(14.dp), style = sans(10.sp, Brand.ink, FontWeight.ExtraBold).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
            } }
        }
    }
    Spacer(Modifier.width(6.dp))
    FilterButton()
    }
}

val LocalOpenFilters = androidx.compose.runtime.staticCompositionLocalOf<() -> Unit> { {} }

/** The filter funnel at pill height (a 44 dp touch area around the 32 dp button), at the right end of the PINR page's pill row and in Discover's own bar. */
@Composable
fun FilterButton(modifier: Modifier = Modifier) {
    val open = LocalOpenFilters.current
    val shape = RoundedCornerShape(50)
    Box(
        modifier.width(36.dp).height(44.dp)
            .clickable(remember { MutableInteractionSource() }, indication = null, role = Role.Button) { open() }
            .semantics { contentDescription = "Filters" }.testTag("filterbutton"),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.width(36.dp).height(32.dp).clip(shape).background(Brand.glass, shape), contentAlignment = Alignment.Center) {
            Box {
                GlyphIcon(Glyphs.filter, Brand.lime, 20.dp)
                Box(Modifier.align(Alignment.TopEnd).offset(3.dp, (-3).dp).size(6.dp).background(Brand.lime, CircleShape))
            }
        }
    }
}
