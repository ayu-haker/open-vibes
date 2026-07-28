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
        nativePlayer?.playUrl(url, title, artist)
    }

    @JavascriptInterface
    fun nativePause() {
        nativePlayer?.pause()
    }

    @JavascriptInterface
    fun nativeResume() {
        nativePlayer?.resume()
    }

    @JavascriptInterface
    fun nativeSeek(positionMs: Long) {
        nativePlayer?.seekTo(positionMs)
    }

    @JavascriptInterface
    fun nativeStop() {
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
        lastKnownState = true
        serviceCommand("play", title, artist, true, 0L, duration)
        AudioFocusManager.ensureFocus(activity)
    }

    @JavascriptInterface
    fun pause() {
        lastKnownState = false
        serviceCommand("pause", "", "", false, 0L, 0L)
    }

    @JavascriptInterface
    fun next() {
        serviceCommand("next", "", "", lastKnownState, 0L, 0L)
    }

    @JavascriptInterface
    fun prev() {
        serviceCommand("prev", "", "", lastKnownState, 0L, 0L)
    }

    @JavascriptInterface
    fun updateState(title: String, artist: String, playing: Boolean, position: Long, duration: Long) {
        lastKnownState = playing
        serviceCommand("update_state", title, artist, playing, position, duration)
    }

    @JavascriptInterface
    fun seek(position: Long) {
        serviceCommand("seek", "", "", lastKnownState, position, 0L)
    }

    @JavascriptInterface
    fun stop() {
        lastKnownState = false
        serviceCommand("stop", "", "", false, 0L, 0L)
    }

    @JavascriptInterface
    fun requestAudioFocus() {
        AudioFocusManager.ensureFocus(activity)
    }

    @JavascriptInterface
    fun abandonAudioFocus() {
        AudioFocusManager.abandonFocus()
    }
}
