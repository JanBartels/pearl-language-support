# Dev_0_3 Paket 21: Hover auf dem geprueften Makronamen

Oeffne diesen Ordner im VS-Code Extension Development Host.
Die .vscode/settings.json aktiviert PEARL fuer die Includedatei.

1. Oeffne `HConditional.h` und waehle in der CodeLens die erste Einbindung
   aus `Main.P` (vor `#undef MODE`).
2. Hover ueber `#ifdef` UND ueber den Makronamen `MODE` dahinter:
   Beide Positionen muessen `Bedingung erfuellt.` anzeigen.
3. Hover ueber `#ifndef` UND ueber `MODE` dahinter:
   Beide Positionen muessen `Bedingung nicht erfuellt.` anzeigen.
4. Waehle die zweite Einbindung (nach `#undef MODE`).
   Fuer `#ifdef` und `MODE` gilt jetzt `Bedingung nicht erfuellt.`,
   fuer `#ifndef` und `MODE` dagegen `Bedingung erfuellt.`
5. Hover ueber den Leerraum zwischen Direktive und Makroname darf nicht
   die Bedingungsinformation ausloesen.

Die Informationen werden aus den bereits erfassten Bedingungsbloecken
und dem ausgewaehlten Include-Vorkommen bezogen, ohne erneute Auswertung.
