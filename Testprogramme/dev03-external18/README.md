# Dev_0_3 / 0.3.1 – Externe Include-Abhängigkeiten (Paket 18)

## Vorbereitung

Im Extension Development Host **nur den Ordner `Project`** öffnen.
`Library` liegt absichtlich außerhalb des Workspace. Die beiden Includedateien
haben bewusst ungewöhnliche Endungen `.inc` und `.def`.
`InclDir` wird ausschließlich in `Project/.vscode/settings.json` gesetzt.

Der Compiler soll `Main.P` ohne Fehler analysieren, auch wenn `Main.P` nie
als Editor-Tab geöffnet wird. Die Testdatei in `Library` für diesen Test
**nicht im Editor öffnen**. Sonst könnte ein `didChange` statt des neuen
Dateisystem-Watchers die Neuanalyse auslösen.

## Test A: Externe Änderung

Im Terminal die Datei `Library/H0/nested/types.def` so ändern, dass aus

    TYPE LibraryType FIXED;

zunächst

    TYPE LibraryType UngueltigerTyp;

wird. Im VS-Code-Fenster **Probleme** müssen daraufhin die erwarteten
Compilerfehler erscheinen, ohne irgendeinen Editor-Tab zu öffnen oder zu
ändern. Datei wieder auf `FIXED` setzen: Fehler müssen verschwinden.

## Test B: Externes Include löschen und wieder anlegen

Den Inhalt von `Library/H0/nested/types.def` vorübergehend sichern, die
Datei löschen. Der Präprozessor soll nun `#include: file ... not found`
in `lib1.inc` melden. Die Datei an derselben Stelle neu anlegen: Die
Fehlermeldung muss automatisch wieder verschwinden.

Das ist ein eigener Regressionstest: Auch ein **fehlgeschlagener** Include-
Versuch muss als Watch-Abhängigkeit erhalten bleiben.

## Test C: Änderung des Include-Graphen

`Library/H0/lib1.inc` auf einen anderen bestehenden Dateinamen umstellen
und prüfen, ob die entsprechende Analyse aktualisiert wird. Änderungen
an einer nicht mehr eingebundenen Datei dürfen danach keinen neuen
Analyselauf auslösen. Die neue Datei muss hingegen beobachtet werden.

## Hinweise

- Die neue Überwachung nutzt nur bekannte Include-Pfade; kein rekursives
  Scannen des gesamten Bibliotheksbaums.
- Dateiendungen sind nicht Bestandteil der Include-Erkennung.
- Extern geöffnete Dateien mit Sprachmodus PEARL werden weiterhin bereits
  über `textDocument/didChange` verarbeitet.
- Der Test setzt voraus, dass der Extension Development Host den aktuellen
  Client **und** den aktuellen Server geladen hat (`npm run build`, F5).
