# RTOS-UH: TAKE/SEND - Compilerreferenztests fuer Roadmap 8.6.7

## Verwendung

Die neun `.P`-Dateien sind unabhaengige Module. Sie sollen **nur uebersetzt**
werden, NICHT geladen, aktiviert oder ausgefuehrt werden.

**ACHTUNG: Direkte Speicher-/Peripheriezugriffe.** Die BU-Systemdefinitionen
verwenden Beispieladressen nach dem Schema aus dem RTOS-UH-Handbuch.
Auf dem Zielsystem muessen diese Adressen nicht existieren; sie koennten auch
auf System- oder Anwenderspeicher zeigen. TAKE/SEND ueber BU kann echte
Hardware ansprechen und sogar Speicher ueberschreiben. Die Tasks haben
bewusst *kein MAIN* und werden nirgendwo aktiviert. Das ist dennoch kein
Ersatz fuer die Regel: **Programme niemals ausfuehren!**

## Empfohlene Reihenfolge

1. `00_GRUNDFORMEN_UND_TYPEN.P`: Basissyntax und einfache Datentypen.
2. `01_PROBE_BY_RST.P`, `02_PROBE_BY_S.P`, `03_PROBE_BY_CONTROL.P`:
   Optionen einzeln untersuchen. Der PEARL-Sprachreport fuehrt sie auf,
   aber das RTOS-UH-Handbuch zeigt in Kapitel 6 vor allem Anweisungen ohne BY.
3. `04_PROBE_OHNE_DATUM.P`: ist der optionale Datenoperand wirklich implementiert?
4. `05_NEGATIV_ALPHIC.P` bis `08_PROBE_MEHRERE_OBJEKTE.P`:
   moegliche Negativdiagnosen pruefen.

Bei Dateien mit zwei verdächtigen Anweisungen: Wenn der Compiler nach dem
ersten Fehler abbricht, bitte die erste Anweisung voruebergehend auskommentieren,
um auch die zweite zu pruefen.

## Quellen und Abgrenzung

- RTOS-UH-Handbuch, Abschnitt 6.2 (gedruckte Seiten 394-396): BU-
  Systemdefinition, BASIC-Klasse, Zugriffsarten, TAKE/SEND-Beispiele.
- RTOS-UH-Handbuch, Abschnitt 6.3 (Seiten 397-400): Eigene BASIC-DATIONs.
- PEARL90-Sprachreport, Abschnitt 10.7 (Seite 10-34):
  `TAKE [Name] FROM Dation [BY ...]` / `SEND [Ausdruck] TO Dation [BY ...]`,
  RST, S und CONTROL als moegliche Optionen.

Der Sprachreport ist *nicht* der Nachweis, dass RTOS-UH alle Optionen
implementiert. Genau dazu dienen die PROBE-Programme.

Alle Dateien enthalten eine nicht-automatisch-aktivierte TASK und beziehen
sich auf BU-Hardwareadressen. Die Adressen sind Platzhalter fuer eine
Uebersetzungspruefung, keine Vorschlaege fuer den realen Einsatz.

## Rueckmeldung

Trage fuer jede Datei das Uebersetzungsergebnis und die Meldungen in
`Ergebnisse.csv` ein. Bei Fehlern bitte nach Moeglichkeit die betroffene
Anweisungszeile und die woertliche Compilermeldung notieren.

Wenn der Compiler bereits die BU-Systemdefinition ablehnt, ist das ein
plattform-/Zugriffscode-Problem und noch kein Beleg fuer TAKE/SEND-Syntax.
Bitte dann zunaechst nur die Systemdefinition mit einer auf Deinem Zielsystem
unterstuetzten BU-Kodierung ersetzen.
