package io.pinr.app.ui

import androidx.compose.foundation.horizontalScroll
import io.pinr.app.feed.jsTrim
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import io.pinr.app.R
import androidx.compose.runtime.collectAsState
import io.pinr.app.feed.CandleSet
import io.pinr.app.feed.CoinAddress
import io.pinr.app.feed.CoinClient
import io.pinr.app.feed.DiscoverRanking
import io.pinr.app.feed.DiscoverTab
import io.pinr.app.feed.FeedData
import io.pinr.app.feed.FeedState
import io.pinr.app.feed.Format
import io.pinr.app.feed.LiteChart
import io.pinr.app.feed.NoScoreLabel
import io.pinr.app.feed.Ribbon
import io.pinr.app.feed.Timeframe
import io.pinr.app.feed.Token
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal fun sans(size: TextUnit, color: Color, weight: FontWeight = FontWeight.Normal) = TextStyle(color = color, fontSize = size, fontWeight = weight)
internal fun mono(size: TextUnit, color: Color, weight: FontWeight = FontWeight.Normal) =
    TextStyle(color = color, fontSize = size, fontWeight = weight, fontFamily = FontFamily.Monospace)

/**
 * The Discover room (west on the map), in the site's look (ui/discover.ts) as the iPhone app draws it: the PINR wordmark,
 * "clean up the trenches" and the blurb, the search pill, the market pulse with Refresh, the four tabs,
 * then 30 cards. As on the site the list is a snapshot: re-ranked on a tab, a search or Refresh.
 */
@Composable
fun DiscoverRoom(
    feed: FeedData, client: CoinClient, insets: PaddingValues, listKey: String, onListKey: (String) -> Unit, onOpen: (Token) -> Unit,
    tab: DiscoverTab, onTab: (DiscoverTab) -> Unit, query: String, onQuery: (String) -> Unit,
    list: androidx.compose.foundation.lazy.LazyListState = androidx.compose.foundation.lazy.rememberLazyListState(),
) {
    // The picker is shared with the PINR page: a list chosen there shows here, and Token health is the empty key.
    LaunchedEffect(listKey) { if (tab != DiscoverTab.BaseBnb) onTab(if (listKey.isEmpty()) DiscoverTab.PinrScore else DiscoverTab.List) }
    var order by remember { mutableStateOf<List<String>>(emptyList()) }
    var lastKnown by remember { mutableStateOf<Map<String, Token>>(emptyMap()) }
    var rankedWholeSet by remember { mutableStateOf(false) }
    var rankedAt by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val current by rememberUpdatedState(feed)
    val choices = LocalChoices.current
    val scope = rememberCoroutineScope()
    val wholeSetRead = feed.restTotal?.let { feed.restLoaded >= it } ?: false
    // The Base/BNB tab reads those coins on their own (`chains=base,bsc`), so it fills in a second or two instead of after the whole sweep.
    val liveStore = LocalLiveFeed.current
    var chainCoins by remember { mutableStateOf<List<Token>>(emptyList()) }
    var chainCoinsLoaded by remember { mutableStateOf(false) }

    suspend fun rerank() {
        val f = current
        val t = tab; val q = query
        // A search finds every coin (even a hidden one, so it can always be looked up); the lists leave hidden coins out.
        val base = if (q.jsTrim().isNotEmpty()) f.all else choices?.visible(f.all) ?: f.all
        val pool = if (t == DiscoverTab.List && q.isEmpty()) {
            base + f.ownCoins.filter { it.id !in f.byId }
        } else if (t == DiscoverTab.BaseBnb && q.isEmpty()) {
            val have = base.mapTo(HashSet()) { it.id }
            base + (choices?.visible(chainCoins) ?: chainCoins).filter { it.id !in have }
        } else base
        val ranked = withContext(Dispatchers.Default) { DiscoverRanking.rank(t, pool, q, listKey = listKey) }
        order = ranked.map { it.id }
        lastKnown = ranked.associateBy { it.id }
        rankedAt = System.currentTimeMillis()
    }
    LaunchedEffect(tab, query, listKey, feed.ownRev) {
        rerank()
        if (tab == DiscoverTab.BaseBnb && query.isEmpty() && !chainCoinsLoaded) {
            liveStore?.chainCoins()?.let { chainCoins = it; chainCoinsLoaded = true; rerank() }
        }
    }
    LaunchedEffect(feed.all.isEmpty()) { if (order.isEmpty()) rerank() }
    // Hiding a coin, or showing them again, re-ranks at once.
    LaunchedEffect(choices?.hidden, choices?.showMayhem) { if (order.isNotEmpty()) rerank() }
    LaunchedEffect(wholeSetRead) { if (wholeSetRead && !rankedWholeSet) { rankedWholeSet = true; rerank() } }
    //
    val findStore = LocalLiveFeed.current
    LaunchedEffect(query) {
        val q = query.jsTrim()
        if (CoinAddress.isAddress(q) && feed.byId[q.lowercase()] == null) {
            findStore?.find(q)?.let { t -> order = listOf(t.id); lastKnown = mapOf(t.id to t) }
        }
    }
    val cards = remember(order, feed.byId) { order.mapNotNull { feed.byId[it] ?: lastKnown[it] } }
    //
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var view by remember { mutableStateOf(DiscoverView.load(ctx)) }

    LazyColumn(
        Modifier.fillMaxSize().testTag("discover-list"),
        state = list,
        contentPadding = PaddingValues(start = 10.dp, end = 10.dp, top = insets.calculateTopPadding(), bottom = insets.calculateBottomPadding()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Hero() }
        // The search pill stays under the header while the list scrolls, as on the site.
        stickyHeader { SearchPill(query, onChange = { onQuery(it) }) }
        item { Pulse(feed, rankedAt, tab, listKey, query, cards.size, view, onView = { v -> view = v; DiscoverView.save(ctx, v) }, onTab = { t -> onTab(t); if (t == DiscoverTab.PinrScore) onListKey("") }, onList = onListKey, onRefresh = { scope.launch { rerank() } }) }
        when {
            feed.state is FeedState.Mismatch -> item { Notice("The feed speaks a different data contract than this app. Results are not shown until the two agree.", PaddingValues()) }
            cards.isEmpty() && (feed.all.isEmpty() || (tab == DiscoverTab.BaseBnb && query.isEmpty() && !chainCoinsLoaded)) -> item { Box(Modifier.fillMaxWidth().padding(top = 60.dp), contentAlignment = Alignment.Center) { Spinner() } }
            cards.isEmpty() -> item {
                Notice(if (query.isEmpty()) when (tab) {
                    DiscoverTab.Fresh -> "No coins under an hour old right now."
                    DiscoverTab.PinrScore -> "No coins with a health reading yet."
                    DiscoverTab.BaseBnb -> "No Base or BNB Chain coins yet."
                    else -> "Nothing to show yet."
                } else "No coin matches “$query”.", PaddingValues(), PinchArt.magnifier)
            }
            view == DiscoverView.List -> items(cards, key = { "r-" + it.id }) { DiscoverRow(it) { t -> onOpen(t) } }
            view == DiscoverView.Gallery -> items(cards.chunked(2), key = { "g-" + it.first().id }) { pair ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    pair.forEach { t -> Box(Modifier.weight(1f)) { DiscoverTile(t) { x -> onOpen(x) } } }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            else -> items(cards, key = { it.id }) { DiscoverCard(it, client, onHide = { t -> choices?.hide(t) }) { t -> onOpen(t) } }
        }
    }
}

@Composable
private fun Hero() {
    Column(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box {
            // The wordmark at the site's 190 wide (the art is 1242 by 492).
            Image(wordmarkPainter(), "PINR", Modifier.size(190.dp, (190f * 492f / 1242.3f).dp), contentScale = androidx.compose.ui.layout.ContentScale.Fit)
        }
        BasicText("clean up the trenches", style = sans(20.sp, Brand.paper, FontWeight.SemiBold))
        BasicText(
            "Deep scans contract architecture, custody protocol, quote pairing synergy, launchpad reward protocols, and social media posts to help traders see what the developer did, real efforts, and strategy for the endgame.",
            Modifier.padding(horizontal = 8.dp),
            style = sans(13.sp, Brand.paper.copy(alpha = 0.72f)).copy(textAlign = TextAlign.Center, lineHeight = 18.sp),
        )
    }
}

@Composable
internal fun SearchPill(query: String, onChange: (String) -> Unit, hint: String = "Ticker, name, CA, X, social, or website", tag: String = "discover-search") {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp).height(52.dp).glass(26.dp).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GlyphIcon(Glyphs.search, Brand.paper.copy(alpha = 0.8f), 20.dp)
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f)) {
            if (query.isEmpty()) BasicText(hint, style = sans(15.sp, Brand.mute), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BasicTextField(
                query, onChange, Modifier.fillMaxWidth().testTag(tag), singleLine = true,
                textStyle = sans(15.sp, Brand.paper), cursorBrush = SolidColor(Brand.lime),
            )
        }
        if (query.isNotEmpty()) {
            BasicText("✕", Modifier.padding(start = 8.dp).clickable { onChange("") }, style = sans(15.sp, Brand.mute))
        }
    }
}

@Composable
private fun UpdatedAgo(name: String, rankedAt: Long, modifier: Modifier) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = System.currentTimeMillis() } }
    BasicText("$name · updated ${maxOf(0L, (now - rankedAt) / 1000)}s ago", modifier, style = mono(10.5.sp, Brand.mute))
}

@Composable
private fun Pulse(feed: FeedData, rankedAt: Long, tab: DiscoverTab, listKey: String, query: String, count: Int, view: DiscoverView, onView: (DiscoverView) -> Unit, onTab: (DiscoverTab) -> Unit, onList: (String) -> Unit, onRefresh: () -> Unit) {
    Column(Modifier.padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(7.dp).background(Brand.lime, CircleShape))
            Spacer(Modifier.width(8.dp))
            BasicText("TRENCHES MARKET PULSE", style = mono(11.sp, Brand.paper, FontWeight.Bold).copy(letterSpacing = 0.2.em))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            // The site's line: the feed's name, and seconds since the list was ranked.
            UpdatedAgo(feedName(feed.state), rankedAt, Modifier.weight(1f))
            BasicText(
                "Refresh",
                Modifier.background(Brand.fg.copy(alpha = 0.07f), RoundedCornerShape(50)).clickable(onClick = onRefresh).padding(horizontal = 12.dp, vertical = 5.dp),
                style = mono(11.sp, Brand.paper, FontWeight.Medium),
            )
        }
        if (query.isEmpty()) {
            //
            @Composable fun Pill(label: String, on: Boolean, tag: String, modifier: Modifier, height: androidx.compose.ui.unit.Dp = 40.dp, onClick: () -> Unit) {
                Box(
                    modifier.height(height)
                        .background(if (on) Brand.lime else Brand.glass, RoundedCornerShape(50))
                        .border(1.dp, if (on) Color.Transparent else Brand.fg.copy(alpha = 0.12f), RoundedCornerShape(50))
                        .clickable(onClick = onClick).testTag(tag),
                    contentAlignment = Alignment.Center,
                ) { BasicText(label, Modifier.padding(horizontal = 8.dp), style = sans(12.sp, if (on) Brand.ink else Brand.mute, FontWeight.Medium).copy(textAlign = TextAlign.Center), maxLines = 1) }
            }
            val pickedLp = io.pinr.app.feed.Lists.launchpad(listKey)
            // With the launchpads' own lists there can be eight tabs: the row scrolls sideways rather than squeezing them.
            Row(Modifier.padding(horizontal = 2.dp).horizontalScroll(androidx.compose.foundation.rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                io.pinr.app.feed.Lists.all().forEach { lp ->
                    Pill(lp.name, tab == DiscoverTab.List && pickedLp?.id == lp.id, "dtab-${lp.id}", Modifier) { onList(io.pinr.app.feed.Lists.first(lp)) }
                }
                Pill("Token health", tab == DiscoverTab.PinrScore, "dtab-PinrScore", Modifier) { onTab(DiscoverTab.PinrScore) }
                Pill("Base/BNB", tab == DiscoverTab.BaseBnb, "dtab-BaseBnb", Modifier) { onTab(DiscoverTab.BaseBnb) }
            }
            if (tab == DiscoverTab.List && pickedLp != null) {
                Row(Modifier.padding(horizontal = 2.dp).horizontalScroll(androidx.compose.foundation.rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    pickedLp.lists.forEach { l ->
                        val k = io.pinr.app.feed.Lists.key(pickedLp, l)
                        Pill(if (l.pinr) "${l.name} · PINR's list" else l.name, k == listKey, "dlist-${l.id}", Modifier, 34.dp) { onList(k) }
                    }
                }
            }
            val lab = if (tab == DiscoverTab.List) io.pinr.app.feed.Lists.label(listKey) else null
            Row(verticalAlignment = Alignment.CenterVertically) {
                BasicText(if (lab != null) "${lab.first} · ${lab.second} · $count" else "${tab.hint} · $count", Modifier.weight(1f), style = mono(11.5.sp, Brand.mute))
                ViewSwitch(view, onView)
                Spacer(Modifier.width(6.dp))
                FilterButton()
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BasicText("Every coin, biggest first · $count", Modifier.weight(1f), style = mono(11.5.sp, Brand.mute))
                ViewSwitch(view, onView)
                Spacer(Modifier.width(6.dp))
                FilterButton()
            }
        }
    }
}

enum class DiscoverView(val label: String, val glyph: String) {
    Cards("Cards", "▤"), List("List", "☰"), Gallery("Gallery", "▦");
    companion object {
        fun load(ctx: android.content.Context): DiscoverView = try {
            val k = ctx.getSharedPreferences("pinr", android.content.Context.MODE_PRIVATE).getString("discoverView", null)
            entries.firstOrNull { it.name == k } ?: Cards
        } catch (e: Exception) { Cards }
        fun save(ctx: android.content.Context, v: DiscoverView) {
            try { ctx.getSharedPreferences("pinr", android.content.Context.MODE_PRIVATE).edit().putString("discoverView", v.name).apply() } catch (e: Exception) {}
        }
    }
}

/** The switch (the site's `.dviews`): three buttons in a glass capsule, the chosen one in lime. */
@Composable
private fun ViewSwitch(view: DiscoverView, onView: (DiscoverView) -> Unit) {
    Row(Modifier.background(Brand.glass, RoundedCornerShape(50)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        DiscoverView.entries.forEach { v ->
            val on = v == view
            Box(
                Modifier.size(width = 44.dp, height = 34.dp).background(if (on) Brand.lime else Color.Transparent, RoundedCornerShape(50))
                    .clickable { onView(v) }.testTag("dview-${v.name}"),
                contentAlignment = Alignment.Center,
            ) { BasicText(v.glyph, style = sans(17.sp, if (on) Brand.onLive else Brand.mute, FontWeight.SemiBold)) }
        }
    }
}

/** List view: one dense row per coin (picture, name and ticker, tags, market cap, the move, the score when shown); every text 11.5 sp or more. */
@Composable
private fun DiscoverRow(t: Token, open: (Token) -> Unit) {
    val c = Format.corner(t)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 62.dp).glass(16.dp).clickable { open(t) }.padding(horizontal = 14.dp, vertical = 10.dp).testTag("drow-${t.id}"),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TokenPicture(t, 38.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            BasicText(Format.title(t), style = sans(15.sp, Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BasicText(Format.ticker(t), style = mono(11.5.sp, Brand.mute), maxLines = 1, overflow = TextOverflow.Ellipsis)
            TagPills(t)
        }
        if (!c.flagged) Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            BasicText(Format.usdCompact(t.valuationUsd), style = mono(12.5.sp, Brand.paper, FontWeight.Medium))
            BasicText(Format.change(t.change24hPct, t.changeWindowHours), style = mono(12.5.sp, if ((t.change24hPct ?: 0.0) >= 0) Brand.lime else Brand.mandarin, FontWeight.Bold))
        }
        if (c.flagged) BasicText(c.score, style = sans(13.sp, Brand.mandarin, FontWeight.Bold))
        else if (c.numeric) BasicText(c.score, style = sans(26.sp, Brand.score(c.score.toInt()), FontWeight.SemiBold).copy(fontFeatureSettings = "tnum"))
    }
}

/** Gallery view: a tile per coin, two to a row. */
@Composable
private fun DiscoverTile(t: Token, open: (Token) -> Unit) {
    val c = Format.corner(t)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 190.dp).glass(20.dp).clickable { open(t) }.padding(12.dp).testTag("dtile-${t.id}"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        TokenPicture(t, 52.dp)
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            BasicText(Format.title(t), style = sans(15.sp, Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BasicText(Format.ticker(t), style = mono(11.5.sp, Brand.mute), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        TagPills(t)
        Spacer(Modifier.weight(1f, fill = false))
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                if (!c.flagged) {
                    BasicText(Format.usdCompact(t.valuationUsd), style = mono(12.5.sp, Brand.paper, FontWeight.Medium))
                    BasicText(Format.change(t.change24hPct, t.changeWindowHours), style = mono(13.sp, if ((t.change24hPct ?: 0.0) >= 0) Brand.lime else Brand.mandarin, FontWeight.Bold))
                }
            }
            if (c.flagged) BasicText(c.score, style = sans(13.sp, Brand.mandarin, FontWeight.Bold))
            else if (c.numeric) BasicText(c.score, style = sans(30.sp, Brand.score(c.score.toInt()), FontWeight.SemiBold).copy(fontFeatureSettings = "tnum"))
        }
    }
}

/** The feed's name as the site's pulse line says it (main.ts `dataView().tape`). */
internal fun feedName(s: FeedState): String = when (s) {
    FeedState.Connecting -> "Connecting"
    is FeedState.Live -> "Engine feed"
    is FeedState.Offline -> "Offline"
    is FeedState.Mismatch -> "Contract mismatch"
}

/** "12s ago", "5m ago", "3h ago", "2d ago". */
internal fun agoShort(s: Long): String = when {
    s < 60 -> "${maxOf(0, s)}s ago"
    s < 3600 -> "${s / 60}m ago"
    s < 86400 * 2 -> "${s / 3600}h ago"
    else -> "${s / 86400}d ago"
}

/**
 * A Discover card in the site's look at phone width (ui/discover.ts, `.drow`): glass, 26 round. Top: the tile's content
 * on the left (picture with its badge, name, $ticker · age, the ribbon, MC and ATH) and the score with what it rests on
 * at the right. Then the lite chart with its options, the move and the volume, and the two ways in.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun DiscoverCard(t: Token, client: CoinClient, onHide: (Token) -> Unit = {}, open: (Token) -> Unit) {
    val narrowCard = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp < 360
    val age = Format.ageText(t.launchedAtMs?.let { (System.currentTimeMillis() - it) / 60_000.0 })
    val copy = t.possibleCopyOf?.let { " · possible copy of ${it.ticker ?: Format.DASH}" } ?: ""
    var tf by remember { mutableStateOf<Timeframe?>(null) }
    var candlesStyle by remember { mutableStateOf(false) }
    var set by remember { mutableStateOf<CandleSet?>(null) }
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var again by remember { mutableStateOf(0) }
    //
    val live = LocalLiveFeed.current
    val feedNow = live?.data?.collectAsState()?.value
    var tradesSeen by remember { mutableStateOf(-1) }
    LaunchedEffect(feedNow?.lastHeardMs) {
        val cur = set ?: return@LaunchedEffect
        val f = tf ?: return@LaunchedEffect
        if (live == null) return@LaunchedEffect
        val (count, next) = io.pinr.app.feed.LiveCandle.advance(cur, f, t.id, live, tradesSeen)
        tradesSeen = count
        if (next != null) set = next
    }
    LaunchedEffect(tf) {
        val f = tf ?: return@LaunchedEffect
        loading = true; set = null
        try { set = client.candles(t.address, f); failed = false } catch (e: CoinClient.Failure) { failed = true }
        loading = false
    }
    // As the site's card: a busy, stale or failed answer is asked again after 8 seconds while the card shows that chart.
    LaunchedEffect(tf, set, failed, again) {
        val f = tf ?: return@LaunchedEffect
        val st = set?.status
        if (!(failed || st == CandleSet.Status.Busy || st == CandleSet.Status.Error || st == CandleSet.Status.Stale)) return@LaunchedEffect
        kotlinx.coroutines.delay(8_000)
        try { set = client.candles(t.address, f); failed = false } catch (e: CoinClient.Failure) { failed = true }
        again++
    }
    // One clock for the ribbon, read while drawing.
    var seconds by remember { mutableStateOf(0.0) }
    LaunchedEffect(Unit) { while (true) androidx.compose.runtime.withFrameMillis { seconds = it / 1000.0 } }

    Column(
        Modifier.fillMaxWidth().glass(22.dp).padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 14.dp).testTag("dcard-${t.id}"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
                    TokenPicture(t, 46.dp)
                    Spacer(Modifier.width(10.dp))
                    // The name takes all the room the hide button leaves (a second weighted spacer cut it to "Anse…" at 320 dp; Manager, 7 Nov).
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        BasicText(Format.title(t), style = sans(14.sp, Brand.paper, FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        // The site's sub line: "$TICKER · 41m", and a warning when its picture matches an earlier coin.
                        // The ticker line starts clear of the picture's chain badge, which reaches past the picture's edge (it covered "$" at 320 dp).
                        // Under 360 dp the age (and any copy warning) moves to the line under the picture, so the ticker line never cuts it.
                        BasicText(if (narrowCard) Format.ticker(t) else "${Format.ticker(t)} · $age$copy", Modifier.padding(start = 18.dp), style = mono(11.5.sp, if (copy.isEmpty() || narrowCard) Brand.mute else Brand.mandarin), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        // The tags start clear of the picture's chain badge, which hangs past the picture's edge (it covered "Copy" at 320 dp);
                        // under 360 dp they take their own line under the picture instead, where they have the card's whole width.
                        if (!narrowCard) Box(Modifier.padding(start = 18.dp)) { TagPills(t) }
                    }
                    // Hide this coin: the site's eye-slash at the end of the name row. It never opens the card.
                    Spacer(Modifier.width(6.dp))
                    Box(
                        Modifier.size(34.dp).background(Brand.fg.copy(alpha = 0.07f), CircleShape).clickable { onHide(t) }
                            .semantics { contentDescription = "Hide this coin" }.testTag("dhide-${t.id}"),
                        contentAlignment = Alignment.Center,
                    ) { GlyphIcon(Glyphs.eyeOff, Brand.mute, 18.dp) }
                }
                if (narrowCard) {
                    BasicText(age + copy, style = mono(11.5.sp, if (copy.isEmpty()) Brand.mute else Brand.mandarin))
                    TagPills(t)
                }
                // R4: a little larger than a tile's ribbon, both ways.
                RibbonView(t, 5.dp, { seconds }, Modifier.width(140.dp).height(16.dp), tileHeight = 100.dp, leanRange = (16 * io.pinr.app.feed.Ribbon.ROW_SHARE).dp)
                if (t.label == null) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        FactRow("MC", Format.money(t.valuationUsd), 10.5.sp)
                        FactRow("ATH", Format.money(t.athUsd), 10.5.sp)
                    }
                }
            }
            Spacer(Modifier.width(6.dp))
            ScoreColumn(t)
        }
        if (t.label != NoScoreLabel.Vamp) {
            // The chips wrap to a second line when the card is narrow (as the site's), so "Candles" is never squeezed letter by letter.
            androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                Chip("Live", tf == null) { tf = null }
                listOf(Timeframe.M15, Timeframe.H1, Timeframe.H4, Timeframe.D1).forEach { f -> Chip(f.code, tf == f) { tf = f } }
                Chip(if (candlesStyle) "Line" else "Candles", false) { candlesStyle = !candlesStyle }
            }
            Box(Modifier.fillMaxWidth().height(110.dp)) {
                val chartMod = Modifier.fillMaxSize()
                val f = tf
                val s = set
                if (f != null) {
                    val r = s?.range
                    if (s != null && s.drawable && r != null) {
                        //
                        //
                        LitePlot(io.pinr.app.feed.lineFromOpen(s.shown, 60.0).map { it.second }, if (candlesStyle) s.shown else null, r.start, r.endInclusive, s.logScale, s.asOf?.let { "${f.code} · ${io.pinr.app.feed.Format.asOf(it)}" } ?: s.source?.let { "${f.code} · $it" }, chartMod)
                    } else {
                        ChartNote(if (loading) "loading…" else if (failed) "chart not read yet" else if (s?.status == CandleSet.Status.Busy) "chart not read yet" else "no candles for this size")
                    }
                } else {
                    val c = LiteChart.of(t)
                    if (c != null) {
                        val lo = c.points.min(); val hi = maxOf(c.points.max(), lo * 1.0001)
                        LitePlot(c.points, null, lo, hi, c.logScale, c.label, chartMod)
                    } else ChartNote("no price history yet")
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                val up = (t.change24hPct ?: 0.0) >= 0
                BasicText(Format.change(t.change24hPct, t.changeWindowHours), Modifier.weight(1f), style = mono(13.sp, if (up) Brand.lime else Brand.mandarin, FontWeight.Bold))
                BasicText("VOL ${Format.money(t.volume24hUsd)}", style = mono(12.sp, Brand.paper.copy(alpha = 0.8f)))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                Modifier.weight(1f).height(40.dp).background(Brand.lime.copy(alpha = 0.08f), RoundedCornerShape(50))
                    .border(1.dp, Brand.lime.copy(alpha = 0.6f), RoundedCornerShape(50)).clickable { open(t) },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(wordmarkPainter(), "PINR", Modifier.height(12.dp))
                Spacer(Modifier.width(6.dp))
                BasicText("terminal", style = sans(14.sp, Brand.lime, FontWeight.SemiBold))
            }
            Row(
                Modifier.weight(1f).height(40.dp).background(Brand.fg.copy(alpha = 0.07f), RoundedCornerShape(50)).clickable { open(t) },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                GlyphIcon(Glyphs.deepscan, Brand.paper, 17.dp)
                Spacer(Modifier.width(6.dp))
                BasicText("Deep Scan", style = sans(14.sp, Brand.paper, FontWeight.SemiBold))
            }
        }
    }
}

/**
 * The score and what it rests on, as the site's Discover row (ui/discover.ts): the number on the score scale, a label
 * in mandarin with "confirmed" or "unchecked" beside a flagged coin (copynote.ts `flagWord`), a dash over "unread" when
 * nothing was read; then "Chain only" and "scored N ago" under a number, and "by count" when the mix counts trades.
 */
@Composable
private fun ScoreColumn(t: Token) {
    val c = Format.corner(t)
    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        when {
            c.flagged -> BasicText(c.score, style = sans(15.sp, Brand.mandarin, FontWeight.Bold))
            c.numeric -> BasicText(c.score, style = sans(42.sp, Brand.score(c.score.toInt()), FontWeight.SemiBold).copy(letterSpacing = (-0.04).em, fontFeatureSettings = "tnum"))
            else -> BasicText(c.score, style = sans(42.sp, Brand.mute, FontWeight.SemiBold))
        }
        Box(Modifier.padding(vertical = 3.dp).width(80.dp).height(1.dp).background(Brand.fg.copy(alpha = 0.12f)))
        val small = mono(10.5.sp, Brand.mute).copy(textAlign = TextAlign.End)
        if (!c.flagged) BasicText(c.coverage, style = mono(12.sp, Brand.paper, FontWeight.Medium))
        BasicText(if (c.flagged) Format.flagWord(t) else c.word, style = small)
        if (c.numeric) {
            BasicText("Chain only", style = small)
            Format.scoredAgo(t.asOfMs)?.let { BasicText("read $it", style = small) }
        }
        if (t.flow?.isCount == true) BasicText("by count", style = small)
    }
}

@Composable
internal fun Chip(text: String, on: Boolean, onClick: () -> Unit) {
    // The pill is drawn as before; its tap area is 44 dp tall (item 17 tap sizes; Build Inspector, 7 Nov: the pills were about 26 dp).
    Box(Modifier.heightIn(min = 44.dp).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        BasicText(
            text,
            Modifier.background(if (on) Brand.lime.copy(alpha = 0.16f) else Brand.fg.copy(alpha = 0.07f), RoundedCornerShape(50))
                .border(1.dp, if (on) Brand.lime.copy(alpha = 0.45f) else Color.Transparent, RoundedCornerShape(50))
                .padding(horizontal = 10.dp, vertical = 5.dp),
            style = mono(12.sp, if (on) Brand.lime else Brand.paper.copy(alpha = 0.85f), FontWeight.Medium),
        )
    }
}

@Composable
internal fun ChartNote(s: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { BasicText(s, style = mono(11.sp, Brand.mute.copy(alpha = 0.7f))) }
}
