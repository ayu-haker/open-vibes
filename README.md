# Open Vibes

A free, open-source music player for Android with streaming from JioSaavn and YouTube Music.

> **Note:** This project is for **educational purposes only**. It demonstrates Android app development with WebView, native MediaPlayer integration, foreground services, and media streaming. Respect music licensing and copyright laws in your region.

## Download APK

[**Download Latest Release (APK)**](https://github.com/ayu-haker/open-vibes/releases/latest)

1. Download the `app-debug.apk` from the link above
2. On your Android phone, go to **Settings > Security > Unknown Sources** and enable it
3. Open the downloaded APK file and install
4. Grant notification permission when prompted

> **Disclaimer:** This app is provided as-is for educational and learning purposes only. The developers are not responsible for any misuse. Users are solely responsible for compliance with local laws and terms of service of third-party APIs used.

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

---

## Pipeline Infrastructure & DevOps

### CI/CD Pipeline

```
Code Push → Lint → Build → Test → Sign → Release → Distribute
```

| Stage | Tool | Description |
|-------|------|-------------|
| Version Control | Git + GitHub | Branch strategy: `main` (stable), `dev` (development) |
| Code Quality | ktlint, detekt | Kotlin static analysis, code style enforcement |
| Build | Gradle (Kotlin DSL) | Incremental builds, build cache, parallel execution |
| Testing | JUnit + Espresso | Unit tests + instrumented UI tests |
| Artifact | `./gradlew assembleRelease` | Signed APK/AAB generation |
| Distribution | GitHub Releases | Tagged releases with APK artifacts |
| Device Testing | ADB + Firebase Test Lab | Physical device + emulator matrix |

### Build Pipeline (GitHub Actions)

```yaml
name: Build & Release
on:
  push:
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - uses: android-actions/setup-android@v3
      - run: ./gradlew assembleDebug --stacktrace
      - uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: app/build/outputs/apk/debug/

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - uses: softprops/action-gh-release@v2
        with:
          files: debug-apk/app-debug.apk
```

### Containerization

```dockerfile
# Multi-stage build for CI environment
FROM eclipse-temurin:17-jdk AS builder
ENV ANDROID_HOME=/opt/android-sdk
RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O /tmp/cmdtools.zip && \
    unzip /tmp/cmdtools.zip -d $ANDROID_HOME/cmdline-tools && \
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
RUN yes | sdkmanager "platforms;android-34" "build-tools;34.0.0"

WORKDIR /app
COPY . .
RUN chmod +x gradlew && ./gradlew assembleDebug --no-daemon

FROM scratch AS artifact
COPY --from=builder /app/app/build/outputs/apk/debug/app-debug.apk /apk/
```

```yaml
# docker-compose.yml for local dev
version: '3.8'
services:
  builder:
    build: .
    volumes:
      - ./app/build/outputs/apk:/apk
      - gradle-cache:/root/.gradle

  adb-device:
    image: sorccu/adb:latest
    devices:
      - /dev/bus/usb:/dev/bus/usb
    privileged: true

volumes:
  gradle-cache:
```

### Infrastructure Architecture

```
┌─────────────────────────────────────────────────┐
│                  Developer Machine               │
│  Android Studio / VS Code → Git Push             │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              GitHub Actions CI                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │  Lint &  │→ │  Build   │→ │  Test & Sign   │ │
│  │  Analyze │  │  APK/AAB │  │  Artifact      │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
┌──────────────────┐  ┌──────────────────────┐
│  GitHub Releases │  │  Firebase Test Lab   │
│  (Tagged APKs)   │  │  (Device Matrix)     │
└────────┬─────────┘  └──────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│              Distribution                         │
│  • GitHub Releases (direct APK download)          │
│  • Firebase App Distribution (beta testing)       │
│  • F-Droid (open source, if submitted)            │
└──────────────────────────────────────────────────┘
```

### Monitoring & Observability

```
┌──────────────────────────────────────┐
│         App Runtime                  │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ Logcat   │  │ Firebase Crashlytics│
│  │ (local)  │  │ (remote)         │  │
│  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
```

- **Crash Reporting**: Firebase Crashlytics for crash-free rate monitoring
- **Analytics**: Privacy-first, no user tracking (local analytics only)
- **Performance**: MediaCodec buffer monitoring, stream latency tracking
- **Logging**: Structured Android Logcat with tag-based filtering (`NativePlayer`, `NetworkBridge`, `PlaybackService`)

### Deployment Strategy

```
Staging (debug APK)
    ↓ QA + Device Testing
Release Candidate
    ↓ Signed Release Build
Production (tagged release on GitHub)
    ↓ User Downloads APK
Side-load on Android device
```

| Environment | Build Type | Signing | Distribution |
|-------------|-----------|---------|-------------|
| Development | `debug` | Debug key | ADB install |
| Staging | `debug` | Debug key | Firebase App Distribution |
| Production | `release` | Release keystore | GitHub Releases (signed APK) |

### Environment Configuration

```properties
# gradle.properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
android.useAndroidX=true
android.nonTransitiveRClass=true

# Build variants
# debug  → development, verbose logging, no ProGuard
# release → production, ProGuard minification, signed APK
```

### Security Pipeline

```
Code Commit
    ↓
Pre-commit hooks (secrets detection)
    ↓
CI: Dependency vulnerability scan (OWASP)
    ↓
CI: Static analysis (detekt, lint)
    ↓
Release: ProGuard/R8 obfuscation
    ↓
Release: APK signing (v2+v3 scheme)
    ↓
GitHub: Signed release artifacts
```

- **No secrets in codebase** — API keys via environment variables
- **ProGuard/R8** — Code obfuscation and minification for release builds
- **Network Security Config** — Cleartext traffic only for development; production enforces HTTPS
- **Dependency scanning** — Automated CVE detection in CI

### Scripts

```bash
# Local development
./gradlew assembleDebug                    # Build debug APK
./gradlew assembleRelease                  # Build release APK
./gradlew installDebug                     # Build + install on connected device
./gradlew lint                             # Run lint checks
./gradlew test                             # Run unit tests

# Device testing
adb install -t app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.echo.music/.MainActivity
adb logcat -s NativePlayer:* PlaybackService:* MainActivity:*

# Release
./gradlew assembleRelease
apksigner sign --ks release.keystore app/build/outputs/apk/release/app-release.apk
```
