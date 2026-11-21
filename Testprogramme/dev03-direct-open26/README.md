# Regressionstest 1: Direktes Öffnen bekannter Includedateien (Paket 26)

## A. Ein eindeutiger externer Include-Kontext

1. Extension Development Host neu starten, NUR `dev03-external18/Project`
   als VS-Code-Workspace öffnen. `Main.P` geschlossen lassen.
2. Nach abgeschlossener Open-Folder-Analyse die Datei
   `../Library/H0/nested/types.def` per `Strg+O` DIREKT öffnen.
3. Unten rechts MUSS **PEARL** stehen, ohne manuelle Sprachzuordnung.
4. Es darf keine Standalone-Analyse von `types.def` erfolgen. Hover auf
   `LibraryType` soll den aus `Main.P` bekannten Kontext verwenden.
5. Datei schließen, Extension Development Host neu starten und die Datei
   bereits während des Analyse-Starts öffnen: Auch dann muss der Sprachmodus
   nach Ankunft der Abhängigkeitsinformationen PEARL werden.

## B. Zwei Kontexte derselben externen Datei

1. NUR `dev03-navigation16/Project` öffnen; `MainA.P` und `MainB.P` geschlossen.
2. `../Library/H0/nested/var.def` DIREKT per `Strg+O` öffnen.
3. Sprachmodus muss PEARL sein. Keine automatische Auswahl zwischen
   `MainA.P` (FIXED) und `MainB.P` (FLOAT).
4. Die CodeLens muss beide Kontexte anbieten. Jeden explizit auswählen und
   den jeweiligen Hover prüfen.
5. Eine reine Peek-Vorschau darf keine Kontextauswahl aktivieren.

## C. Nicht eingebundene Datei

1. Im Bibliotheksordner eine neue Datei `unrelated.def` anlegen und direkt
   öffnen. Ohne eigene `files.associations` darf der Client ihr NICHT allein
   aufgrund der Endung PEARL zuweisen.
2. Eine zwischenzeitlich fehlende `#include`-Zieldatei darf vor ihrer
   Wiederherstellung ebenfalls nicht als gültiger Include-Kontext behandelt
   werden. Nach Wiederanlegen und erfolgreicher Analyse wird sie erkannt.

Die obigen Verzeichnisse stammen aus den vorhandenen Paketen 16 und 18.
Es werden keine zusätzlichen Programmdateien benötigt.
