# RTOS-UH-Referenztests fuer Roadmap 8.6.3 (READ/WRITE)

## Zweck

Einzelne, unabhaengige PEARL-Module zum Vergleich zwischen dem Originalcompiler
und dem TypeScript-Parser/LSP. Zunaechst alle Module **nur uebersetzen**.

Die angegebenen Erwartungen sind aus RTOS-UH 5.7.4 bis 5.7.6 und der
gegenwaertigen Implementierung abgeleitet. Sie sind **keine bereits am
Originalcompiler bestaetigten Messergebnisse**.

## Erwartungsmatrix

| Datei | Hypothese | Referenz |
|---|---|---|
| positiv/00_WRITE_EINFACH.pearl | akzeptiert | RTOS-UH 5.7.5: binaere Ausgabe, Mischtypen |
| positiv/01_READ_EINFACH.pearl | akzeptiert | RTOS-UH 5.7.5: binaere Eingabe |
| positiv/02_MISCHTYPEN_FELDER.pearl | akzeptiert | RTOS-UH 5.7.5: Arrays und verschiedene Typen; ALPHIC-DATION im Beispiel |
| positiv/03_S_WRITE.pearl | akzeptiert ab P90 15.9-M | RTOS-UH 5.7.6: S(FIXED(31)), pro Objekt |
| positiv/04_S_READ.pearl | akzeptiert ab P90 15.9-M | RTOS-UH 5.7.6: S(FIXED(31)), Empfang |
| positiv/05_S_ZAHLEN.pearl | akzeptiert ab P90 15.9-M | RTOS-UH 5.7.6: weniger/mehr S-Formate als Objekte |
| positiv/06_ALTE_AUFRUFE.pearl | akzeptiert | RTOS-UH 5.7.5: CALL ist optional |
| grenzfaelle/10_WRITE_AUSDRUECKE.pearl | **offen**: Abgleich der Ausdrucksgrammatik | LSP akzeptiert Ausdruecke; RTOS-UH nennt Variablenliste |
| grenzfaelle/11_FELDAUSSCHNITTE.pearl | **offen**: Abgleich der Segmentgrammatik | LSP unterstuetzt Segmente; Originalcompiler bestaetigen |
| negativ/20_S_FALSCHE_PRAEZISION.pearl | soll abgelehnt werden | RTOS-UH 5.7.6 verlangt FIXED(31) |
| negativ/21_S_KEINE_VARIABLE.pearl | soll abgelehnt werden | RTOS-UH 5.7.6 verlangt beschreibbare Variable |
| negativ/22_READ_INV.pearl | soll abgelehnt werden | READ benoetigt beschreibbares Ziel; Originalcompiler pruefen |
| negativ/23_FALSCHE_RICHTUNG.pearl | soll abgelehnt werden | Eingabe von OUT-DATION nicht zulaessig |
| negativ/24_BY_SKIP.pearl | **offen**: Positionierung laut RTOS-UH nicht fertig integriert | RTOS-UH 5.7.5/5.7.6; LSP weist SKIP bei READ zurueck |
| laufzeit/90_RW_RUNDLAUF.pearl | **nur optional, nach Pruefung** | RTOS-UH 5.7.4 REWIND, 5.7.5 WRITE/READ |

## Vorgehen

1. Jedes Programm als **separates Modul** uebersetzen. Beim alten P90-Compiler
   ggf. Dateinamen und Build-Kommando an die lokale Umgebung anpassen.
2. Erst 00..06 testen, dann Grenzfaelle 10/11 und Negativtests 20..24.
3. Je Datei `akzeptiert / abgelehnt`, Compiler-Version, Meldung und Zeile
   notieren; insbesondere *unerwartet akzeptierte* Negativtests dokumentieren.
4. Keine `SPC (READ,WRITE) ENTRY GLOBAL;` hinzufuegen! Das ist bei P90
   laut RTOS-UH 5.7.5 fuer die eingebauten Legacy-Aufrufe unzulaessig.
5. Ein Erfolg beim Uebersetzen sagt noch nichts ueber die Laufzeitsemantik aus.

## Sicherheit und Laufzeittest

**Nicht alle positiv/Programme ausfuehren.** `01`, `02`, `04` und `06` enthalten
READ auf beispielhafte Dateien ohne garantiert vorhandene Inhalte. `03` und
`05` verwenden `/NIL` als harmlose Datensenke, aber schreiben uninitialisierte
Daten; sie sind ausschliesslich fuer die Uebersetzung vorgesehen.

`laufzeit/90_RW_RUNDLAUF.pearl` ist **optional** und verwendet die Datei
`/ED/RW86TST`. Beim Ausfuehren kann diese Datei erzeugt oder ueberschrieben
werden. **Nur nach Kontrolle des Zielsystems ausfuehren und wenn dieser Name
sicher frei ist!** Bei Bedarf den Pfad eindeutig anpassen. `REWIND` setzt die
Dateiposition zurueck. Erwartete Konsolenausgabe bei gelungener Uebertragung:

    READ/WRITE OK

Ein abweichendes Ergebnis kann auch auf Dateisystem- oder OPEN-Verhalten
zurueckgehen. Das Programm testet nicht isoliert nur den Parser.

## Notizbogen

| Datei | Compiler-Version | akzeptiert? | Meldung / Zeile | Bemerkungen |
|---|---|---|---|---|
| 00 | | | | |
| 01 | | | | |
| 02 | | | | |
| 03 | | | | |
| 04 | | | | |
| 05 | | | | |
| 06 | | | | |
| 10 | | | | |
| 11 | | | | |
| 20 | | | | |
| 21 | | | | |
| 22 | | | | |
| 23 | | | | |
| 24 | | | | |
| 90 | | | | |

## Hinweise zum TypeScript-LSP

Alle Positivprogramme und beide Grenzfaelle wurden mit dem Quelltextstand
8.6.3 inkl. Builtin-Korrektur durch Lexer, Praeprozessor, Parser und Semantik
geprueft: **keine I/O-bezogenen Diagnosen**. Die Negativprogramme erzeugen
die beabsichtigten Diagnosen; `S(3)` wird bereits syntaktisch abgelehnt.

Die zwei allgemeinen Hinweise zu fehlenden `P=`- und `SC=`-Angaben sind
absichtlich nicht unterdrueckt. Solche Vorgaben haengen von Deinem konkreten
RTOS-UH-Zielsystem ab. Bitte bei Bedarf vor `MODULE` ergaenzen.

Diese Pruefung ersetzt **keinen** Vergleich mit dem Originalcompiler.
