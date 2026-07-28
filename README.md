# Open Vibes

A free, open-source music player for Android with streaming from JioSaavn and YouTube Music.

## Features

- **Multi-source streaming** — Search and play from JioSaavn & YouTube Music
- **Native Android playback** — MediaPlayer-based streaming with proper HTTP headers
- **Lock screen controls** — Play/pause/next/prev from lock screen and notification
- **Foreground service** — Keeps playing in background with persistent notification
- **Search** — Unified search across music sources
- **Queue management** — Add to queue, reorder, shuffle, repeat
- **Library** — Favorites, recently played, artists, albums
- **Settings** — Player, look & feel, language, extensions
- **Dynamic theming** — 16 accent colors, dark/light/AMOLED modes, glassmorphism UI
- **Sleep timer** — Auto-stop playback after set duration
- **Crossfade** — Smooth transitions between tracks

## Tech Stack

- **Android** — Kotlin, WebView, MediaPlayer, MediaSessionCompat
- **Frontend** — HTML5, CSS3, vanilla JavaScript
- **APIs** — JioSaavn (direct HTTP), YouTube Music (via Piped)

## Requirements

- Android 8.0+ (API 26)
- Internet connection
- No account or server required

## Build

```bash
# Set JAVA_HOME to JDK 17
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk

cd EchoMusic
./gradlew assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Project Structure

```
EchoMusic/
├── app/src/main/
│   ├── assets/
│   │   ├── index.html        # Main UI (all screens)
│   │   ├── style.css          # Premium dark UI theme
│   │   ├── music-api.js       # Music streaming APIs
│   │   └── app.js             # Core JS engine
│   ├── java/com/echo/music/
│   │   ├── MainActivity.kt    # WebView activity
│   │   ├── NativePlayer.kt    # MediaPlayer wrapper
│   │   ├── NetworkBridge.kt   # Native HTTP + DES decrypt
│   │   ├── PlaybackBridge.kt  # JS ↔ Kotlin bridge
│   │   ├── PlaybackService.kt # Foreground service + notification
│   │   └── AudioFocusManager.kt
│   └── AndroidManifest.xml
└── build.gradle.kts
```

## License

Free and open source. Use responsibly. Respect music licensing in your region.
