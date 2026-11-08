package io.pinr.app.feed

import kotlin.math.log10
import kotlin.math.min

/**
 *
 * `hearTrade`): the last 40 heard within 15 seconds, for a ribbon to turn each into one dot, and when the coin last traded. A coin heard within
 * 30 minutes is "real"; before any trade, or after, a ribbon has nothing to draw. Nothing here is Compose state: a drawer reads it each frame,
 * so a burst of trades never recomposes a screen.
 */
class RealTrades {
    /** One heard trade: when the app heard it (ms), buy or sell, and its size 0..1 from the dollars (the site's `sizeOfTrade`). */
    data class Heard(val atMs: Long, val buy: Boolean, val size: Double)

    private class Coin {
        val trades = ArrayDeque<Heard>()
        var lastRealMs: Long? = null
        var heardMs: Long = 0
    }

    private val coins = HashMap<String, Coin>()

    /** One trade from the stream (a price alone, with no side, is not a trade). */
    @Synchronized
    fun hear(tick: LiveTick, heardMs: Long = System.currentTimeMillis()) {
        val buy = tick.isBuy ?: return
        val key = tick.address.lowercase()
        val c = coins.getOrPut(key) { Coin() }
        c.trades.addLast(Heard(heardMs, buy, size(tick.usd)))
        while (c.trades.size > KEEP_COUNT || (c.trades.isNotEmpty() && heardMs - c.trades.first().atMs > KEEP_MS)) c.trades.removeFirst()
        if (c.lastRealMs.let { it == null || tick.atMs > it }) c.lastRealMs = tick.atMs
        c.heardMs = heardMs
        if (coins.size > MAX_COINS) {
            coins.entries.sortedBy { it.value.heardMs }.take(coins.size - MAX_COINS + 200).forEach { (k, _) -> if (k != key) coins.remove(k) }
        }
    }

    /** The trades heard for a coin lately, oldest first (each drawer keeps its own cursor and takes each once). */
    @Synchronized
    fun trades(address: String): List<Heard> = coins[address.lowercase()]?.trades?.toList() ?: emptyList()

    /** When the coin's latest real trade happened (its own time, ms), or null. */
    @Synchronized
    fun lastRealMs(address: String): Long? = coins[address.lowercase()]?.lastRealMs

    /** True while the coin has had a real trade heard in the last 30 minutes. */
    @Synchronized
    fun isReal(address: String, nowMs: Long = System.currentTimeMillis()): Boolean = coins[address.lowercase()]?.let { nowMs - it.heardMs < REAL_FOR_MS } ?: false

    companion object {
        const val KEEP_COUNT = 40
        const val KEEP_MS = 15_000L
        const val REAL_FOR_MS = 30 * 60_000L
        const val MAX_COINS = 3000

        /** The site's size of a trade: log of its dollars, a small fixed size when the dollars are unknown. */
        fun size(usd: Double?): Double = if (usd != null && usd.isFinite() && usd > 0) min(1.0, log10(1 + usd) / 3) else 0.05
    }
}
