# RTOS-UH: Feld-E/A und Feld-Ausschnitte

Die vier Programme sollen **einzeln uebersetzt**, aber vorerst **nicht
zur Laufzeit ausgefuehrt** werden. Es wird nur die Sprachakzeptanz geprueft.
Die SYSTEM-Datenstationen zeigen aus Sicherheitsgruenden auf `/NIL`.

## Belegstellen

1. RTOS-UH-Handbuch, Kapitel 5.1, Tabelle 5.2, gedruckte Seite 285:
   ARRAYS: `Keine Total-E/A`, `Keine Slices`.
2. RTOS-UH-Handbuch, Kapitel 5.7.5 READ/WRITE, gedruckte Seiten 338-339:
   ARRAY-Objekte werden beim binaeren READ/WRITE komplett uebertragen;
   Beispiel `WRITE FELD,ARR,R TO FLOPPY;` / `READ FELD,ARR,R FROM FLOPPY;`.
3. PEARL-Sprachreport 1995, Kapitel 10.5, Seite 10-21 und Anhang A.3.4.4,
   Seite A-18: GET/PUT mit Feldern und Slices sind in der Sprachdefinition
   vorgesehen. Fuer RTOS-UH hat aber dessen Handbuch Vorrang.
4. Sprachreport Kapitel 10.6, Seite 10-33: CONVERT mit Ausdrucks-/Namenliste;
   kein ausdruecklicher Beleg fuer komplette ARRAY-Objekte bei CONVERT.

## Versuchsuebersicht

| Datei | Zweck | Erwartung laut Handbuch |
|---|---|---|
| 00_ELEMENTE_UND_BINARY_TOTAL.P | GET/PUT mit Feldelementen, binaeres READ/WRITE ganzer Felder | Uebersetzbar |
| 01_GET_PUT_TOTAL.P | Formatiertes GET/PUT ganzer 1D-/2D-Felder | Nicht unterstuetzt |
| 02_GET_PUT_SLICES.P | GET/PUT von 1D- und 2D-Ausschnitten | Nicht unterstuetzt |
| 03_CONVERT_TOTAL.P | CONVERT mit ganzem Feld in beiden Richtungen | Explorativ; keine zugesicherte RTOS-Unterstuetzung |

Die Programme mit vermutlich unzulaessigen Operationen enthalten jeweils
mehrere **unabhaengige** Anweisungen. Falls der Originalcompiler nach dem
ersten Fehler abbricht, bitte die jeweils bereits geprueften Zeilen auskommentieren
und die restlichen Anweisungen erneut pruefen.

Bitte bei Rueckmeldung angeben: Compiler-Version, akzeptiert/abgelehnt,
beanstandete Zeilen und exakte Fehlermeldungen.

**Wichtig fuer den LSP:** Der derzeitige `FormattedIoFormatCompatibility`-Analysator
expandiert vollständige Array-Objekte und Slices fuer GET/PUT zu Datenelementen.
Das ist bislang nur eine Implementierungsannahme aus dem Sprachreport,
kein Bestaetigungstest gegen RTOS-UH. Nach der Referenzpruefung entscheiden
wir ueber die entsprechende semantische Einschraenkung.
