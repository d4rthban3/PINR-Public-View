package io.pinr.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.pinr.app.feed.ArenaGroup
import io.pinr.app.feed.ArenaMember
import io.pinr.app.feed.ArenaWire
import io.pinr.app.feed.ChainName
import io.pinr.app.feed.Format
import io.pinr.app.feed.PoolWords
import io.pinr.app.feed.Token
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

@Composable
fun ArenaRoom(insets: PaddingValues, onOpen: (Token) -> Unit) {
    val store = LocalLiveFeed.current
    val choices = LocalChoices.current
    var groups by remember { mutableStateOf<List<ArenaGroup>?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(store) {
        while (true) {
            val base = store?.baseUrl
            if (base != null) {
                val g = withContext(Dispatchers.IO) { try { io.pinr.app.feed.UrlHttp.get("$base/api/arena").takeIf { it.first == 200 }?.let { ArenaWire.parse(it.second) } } catch (e: Exception) { null } }
                if (g != null) { groups = g; failed = false } else if (groups == null) failed = true
            }
            delay(20_000)
        }
    }
    var query by remember { mutableStateOf("") }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = insets.calculateTopPadding(), bottom = insets.calculateBottomPadding()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        //
        item { SearchPill(query, { query = it }, "Ticker, name or CA", "arena-search") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                BasicText("PvP Arena", style = sans(30.sp, Brand.paper, FontWeight.Bold))
                BasicText(
                    "Every version of a contested coin, side by side. Ranked by the last 30 minutes' volume, then X, then the chart. Observed figures, not a verdict.",
                    style = sans(13.sp, Brand.mute).copy(lineHeight = 18.sp),
                )
            }
        }
        //
        val g = groups?.let { io.pinr.app.feed.ArenaShown.apply(it, choices?.showMayhem ?: false) }
        if (g == null) item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (failed) PinchScene(PinchArt.waiting, 72)
                BasicText(if (failed) "The Arena is not read yet. PINR asks again shortly." else "Loading…", style = sans(14.sp, Brand.mute))
            }
        }
        else if (g.isEmpty()) item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PinchScene(PinchArt.calm, 64)
                BasicText("No contested coins right now.", style = sans(14.sp, Brand.mute))
            }
        }
        else {
            val q = query.trim()
            val shown = if (q.isEmpty()) g else g.filter { grp -> grp.members.any { arenaMatches(it, q) } }
            if (q.isNotEmpty()) item { BasicText("Search · ${shown.size} ${if (shown.size == 1) "battle" else "battles"} found", style = mono(12.sp, Brand.mute, FontWeight.Medium)) }
            if (shown.isEmpty()) item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PinchScene(PinchArt.waiting, 64)
                    BasicText("Nothing in the Arena matches “$q”.", style = sans(14.sp, Brand.mute))
                }
            }
            items(shown, key = { it.id }) { group -> GroupBlock(group, store, onOpen, showAll = q.isNotEmpty()) }
        }
    }
}

internal fun arenaMatches(m: ArenaMember, query: String): Boolean {
    val q = query.trim().lowercase().removePrefix("$")
    if (q.isEmpty()) return true
    return (m.name ?: "").lowercase().contains(q) || (m.ticker ?: "").lowercase().removePrefix("$").contains(q) || (q.length >= 6 && m.address.lowercase().contains(q))
}

@Composable
private fun GroupBlock(g: ArenaGroup, store: io.pinr.app.feed.FeedStore?, onOpen: (Token) -> Unit, showAll: Boolean) {
    var opening by remember { mutableStateOf<String?>(null) }
    //
    var expanded by remember(g.id) { mutableStateOf(false) }
    LaunchedEffect(opening) {
        val a = opening ?: return@LaunchedEffect
        store?.find(a)?.let(onOpen)
        opening = null
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BasicText(g.title, style = sans(17.sp, Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BasicText(g.ticker, style = mono(12.sp, Brand.mute), maxLines = 1)
        }
        val cut = if (showAll || expanded || g.members.size <= 3) g.members.size else 3
        g.members.take(cut).forEachIndexed { i, m -> MemberCard(m, i + 1) { opening = m.address } }
        if (cut < g.members.size) {
            val left = g.members.size - cut
            BasicText(
                "Show $left more ${if (left == 1) "version" else "versions"}",
                Modifier.fillMaxWidth().clickable { expanded = true }.padding(vertical = 14.dp).semantics { contentDescription = "Show more versions" },
                style = sans(14.sp, Brand.paper, FontWeight.SemiBold).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center),
            )
        }
    }
}

@Composable
private fun MemberCard(m: ArenaMember, rank: Int, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().glass(14.dp).clickable(onClick = onClick).padding(12.dp)
            .semantics { contentDescription = "Open ${m.name ?: PoolWords.shortAddress(m.address)}" },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            BasicText("$rank.", style = mono(12.sp, if (rank == 1) Brand.lime else Brand.mute, FontWeight.Bold))
            BasicText(m.name ?: PoolWords.shortAddress(m.address), style = sans(14.sp, Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            BasicText(m.ticker ?: "", style = mono(11.sp, Brand.mute), maxLines = 1)
            if (m.earliest) BasicText("earliest launch", Modifier.border(1.dp, Brand.lime.copy(alpha = 0.6f), RoundedCornerShape(50)).padding(horizontal = 7.dp, vertical = 2.dp), style = mono(10.sp, Brand.lime, FontWeight.Medium))
        }
        val age = m.launchedAtMs?.let { agoShort(maxOf(0, (System.currentTimeMillis() - it) / 1000)).removeSuffix(" ago") + " old" }
        BasicText(listOfNotNull(m.launchpad ?: m.chain?.let { ChainName.of(it) }, age).joinToString(" · "), style = mono(10.5.sp, Brand.mute))
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Fig("30 min", m.recentText, hot = true); Fig("24h vol", Format.money(m.volume24h)); Fig("X", m.xText)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Fig("24h", m.change24h?.let { String.format(java.util.Locale.US, "%+.1f%%", it) } ?: Format.DASH); Fig("MC", Format.money(m.valuation))
        }
    }
}

@Composable
private fun Fig(label: String, value: String, hot: Boolean = false) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        BasicText(label, style = mono(9.5.sp, Brand.mute))
        BasicText(value, style = mono(11.5.sp, if (hot) Brand.lime else Brand.paper, FontWeight.Medium), maxLines = 1)
    }
}
