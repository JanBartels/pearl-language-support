# RTOS-UH: Tests fuer den Compiler-Steuerkommentar /*+G*/

Die Option wird lexikalisch erkannt und vom `CompilerControlAnalyzer`
aufgrund der AST-Position und der semantischen PROC-Attribute geprueft.

Quelle: RTOS-UH-Handbuch, 5.4.6. Die Pflicht zum zusaetzlichen `GLOBAL`
ist dort ausdruecklich beschrieben. Die Platzierungsregel vor der ersten TASK
folgt aus der Modulkopf- und TASK-Speicherverkettung und der Suche des Laders
nach 17er-Scheiben; sie wird nicht als explizite Regel im Handbuch genannt.

| Datei | Erwartung |
|------|-----------|
| 00_ValidBeforeTask.P | Keine Diagnose; zwei +G-Prozeduren vor TASK |
| 01_InvalidAfterTask.P | Fehler bei /*+G*/: +G-PROC nach erster TASK |
| 02_OrdinaryProcAfterTask.P | Keine Diagnose: normale PROC nach TASK |
| 03_InvalidInParameterList.P | Warnung: +G nicht unmittelbar nach PROC |
| 04_InvalidInBody.P | Warnung: +G im Rumpf wird ignoriert |
| 05_ValidProcedureKeyword.P | Keine Diagnose bei PROCEDURE /*+G*/ GLOBAL |
| 06_GDoesNotImplyGlobal.P | **Ein Fehler**: +G-PROC ohne GLOBAL |
| 07a_FirstFileBeforeTask.P | Keine Diagnose (Datei 1, eigener MODULE) |
| 07b_SecondFileAfterTask.P | **Ein Fehler** (Datei 2, eigener MODULE) |
| 08_InvalidBeforeProc.P | Warnung: +G vor PROC |
| 09_ValidGroupedParameters.P | Keine Diagnose: gruppierte Parameter `((A, B) FIXED)` |
| 10_ValidManyBeforeTask.P | Keine Diagnose: nur +G-PROCs vor TASK eingeschraenkt |
| 11_InvalidAfterGlobal.P | Warnung: +G hinter GLOBAL |
| 12_ValidSeparateParameterGroups.P | Keine Diagnose: `A FIXED, B FIXED` |
| 13_AfterTaskAndWithoutGlobal.P | **Zwei Fehler** am Kommentar: GLOBAL fehlt und nach TASK |

Die 07er-Dateien getrennt oeffnen/uebersetzen. Mehrere MODULE in **einer**
Uebersetzungseinheit werden hier bewusst nicht als gueltig angenommen;
dieses Verhalten ist noch am RTOS-UH-Compiler zu klaeren.

Bitte neben der Zahl der Diagnosen auch Hover auf /*+G*/ kontrollieren.
