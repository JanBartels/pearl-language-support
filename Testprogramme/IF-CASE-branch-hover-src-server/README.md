# IF/CASE - Syntax- und Recovery-Tests

Jede Datei separat im LSP oeffnen. Die Semantik der Bedingungs- und Selektorausdruecke ist noch nicht implementiert.

| Datei | Erwarteter Befund | Strukturerhaltung |
| --- | --- | --- |
| 00_ValidNested.P | 0 Fehler | IF, CASE, ALT, OUT, REPEAT und abschliessender BEGIN |
| 01_MissingThen.P | Expected 'THEN' after IF condition | InThen und Survives bleiben im AST |
| 02_MissingIfFin.P | Expected 'FIN' after IF statement | Nachfolgende NextTask mit Survives bleibt erhalten |
| 03_MixedAlt.P | CASE must not mix positional and indexed ALT forms | Beide ALT-Zweige und Survives bleiben erhalten |
| 04_MissingCaseFin.P | Expected 'FIN' after CASE statement | Nachfolgende NextTask mit Survives bleibt erhalten |
| 05_RepeatedOut.P | OUT is repeated in CASE statement | Der erste OUT-Zweig und Survives bleiben erhalten; der zweite OUT-Zweig muss nicht im AST stehen |
| 06_MissingAlt.P | Expected at least one ALT in CASE statement | OUT-Zweig und Survives bleiben erhalten |
| 07_DirectDclInBranch.P | Declarations inside IF/CASE branches require BEGIN ... END. | InvalidHere darf nicht als Deklarationsknoten/Symbol uebernommen werden; ValidHere und Survives bleiben |
| 08_UnclosedAltList.P | Expected ')' after ALT case list. | Nachfolgende OUT-Struktur und Survives bleiben erhalten |
| 09_AltAfterOut.P | ALT must precede OUT in CASE statement. | Nachfolgender Survives-Block bleibt erhalten |

Diagnosetexte stammen aus dem aktuellen Parser-Quellstand. Nebenwirkungen bei Fehler-Recovery koennen weitere Meldungen erzeugen. Wichtig sind korrekte Fehlerstelle, kein Parser-Haenger und Erhaltung des nachfolgenden AST.

Insbesondere darf bei 02 und 04 ein inneres fehlendes FIN kein END der TASK konsumieren.
