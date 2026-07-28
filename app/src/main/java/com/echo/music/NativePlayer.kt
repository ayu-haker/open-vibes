package com.echo.music

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Log
import android.webkit.WebView
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class NativePlayer(private val getWebView: () -> WebView?) {

    companion object {
        private const val TAG = "NativePlayer"
        var instance: NativePlayer? = null
            private set
    }

    private val executor = Executors.newSingleThreadExecutor()
    private var player: MediaPlayer? = null
    private var currentUrl: String? = null
    private var isPrepared = false
    private var currentTitle = ""
    private var currentArtist = ""

    var onStateChange: ((playing: Boolean, position: Long, duration: Long) -> Unit)? = null
    var onComplete: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    init {
        instance = this
    }

    fun playUrl(url: String, title: String = "", artist: String = "") {
        stop()
        currentTitle = title
        currentArtist = artist
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            Log.e(TAG, "Invalid URL: $url")
            postToJs("window._onNativeError('Invalid URL')")
            return
        }
        currentUrl = url
        isPrepared = false
        Log.d(TAG, "Playing: $url")

        executor.execute {
            try {
                val mp = MediaPlayer()
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )

                mp.setOnPreparedListener {
                    isPrepared = true
                    mp.start()
                    Log.d(TAG, "Started, duration=${mp.duration}")
                    postToJs("window._onNativePlaying()")
                }

                mp.setOnCompletionListener {
                    Log.d(TAG, "Completed")
                    postToJs("window._onNativeComplete()")
                }

                mp.setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "Error: what=$what extra=$extra")
                    postToJs("window._onNativeError('error:$what:$extra')")
                    true
                }

                val conn = URL(url).openConnection() as HttpURLConnection
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                conn.setRequestProperty("Accept", "*/*")
                conn.setRequestProperty("Referer", "https://www.jiosaavn.com/")
                conn.setRequestProperty("Origin", "https://www.jiosaavn.com")
                conn.connectTimeout = 20000
                conn.readTimeout = 30000
                conn.instanceFollowRedirects = true

                val responseCode = conn.responseCode
                Log.d(TAG, "HTTP $responseCode")
                if (responseCode !in 200..299) {
                    conn.disconnect()
                    postToJs("window._onNativeError('HTTP $responseCode')")
                    return@execute
                }

                val inputStream = conn.inputStream
                val tmpFile = java.io.File.createTempFile("ov_audio_", ".mp3", getWebView()?.context?.cacheDir)
                tmpFile.outputStream().use { out -> inputStream.use { it.copyTo(out) } }
                conn.disconnect()
                mp.setDataSource(tmpFile.absolutePath)
                mp.prepareAsync()
                player = mp
            } catch (e: Exception) {
                Log.e(TAG, "playUrl error", e)
                postToJs("window._onNativeError('${escapeJs(e.message ?: "unknown")}')")
            }
        }
    }

    fun pause() {
        player?.let {
            if (it.isPlaying) {
                it.pause()
                postToJs("window._onNativeState(false, ${it.currentPosition}, ${it.duration})")
            }
        }
    }

    fun resume() {
        player?.let {
            if (!it.isPlaying && isPrepared) {
                it.start()
                postToJs("window._onNativeState(true, ${it.currentPosition}, ${it.duration})")
            }
        }
    }

    fun togglePlayPause() {
        if (isPlaying()) pause() else resume()
    }

    fun seekTo(positionMs: Long) {
        player?.seekTo(positionMs.toInt())
    }

    fun stop() {
        try { player?.release() } catch (_: Exception) {}
        player = null
        isPrepared = false
        currentUrl = null
    }

    fun isPlaying(): Boolean = player?.isPlaying == true
    fun getPosition(): Long = player?.currentPosition?.toLong() ?: 0L
    fun getDuration(): Long = player?.duration?.toLong() ?: 0L
    fun getTitle(): String = currentTitle
    fun getArtist(): String = currentArtist

    private fun postToJs(js: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                getWebView()?.evaluateJavascript(js, null)
            } catch (_: Exception) {}
        }
    }

    private fun escapeJs(s: String): String {
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r")
    }
}
