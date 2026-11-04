# RTOS-UH Compilerproben – Roadmap 8.5

Die Programme sind separat kompilierbar und dienen nicht zur Ausführung auf echter Hardware.
Die RTOS-UH-Compilerbeobachtungen haben Vorrang vor allgemeineren Reportregeln.

| Programm | RTOS-UH | LSP-Soll |
|---|---|---|
| `TaskingConfirmedAliases.P` | akzeptiert: `PRIORITY`, `EVERY`, `WHEN ... RESUME` und `INV FIXED`-Priorität | keine Fehler |
| `TaskingMutablePriority.P` | Fehler bei `PRIO MutablePriority` | `semantic.invalid-task-priority` |
| `TaskingContinuePriority.P` | Syntaxfehler bei `CONTINUE ... PRIO` | genau ein Parserfehler, Folgeanweisung bleibt erhalten |
| `VirtualArrayReference.P` | `RF = AF` ist laut Compiler zulässig; Übergabeformen sind zur zusätzlichen Compilerprobe vorgesehen | keine Fehler |
| `VirtualArrayReferenceInvalid.P` | Negativprobe für falschen Feldrang und Elementtyp | zwei `semantic.invalid-assignment-value-type` |
| `TaskingNegativeDurationLsp.P` | Compiler akzeptiert negative Zeiten | drei bewusste LSP-Semantikfehler `semantic.negative-tasking-duration` |

**Noch mit dem RTOS-UH-Compiler zu prüfen:** Die Verallgemeinerung von `REF () FIXED`
auf Übergabeparameter (insbesondere `IDENT`) und mehrdimensionale virtuelle Referenzen
ist aus der zentralen REF-Kompatibilitätsregel abgeleitet, aber bisher nicht durch eine
separate RTOS-UH-Compilerprobe bestätigt.

## Testbefehle ab dem Repository-Root

```sh
npx tsx --test \
  src/server/semantic/tests/virtualArrayReferenceCompatibility.test.ts \
  src/server/semantic/tests/taskingAndVirtualReferencePrograms.test.ts \
  src/server/semantic/tests/taskingStatementSemantics.test.ts \
  src/server/parser/problem/statements/tests/taskingStatementParser.test.ts \
  src/server/documentation/tests/taskingLspIntegration.test.ts \
  src/server/semantic/tests/referenceActualParameters.test.ts \
  src/server/semantic/tests/refTargetInvariant.test.ts \
  > test-85-tasking-ref.log 2>&1

find src/server -name '*.test.ts' -print0 | \
  xargs -0 npx tsx --test > test-all-85-ref.log 2>&1

npx tsc --noEmit > build-85-ref.log 2>&1
```
