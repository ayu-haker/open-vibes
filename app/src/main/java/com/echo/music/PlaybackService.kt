package com.echo.music

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle

class PlaybackService : android.app.Service() {

    companion object {
        private const val TAG = "PlaybackService"
        private const val NOTIFICATION_ID = 1337
        private const val CHANNEL_ID = "openvibes_playback"
        private const val CHANNEL_NAME = "Playback"
    }

    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var notificationManager: NotificationManager
    private var isPlaying = false
    private var currentTitle = ""
    private var currentArtist = ""
    private var currentPosition = 0L

    private val mediaSessionCallback = object : MediaSessionCompat.Callback() {
        override fun onPlay() {
            Log.d(TAG, "MediaSession onPlay")
            AudioFocusManager.ensureFocus(this@PlaybackService)
            NativePlayer.instance?.resume()
            isPlaying = true
            updateNotification()
        }

        override fun onPause() {
            Log.d(TAG, "MediaSession onPause")
            NativePlayer.instance?.pause()
            isPlaying = false
            updateNotification()
        }

        override fun onSkipToNext() {
            Log.d(TAG, "MediaSession onSkipToNext")
            sendCommandToWebView("next")
        }

        override fun onSkipToPrevious() {
            Log.d(TAG, "MediaSession onSkipToPrevious")
            sendCommandToWebView("prev")
        }

        override fun onStop() {
            Log.d(TAG, "MediaSession onStop")
            NativePlayer.instance?.stop()
            AudioFocusManager.abandonFocus()
            isPlaying = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }

        override fun onSeekTo(pos: Long) {
            Log.d(TAG, "MediaSession onSeekTo: $pos")
            NativePlayer.instance?.seekTo(pos)
            updatePlaybackState(true, pos)
        }

        override fun onCustomAction(action: String?, extras: Bundle?) {
            Log.d(TAG, "MediaSession onCustomAction: $action")
            when (action) {
                "shuffle" -> sendCommandToWebView("shuffle")
                "repeat" -> sendCommandToWebView("repeat")
                "like" -> sendCommandToWebView("like")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate")

        createNotificationChannel()

        mediaSession = MediaSessionCompat(this, "OpenVibesSession").apply {
            setCallback(mediaSessionCallback)
            isActive = true
        }

        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.getStringExtra("action")
        val title = intent?.getStringExtra("title") ?: ""
        val artist = intent?.getStringExtra("artist") ?: ""
        val playing = intent?.getBooleanExtra("isPlaying", false) ?: false
        val position = intent?.getLongExtra("position", 0L) ?: 0L
        val duration = intent?.getLongExtra("duration", 0L) ?: 0L

        Log.d(TAG, "onStartCommand action=$action title=$title playing=$playing")

        when (action) {
            "update_state" -> {
                isPlaying = playing
                currentTitle = title
                currentArtist = artist
                currentPosition = position
                updateMetadata(title, artist, duration)
                updatePlaybackState(playing, position)
                updateNotification()
            }
            "play", "play_pause" -> {
                currentTitle = title
                currentArtist = artist
                isPlaying = if (action == "play") true else !isPlaying
                if (isPlaying) NativePlayer.instance?.resume() else NativePlayer.instance?.pause()
                updateMetadata(title, artist, duration)
                updatePlaybackState(isPlaying, position)
                updateNotification()
            }
            "pause" -> {
                NativePlayer.instance?.pause()
                isPlaying = false
                updatePlaybackState(false, position)
                updateNotification()
            }
            "stop" -> {
                NativePlayer.instance?.stop()
                isPlaying = false
                AudioFocusManager.abandonFocus()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            "prev" -> {
                sendCommandToWebView("prev")
            }
            "next" -> {
                sendCommandToWebView("next")
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): android.os.IBinder? = null

    override fun onDestroy() {
        mediaSession.isActive = false
        mediaSession.release()
        AudioFocusManager.abandonFocus()
        Log.d(TAG, "onDestroy")
        super.onDestroy()
    }

    private fun sendCommandToWebView(command: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("playback_command", command)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        try {
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send command to WebView", e)
        }
    }

    private fun updateMetadata(title: String, artist: String, duration: Long) {
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, createPlaceholderArt(title))
            .build()
        mediaSession.setMetadata(metadata)
    }

    private fun updatePlaybackState(playing: Boolean, position: Long) {
        val state = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(
                if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                position,
                1f
            )
            .build()
        mediaSession.setPlaybackState(state)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Music playback controls"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        } else {
            @Suppress("DEPRECATION")
            notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        }
    }

    private fun buildNotification(): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = PendingIntent.getService(
            this, 1,
            Intent(this, PlaybackService::class.java).putExtra("action", "prev"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIntent = PendingIntent.getService(
            this, 2,
            Intent(this, PlaybackService::class.java).putExtra("action", "play_pause"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val nextIntent = PendingIntent.getService(
            this, 3,
            Intent(this, PlaybackService::class.java).putExtra("action", "next"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this, 4,
            Intent(this, PlaybackService::class.java).putExtra("action", "stop"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIcon = if (isPlaying) {
            android.R.drawable.ic_media_pause
        } else {
            android.R.drawable.ic_media_play
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle.ifEmpty { "Open Vibes" })
            .setContentText(currentArtist.ifEmpty { "Tap to play music" })
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevIntent)
            .addAction(playPauseIcon, if (isPlaying) "Pause" else "Play", playPauseIntent)
            .addAction(android.R.drawable.ic_media_next, "Next", nextIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
                    .setShowCancelButton(true)
                    .setCancelButtonIntent(stopIntent)
            )
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .build()
    }

    private fun updateNotification() {
        notificationManager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun createPlaceholderArt(title: String): Bitmap {
        val size = 256
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)

        val hue = (title.hashCode() % 360 + 360) % 360
        val paint = android.graphics.Paint().apply {
            color = Color.HSVToColor(floatArrayOf(hue.toFloat(), 0.6f, 0.7f))
            style = android.graphics.Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), paint)

        val textPaint = android.graphics.Paint().apply {
            color = Color.WHITE
            textSize = 80f
            isAntiAlias = true
            textAlign = android.graphics.Paint.Align.CENTER
        }
        val displayTitle = title.take(1).uppercase()
        canvas.drawText(displayTitle, size / 2f, size / 2f + 28f, textPaint)

        return bitmap
    }
}
