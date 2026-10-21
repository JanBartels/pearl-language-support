# Einbaufunktions-Infrastruktur 7a - RTOS-UH-Integrationstests

Die Programme sind unabhaengig. Einzeln im LSP oeffnen.

| Test | Erwartung |
| --- | --- |
| 00 | Keine Diagnose; CALL REFADD bindet die Einbauprozedur. |
| 01 | Genau eine Diagnose: REFADD braucht 2 Parameter. |
| 02 | Keine Diagnose; LINE mit 5 Parametern. |
| 03 | Genau eine Diagnose: LINE braucht 5 Parameter. |
| 04 | Genau eine Diagnose: REFADD ist nach DCL kein aufrufbares Objekt. |
| 05 | Keine Diagnose: die SPC-ENTRY verdeckt die gleichnamige Einbaufunktion. |
| 06 | Genau eine Diagnose: NOW ist ein wertlieferndes Objekt, keine CALL-Prozedur. |
| 07 | Keine Diagnose; SEEK mit 2 Parametern. Der Name Station wird derzeit nicht ausgewertet. |

Bei CALL werden in 7a bewusst nur Aufrufziel und Anzahl geprueft, keine Ausdruckstypen.
Die eigentliche Verwendung von SIN, LEN usw. in Ausdruecken wird erst nach
Einfuehrung der Ausdrucks-/Verwendungsanalyse erkannt; dies ist kein LSP-Fehler.

Die alte CALL-READ/CALL-WRITE-Schreibweise steht im Katalog, bedarf aber
noch einer gesonderten Behandlung im StatementParser (READ/WRITE sind dort
bereits eigene Anweisungsanfaenge). Bitte jetzt noch nicht als integriert werten.

Quellen: RTOS-UH-Handbuch 5.7.1-5.7.17. Strings 5.7.17 sind optional
verfuegbare Bibliotheksroutinen ohne SPC fuer PEARL90 (anders als PEARL80).
DATE, ASSIGN, RANF, DRANF etc. sind spezifikationspflichtige ENTRYs und
werden deshalb nicht als implizite Einbaufunktionen registriert.
