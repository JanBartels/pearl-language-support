# RTOS-UH / LSP: weitere PROC-Korrekturen (22.10.2026)

Die Testdateien stehen einzeln fuer sich. Die meisten sind LSP-Tests; mit
`DeclarationAfterProcedureOrTask` ist eine **semantische** LSP-Diagnose gemeint.
Es werden **keine Laufzeittests** und **keine +G-Tests** verlangt.

| Test | Erwartung |
| --- | --- |
| 00_GlobalSpcProcDefined.P | ohne Fehler; Peek Definition von SPC zu PROC und Peek Declaration zurueck |
| 01_GlobalSpcProcMismatch.P | genau ein SignatureMismatch; Relation trotzdem in beiden Richtungen |
| 02_GlobalSpcExternalOnly.P | ohne Fehler; keine lokale SPC/Definition-Relation |
| 03_GlobalSpcTaskDefined.P | ohne Fehler; SPC/TASK-Navigation (Compilerabgleich noch offen) |
| 04_DclAfterTask.P | eine DeclarationAfterProcedureOrTask-Diagnose bei DCL |
| 05_DclAfterProc.P | eine DeclarationAfterProcedureOrTask-Diagnose bei DCL |
| 06_DclBeforeDefinitions.P | ohne Fehler |
| 07_DclInsideTask.P | ohne Reihenfolge-Diagnose, da TASK-lokale DCL |
| 08_ShadowedBuiltinDcl.P | InvalidCallTarget; Builtin REFADD darf nicht als Fallback erscheinen |
| 09_ShadowedBuiltinSpc.P | ohne Fehler; nutzereigene SPC ueberschreibt Builtin-Signatur |
| 10_BuiltinFallback.P | ohne Fehler; REFADD wird als Builtin aufgeloest |
| 11_UserNamedNow.P | ohne Fehler; NOW ist kein reservierter Objektbezeichner |
| 12_TwoLateDcls.P | zwei eigene DeclarationAfterProcedureOrTask-Diagnosen |
| 13_EmptyProblemStatements.P | ohne Parserfehler; leere Semikolons im PROBLEM-Teil |
| 14_TwoModules.P | genau eine MultipleModulesInTranslationUnit-Diagnose am zweiten MODULE |

## Quellen und Status

- Test 00 ist der bereits mit dem realen RTOS-UH-Compiler positiv gepruefte C08-Fall.
- Die Builtin-Faelle entsprechen dem realen Compilerbefund und dem vorhandenen
  Fallback-Prinzip: normaler Symbol-Lookup vor Builtin-Katalog.
- Die Diagnosen fuer modulglobale DCL nach PROC/TASK beruhen auf den
  Compilerbeobachtungen mit realen Programmen.
- Test 03 (SPC TASK GLOBAL + lokale TASK GLOBAL) wird zunaechst analog
  implementiert, ist **noch nicht einzeln mit dem realen Compiler bestaetigt**.
- Test 07 prueft, dass DCL in einem TASK-Scope nicht versehentlich als
  modulglobale DCL behandelt wird.
- Fuer Test 01 muss der Link SPC <-> PROC **trotz** Signaturfehler erhalten
  bleiben, inklusive der vorhandenen Related Location.

Keine Dateien dieses Pakets gehoeren nach `src/server`.
