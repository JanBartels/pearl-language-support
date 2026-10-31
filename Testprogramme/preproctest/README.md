# PEARL - Regressionstests fuer den externen Praeprozessor

Die Dateien Test1.P bis Test13.P entsprechen den im Chat besprochenen Tests.
Die *.inc-Dateien muessen im selben Verzeichnis wie die zugehoerige *.P-Datei liegen.

| Test | Pruefpunkt | Erwartung |
| --- | --- | --- |
| 1 | Einfaches Makro | Feld 1:10, Hover/Definition auf Anzahl |
| 2 | Rekursive Expansion | Werte 0:20, Hover/Definition auf Grenze |
| 3 | Fehler im Makro | Diagnose zu Unbekannt an der Verwendung von Grenze (absichtlicher Fehler) |
| 4 | Generierter Kommentar | SPC Feld() FIXED GLOBAL; virtuelles Feld Rang 1 |
| 5 | Zwei Makros in Feldgrenzen | Feld 1:20 |
| 6 | Fehler im zweiten Makro | Diagnose an Obergrenze (absichtlicher Fehler) |
| 7 | Include mit Definition und Verwendung | Feld 0:30; Include-Datei separat keine Uebersetzungseinheit |
| 8 | Zwei Makros in Ausdruck | Wert initial 46 |
| 9 | Wiederholtes inneres Makro | Wert initial 20 |
| 10 | Fehler in verschachteltem Makro | Diagnose bei Ausdruck (absichtlicher Fehler) |
| 11 | Kommentar ueber getrennte Makroverwendungen und Zeilen | A/C deklariert, B auskommentiert; Verhalten des echten externen Praeprozessors NOCH NICHT bestaetigt |
| 12 | Makro im Hauptprogramm, Verwendung im Include | Feld 0:25 |
| 13 | Makrodefinition im Include, Verwendung im Hauptprogramm | Feld 0:50; Go to Definition in Test13.inc |

Hinweis: Bei Test3, Test6 und Test10 werden Diagnosen absichtlich provoziert.
Test11 ist ein experimenteller Grenzfall, den wir am echten Praeprozessor noch pruefen wollen.
