package com.echo.music

import android.content.Context
import android.util.Log

class AdManager(private val context: Context) {

    companion object {
        private const val TAG = "AdManager"

        fun onAdEvent(adType: String, event: String) {
            AdAuditLog.record(adType, event)
        }
    }

    fun showBanner() {
        Log.d(TAG, "showBanner → visual only, NO player calls")
        onAdEvent("banner", "shown")
    }

    fun hideBanner() {
        Log.d(TAG, "hideBanner → visual only, NO player calls")
        onAdEvent("banner", "hidden")
    }

    fun triggerInterstitial() {
        Log.d(TAG, "triggerInterstitial → visual only, NO player calls")
        onAdEvent("interstitial", "shown")
    }

    fun dismissInterstitial() {
        Log.d(TAG, "dismissInterstitial → visual only, NO player calls")
        onAdEvent("interstitial", "dismissed")
    }
}
