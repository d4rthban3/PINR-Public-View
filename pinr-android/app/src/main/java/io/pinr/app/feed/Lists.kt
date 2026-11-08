package io.pinr.app.feed

import kotlin.math.abs

/**
 *
 * Pump.fun, Flap and Four.meme refuse every reader we can use for free, so their lists here are PINR's own, built from the coins PINR lists.
 * A plain sort (New, Market cap, Oldest, Last trade) carries the launchpad's name; a ranked board (Movers, Trending, Hot) is labelled "PINR's list"
 * with the ordering said in words. A coin with no figure for a list goes last: never first, never a zero.
 */
data class LaunchList(val id: String, val name: String, val pinr: Boolean, val order: String, val own: Boolean = false)

data class Launchpad(val id: String, val name: String, val lists: List<LaunchList>, val own: Boolean = false)

object Lists {
    private val sorts = listOf(
        LaunchList("new", "New", false, "newest first"),
        LaunchList("marketcap", "Market cap", false, "biggest market cap first"),
        LaunchList("lasttrade", "Last trade", false, "most recent trade first"),
    )

    val launchpads = listOf(
        Launchpad("pumpfun", "Pump.fun", listOf(LaunchList("movers", "Movers", true, "biggest 24h price move first, up or down")) + sorts + LaunchList("oldest", "Oldest", false, "oldest first")),
        Launchpad("flap", "Flap", listOf(LaunchList("trending", "Trending", true, "most trades in the last hour first")) + sorts),
        Launchpad("fourmeme", "Four.meme", listOf(LaunchList("hot", "Hot", true, "most trades in the last hour first")) + sorts),
    )

    /** The launchpads whose own lists the engine reads (`/api/lists`: Zora, Clanker, BONKfun), set when they arrive; their order is kept as ranks. */
    @Volatile private var ownPads: List<Launchpad> = emptyList()
    @Volatile private var ownRanks: Map<String, Map<String, Int>> = emptyMap()
    fun all(): List<Launchpad> = launchpads + ownPads

    /** Takes the launchpads' own lists in and returns their coins as tokens the page can hold (a coin the page already has keeps its own figures). */
    fun setOwn(doc: org.json.JSONObject, feedBase: String?): List<Token> {
        val pads = ArrayList<Launchpad>()
        val ranks = HashMap<String, Map<String, Int>>()
        val tokens = LinkedHashMap<String, Token>()
        val lps = doc.optJSONArray("launchpads") ?: return emptyList()
        for (i in 0 until lps.length()) {
            val lp = lps.optJSONObject(i) ?: continue
            val id = lp.optString("id"); val name = lp.optString("name")
            if (id.isEmpty() || name.isEmpty()) continue
            val chain = lp.optString("chain").takeIf { it.isNotEmpty() && it != "null" }
            val listsJson = lp.optJSONArray("lists") ?: continue
            val items = (0 until listsJson.length()).mapNotNull { listsJson.optJSONObject(it) }.sortedBy { if (it.optBoolean("default")) 0 else 1 }
            val lists = ArrayList<LaunchList>()
            for (l in items) {
                val lid = l.optString("id"); val lname = l.optString("name")
                val coins = l.optJSONArray("coins") ?: continue
                if (lid.isEmpty() || lname.isEmpty()) continue
                lists.add(LaunchList(lid, lname, false, "the launchpad's own order", own = true))
                val rank = HashMap<String, Int>()
                for (j in 0 until coins.length()) {
                    val c = coins.optJSONObject(j) ?: continue
                    val addr = c.optString("id"); if (addr.isEmpty()) continue
                    rank[addr.lowercase()] = c.optInt("rank", j + 1)
                    if (tokens.containsKey(addr.lowercase())) continue
                    val o = org.json.JSONObject().put("address", addr).put("coverage", 0).put("launchpad", name).put("note", "No health reading yet").put("asOfMs", System.currentTimeMillis().toDouble())
                    (c.optString("chain").takeIf { it.isNotEmpty() && it != "null" } ?: chain)?.let { o.put("chain", it) }
                    c.optString("name").takeIf { it.isNotEmpty() && it != "null" }?.let { o.put("name", it) }
                    c.optString("ticker").takeIf { it.isNotEmpty() && it != "null" }?.let { o.put("ticker", it) }
                    if (!c.isNull("mcapUsd")) o.put("valuationUsd", c.optDouble("mcapUsd"))
                    if (!c.isNull("createdMs")) o.put("launchedAtMs", c.optDouble("createdMs"))
                    if (!c.isNull("lastTradeMs")) o.put("lastTradeMs", c.optDouble("lastTradeMs"))
                    c.optString("imageUrl").takeIf { it.isNotEmpty() && it != "null" }?.let { o.put("imageUrl", it) }
                    val w = Wire.token(o) ?: continue
                    (Token.make(w, feedBase) as? Token.Made.Shown)?.let { tokens[addr.lowercase()] = it.token }
                }
                ranks["$id:$lid"] = rank
            }
            if (lists.isNotEmpty()) pads.add(Launchpad(id, name, lists, own = true))
        }
        ownPads = pads
        ownRanks = ranks
        return tokens.values.toList()
    }

    const val DEFAULT_KEY = "pumpfun:movers"

    fun key(lp: Launchpad, list: LaunchList) = "${lp.id}:${list.id}"
    fun first(lp: Launchpad) = key(lp, lp.lists.first())
    fun launchpad(key: String): Launchpad? = all().firstOrNull { it.id == key.substringBefore(':') }
    fun list(key: String): Pair<Launchpad, LaunchList>? {
        val lp = launchpad(key) ?: return null
        val l = lp.lists.firstOrNull { it.id == key.substringAfter(':') } ?: return null
        return lp to l
    }

    /** What the page says it is showing: the launchpad's name for a plain sort, "PINR's list" for a ranked board; the order in words. */
    fun label(key: String): Triple<String, String, Boolean>? {
        val (lp, l) = list(key) ?: return null
        return Triple(if (l.pinr) "${lp.name} · ${l.name} (PINR's list)" else "${lp.name} · ${l.name}", l.order, l.pinr)
    }

    private fun mark(t: Token): String? {
        val l = (t.launchpad ?: "").lowercase()
        return when {
            l.contains("pump") -> "pumpfun"
            l.contains("flap") -> "flap"
            l.contains("four") -> "fourmeme"
            else -> null
        }
    }

    /** The number a list orders by (bigger first); null when the coin has none. */
    private fun measure(id: String, t: Token, nowMs: Long): Double? = when (id) {
        "movers" -> t.change24hPct?.let { abs(it) }
        "trending", "hot" -> t.flow?.trades1h?.toDouble()
        "new" -> t.launchedAtMs?.let { -maxOf(0L, nowMs - it).toDouble() }
        "oldest" -> t.launchedAtMs?.let { maxOf(0L, nowMs - it).toDouble() }
        "marketcap" -> t.valuationUsd
        "lasttrade" -> t.lastTradeMs?.toDouble()
        else -> null
    }

    /** The coins of one list, in order (a coin without the figure goes after those with it, in the feed's order). */
    fun rank(key: String, tokens: List<Token>, nowMs: Long = System.currentTimeMillis(), limit: Int): List<Token> {
        val (lp, l) = list(key) ?: return emptyList()
        if (lp.own) {
            // The launchpad's own list: its coins in its own order (a coin the page does not hold yet is not drawn).
            val ranks = ownRanks["${lp.id}:${l.id}"] ?: emptyMap()
            return tokens.filter { ranks.containsKey(it.address.lowercase()) }.sortedBy { ranks[it.address.lowercase()] }.take(limit)
        }
        val rows = tokens.withIndex().filter { mark(it.value) == lp.id }.map { Triple(it.index, it.value, measure(l.id, it.value, nowMs)) }
        return rows.sortedWith { a, b ->
            val x = a.third; val y = b.third
            when {
                x != null && y != null && x != y -> y.compareTo(x)
                x == null && y != null -> 1
                x != null && y == null -> -1
                else -> a.first.compareTo(b.first)
            }
        }.take(limit).map { it.second }
    }
}
