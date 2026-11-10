# RTOS-UH-Compilertests: TAKE/SEND und zusammengesetzte Datenobjekte

**Ziel:** Die verbliebenen offenen Grenzen von Roadmap 8.6.7 auf dem
Originalcompiler (PowerPC-RTOS-PEARL90 16.7-M) abgleichen.

## Sicherheit: NUR UEBERSETZEN, NICHT AUSFUEHREN

Die Programme verwenden beispielhafte `/BU`-Adressen (`0240FFFC`,
`0240FFF8`, `0240FFF4`). TAKE und SEND koennen unmittelbar auf
Peripherie- oder Speicheradressen zugreifen. **Kein LOAD, kein START und
keine sonstige Ausfuehrung dieser Programme!** Die TASK heisst `Probe`
und traegt absichtlich kein `MAIN`; dies ist keine Sicherheitsgarantie,
sondern lediglich eine zusaetzliche Vorsichtsmassnahme.

## Uebersetzung

Die zwei Dateien sind eigenstaendige MODULE mit verschiedenen Namen:

1. `01_GANZE_FELDER_STRUKTUREN.P` - elementare Positivkontrollen sowie
   komplette 1D/2D-Felder, STRUCTs, Felder von STRUCTs, STRUCTs als
   Feldelement, Feldkomponenten einer STRUCT und gemischte Datenlisten.
   Die Testgruppen sind `K01` bis `K12`.
2. `02_AUSSCHNITTE_UND_GRENZEN.P` - Elementkontrollen und vier Arten
   von Feld-Ausschnitten (jeweils TAKE und SEND). Die Testgruppen sind
   `S00` bis `S05`. `S05` prueft die Fehler-Recovery nach den Slices.

**Bitte beide Programme einzeln uebersetzen**, und die Compiler-Meldungen
mit PEARL-Zeilennummern zurueckgeben. Ein erfolgreiches Uebersetzen muss
nicht bedeuten, dass ein Datentransfer zur Laufzeit sinnvoll waere.

## Erwartung und Abgrenzung

- `K01`: durch die bereits ausgefuehrten TAKE/SEND-Tests belegt (einfache
  Datenobjekte und mehrere Datenobjekte pro Anweisung).
- `K02`, `K03`, `S00`, `S05`: Positivkontrollen mit einzelnen Feldelementen
  und Strukturkomponenten; die vollstaendige RTOS-UH-Akzeptanz der
  Strukturkomponenten ist noch zu ueberpruefen.
- `K04` bis `K12`: **explorativ**. Der aktuelle LSP lehnt ganze Felder
  und STRUCT-Objekte ab. Das Handbuch, Abschnitt 6.2, nennt fuer `/BU`
  einfache Datentypen; es belegt keinen zusammengesetzten Datentransfer.
- `S01` bis `S04`: **explorativ**. Feld-Slices werden von unserem Parser
  abgelehnt und sind laut RTOS-UH-Implementierungsuebersicht generell
  nicht implementiert (Kapitel 5.1, Tabelle 5.2).

Drei verschiedene Compiler-Reaktionen sind zu unterscheiden:

1. `0 ERRORS` = die gepruefte Konstruktion wird akzeptiert.
2. `Syntax violation` = die Schreibweise ist bereits grammatisch unzulaessig.
3. `Data- or object-types do not match` oder andere Typdiagnose = die
   Schreibweise wird erkannt, aber semantisch abgelehnt.

Ein frueher Fehler darf nicht auf die spaeteren Anweisungen uebertragen
werden: Entscheidend sind die einzelnen Zeilen und die konkrete Meldung.

Alle Feld- und Strukturdeklarationen stehen vor der TASK und besitzen
**keine INIT-Liste**. Damit wird die zuvor gefundene RTOS-UH-Sonderregel
fuer lokale Feldinitialisierung bewusst aus diesen Compilertests
herausgehalten.

## Ergebnisse

`Ergebnisse.csv` enthaelt pro TAKE/SEND-Anweisung die Testgruppe und
Quelltextzeile sowie leere Spalten fuer Compilerergebnis und Meldung.
Es genuegt, die Compiler-Listings/Screenshots oder die ausgefuellte
Tabelle zu schicken.

## Quellen

- RTOS-UH-Handbuch, Kapitel 6.2, Seiten 394-396 (BASIC-DATION `/BU`,
  TAKE/SEND, zugelassene einfache Datentypen).
- RTOS-UH-Handbuch, Kapitel 5.1, Seite 285, Tabelle 5.2
  (keine ARRAY-Slices, keine Total-E/A im allgemeinen I/O).
- PEARL90-Sprachreport, Abschnitt 10.7 (TAKE/SEND mit optionalem
  Datenobjekt). In Zweifelsfaellen hat RTOS-UH Vorrang.
