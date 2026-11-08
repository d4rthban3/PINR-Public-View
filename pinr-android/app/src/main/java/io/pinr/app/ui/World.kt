package io.pinr.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.min
import kotlin.math.roundToInt
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/**
 * The site's map (pinr-live/src/ui/pages.ts and compass.ts), as the iPhone app draws it (World.swift): every page is a
 * room on one canvas, laid out like a compass. PINR at the centre, the PvP Arena to the north, Discover to the west,
 * the Wallet to the east, PINRterminal + DeepScan to the south, and a labelled advertisement placeholder in each corner.
 */
enum class Room(val col: Int, val row: Int, val title: String) {
    AdNW(0, 0, "Advertisement · placeholder"),
    Arena(1, 0, "PvP Arena"),
    AdNE(2, 0, "Advertisement · placeholder"),
    Discover(0, 1, "Discover"),
    Pinr(1, 1, "PINR"),
    Wallet(2, 1, "Wallet and profile"),
    AdSW(0, 2, "Advertisement · placeholder"),
    Terminal(1, 2, "PINRterminal + DeepScan"),
    AdSE(2, 2, "Advertisement · placeholder");

    val isAd: Boolean get() = this in listOf(AdNW, AdNE, AdSW, AdSE)

    /** The rooms whose page is solid behind its content on the site. */
    val solid: Boolean get() = this in listOf(Terminal, Wallet)
}

/**
 * The map's zoom while a room is drawn on the whole map (1 in a room): a room can then draw itself for that size, as the
 * site's tiles re-lay themselves out at the camera's zoom (cards.ts `lodFor`, `LABEL_PX`).
 */
val LocalMapScale = compositionLocalOf { 1f }

data class Screen(val room: Room, val coin: String?, val listKey: String, val query: String, val tab: io.pinr.app.feed.DiscoverTab, val scroll: ScrollPlace? = null)

/** Where a room was scrolled: the first item shown and how far into it (a list or grid), or pixels (the coin page, `index` 0). */
data class ScrollPlace(val index: Int, val offset: Int)

/**
 *
 * opened afresh starts at its top; Back puts the saved place back (`restore`, taken by `settle` when the room is shown).
 */
class Scrolls {
    val pinr = androidx.compose.foundation.lazy.grid.LazyGridState()
    val discover = androidx.compose.foundation.lazy.LazyListState()
    val coin = androidx.compose.foundation.ScrollState(0)
    private var pending: Pair<Room, ScrollPlace>? = null
    /** Counts restores, so a Back within one room (one coin to the one before) is applied too. */
    var seq by mutableStateOf(0)
        private set

    fun read(room: Room): ScrollPlace? = when (room) {
        Room.Pinr -> ScrollPlace(pinr.firstVisibleItemIndex, pinr.firstVisibleItemScrollOffset)
        // Discover's search pill is a sticky header, reported as the first visible item while it is pinned: the place is the topmost
        // real item under it (the highest index covering the top of the list) and how far it is scrolled.
        Room.Discover -> discover.layoutInfo.visibleItemsInfo.filter { it.offset <= 0 && it.offset + it.size > 0 }.maxByOrNull { it.index }
            ?.let { ScrollPlace(it.index, -it.offset) } ?: ScrollPlace(discover.firstVisibleItemIndex, discover.firstVisibleItemScrollOffset)
        Room.Terminal -> ScrollPlace(0, coin.value)
        else -> null
    }

    fun restore(room: Room, place: ScrollPlace) {
        pending = room to place
        seq++
    }

    /** The place `room` is shown at now: the saved one when Back asked for it, else its top. */
    fun take(room: Room): ScrollPlace {
        val p = pending?.takeIf { it.first == room }?.second
        pending = null
        return p ?: ScrollPlace(0, 0)
    }

    /** Scrolls `room` to `place`. A room drawn again when the camera settles starts with its list nearly empty for a moment (its ranking lands
     *  after), which clamps any scroll near the top; so the place is set, checked over the next frames, and set again until it holds (up to
     *  three seconds). */
    suspend fun apply(room: Room, place: ScrollPlace) {
        val list: (suspend () -> Unit)? = when (room) {
            Room.Pinr -> suspend { pinr.scrollToItem(place.index, place.offset) }
            Room.Discover -> suspend { discover.scrollToItem(place.index, place.offset) }
            else -> null
        }
        if (list == null) {
            if (room == Room.Terminal) coin.scrollTo(place.offset)
            return
        }
        fun at(): Boolean = when (room) {
            Room.Pinr -> pinr.firstVisibleItemIndex == place.index && kotlin.math.abs(pinr.firstVisibleItemScrollOffset - place.offset) < 4
            else -> read(Room.Discover)?.let { it.index == place.index && kotlin.math.abs(it.offset - place.offset) < 4 } ?: false
        }
        val touched = { if (room == Room.Pinr) pinr.isScrollInProgress else discover.isScrollInProgress }
        var held = 0
        var waited = 0
        // A user who starts scrolling takes over: the place is not set again under their finger.
        while (held < 6 && waited < 3000 && !(waited > 0 && touched())) {
            if (!at()) { held = 0; runCatching { list() } } else held++
            kotlinx.coroutines.delay(50)
            waited += 50
        }
    }
}

class Camera {
    var room by mutableStateOf(Room.Pinr)
        private set
    var map by mutableStateOf(false)
        private set
    private val trail = mutableStateListOf<Screen>()
    /** The number of saved screens (the path Back walks). */
    val depth: Int get() = trail.size
    /** The app sets these: how to read the screen as it is, and how to put a saved one back. */
    var capture: () -> Screen = { Screen(room, null, "", "", io.pinr.app.feed.DiscoverTab.List) }
    var restore: ((Screen) -> Unit)? = null
    /** The rooms drawn right now: the one you are in, plus all of them while flying or on the map. */
    var drawn by mutableStateOf(setOf(Room.Pinr))
        private set
    /** True when the camera rests in one room (not flying, not on the map): that room is then shown in place. */
    var settled by mutableStateOf(true)
        private set

    val canGoBack: Boolean get() = map || trail.isNotEmpty() || room != Room.Pinr

    /** Save the screen being left (also when one coin opens another from the coin page). */
    fun step() {
        trail += capture()
        if (trail.size > 200) trail.removeAt(0)
    }

    fun go(to: Room) {
        if (to == room && !map) return
        if (to != room) step()
        fly(if (map) Room.entries.toSet() else setOf(room, to))
        room = to
        map = false
    }

    fun toggleMap() {
        fly(Room.entries.toSet())
        map = !map
    }

    fun back() {
        if (map) { fly(Room.entries.toSet()); map = false; return }
        // The first screen of a visit goes to the PINR page, not out of the app.
        val last = trail.removeLastOrNull() ?: run {
            if (room != Room.Pinr) { fly(setOf(room, Room.Pinr)); room = Room.Pinr }
            return
        }
        restore?.invoke(last)
        if (last.room == room) return
        fly(setOf(room, last.room))
        room = last.room
    }

    private fun fly(drawing: Set<Room>) {
        settled = false
        drawn = drawing
    }

    /** Called when a flight has come to rest. */
    fun landed() {
        if (!map) { drawn = setOf(room); settled = true }
    }
}

/**
 * The map's geometry: rooms are screen-sized, with a gap between them (the iPhone app's MapLayout). The whole map is
 * fitted inside the band between the header and the footer ([top] and [bottom], in pixels), so no room is cut.
 */
class MapLayout(val w: Float, val h: Float, val top: Float = 0f, val bottom: Float = 0f) {
    val gap = w * 0.09f
    val worldW = w * 3 + gap * 2
    val worldH = h * 3 + gap * 2
    fun x(r: Room) = r.col * (w + gap)
    fun y(r: Room) = r.row * (h + gap)
    private val band get() = h - top - bottom
    fun mapScale(density: Float) = min((w - 16 * density) / worldW, (band - 16 * density) / worldH)
    fun mapX(density: Float) = (w - worldW * mapScale(density)) / 2
    fun mapY(density: Float) = top + (band - worldH * mapScale(density)) / 2
}

/**
 * The world under the header and footer: at rest, the room you are in, shown plainly in place so its scrolling and
 * buttons take their touches; flying or on the whole map, every drawn room in one piece, moved and scaled by the camera.
 * Page content is cut at the header's bottom edge and the footer's top edge (the site's band, main.ts --clip-top).
 */
@Composable
fun WorldView(
    camera: Camera, clipTop: Dp, clipBottom: Dp, room: @Composable (Room) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val d = LocalDensity.current
        val w = constraints.maxWidth.toFloat()
        val h = constraints.maxHeight.toFloat()
        val top = with(d) { clipTop.toPx() }
        val bottom = with(d) { clipBottom.toPx() }
        val layout = remember(w, h, top, bottom) { MapLayout(w, h, top, bottom) }
        val x = remember { Animatable(-layout.x(camera.room)) }
        val y = remember { Animatable(-layout.y(camera.room)) }
        val s = remember { Animatable(1f) }
        val tx = if (camera.map) layout.mapX(d.density) else -layout.x(camera.room)
        val ty = if (camera.map) layout.mapY(d.density) else -layout.y(camera.room)
        val ts = if (camera.map) layout.mapScale(d.density) else 1f
        LaunchedEffect(tx, ty, ts) {
            // The site's flight: a soft spring (the iPhone app's response 0.6, damping 0.86).
            val spec = spring<Float>(dampingRatio = 0.86f, stiffness = 110f)
            coroutineScope {
                launch { x.animateTo(tx, spec) }
                launch { y.animateTo(ty, spec) }
                launch { s.animateTo(ts, spec) }
            }
            camera.landed()
        }
        // The site's dot grid travels with the camera (read while drawing, so a flight only repaints it).
        DotGrid({ x.value }, { y.value }, { s.value })

        Box(Modifier.fillMaxSize().drawWithContent { clipRect(top = top, bottom = size.height - bottom) { this@drawWithContent.drawContent() } }) {
            if (camera.settled) {
                RoomFrame(camera.room, onMap = false, onTap = {}, modifier = Modifier.fillMaxSize().testTag("room-${camera.room.name}")) { room(it) }
            } else {
                val wDp = with(d) { w.toDp() }
                val hDp = with(d) { h.toDp() }
                Box(
                    Modifier.wrapContentSize(Alignment.TopStart, unbounded = true)
                        .requiredSize(with(d) { layout.worldW.toDp() }, with(d) { layout.worldH.toDp() })
                        .graphicsLayer {
                            transformOrigin = TransformOrigin(0f, 0f)
                            translationX = x.value
                            translationY = y.value
                            scaleX = s.value
                            scaleY = s.value
                        },
                ) {
                    for (r in Room.entries) {
                        if (r !in camera.drawn) continue
                        CompositionLocalProvider(LocalMapScale provides if (camera.map) layout.mapScale(d.density) else 1f) {
                        RoomFrame(
                            r, onMap = camera.map, onTap = { camera.go(r) },
                            modifier = Modifier.offset { IntOffset(layout.x(r).roundToInt(), layout.y(r).roundToInt()) }.requiredSize(wDp, hDp),
                        ) { room(it) }
                        }
                    }
                }
            }
        }
    }
}

/**
 * One room: its page, and on the map a glass frame around it that can be tapped to fly in. An ad corner has no frame on
 * the map: its slots float on the background, as on the site.
 */
@Composable
private fun RoomFrame(r: Room, onMap: Boolean, onTap: () -> Unit, modifier: Modifier, content: @Composable (Room) -> Unit) {
    val framed = onMap && !r.isAd
    val shape = RoundedCornerShape(if (framed) 44.dp else 0.dp)
    Box(
        modifier
            .clip(shape)
            .background(if (framed) Brand.glass else Color.Transparent)
            // The site keeps these pages solid behind their content (the frame at 93% panel); PINR, Discover and the
            // ad corners stand on the live background.
            .background(if (r.solid) Brand.panel.copy(alpha = 0.93f) else Color.Transparent)
            .border(if (framed) 5.dp else 0.dp, Brand.fg.copy(alpha = if (framed) 0.22f else 0f), shape),
    ) {
        content(r)
        if (onMap) {
            // On the map a room takes no touches of its own: a tap anywhere on it flies in.
            Box(
                Modifier.fillMaxSize()
                    .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } }
                    .clickable(remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClick = onTap)
                    .semantics { contentDescription = r.title }
                    .testTag("map-${r.name}"),
            )
        }
    }
}

/** A room whose page comes in a later step: its title, as a quiet plate (and DeepScan's own words, as on the iPhone app). */
@Composable
fun PlaceholderRoom(r: Room, insets: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(insets).padding(horizontal = 28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BasicText(r.title, Modifier.testTag("page-${r.name}"), style = TextStyle(color = Brand.paper, fontSize = 22.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
            if (r == Room.Terminal) {
                BasicText(
                    "Choose a token on the PINR page or Discover.", Modifier.padding(top = 12.dp),
                    style = TextStyle(color = Brand.paper.copy(alpha = 0.75f), fontSize = 14.sp, textAlign = TextAlign.Center),
                )
            }
        }
    }
}

/** PINRterminal + DeepScan with no coin chosen yet (or one that has left the feed), in the iPhone app's words. */
@Composable
fun TerminalEmpty(gone: Boolean, insets: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(insets).padding(horizontal = 28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            GlyphIcon(Glyphs.deepscan, Brand.lime, 40.dp)
            BasicText("PINRterminal", Modifier.padding(top = 14.dp).testTag("page-Terminal"), style = TextStyle(color = Brand.paper, fontSize = 22.sp, fontWeight = FontWeight.Bold))
            BasicText(
                if (gone) "This coin is not in the feed right now." else "Choose a token on the PINR page or Discover.", Modifier.padding(top = 14.dp),
                style = TextStyle(color = Brand.paper.copy(alpha = 0.75f), fontSize = 14.sp, textAlign = TextAlign.Center),
            )
        }
    }
}
