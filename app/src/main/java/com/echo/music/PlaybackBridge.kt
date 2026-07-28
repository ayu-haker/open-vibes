package com.echo.music

import android.webkit.JavascriptInterface

class PlaybackBridge(
    private val activity: MainActivity,
    private val serviceCommand: (String, String, String, Boolean, Long, Long) -> Unit
) {

    private var lastKnownState: Boolean = false
    private var nativePlayer: NativePlayer? = null

    fun setNativePlayer(np: NativePlayer) { nativePlayer = np }

    @JavascriptInterface
    fun playUrl(url: String, title: String, artist: String) {
        AdAuditLog.record("playback", "playUrl_called")
        nativePlayer?.playUrl(url, title, artist)
    }

    @JavascriptInterface
    fun nativePause() {
        AdAuditLog.record("playback", "nativePause_called")
        nativePlayer?.pause()
    }

    @JavascriptInterface
    fun nativeResume() {
        AdAuditLog.record("playback", "nativeResume_called")
        nativePlayer?.resume()
    }

    @JavascriptInterface
    fun nativeSeek(positionMs: Long) {
        nativePlayer?.seekTo(positionMs)
    }

    @JavascriptInterface
    fun nativeStop() {
        AdAuditLog.record("playback", "nativeStop_called")
        nativePlayer?.stop()
    }

    @JavascriptInterface
    fun nativeGetPosition(): Long = nativePlayer?.getPosition() ?: 0L

    @JavascriptInterface
    fun nativeGetDuration(): Long = nativePlayer?.getDuration() ?: 0L

    @JavascriptInterface
    fun nativeIsPlaying(): Boolean = nativePlayer?.isPlaying() ?: false

    @JavascriptInterface
    fun play(title: String, artist: String, duration: Long) {
        AdAuditLog.record("playback", "play_called")
        lastKnownState = true
        serviceCommand("play", title, artist, true, 0L, duration)
        AudioFocusManager.ensureFocus(activity)
    }

    @JavascriptInterface
    fun pause() {
        AdAuditLog.record("playback", "pause_called")
        lastKnownState = false
        serviceCommand("pause", "", "", false, 0L, 0L)
    }

    @JavascriptInterface
    fun next() {
        AdAuditLog.record("playback", "next_called")
        serviceCommand("next", "", "", lastKnownState, 0L, 0L)
    }

    @JavascriptInterface
    fun prev() {
        AdAuditLog.record("playback", "prev_called")
        serviceCommand("prev", "", "", lastKnownState, 0L, 0L)
    }

    @JavascriptInterface
    fun updateState(title: String, artist: String, playing: Boolean, position: Long, duration: Long) {
        AdAuditLog.record("playback", "state_updated playing=$playing")
        lastKnownState = playing
        serviceCommand("update_state", title, artist, playing, position, duration)
    }

    @JavascriptInterface
    fun seek(position: Long) {
        serviceCommand("seek", "", "", lastKnownState, position, 0L)
    }

    @JavascriptInterface
    fun stop() {
        AdAuditLog.record("playback", "stop_called")
        lastKnownState = false
        serviceCommand("stop", "", "", false, 0L, 0L)
    }

    @JavascriptInterface
    fun requestAudioFocus() {
        AdAuditLog.record("playback", "focus_requested")
        AudioFocusManager.ensureFocus(activity)
    }

    @JavascriptInterface
    fun abandonAudioFocus() {
        AdAuditLog.record("playback", "focus_abandoned")
        AudioFocusManager.abandonFocus()
    }

    @JavascriptInterface
    fun getAuditLog(): String = AdAuditLog.getLog()

    @JavascriptInterface
    fun wasPlayerTouchedDuringAd(adType: String): Boolean = AdAuditLog.wasPlayerTouchedDuringAd(adType)

    @JavascriptInterface
    fun logAdEvent(adType: String, event: String) {
        AdAuditLog.record(adType, event)
    }
}
