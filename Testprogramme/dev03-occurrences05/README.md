# Dev_0_3: Zweimal dasselbe Include in einer Übersetzungseinheit

Den Ordner `dev03-occurrences05` direkt im VS-Code-Extension-Host öffnen.
Die lokalen Einstellungen ordnen `.h` dem Sprachmodus PEARL zu.

`RepeatedInOneUnit.P` bindet `HSharedVar.h` zweimal ein, jeweils innerhalb
unterschiedlicher Prozeduren mit eigener Symboltabelle:

- `First`: `DCL Var FIXED;`
- `Second`: `DCL Var FLOAT;`

Die physische Position von `Var` in `HSharedVar.h` ist in beiden Fällen
identisch. Der expandierte Text hat dagegen zwei verschiedene Positionen.

Paket 05 führt die Herkunftsmetadaten hierfür ein und hat einen automatischen
Präprozessor-Regressionstest. **Es implementiert noch keine Auswahl der beiden
Vorkommen für Hover oder Navigation.** In der direkt geöffneten Headerdatei
kann daher weiterhin nur ein zufälliger oder gar kein Hover erscheinen.
Bitte dieses Verhalten nicht als bestandenen Kontextauswahltest werten.

Später dient dieser Ordner als manueller Regressionstest der CodeLens-Auswahl
von `First` und `Second` und der richtigen Hover-Typen.
