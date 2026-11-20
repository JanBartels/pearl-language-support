# Dev_0_3: Folding-Refresh bei Include-Kontextwechsel

Dieser Test verwendet absichtlich die bereits vorhandenen Dateien
`Testprogramme/TEST.P` und `Testprogramme/testinc.h`. Es werden keine
Testprogramme überschrieben.

1. `npm run build` im Projektverzeichnis, Extension Development Host neu starten.
2. Im Host `Testprogramme` als Ordner öffnen. Den Header `testinc.h` auf
   Sprachmodus PEARL stellen, falls noch nicht zugeordnet.
3. Im PEARL-Debug-Ausgabekanal nach `[FoldingRefresh] client refreshSupport=true`
   beziehungsweise `false` suchen.
4. In `testinc.h` über die CodeLens eine Einbindung wählen, dann auf eine
   andere Einbindung wechseln. Bei `true` sollte der Client nun eine neue
   `textDocument/foldingRange`-Anfrage auslösen, sichtbar als
   `[FoldingRefresh] folding ...: N ranges`.
5. Datei schließen, erneut öffnen, Kontext wählen, Folding prüfen.

Wenn `refreshSupport=false` gemeldet wird, unterstützt der verbundene
LSP-Client diesen globalen Refresh nicht. Dann sendet der Server mit Absicht
keine nicht unterstützte Anfrage. Eine Lösung erfordert in diesem Fall eine
Aktualisierung des VS-Code-Clients beziehungsweise seiner LSP-Bibliothek
und ggf. eine clientseitige Fallback-Strategie.

Dieser Patch ersetzt die temporäre Trace-Version aus Paket 09 und entfernt
deren ausführliche Hover-Traces. Die begrenzten Folding-Debugmeldungen bleiben
vorerst erhalten.
