package io.pinr.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.pinr.app.feed.Format
import io.pinr.app.feed.Token

/**
 *
 * the card carries and a few more in clear view, and a Deep Scan button that goes on to the coin's DeepScan page. Observed words only; a missing figure is a dash.
 */
@Composable
fun FullCard(t: Token, time: () -> Double, insets: PaddingValues, onClose: () -> Unit, onDeepScan: () -> Unit) {
    val age = Format.ageText(t.launchedAtMs?.let { (System.currentTimeMillis() - it) / 60_000.0 })
    Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.45f)).clickable(onClick = onClose).testTag("fullcard-${t.id}")) {
        Column(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = insets.calculateTopPadding() + 8.dp, bottom = insets.calculateBottomPadding() + 20.dp)
                .glass(28.dp).clickable(enabled = false) {}.verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // The Close chip sits over the panel's top right corner instead of beside the tile: the larger tile left it only about 60 dp, which cut "Close" to "Cl"
            // (the inspector's note, 12 Nov).
            Box(Modifier.fillMaxWidth()) {
                //
                TileView(t, 200.dp, time, Modifier.width(200.dp).align(Alignment.TopStart))
                BasicText(
                    "Close",
                    Modifier.align(Alignment.TopEnd).background(Brand.fg.copy(alpha = 0.09f), RoundedCornerShape(50)).clickable(onClick = onClose).padding(horizontal = 18.dp, vertical = 11.dp).testTag("fullcard-close"),
                    style = sans(14.sp, Brand.paper, FontWeight.SemiBold),
                    softWrap = false, maxLines = 1,
                )
            }
            val up = (t.change24hPct ?: 0.0) >= 0
            val rows = listOfNotNull(
                t.score?.let { Triple("Token health", "$it · ${Format.coverage(t.coverage)}", null as androidx.compose.ui.graphics.Color?) },
                Triple("Market cap", Format.usdCompact(t.valuationUsd), null),
                Triple("All-time high", Format.usdCompact(t.athUsd), null),
                Triple("24h change", Format.change(t.change24hPct, t.changeWindowHours), if (t.change24hPct == null) null else if (up) Brand.lime else Brand.mandarin),
                Triple("Price", Format.price(t.priceUsd), null),
                Triple("24h volume", Format.usdCompact(t.volume24hUsd), null),
                Triple("Liquidity", Format.usdCompact(t.liquidityUsd), null),
                Triple("Age", age, null),
                Triple("Trades, last hour", t.hourTrades?.let { String.format(java.util.Locale.US, "%,d", it) } ?: Format.DASH, null),
                Triple("Pair", t.quotePair?.takeIf { it.isNotEmpty() } ?: Format.DASH, null),
            )
            rows.chunked(2).forEach { pair ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    pair.forEach { (label, value, tone) ->
                        Column(Modifier.weight(1f).background(Brand.fg.copy(alpha = 0.06f), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            BasicText(label, style = mono(12.5.sp, Brand.mute))
                            BasicText(value, style = mono(18.sp, tone ?: Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            Box(Modifier.fillMaxWidth().height(52.dp).background(Brand.lime, RoundedCornerShape(50)).clickable(onClick = onDeepScan).testTag("fullcard-deepscan"), contentAlignment = Alignment.Center) {
                BasicText("Deep Scan", style = sans(17.sp, Brand.onLive, FontWeight.SemiBold))
            }
        }
    }
}
