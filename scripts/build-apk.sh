#!/usr/bin/env bash
# Builds a debug APK on this machine, same steps as .github/workflows/build-apk.yml.
# Output: apk/audiobookshelf-<timestamp>-<commit>.apk
#
# Requires JDK 17 + 21, the Android SDK (platform 36) and Node. Overridable via env:
#   JAVA_HOME (default: JDK 21), ANDROID_HOME (default: /opt/android-sdk)
# Pass --skip-web to reuse the last Nuxt build (dist/) when only native code changed.
set -euo pipefail

cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
JDK_PATHS="/usr/lib/jvm/java-17-openjdk-amd64,/usr/lib/jvm/java-21-openjdk-amd64"

[ -f android/local.properties ] || echo "sdk.dir=$ANDROID_HOME" > android/local.properties

[ -d node_modules ] || npm ci --omit=optional
[ "${1:-}" = "--skip-web" ] || npm run generate
# Always copy the current web build into the Android project, it's quick
npx cap sync android

(cd android && ./gradlew assembleDebug --no-daemon -Dorg.gradle.java.installations.paths="$JDK_PATHS")

mkdir -p apk
name="audiobookshelf-$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD).apk"
cp -v android/app/build/outputs/apk/debug/app-debug.apk "apk/$name"
echo "APK: $(pwd)/apk/$name"
