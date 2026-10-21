# RTOS-UH Shellprozeduren (Abschnitt 3.3)

Alle Programme einzeln im LSP öffnen. Erwartete Semantikdiagnosen:

| Test | Erwartung |
|---|---|
| 00 | Keine Diagnose, XHELP erkannt; Headername verweist auf PROC |
| 01 | Fehlende PROC-Definition |
| 02 | Ungültige Shellsignatur (Rückgabetyp) |
| 03 | Ungültige Shellsignatur (Textlänge) |
| 04 | Ungültige Shellsignatur (IDENT fehlt) |
| 05 | Keine Diagnose: individuelle DATION-Richtungen |
| 06 | Doppelte Prozedurbekanntgabe |
| 07 | Doppelter Shellbefehlsname |
| 08 | Keine Diagnose: gewöhnliches MODULE / PROC |
| 09 | XHELP-PROC nicht im SHELLMODULE-Kopf bekanntgegeben |
| 10 | Keine Diagnose: Shell-PROC benötigt kein GLOBAL |
| 11 | Ungültige Shellsignatur: explizites FIXED(31) statt FIXED |

Wichtig: Die ABI wird *nicht* im SHELLMODULE-Kopf ausgeschrieben.
Die fünf Formalparameter mit BIT(1)-Ergebnis stammen aus der Shellschnittstelle.
Nicht angemeldete Prozeduren ohne XHELP können derzeit nicht als Shellprozedere erkannt werden;
diese Absicht ist aus dem Quelltext allein nicht rekonstruierbar.
