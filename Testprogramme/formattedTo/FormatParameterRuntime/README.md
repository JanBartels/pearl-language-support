# RTOS-UH: Formatparameter-Laufzeittests (2 Programme)

## Durchfuehrung

Nur diese beiden vollstaendigen PEARL-Programme uebersetzen und ausfuehren:

1. `01_STANDARD.P`: 39 Faelle unter normaler CLOCK-Aufloesung (F, E, A, B,
   B3, B4, X, T, D, dynamische Breiten und CONVERT-Eingabe).
2. `02_CLOCK50.P`: zwei gezielte Vergleichsfaelle mit `MODE=CLOCK50;`
   (`T(16,5)` und `D(30,5)`).

Beide Programme verwenden vor `MODULE` **`MODE=NOLSTOP;`** und innerhalb
von `TASK MAIN` **`/*+M*/;`**. So erzeugt der RTOS-UH-Compiler Zeilenmarker,
ohne Zeilenstop-Traps einzubauen. Die Laufzeitfehlermeldung nennt damit die
letzte durchlaufene PEARL-Quellzeile; `Ergebnisse.csv` enthaelt die
Zeilennummer jeder CONVERT-Anweisung.

Alle Testfaelle werden nacheinander ausgefuehrt. Die Programme verwenden
nur `/TY` als Ausgabeziel und keine Dateien. Eine Fehlerprobe soll die
nachfolgenden Proben nicht verhindern: Laut RTOS-UH-Handbuch Abschnitt 5.12
laufen die verursachenden Tasks bei den meisten Laufzeitfehlern weiter.
Ausnahmen, die zur Terminierung oder Suspendierung fuehren, sind im Handbuch
jeweils gesondert vermerkt. Unbekannte Nullformat-Grenzfaelle dennoch nur
in einer Testumgebung ausfuehren.

## Ausgabe und Erfassung

Jede Probe schreibt vor der Konvertierung ihre eindeutige Kennung, etwa
`21_F_ZU_KURZ`. Nach der Konvertierung erscheinen
`OUT=[...] RST=...` bzw. bei Eingabe `WERT=... RST=...`.
Erst danach beginnt die naechste Probe. Auch bei Fehlern werden dadurch
Laufzeitmeldung, CONVERT-Zeilennummer, sichtbares Ergebnis und `RST`-Wert
eindeutig einem Fall zugeordnet. Ein unerwarteter Taskabbruch waere am
fehlenden `ENDE ...` und an der letzten Kennung erkennbar.

`Fehler` wird vor **jedem** Fall auf -999 gesetzt. Ein unveraenderter Wert
ist nicht automatisch ein Beleg fuer erfolgreichen Ablauf, sondern zeigt
zunaechst nur, dass kein anderer Wert beobachtet wurde.

`Puffer` wird vor jedem Ausgabeversuch mit Punkten vorbelegt. Ausgegeben
werden seine ersten 40 Zeichen, damit auch abgeschnittene oder gar nicht
geschriebene Ergebnisse sichtbar bleiben. Die `OUT`-Zeilen nutzen nur
bekannt unkritische Ausgabeformate.

`Ergebnisse.csv` ist die einfache Messliste mit allen 41 Einzelfaellen und
**bereits eingetragenen Zeilennummern**. Eintragen: sichtbare Ausgabe,
RST-Wert und RTOS-Laufzeitmeldung.

## Quellen und Fragestellung

- RTOS-UH 5.5.6-5.5.9: F/E/A/B/T/D sowie RST und Steuerformate.
- RTOS-UH 5.12: INPUT-SYNTAX, IOFM, OBIN, XIOV und weitere Laufzeitmeldungen.
- RTOS-UH 5.3.1: `MODE=NOLSTOP;`.
- RTOS-UH 5.4.3: `/*+M*/;` (Zeilennummern markieren).

Zu klaeren sind insbesondere Nullbreiten, zu kleine Felder (Sternchen oder
Fehler?), unplausible Nachkommastellen und Unterschiede mit CLOCK50.
Die generierten Ausgaben sind Messwerte, keine vorab gesicherten Ergebnisse.
Der Compiler prueft Breiten nach Deiner Originalcompiler-Beobachtung nicht
bei der Uebersetzung. Deshalb fuer die LSP-Semantik aus den Ergebnissen
nur gesicherte Regeln ableiten; die Formatablauf- und Typzuordnung bleibt
Roadmap 8.6.4.2 vorbehalten.
