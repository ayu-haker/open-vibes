package com.echo.music

import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class NetworkBridge(private val getWebView: () -> WebView?) {

    private val executor = Executors.newFixedThreadPool(4)
    private val counter = AtomicLong(0)

    @JavascriptInterface
    fun fetchAsync(url: String, callbackId: String) {
        executor.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                conn.setRequestProperty("Accept", "*/*")
                conn.connectTimeout = 20000
                conn.readTimeout = 20000
                conn.instanceFollowRedirects = true
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val reader = BufferedReader(InputStreamReader(stream))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                conn.disconnect()
                val bodyB64 = Base64.encodeToString(sb.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                postToJs("NetBridge._resolveB64('$callbackId','$bodyB64')")
            } catch (e: Exception) {
                val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
                postToJs("NetBridge._reject('$callbackId','$msg')")
            }
        }
    }

    @JavascriptInterface
    fun fetchWithHeadersAsync(url: String, headersJson: String, callbackId: String) {
        executor.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 20000
                conn.readTimeout = 20000
                conn.instanceFollowRedirects = true
                try {
                    val hdrs = JSONObject(headersJson)
                    for (key in hdrs.keys()) {
                        conn.setRequestProperty(key, hdrs.getString(key))
                    }
                } catch (_: Exception) {}
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val reader = BufferedReader(InputStreamReader(stream))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                conn.disconnect()
                val bodyB64 = Base64.encodeToString(sb.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                postToJs("NetBridge._resolveB64('$callbackId','$bodyB64')")
            } catch (e: Exception) {
                val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
                postToJs("NetBridge._reject('$callbackId','$msg')")
            }
        }
    }

    @JavascriptInterface
    fun postAsync(url: String, body: String, callbackId: String) {
        executor.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 20000
                conn.readTimeout = 20000
                conn.outputStream.write(body.toByteArray(Charsets.UTF_8))
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val reader = BufferedReader(InputStreamReader(stream))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                conn.disconnect()
                val respB64 = Base64.encodeToString(sb.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                postToJs("NetBridge._resolveB64('$callbackId','$respB64')")
            } catch (e: Exception) {
                val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
                postToJs("NetBridge._reject('$callbackId','$msg')")
            }
        }
    }

    @JavascriptInterface
    fun proxyStream(url: String, callbackId: String) {
        executor.execute {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                conn.setRequestProperty("Accept", "*/*")
                conn.setRequestProperty("Referer", "https://www.jiosaavn.com/")
                conn.setRequestProperty("Origin", "https://www.jiosaavn.com")
                conn.connectTimeout = 20000
                conn.readTimeout = 30000
                conn.instanceFollowRedirects = true
                val code = conn.responseCode
                if (code !in 200..299) {
                    throw Exception("HTTP $code")
                }
                val contentType = conn.contentType ?: "audio/mpeg"
                val tmpFile = java.io.File.createTempFile("ov_stream_", ".tmp", getWebView()?.context?.cacheDir)
                tmpFile.deleteOnExit()
                conn.inputStream.use { input ->
                    tmpFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                conn.disconnect()
                val path = tmpFile.absolutePath
                val b64path = Base64.encodeToString(path.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                postToJs("NetBridge._resolveStream('$callbackId','$b64path')")
            } catch (e: Exception) {
                val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
                postToJs("NetBridge._rejectStream('$callbackId','$msg')")
            }
        }
    }

    @JavascriptInterface
    fun decryptUrl(encryptedB64: String, callbackId: String) {
        try {
            val key = "38346591"
            val keyBytes = key.toByteArray(Charsets.UTF_8)
            val spec = SecretKeySpec(keyBytes, "DES")
            val cipher = Cipher.getInstance("DES/ECB/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, spec)
            val encryptedBytes = Base64.decode(encryptedB64, Base64.NO_WRAP)
            val decryptedBytes = cipher.doFinal(encryptedBytes)
            val url = String(decryptedBytes, Charsets.UTF_8).trimEnd('\u0000')
            Log.d("NetworkBridge", "DES decrypted URL: $url")
            val b64url = Base64.encodeToString(url.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
            postToJs("NetBridge._resolveB64('$callbackId','$b64url')")
        } catch (e: Exception) {
            Log.e("NetworkBridge", "DES decrypt failed", e)
            val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
            postToJs("NetBridge._reject('$callbackId','$msg')")
        }
    }

    @JavascriptInterface
    fun resolveStream(encryptedUrl: String, quality: String, callbackId: String) {
        executor.execute {
            try {
                val key = "38346591"
                val keyBytes = key.toByteArray(Charsets.UTF_8)
                val spec = SecretKeySpec(keyBytes, "DES")
                val cipher = Cipher.getInstance("DES/ECB/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, spec)
                val encryptedBytes = Base64.decode(encryptedUrl, Base64.NO_WRAP)
                val decryptedBytes = cipher.doFinal(encryptedBytes)
                var url = String(decryptedBytes, Charsets.UTF_8).trimEnd('\u0000')
                Log.d("NetworkBridge", "DES raw URL: $url")

                val qMap = mapOf(
                    "96kbps" to "_96", "160kbps" to "_160",
                    "320kbps" to "_320", "Low (96kbps)" to "_96",
                    "Normal (160kbps)" to "_160", "High (256kbps)" to "_160",
                    "Very High (320kbps)" to "_320", "Lossless (FLAC)" to "_320"
                )
                val qSuffix = qMap[quality] ?: "_320"
                url = url.replace("_96", qSuffix)

                if (!url.startsWith("http")) {
                    throw Exception("Invalid URL after decrypt: $url")
                }

                Log.d("NetworkBridge", "Final stream URL: $url")
                val b64url = Base64.encodeToString(url.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                postToJs("NetBridge._resolveB64('$callbackId','$b64url')")
            } catch (e: Exception) {
                Log.e("NetworkBridge", "resolveStream failed", e)
                val msg = (e.message ?: "unknown").replace("\\", "\\\\").replace("'", "\\'")
                postToJs("NetBridge._reject('$callbackId','$msg')")
            }
        }
    }

    private fun postToJs(js: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                getWebView()?.evaluateJavascript(js, null)
            } catch (_: Exception) {}
        }
    }
}
