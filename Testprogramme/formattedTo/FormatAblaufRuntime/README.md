# Formatablauf 8.6.4.2: Runtime-Referenztest

Ein einziges ausfuehrbares PEARL-Programm: `01_FORMAT_ABLAUF.P`.

## Durchfuehrung

- Quellcode unter `Testprogramme/formattedTo/FormatAblaufRuntime/` im Repository ablegen.
- Auf dem RTOS-UH-Testsystem uebersetzen und ausfuehren.
- `MODE=NOLSTOP;` steht vor `MODULE`, `/*+M*/;` aktiviert Compiler-Zeilenmarker.
- Die Ausgabe geht ausschliesslich nach `/TY`, es werden keine Dateien geschrieben.
- Jede Probe hat eine Kennung und setzt `Fehler` und `Puffer` zurueck. Der Wert -999
  bedeutet, dass die RST-Variable seit dem Zuruecksetzen unveraendert blieb;
  er ist **nicht automatisch ein Fehlercode**.
- Vor der CONVERT-Anweisung wird die Kennung ausgegeben; danach folgen `OUT=[...]`
  und `RST=...`. `Ergebnisse.csv` enthaelt die CONVERT-Zeilennummern.
- Die Faelle mit falschen Typzuordnungen sind **beabsichtigte** Laufzeitfehlertests.
  Die statische LSP-Diagnose ist in diesen Faellen gerade das Pruefziel.
- `06_OHNE_BY` prueft die Default-Konvertierung ohne Formatliste. Hier kann kein
  `RST` angegeben werden; der gedruckte Sentinel -999 ist nur eine Kontrollmarke.

## Besonders wichtig: 14_3X_OPTIONAL

`CONVERT Zahl,Kurz,Bits TO Puffer BY (3)X;` verarbeitet **kein einziges Datenobjekt**.
Falls die Laufzeitverwaltung immer wieder implizit an den Formatlistenanfang
springt, waere eine Endlosschleife moeglich. Der Fall ist deshalb in
`IF NurX THEN ... FIN;` untergebracht und standardmaessig deaktiviert (`NurX = '0'B1`).
Bitte erst alle anderen Faelle auswerten. Nur falls gewuenscht und in einer
isolierten Testumgebung `NurX = '1'B1` setzen, mit Abbruchmoeglichkeit.

## B4(4) mit BIT(32) ist **kein** gesicherter Erwartungswert

Der PEARL-90-Sprachreport, Abschnitt 10.5.4, beschreibt linkbuendige Ausgabe
und Abschneiden von rechts. Damit waere `1234` eine plausible Ausgabe.
RTOS-UH, Abschnitt 5.5.7, beschreibt hingegen rechtsbuendige Ausgabe und
Auffuellen mit Nullen von links. Ob die Laufzeit bei zu kleiner Breite
`1234`, `5678`, einen Fehler oder etwas anderes produziert, ist daraus nicht
abschliessend ableitbar. Bitte die Ausgabe von `07` und `08` mit den
Referenzen `09_B4_REFERENZ_32` und `10_B4_REFERENZ_16` vergleichen.

`X` ohne Argument wird hier als normaler Steuerformat-Eintrag verwendet.
Die sichtbare Menge an Leerzeichen und eventuelle Zeilenwechsel durch `SKIP`
sind ebenfalls Messwerte, keine fest zugesicherten Ergebnisse.

## Quellen

- RTOS-UH-Handbuch 5.5.6: Formatliste steuert den Ablauf; Ruecksprung an die
  letzte Blockwiederholklammer oder den Anfang.
- RTOS-UH-Handbuch 5.5.7: F, T, B/B3/B4, LIST und Feldausrichtung.
- RTOS-UH-Handbuch 5.5.8-5.5.9: Wiederholung, `R(...)`, `X`, `SKIP`, `RST`.
- RTOS-UH-Handbuch 5.12: Laufzeitfehler; Tabelle 5.7 bei `ST` fuer Statuscodes.
- PEARL-90-Sprachreport 10.5.4: Abweichende Beschreibung der B-Ausgabe.

Falls der Originalcompiler ein Programm wegen einer absichtlich inkompatiblen
Format-/Datentyp-Kombination schon beim Uebersetzen ablehnt, bitte die genaue
Zeile und Fehlermeldung notieren. Laut bisherigen Referenztests praeferiert
RTOS-UH hier aber Laufzeitdiagnosen.
