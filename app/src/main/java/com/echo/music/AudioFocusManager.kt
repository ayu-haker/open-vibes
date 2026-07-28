package com.echo.music

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log

object AudioFocusManager {
    private const val TAG = "AudioFocus"

    private var activeFocusRequest: AudioFocusRequest? = null
    private var appContext: Context? = null

    fun ensureFocus(context: Context) {
        appContext = context.applicationContext
        if (activeFocusRequest != null) {
            Log.d(TAG, "Focus already held, skipping")
            return
        }
        requestFocus()
    }

    fun abandonFocus() {
        if (activeFocusRequest == null) return
        try {
            val am = appContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            if (am != null && activeFocusRequest != null) {
                @Suppress("DEPRECATION")
                am.abandonAudioFocusRequest(activeFocusRequest!!)
            }
            activeFocusRequest = null
            Log.d(TAG, "Focus abandoned")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to abandon focus", e)
            activeFocusRequest = null
        }
    }

    private fun requestFocus() {
        val ctx = appContext ?: return
        try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()

                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(true)
                    .setWillPauseWhenDucked(false)
                    .setOnAudioFocusChangeListener { focusChange ->
                        handleFocusChange(focusChange)
                    }
                    .build()

                val result = am.requestAudioFocus(focusRequest)
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    activeFocusRequest = focusRequest
                    Log.d(TAG, "Focus GRANTED")
                } else {
                    Log.w(TAG, "Focus DENIED: $result")
                }
            } else {
                @Suppress("DEPRECATION")
                val result = am.requestAudioFocus(
                    { focusChange -> handleFocusChange(focusChange) },
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                )
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    Log.d(TAG, "Focus GRANTED (legacy)")
                } else {
                    Log.w(TAG, "Focus DENIED (legacy): $result")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request focus", e)
        }
    }

    private fun handleFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                Log.d(TAG, "FOCUS LOSS (external app) -> pausing")
                sendCommand("pause")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "FOCUS LOSS TRANSIENT (phone call etc) -> pausing")
                sendCommand("pause")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                Log.d(TAG, "FOCUS LOSS DUCK -> NOT ducking our audio")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.d(TAG, "FOCUS GAINED -> resuming")
                sendCommand("play")
            }
        }
    }

    private fun sendCommand(command: String) {
        val ctx = appContext ?: return
        try {
            val intent = android.content.Intent(ctx, MainActivity::class.java).apply {
                putExtra("playback_command", command)
                addFlags(
                    android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
            }
            ctx.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send focus command", e)
        }
    }
}
