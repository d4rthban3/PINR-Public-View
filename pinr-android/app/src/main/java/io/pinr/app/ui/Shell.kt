package io.pinr.app.ui

import androidx.compose.foundation.border
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.flow.first
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.pinr.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import io.pinr.app.feed.CoinAddress
import io.pinr.app.feed.CoinClient
import io.pinr.app.feed.FeedData
import io.pinr.app.feed.FeedState
import io.pinr.app.feed.FeedStore
import io.pinr.app.feed.Format
import androidx.compose.runtime.compositionLocalOf
import io.pinr.app.feed.PinrFilter

/**
 * The site's five pages, in the footer's order (pinr-live/src/ui/tabbar.ts): Discover | PINR | the PINR guide (the
 * lime button, the centre of the map) | PINRbot DeepScan (the terminal and DeepScan, one page) | Wallet and profile.
 */
enum class Tab(val label: String, val room: Room) {
    Discover("Discover", Room.Discover),
    Pinr("PINR", Room.Pinr),
    DeepScan("PINRbot DeepScan", Room.Terminal),
    Wallet("Wallet and profile", Room.Wallet),
}

/**
 * The app's frame: the live background, the site's map of rooms under the camera, the site's header at the top and its
 * footer at the bottom. Each footer tab flies the camera to its room; the compass pulls back to the whole map.
 */
val LocalLiveFeed = androidx.compose.runtime.staticCompositionLocalOf<FeedStore?> { null }

@Composable
fun PinrApp(store: FeedStore, openLink: String? = null, onLinkOpened: () -> Unit = {}) {
    val camera = remember { Camera() } // the app opens on PINR, as the site does
    //
    var listKey by rememberSaveable { mutableStateOf(io.pinr.app.feed.Lists.DEFAULT_KEY) }
    var panel by remember { mutableStateOf<HeaderPanel?>(null) }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    //
    var dQuery by rememberSaveable { mutableStateOf("") }
    var dTab by rememberSaveable { mutableStateOf(io.pinr.app.feed.DiscoverTab.List) }
    val scrolls = remember { Scrolls() }
    camera.capture = { Screen(camera.room, if (camera.room == Room.Terminal) selected else null, listKey, dQuery, dTab, scrolls.read(camera.room)) }
    camera.restore = { s -> listKey = s.listKey; dQuery = s.query; dTab = s.tab; s.coin?.let { selected = it }; s.scroll?.let { scrolls.restore(s.room, it) } }
    //
    // sections) lands a moment after it is shown, so the place is set again once it has.
    LaunchedEffect(camera.room, scrolls.seq) {
        val room = camera.room
        val place = scrolls.take(room)
        // The room is drawn once on the moving map and again in place when the camera settles, with its list empty for a moment: the
        // place is set once it is in place (apply then waits for the saved item).
        androidx.compose.runtime.snapshotFlow { camera.settled }.first { it }
        if (camera.room == room) scrolls.apply(room, place)
    }
    val feed by store.data.collectAsState()
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val watch = remember { WatchStore(ctx) }
    // The look follows the phone until the sun or moon is tapped; the saved choice is read once, and the system bars follow the look.
    ThemeState.systemDark = androidx.compose.foundation.isSystemInDarkTheme()
    LaunchedEffect(Unit) { ThemeState.load(ctx) }
    val lookView = androidx.compose.ui.platform.LocalView.current
    androidx.compose.runtime.SideEffect {
        (ctx as? android.app.Activity)?.window?.let { w ->
            androidx.core.view.WindowCompat.getInsetsController(w, lookView).apply {
                isAppearanceLightStatusBars = ThemeState.light
                isAppearanceLightNavigationBars = ThemeState.light
            }
        }
    }
    val choices = remember { ChoicesStore(ctx) }
    var settings by remember { mutableStateOf(false) }
    // The header's PINR GUIDE button offers the guide or the Whitepaper; each is a full page over the view.
    var choosing by remember { mutableStateOf(false) }
    var page by remember { mutableStateOf<String?>(null) }
    //
    var linkNote by remember { mutableStateOf<String?>(null) }
    val client = remember(store) { CoinClient(store.baseUrl) }
    // A link to one coin (`pinr://coin/<address>`, or the site's `?coin=<address>`) opens that coin's page.
    LaunchedEffect(openLink) {
        val address = CoinAddress.parse(openLink) ?: return@LaunchedEffect
        val (t, notice) = store.findWhy(address)
        if (t != null) { linkNote = null; selected = t.id; camera.go(Room.Terminal) }
        else linkNote = CoinAddress.linkNote(notice, address)
        onLinkOpened()
    }
    // Price alerts are checked against each new reading of the feed, while PINR is open (as on the site).
    LaunchedEffect(feed.all) { watch.check(feed.all) }
    // The feed is read and sorted off the screen's thread; the screen only receives finished sets.
    LaunchedEffect(store) { withContext(Dispatchers.Default) { store.run() } }

    BackHandler(enabled = page != null || choosing || settings || panel != null || camera.canGoBack) {
        when { page != null -> page = null; choosing -> choosing = false; settings -> settings = false; panel != null -> panel = null; else -> camera.back() }
    }

    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    // A room runs under the bars, as on the site; its content starts below the header and ends above the footer, and
    // the band between them is where page content shows (the site's --clip-top and --clip-bottom).
    val clipTop = top + 8.dp + 52.dp + 2.dp
    val clipBottom = bottom + 8.dp + 56.dp + 2.dp
    val insets = PaddingValues(top = clipTop + 10.dp, bottom = clipBottom + 10.dp)

    CappedTextSize {
    Box(Modifier.fillMaxSize().background(Brand.ink)) {
        LiveBackground(choices.background, playing = camera.map || camera.room == Room.Pinr)
    // Turned to landscape, everything keeps clear of the camera's cut-out at the side (the background still runs under it).
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.displayCutout.only(WindowInsetsSides.Horizontal))) {
        androidx.compose.runtime.key(Unit) {
        androidx.compose.runtime.CompositionLocalProvider(LocalChoices provides choices, LocalLiveFeed provides store, LocalOpenFilters provides { panel = HeaderPanel.Filters }) {
        WorldView(camera, clipTop, clipBottom) { r ->
            val openCoin: (io.pinr.app.feed.Token) -> Unit = { selected = it.id; camera.go(Room.Terminal) }
            when {
                r == Room.Pinr -> PinrRoom(feed, listKey, insets, openCoin, onList = { listKey = it }, grid = scrolls.pinr)
                r == Room.Arena -> ArenaRoom(insets, onOpen = openCoin)
                r == Room.Discover -> DiscoverRoom(feed, client, insets, listKey, { listKey = it }, openCoin, dTab, { dTab = it }, dQuery, { dQuery = it }, list = scrolls.discover)
                r == Room.Wallet -> WalletRoom(choices, client, feed.byId, insets, openCoin)
                r == Room.Terminal -> {
                    // The last coin opened anywhere; a coin no longer in the feed says so.
                    val t = selected?.let { feed.byId[it] ?: store.found[it] }
                    if (t != null) CoinPage(t, choices.visible(feed.all), client, watch, insets, onOpen = { camera.step(); selected = it.id }, onHide = { choices.hide(it); selected = null; camera.back() }, scroll = scrolls.coin)
                    else TerminalEmpty(selected != null, insets)
                }
                r.isAd -> AdRoom(r, insets)
                else -> PlaceholderRoom(r, insets)
            }
        }
        }
        }
        HeaderBar(
            camera.room, camera.map, canGoBack = camera.canGoBack, onBack = camera::back, onGuide = { choosing = true }, onPanel = { panel = it },
            modifier = Modifier.align(Alignment.TopCenter).padding(top = top + 8.dp, start = 10.dp, end = 10.dp),
        )
        FooterBar(
            if (camera.map) null else Tab.entries.firstOrNull { it.room == camera.room },
            onTab = { camera.go(it.room) },
            room = camera.room, map = camera.map, onCompass = camera::toggleMap,
            modifier = Modifier.align(Alignment.BottomCenter).padding(start = 10.dp, end = 10.dp, bottom = bottom + 8.dp),
        )
        // The newest price alert that fired, for ten seconds, under the header (the site's toast).
        watch.toast?.let {
            BasicText(
                it,
                Modifier.align(Alignment.TopCenter).padding(top = top + 8.dp + 52.dp + 8.dp)
                    .background(Brand.lime, RoundedCornerShape(50)).padding(horizontal = 16.dp, vertical = 9.dp),
                style = TextStyle(color = Brand.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            )
        }
        //
        linkNote?.let { n ->
            BasicText(
                n,
                Modifier.align(Alignment.BottomCenter).padding(start = 16.dp, end = 16.dp, bottom = clipBottom + 10.dp)
                    .shadow(14.dp, RoundedCornerShape(22.dp))
                    .background(Brand.panel, RoundedCornerShape(22.dp)).border(1.dp, Brand.fg.copy(alpha = 0.14f), RoundedCornerShape(22.dp))
                    .clickable { linkNote = null }.heightIn(min = 44.dp).padding(horizontal = 16.dp, vertical = 10.dp)
                    .semantics { contentDescription = "$n. Tap to close." }.testTag("link-note"),
                style = TextStyle(color = Brand.paper, fontSize = 14.sp, fontWeight = FontWeight.Medium),
            )
        }
        panel?.let { p ->
            Panel(
                p, feed, listKey, onFilter = { listKey = it; panel = null; camera.go(Room.Pinr) }, onClose = { panel = null },
                onRoom = { panel = null; camera.go(it) }, onMap = { panel = null; if (!camera.map) camera.toggleMap() },
                onSettings = { panel = null; settings = true }, onGuideRow = { panel = null; choosing = true }, onDiagnostics = { panel = HeaderPanel.Diagnostics },
                choices = choices,
            )
        }
        if (settings) SettingsPanel(choices, feed) { settings = false }
        if (choosing) GuideChoice(onGuide = { choosing = false; page = "guide" }, onPaper = { choosing = false; page = "paper" }, onClose = { choosing = false })
        page?.let { HeaderPage(it, insets) { page = null } }
    }
    }
    }
}

/** The phone's choices, for the screens deep inside the map (hidden coins, Display). */
val LocalChoices = compositionLocalOf<ChoicesStore?> { null }

/** One line on the feed, in the iPhone app's words. */
fun statusText(s: FeedState): String = when (s) {
    FeedState.Connecting -> "Connecting to the feed…"
    is FeedState.Live -> "Feed live · contract ${s.contract}"
    is FeedState.Offline -> "Offline · ${s.reason}"
    is FeedState.Mismatch -> "Mismatch · the feed speaks contract ${s.contract}"
}

/** What a header button opens, as a sheet from the bottom over a dimmed page (the site's popovers on a phone). */
@Composable
private fun Panel(
    p: HeaderPanel, feed: FeedData, listKey: String, onFilter: (String) -> Unit, onClose: () -> Unit,
    onRoom: (Room) -> Unit, onMap: () -> Unit, onSettings: () -> Unit, onGuideRow: () -> Unit, onDiagnostics: () -> Unit,
    choices: ChoicesStore,
) {
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f))
            .clickable(remember { MutableInteractionSource() }, indication = null, onClick = onClose),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(
            Modifier.fillMaxWidth().background(Brand.panel, RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .clickable(remember { MutableInteractionSource() }, indication = null) {}
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 20.dp, vertical = 18.dp)
                .testTag("panel-${p.name}"),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val title = TextStyle(color = Brand.paper, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            val body = TextStyle(color = Brand.mute, fontSize = 13.sp)
            val mono = TextStyle(color = Brand.paper.copy(alpha = 0.85f), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            when (p) {
                HeaderPanel.Filters -> {
                    BasicText("Launchpad", style = title)
                    val pickedLp = io.pinr.app.feed.Lists.launchpad(listKey)
                    io.pinr.app.feed.Lists.all().forEach { lp ->
                        Row(Modifier.fillMaxWidth().clickable { onFilter(io.pinr.app.feed.Lists.first(lp)) }.padding(vertical = 6.dp).testTag("launchpad-${lp.id}"), verticalAlignment = Alignment.CenterVertically) {
                            BasicText(lp.name, Modifier.weight(1f), style = TextStyle(color = if (lp.id == pickedLp?.id) Brand.lime else Brand.paper, fontSize = 15.sp, fontWeight = FontWeight.Medium))
                            if (lp.id == pickedLp?.id) Box(Modifier.size(6.dp).background(Brand.lime, CircleShape))
                        }
                    }
                    if (pickedLp != null) {
                        BasicText("List", style = title)
                        pickedLp.lists.forEach { l ->
                            val k = io.pinr.app.feed.Lists.key(pickedLp, l)
                            Row(Modifier.fillMaxWidth().clickable { onFilter(k) }.padding(vertical = 6.dp).testTag("list-${l.id}"), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                        BasicText(l.name, style = TextStyle(color = if (k == listKey) Brand.lime else Brand.paper, fontSize = 15.sp, fontWeight = FontWeight.Medium))
                                        if (l.pinr) BasicText("PINR's list", Modifier.border(1.dp, Brand.lime, CircleShape).padding(horizontal = 6.dp), style = TextStyle(color = Brand.lime, fontSize = 10.sp, fontWeight = FontWeight.SemiBold))
                                    }
                                    BasicText(l.order, style = body)
                                }
                                if (k == listKey) Box(Modifier.size(6.dp).background(Brand.lime, CircleShape))
                            }
                        }
                        BasicText(if (pickedLp.own) "These are ${pickedLp.name}'s own lists, read from ${pickedLp.name} and shown in its own order." else "These are PINR's lists of the ${pickedLp.name} coins PINR lists. ${pickedLp.name} does not let anyone read its own lists, so a plain sort carries its name and ranked boards say they are PINR's.", style = TextStyle(color = Brand.mute, fontSize = 11.sp))
                    }
                    Row(Modifier.fillMaxWidth().clickable { onFilter("") }.padding(vertical = 6.dp).testTag("filter-PinrScore"), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            BasicText(PinrFilter.PinrScore.label, style = TextStyle(color = if (listKey.isEmpty()) Brand.lime else Brand.paper, fontSize = 15.sp, fontWeight = FontWeight.Medium))
                            BasicText(PinrFilter.PinrScore.hint, style = body)
                        }
                        if (listKey.isEmpty()) Box(Modifier.size(6.dp).background(Brand.lime, CircleShape))
                    }
                    //
                    Row(Modifier.fillMaxWidth().clickable { choices.switchMayhem(!choices.showMayhem) }.padding(vertical = 6.dp).testTag("show-mayhem")
                        .semantics { stateDescription = if (choices.showMayhem) "On" else "Off" }, verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            BasicText("Show Mayhem", style = TextStyle(color = if (choices.showMayhem) Brand.lime else Brand.paper, fontSize = 15.sp, fontWeight = FontWeight.Medium))
                            BasicText("Coins labelled MAYHEM; left out by default", style = body)
                        }
                        if (choices.showMayhem) Box(Modifier.size(6.dp).background(Brand.lime, CircleShape))
                    }
                }
                HeaderPanel.Diagnostics -> {
                    BasicText("Diagnostics", style = title)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(7.dp).background(statusColour(feed.state), CircleShape))
                        Spacer(Modifier.size(8.dp))
                        BasicText(statusText(feed.state), Modifier.testTag("feed-status"), style = mono)
                    }
                    PanelRows(diagnosticsRows(feed))
                }
                HeaderPanel.Pipeline -> {
                    BasicText("Discovery pipeline", style = title)
                    PanelRows(pipelineRows(feed))
                }
                HeaderPanel.Menu -> {
                    BasicText("Menu", style = title)
                    // The site's menu (header.ts MENU_ITEMS), in its order, then Settings.
                    MenuRow(Glyphs.pinrGrid, "PINR") { onRoom(Room.Pinr) }
                    MenuRow(Glyphs.discover, "Discover") { onRoom(Room.Discover) }
                    MenuRow(Glyphs.guideArrow, "PINR guide") { onGuideRow() }
                    MenuRow(Glyphs.deepscan, "PINRterminal + DeepScan") { onRoom(Room.Terminal) }
                    MenuRow(Glyphs.wallet, "Wallet / Profile") { onRoom(Room.Wallet) }
                    MenuRow(Glyphs.siteMap, "Site map", onMap)
                    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(1.dp).background(Brand.fg.copy(alpha = 0.1f)))
                    MenuRow(Glyphs.sun, "Settings", onSettings)
                    //
                    MenuRow(Glyphs.diag, "Diagnostics", onDiagnostics)
                }
            }
        }
    }
}

@Composable
private fun MenuRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp).testTag("menu-$label"), verticalAlignment = Alignment.CenterVertically) {
        GlyphIcon(icon, Brand.paper, 22.dp)
        Spacer(Modifier.size(14.dp))
        BasicText(label, style = TextStyle(color = Brand.paper, fontSize = 16.sp, fontWeight = FontWeight.SemiBold))
    }
}

/** A panel's label / value lines (header.ts PanelRow), the value in lime or mandarin when it carries a tone. */
@Composable
private fun PanelRows(rows: List<Triple<String, String, Color?>>) {
    rows.forEach { (l, v, tone) ->
        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
            BasicText(l, Modifier.weight(1f), style = TextStyle(color = Brand.mute, fontSize = 13.sp))
            BasicText(v, style = TextStyle(color = tone ?: Brand.paper, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium))
        }
    }
}

/** Where tokens stand (main.ts `pipeline`), from what the feed sends. */
fun pipelineRows(f: FeedData): List<Triple<String, String, Color?>> {
    val all = f.all
    val rows = mutableListOf<Triple<String, String, Color?>>(
        Triple("Tokens found", all.size.toString(), null),
        Triple("Token health read", all.count { it.label == null && it.coverage > 0 && it.score != null }.toString(), Brand.lime),
        Triple("Launchpad coins, no health reading yet", all.count { it.label == null && it.coverage <= 0 && it.note == null }.toString(), null),
    )
    io.pinr.app.feed.NoScoreLabel.entries.forEach { l -> all.count { it.label == l }.takeIf { it > 0 }?.let { rows += Triple("Label observed: ${l.text}", it.toString(), Brand.mandarin) } }
    return rows
}

/** What the app knows about its own reading (main.ts `diagnostics`), from what the feed sends. */
fun diagnosticsRows(f: FeedData, nowMs: Long = System.currentTimeMillis()): List<Triple<String, String, Color?>> {
    val loaded = f.all.filter { it.coverage > 0 }
    val avg = if (loaded.isEmpty()) null else Math.round(loaded.sumOf { it.coverage } / loaded.size)
    val name = when (f.state) {
        is FeedState.Live -> if (f.mode == "replay") "REPLAY OF SAVED RUNS" else "ENGINE FEED"
        FeedState.Connecting -> "CONNECTING"
        is FeedState.Mismatch -> "CONTRACT MISMATCH"
        is FeedState.Offline -> "OFFLINE"
    }
    return listOf(
        Triple("Data source", name, if (f.state is FeedState.Live) null else Brand.mandarin),
        Triple("Average coverage", avg?.let { "$it%" } ?: Format.DASH, null),
        Triple("Thin coverage (under 55%)", f.all.count { it.coverage > 0 && it.coverage < 55 }.toString(), null),
        Triple("Nothing loaded (0%)", f.all.count { it.coverage <= 0 }.toString(), null),
        Triple("New launches (under 1h)", f.all.count { t -> t.launchedAtMs?.let { nowMs - it < 3_600_000 } ?: false }.toString(), null),
        Triple("Tokens skipped (unreadable)", f.leftOut.toString(), if (f.leftOut == 0) null else Brand.mandarin),
    )
}

private fun statusColour(s: FeedState): Color = when (s) {
    FeedState.Connecting -> Brand.lilac
    is FeedState.Live -> Brand.lime
    is FeedState.Offline -> Color.Gray
    is FeedState.Mismatch -> Brand.alarm
}

/** The site's footer (#tabbar in style.css): five tabs in black glass, 56 high, fully rounded, lime when lit (none on the whole map or in an ad corner). */
@Composable
fun FooterBar(current: Tab?, onTab: (Tab) -> Unit, room: Room, map: Boolean, onCompass: () -> Unit, modifier: Modifier = Modifier) =
    FixedTextSize { FooterBody(current, onTab, room, map, onCompass, modifier) }

@Composable
private fun FooterBody(current: Tab?, onTab: (Tab) -> Unit, room: Room, map: Boolean, onCompass: () -> Unit, modifier: Modifier) {
    Row(
        modifier.fillMaxWidth().height(56.dp)
            .shadow(14.dp, RoundedCornerShape(28.dp), ambientColor = Color.Black, spotColor = Color.Black)
            .clip(RoundedCornerShape(28.dp))
            .background(Brand.glass)
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Discover | PINR | the compass (where you are; a tap shows the whole site) | DeepScan | Wallet. The guide button is in the header's centre.
        listOf(Tab.Discover, Tab.Pinr, null, Tab.DeepScan, Tab.Wallet).forEach { t ->
            if (t == null) {
                Box(Modifier.weight(1f).height(48.dp), contentAlignment = Alignment.Center) { Compass(room, map, onCompass) }
                return@forEach
            }
            val lit = t == current
            Box(
                Modifier.weight(1f).height(48.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .clickable(remember { MutableInteractionSource() }, indication = null, role = Role.Tab) { onTab(t) }
                    .semantics { contentDescription = t.label; selected = lit }
                    .testTag("tab-${t.name}"),
                contentAlignment = Alignment.Center,
            ) {
                TabMark(t, lit)
                if (lit && t != Tab.Pinr) {
                    Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp).size(4.dp).clip(CircleShape).background(Brand.lime))
                }
            }
        }
    }
}

@Composable
private fun TabMark(t: Tab, lit: Boolean) {
    val tint = if (lit) Brand.lime else Brand.mute
    when (t) {
        Tab.Pinr -> Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(1.dp)) {
            // The wordmark with a small "page" centred below it (the site's `wmpage`).
            Image(wordmarkPainter(), null, Modifier.height(14.dp).alpha(if (lit) 1f else 0.7f))
            BasicText("page", style = mono(9.sp, if (lit) Brand.lime else Brand.mute, FontWeight.Medium))
        }
        Tab.Discover -> GlyphIcon(Glyphs.discover, tint, 24.dp)
        Tab.DeepScan -> GlyphIcon(Glyphs.deepscan, tint, 24.dp)
        Tab.Wallet -> GlyphIcon(Glyphs.wallet, tint, 24.dp)
    }
}


/** The choice the header's PINR GUIDE button offers: the PINR guide or the Whitepaper, each a full page over the view. */
@Composable
private fun GuideChoice(onGuide: () -> Unit, onPaper: () -> Unit, onClose: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)).clickable(remember { MutableInteractionSource() }, indication = null, onClick = onClose),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(
            Modifier.fillMaxWidth().padding(10.dp).glass(26.dp).clickable(remember { MutableInteractionSource() }, indication = null) {}.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            BasicText("PINR guide", style = sans(18.sp, Brand.paper, FontWeight.SemiBold))
            for ((label, go) in listOf("PINR guide" to onGuide, "Whitepaper" to onPaper)) {
                BasicText(
                    label,
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(Brand.fg.copy(alpha = 0.08f)).clickable(onClick = go).padding(vertical = 13.dp).testTag("choice-$label"),
                    style = sans(15.sp, Brand.paper, FontWeight.Medium).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center),
                )
            }
        }
    }
}

/** The guide or the Whitepaper as a full page over the view, with its own back button. */
@Composable
private fun HeaderPage(which: String, insets: PaddingValues, onClose: () -> Unit) {
    // A plain page, as the site's: the same solid panel as Settings, no moving art behind it.
    Box(Modifier.fillMaxSize().background(Brand.panel).testTag("page-$which")) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 8.dp, start = 8.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp).clickable(remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClick = onClose).semantics { contentDescription = "Close" }, contentAlignment = Alignment.Center) {
                    GlyphIcon(Glyphs.back, Brand.lime, 22.dp)
                }
                BasicText(if (which == "guide") "PINR guide" else "Whitepaper", style = sans(17.sp, Brand.paper, FontWeight.SemiBold))
            }
            if (which == "guide") GuideRoom(PaddingValues(top = 4.dp, bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 16.dp))
            else Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // One card with its icon and "Coming soon", and a note under it (the site's whitepaper page).
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Brand.fg.copy(alpha = 0.05f)).padding(vertical = 36.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    GlyphIcon(Glyphs.whitepaper, Brand.lime, 36.dp)
                    BasicText("Coming soon", style = sans(20.sp, Brand.paper, FontWeight.Bold))
                }
                BasicText("The PINR whitepaper will be read here.", style = sans(13.sp, Brand.mute))
            }
        }
    }
}
