# 7a - Einbaufunktionskatalog / polymorphe Signaturen

Die Implementierung basiert auf dem bereitgestellten `SHELL-PROC-hover-command`-Stand und der RTOS-UH-Beschreibung 5.7.

## Architektur

- `semantic/builtins/builtinCatalog.ts`: kuratierter Katalog mit 43 implizit bekannten Einbauobjekten.
- `semantic/builtins/builtinSignature.ts`: deklaratives Patternmodell fuer Parametertypen/Variablen und Ergebnisabhaengigkeiten.
- `semantic/semanticAnalyzer.ts`: CALL-Ziel zuerst per `resolveSymbol` aufloesen; nur bei fehlendem Benutzersymbol im Builtin-Katalog nachschlagen. Prozeduraritaet ohne Ausdruckstyppruefung.
- `semantic/semanticContext.ts`: `builtinBindings` separat von `bindings`, damit keine fiktiven `SourceValue`-Deklarationen entstehen.
- `documentation/problem/statements/callStatementDocumentationProvider.ts`: Einbau-Signatur bei explizitem CALL anzeigen.

## Sprachgrenzen

- `SIN` etc.: `FLOAT(23)` und `FLOAT(55)`; Resultat uebernimmt Argumenttyp (5.7.1).
- `LEN`, `BEG`, `MID`, `INSTR`, `KON`, `INSER`, `CMPW`: bei PEARL90 ohne SPC, aber laut Handbuch nicht in jeder Installation verfuegbar (5.7.17); im Katalog als optional markiert. CHAR-Parameter haben variable Laengen. Fuer `CMPW` bleibt der genaue Ergebnistyp bewusst offen.
- `NOW`: wertliefernd, kein `CALL` (5.7.7).
- `REFADD`, Grafik-, Datenstationsfunktionen: compilerbekannte CALL-Sonderformen (5.7.3-5.7.5, 5.7.9).
- `DATE`, `ASSIGN`, `RANF`, `DRANF`, `GET_TASKNAME` etc.: laut Handbuch mit SPC zu spezifizieren; nicht als implizit eingebaut eingetragen.

## Bewusst noch offen

- Kein allgemeiner Ausdrucksparser: SIN/LEN-Ausdruecke erhalten in 7a noch keine AST-Bindung.
- Keine Typpruefung aus CALL-Aktualparametern; nur die Anzahl kann derzeit verlustfrei bestimmt werden.
- Nachfolgende `CALL READ`/`CALL WRITE` brauchen eigene Behandlung im StatementParser, weil READ/WRITE dort bereits eigenstaendige Anweisungen sind.
- Eine Benutzerdeklaration mit gleichem Namen verdeckt den Eintrag im Katalog; eine Warnung fuer unbeabsichtigte Verdeckung kann spaeter auf der Symbol-/Verwendungsanalyse aufbauen.
- Optionale Funktionsverfuegbarkeit und FPU-Praezision sind im Katalog als Metadaten vorhanden, werden aber noch nicht aus Modul-Modes oder der Laufzeitkonfiguration diagnostiziert.
- NamedType-/Aliasaufloesung und genaue IDENT-Ausdruckspruefung erfolgen spaeter vor dem Pattern-Matching.
