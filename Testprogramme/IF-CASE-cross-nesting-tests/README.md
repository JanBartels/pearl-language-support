# IF/CASE - Kreuzverschachtelung und Recovery

Die Testdateien sind unabhaengige, absichtlich teilweise fehlerhafte PEARL-Module.
Sie sollen einzeln im LSP geoeffnet werden. Keine Datei wird automatisch
als RTOS-UH-Compiler-testbestaetigt bezeichnet.

## Kriterien

1. 00 muss ohne Diagnosen parsen, die geschachtelten AST-Knoten behalten und
   gueltiges Folding liefern.
2. 01-10 muessen mindestens den beabsichtigten Strukturfehler melden.
   Die exakte Zahl und Position von Folgefehlern sind nicht vorgegeben.
3. Es darf niemals einen LSP-Absturz oder `Invalid span` bei Folding geben.
4. Ein gueltiger, nachfolgender Block `Survives` soll moeglichst erhalten bleiben.
   Wenn das mit der gewaelten Recovery nicht moeglich ist, AST und Diagnose
   untersuchen statt das Programm stillschweigend fuer gueltig zu halten.
5. Wo `NextTask` vorhanden ist, muss sie eigenstaendig im AST erscheinen.
6. Bei Syntaxfehlern ist es legitim, dass ein vorhandenes FIN/END zunaechst
   dem innersten noch offenen Konstrukt zugeordnet wird. Der Parser soll nicht
   mittels Heuristik eine vermeintlich beabsichtigte Struktur erfinden.

## Dateiliste

| Datei | Absichtlicher Strukturfehler |
|---|---|
| 00_ValidNestedControl.P | Keiner; verschachtelte IF/CASE/BEGIN/REPEAT |
| 01_IfFinBeforeBlockEnd.P | IF-FIN vor BEGIN-END |
| 02_IfFinBeforeRepeatEnd.P | IF-FIN vor REPEAT-END |
| 03_CaseFinBeforeAltBlockEnd.P | CASE-FIN vor BEGIN-END in ALT |
| 04_CaseFinBeforeOutRepeatEnd.P | CASE-FIN vor REPEAT-END in OUT |
| 05_RepeatEndBeforeIfFin.P | REPEAT-END vor IF-FIN |
| 06_BlockEndBeforeCaseFin.P | BEGIN-END vor CASE-FIN |
| 07_AltBeforeNestedIfFin.P | Zweites ALT erscheint vor IF-FIN |
| 08_ElseBeforeNestedRepeatEnd.P | ELSE erscheint vor REPEAT-END |
| 09_IfElseAfterBlockEnd.P | ELSE/FIN nach vorzeitigem BEGIN-END |
| 10_CaseAltRepeatEndThenIfFin.P | END vor noch offenen IF-/CASE-FIN |

Insbesondere 07 und 10 pruefen auch, ob der Parser bei falsch platzierten
ALT/END die AST-Struktur und Folding-Bereiche konsistent haelt.
