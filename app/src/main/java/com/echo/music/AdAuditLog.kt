package com.echo.music

import android.util.Log

object AdAuditLog {
    private const val TAG = "AdAudit"
    private val events = mutableListOf<String>()

    fun record(adType: String, event: String) {
        val entry = "${System.currentTimeMillis()}: [$adType] $event"
        events.add(entry)
        if (events.size > 200) events.removeAt(0)
        Log.d(TAG, entry)
    }

    fun wasPlayerTouchedDuringAd(adType: String): Boolean {
        val playerTouchPatterns = listOf("player.pause", "player.stop", "audio_focus", "duck")
        val relevantEvents = events.filter { it.contains("[$adType]") }
        return relevantEvents.any { entry ->
            playerTouchPatterns.any { pattern -> entry.contains(pattern, ignoreCase = true) }
        }
    }

    fun getLog(): String = events.joinToString("\n")

    fun clear() = events.clear()
}
