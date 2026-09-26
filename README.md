# Hex Blast

Головоломка на сотах в духе Block Blast: ставишь фигуры, сжигаешь линии в трёх направлениях, копишь комбо.

- Игра целиком в `app/src/main/assets` (canvas + WebAudio), Android-обёртка на WebView в `app/src/main/java`.
- Обновления приходят из GitHub Releases этого репозитория: приложение само проверяет последний релиз.
- Новая версия: `./release.sh 1.2 "Что нового"`. Нужен `hexblast.keystore` и `keystore.properties` рядом с проектом (в git не хранятся).
