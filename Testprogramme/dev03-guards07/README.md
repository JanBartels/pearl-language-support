# Manuelle Prüfung: Include-Guard und CodeLens (Dev_0_3, Paket 07)

Öffne **diesen Ordner direkt** im Extension Development Host.
Die enthaltene `.vscode/settings.json` ordnet `*.h` dem Sprachmodus PEARL zu.

`Guard.P` bindet `HGuard.h` viermal ein. Alle vier `#include`-Direktiven
werden ausgeführt, aber nur beim ersten Include ist `_dev03_guard_h_`
noch undefiniert.

1. Öffne `HGuard.h` und kontrolliere die CodeLens mit vier Vorkommen.
2. Wähle den **ersten** Include-Kontext. Die Zeile
   `TYPE GuardedType FIXED;` darf **nicht abgedunkelt** sein.
   Der Hover über `GuardedType` sollte die Typdeklaration zeigen.
3. Wähle den **zweiten**, **dritten** oder **vierten** Kontext.
   Die Deklarationszeile muss **abgedunkelt** sein, da `#ifndef` nicht
   erfüllt ist. Aus dem jeweiligen Vorkommen stammt kein AST-Typknoten.
4. Wechsle wieder zum ersten Vorkommen. Die Abdunklung muss verschwinden.
5. Ändere den Header und prüfe, dass die Auswahl und das Verhalten
   nach der Neuanalyse konsistent bleiben.

**Achtung:** Das Präprozessor-Hover auf der `#ifndef`-Direktive selbst
ist bei mehrfachen Include-Vorkommen noch deaktiviert. Dieser Test prüft
die vorkommensbezogenen Inaktivitätsmarkierungen und den AST-Hover.
