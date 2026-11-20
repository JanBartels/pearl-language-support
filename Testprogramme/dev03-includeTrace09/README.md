# Dev_0_3: gezielte Diagnose von Hover und Folding in Includes

Dies ist eine **temporäre Diagnosefassung**, noch keine Korrektur. Sie ersetzt `server.ts`
und ergänzt lediglich `[IncludeTrace]`-Protokolle für `.h`-Dateien.

1. `npm run build` ausführen und den Extension Development Host **neu starten**.
2. In Deinem bestehenden Ordner `Testprogramme` `testinc.h` im Sprachmodus PEARL öffnen.
3. In der CodeLens die erste Einbindung unter `TEST.P` auswählen.
4. Über die Zeichen `#ifndef` (nicht den Makronamen) hovern.
5. Das Headerdokument einmal schließen und neu öffnen, damit VS Code Folding-Ranges neu anfordert.
6. Im PEARL-Ausgabekanal alle Zeilen mit `[IncludeTrace]` kopieren.

Die Zeilen unterscheiden drei Fälle: Es kommt gar keine LSP-Anfrage an, es
fehlt ein Analysekontext, oder ein vorhandener Kontext enthält keinen Treffer.
Für Folding wird auch die Anzahl der zurückgegebenen Faltungsbereiche gezeigt.

Wenn der Test abgeschlossen ist, kann `server.ts` wieder durch die Fassung aus
Änderungspaket 08 ersetzt werden. Bitte diese Diagnosefassung nicht committen.
