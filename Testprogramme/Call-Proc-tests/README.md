# CALL / SPC PROC/ENTRY / REF PROC: Integrationstests

Diese Programme einzeln im aktuellen LSP testen. Die Programme sind unabhängig;
mehrere MODULE in einer Übersetzungseinheit werden nicht vorausgesetzt.

| Datei | Erwartung |
|---|---|
| 00 | 0 Diagnosen; SPC ENTRY und CALL mit zwei Argumenten |
| 01 | 0 Diagnosen; SPC mit optionalem `:` vor PROC |
| 02 | 0 Diagnosen; REF PROC INIT an passende PROC; CALL über Zeiger |
| 03 | 1 Semantikfehler: INIT-Signatur passt nicht (FLOAT/FIXED) |
| 04 | 1 Semantikfehler: falsche Parameteranzahl; BEGIN erhalten |
| 05 | 1 Semantikfehler: Datenobjekt ist nicht aufrufbar; BEGIN erhalten |
| 06 | 1 Semantikfehler: SPC ENTRY benötigt GLOBAL |
| 07 | Parserdiagnose: fehlender Parametertyp; Runner/Survives erhalten |
| 08 | Parserdiagnose: fehlendes `)` in CALL; BEGIN erhalten |
| 09 | 0 Diagnosen; zwei Aktualparameter trotz innerer Kommas |
| 10 | 0 Diagnosen; externe REF-PROC-Spezifikation und CALL |
| 11 | 0 Diagnosen; RTOS-UH ENTRY_C als eigene Aufrufkonvention |
| 12 | 0 Diagnosen; zwei CALLs innerhalb IF/THEN/ELSE/FIN |
| 13 | 0 Diagnosen; Namensliste mit zwei ENTRY-Spezifikationen |
| 14 | 1 Semantikfehler: REF PROC erwartet PEARL-, nicht C-Aufrufkonvention |
| 15 | 1 Parserfehler: fehlendes Semikolon nach CALL; BEGIN erhalten |
| 16 | 0 Diagnosen; CALL in ALT, BEGIN und OUT |

## Absichtlich noch nicht geprüft

- Typen der Aktualparameter (Ausdrucksparser fehlt)
- `IDENT`-Lvalue-Prüfung (Ausdrucksparser fehlt)
- Unmarkierte Aufrufe `Name(...)` (mit Assignment/Array-Zugriff mehrdeutig)
- Prozedurzuweisungen `Pointer := Procedure` (Assignment-Parser fehlt)
- Funktionsaufrufe innerhalb von Ausdrücken und deren Ergebnistypen
- Unbekannte Prozedurnamen ohne SPC (z.B. RTOS-Einbaufunktionen)
