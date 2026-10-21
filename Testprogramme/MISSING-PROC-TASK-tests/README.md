# RTOS-UH: MISSING PROC/TASK (lokale SPC-Vorabspezifikation)

Die Dateien sind LSP-Regressionstests, keine mit RTOS-UH verifizierten
Compiler-Tests. Pro Datei eine Übersetzungseinheit.

Eine lokale SPC ohne GLOBAL ist als Vorabspezifikation modelliert,
deren Definition bis MODEND folgen muss. SPC GLOBAL ist extern.

**Achtung:** Die bisherige 7a-Integrationstestdatei `06_MissingSpcGlobal.P`
beruht auf der Annahme, dass `SPC ... ENTRY` stets GLOBAL benötigt.
Diese Annahme ist mit der hier zitierten RTOS-UH-Meldung zu überprüfen;
der neue Semantikstand diagnostiziert stattdessen eine fehlende lokale PROC.

- `00_LocalTaskDefined.P`: 0 diagnostics; SPC Later bound to TASK Later
- `01_LocalTaskMissing.P`: 1 missing local TASK at SPC Later
- `02_LocalProcDefined.P`: 0 diagnostics; CALL binds to later PROC definition
- `03_LocalProcMissing.P`: 1 missing local PROC at SPC Later
- `04_LocalProcSignatureMismatch.P`: 1 mismatch diagnostic on PROC definition
- `05_ExternalProcWithoutDefinition.P`: 0 diagnostics; external GLOBAL SPC requires no local definition
- `06_ExternalTaskWithoutDefinition.P`: 0 diagnostics; external GLOBAL SPC requires no local definition
- `07_LocalProcTypeConflict.P`: 1 or more diagnostics for missing PROC/other kind, but no false binding
- `08_LocalProcAfterDefinition.P`: duplicate declaration: specification appears after definition
- `09_LocalProcGrouped.P`: 0 diagnostics for two linked forward definitions
- `10_ExternalEntryWithoutGlobal.P`: missing local PROC (not automatically external)


Diese Tests sollten ohne Commit zunächst im LSP überprüft werden.
- `11_LocalProcSyntax.P`: prueft die lokale Schreibweise mit `PROC` statt `ENTRY`; erwartet 0 Diagnosen.
- `12_LocalProcResults.P`: prueft die Abweichung des Ergebnistyps; erwartet Signaturdiagnose.
