package io.pinr.app.feed

import kotlin.math.floor
import kotlin.math.sin

/**
 *
 * pinr-live/src/world/flow.ts `stepReal`; the iPhone app's Ribbon.swift). A coin with no trade heard lately draws nothing: still and level,
 *
 */
class Ribbon private constructor(
    val lean: Double? = null,
) {
    /** One heard trade as a dot: where it is (0 = old edge, 1 = now), buy or sell, size 0..1, and its fixed height in the band (0 top, 1 bottom). */
    data class Dot(val u: Double, val buy: Boolean, val size: Double, val y: Double)

    /** The stream's displacement as -1..1, up positive (buyers ahead), 0 when level (within 5%) or with no tape; the caller scales it to dp. */
    fun shift(): Double {
        val l = lean ?: return 0.0
        return if (!l.isFinite() || kotlin.math.abs(l) <= LEVEL) 0.0 else l.coerceIn(-1.0, 1.0)
    }
    /** The words for the accessible name: observed, never a verdict. */
    val words: String get() {
        val l = lean ?: return "no trades in the last 5 minutes"
        return if (kotlin.math.abs(l) <= LEVEL) "balanced" else if (l > 0) "buyers ahead" else "sellers ahead"
    }

    companion object {
        /** Within this of zero the two sides are level (within 5% of each other). */
        const val LEVEL = 0.05
        /** How far the stream moves at full lean, as a share of the tile's height (the site's LEAN_TILE) and of a Discover ribbon's (LEAN_ROW). */
        const val TILE_SHARE = 0.12
        const val ROW_SHARE = 0.3
        /** Ribbon lengths a second (the site's REAL_SPEED): a dot crosses in about 3 seconds. A dot this far past the right edge is not drawn. */
        const val SPEED = 0.33
        const val PAST_EDGE = 1.08

        fun of(flow: Token.Flow?): Ribbon {
            val f = flow
            val lean = if (f != null && f.buy5m + f.sell5m > 0) (f.buy5m - f.sell5m) / (f.buy5m + f.sell5m) else null
            return Ribbon(lean)
        }

        /** The dots at [nowMs], from the trades heard for this coin: each is born at the old edge when heard and rides on; a fixed spread per trade, the same on every frame. */
        fun dots(trades: List<RealTrades.Heard>, nowMs: Long): List<Dot> {
            val out = ArrayList<Dot>(trades.size)
            var k = 0
            var prev = Long.MIN_VALUE
            for (t in trades) {
                k = if (t.atMs == prev) k + 1 else 0 // trades heard at one instant are a burst: spaced along the ribbon, not stacked (the site's stepReal)
                prev = t.atMs
                val age = (nowMs - t.atMs) / 1000.0
                if (age < 0) continue
                val h = (t.atMs % 100_000L).toDouble()
                val u = age * SPEED + minOf(k, 10) * 0.02 + hash(h + k * 7) * 0.03
                if (u > PAST_EDGE) continue
                out += Dot(minOf(u, 1.0), t.buy, t.size, floor(hash(h + 17 + k * 7) * 3) / 2 * 0.9 + 0.05 + (hash(h + 31) - 0.5) * 0.12)
            }
            return out
        }

        const val SIZE_RANGE = 0.17
        const val SWOOP = 0.6
        fun sizeOffset(size: Double, buy: Boolean, u: Double): Double {
            val s = size.coerceIn(0.0, 1.0)
            val tail = if (u > 0.82) SWOOP * Math.pow((u - 0.82) / 0.18, 2.0) else 0.0
            return (if (buy) -1 else 1) * s * SIZE_RANGE * (1 + tail)
        }

        /** A fixed spread in 0 until 1 for each trade, the same on every frame (the iPhone app's hash). */
        fun hash(i: Double): Double {
            val x = sin(i * 12.9898 + 78.233) * 43758.5453
            return x - floor(x)
        }
    }
}
