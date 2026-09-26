#!/usr/bin/env bash
# Выпуск новой версии Hex Blast: поднимает версию, собирает подписанный APK,
# коммитит, ставит тег и публикует релиз на GitHub. Установленные игры увидят
# его при следующем запуске и предложат обновиться.
#
#   ./release.sh 1.2 "Что нового"
#
# versionCode обязан расти: Android не ставит поверх сборку с тем же или меньшим кодом.
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"
if [[ -z "$VERSION" ]]; then
    echo "Использование: ./release.sh <версия> [что нового]" >&2
    exit 1
fi

GH="${GH:-gh}"
command -v "$GH" >/dev/null 2>&1 || GH=/c/Users/User/dev-tools/gh/bin/gh.exe

GRADLE_FILE="app/build.gradle.kts"
CURRENT_CODE=$(grep -oE 'versionCode = [0-9]+' "$GRADLE_FILE" | grep -oE '[0-9]+')
NEXT_CODE=$((CURRENT_CODE + 1))
echo "==> Версия $VERSION (versionCode $CURRENT_CODE -> $NEXT_CODE)"
sed -i "s|versionCode = $CURRENT_CODE|versionCode = $NEXT_CODE|" "$GRADLE_FILE"
sed -i -E "s|versionName = \"[^\"]+\"|versionName = \"$VERSION\"|" "$GRADLE_FILE"

echo "==> Сборка"
./gradlew assembleRelease --console=plain -q
APK="HexBlast-$VERSION.apk"
cp app/build/outputs/apk/release/app-release.apk "$APK"

echo "==> Коммит и тег"
git add -A
git commit -m "Hex Blast $VERSION" -m "$NOTES"
git tag "v$VERSION"
git push origin HEAD --tags

echo "==> Релиз на GitHub"
"$GH" release create "v$VERSION" "$APK" --title "Hex Blast $VERSION" --notes "${NOTES:-Новая версия}"
echo "Готово: $APK опубликован."
