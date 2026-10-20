# Recoverytests fuer BEGIN/END und REPEAT/END

Jede `.P`-Datei separat im LSP laden. Nur `00_ValidCombined.P` ist als gueltiger
Strukturtest vorgesehen. Die anderen Dateien haben genau einen absichtlichen
Syntax-/Strukturfehler.

| Datei | Absicht | Entscheidende Pruefung |
| --- | --- | --- |
| 00_ValidCombined.P | Kombinierter FOR/WHILE-Kopf | Keine Diagnosen, Repetition + Block + folgender Block im AST |
| 01_MissingEndSemicolon.P | `;` hinter Block-END fehlt | Syntaxdiagnose; folgender `BEGIN` bleibt eigenstaendiger AST-Knoten |
| 02_MissingRepeat.P | `FOR`-Kopf ohne `REPEAT` | Diagnose; folgender `BEGIN` wird geparst |
| 03_MissingInnerEnd.P | `END` einer inneren Wiederholung fehlt | Diagnose erwartet, moeglicherweise erst am TASK-Ende. END-Zuordnung ist ohne Zusatzinformation mehrdeutig. |
| 04_ExtraEnd.P | Zusaetzliches `END` nach TASK | Diagnose auf PROBLEM-Ebene, kein haengender Parser |
| 05_MissingDclSemicolon.P | `;` vor verschachteltem BEGIN fehlt | Diagnose; verschachtelter BEGIN bleibt erhalten |
| 06_LateDeclaration.P | DCL nach REPEAT-Anweisung | Diagnose; folgende BEGIN-Struktur bleibt erhalten |

Die erwarteten Formulierungen und Anzahl der Meldungen sind nicht festgelegt;
es geht um Struktur-Erhalt, Position und Beendigung der Analyse.
