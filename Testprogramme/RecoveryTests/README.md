# PROC-Abschluss-Review: unvollstaendige Typen in Signaturen

Die drei LSP-Testprogramme enthalten bewusst unbekannte Typnamen.
Erwartet wird jeweils die primaere Semantikdiagnose fuer den unbekannten Typ,
aber **keine zusaetzliche SPC/PROC-Signaturkonfliktdiagnose**. Der Parser
soll beide Deklarationen weiterhin im AST behalten und Peek Navigation
SPC <-> PROC soll funktionieren.

* 00: Unbekannter Typ in SPC-Parameter.
* 01: Unbekannter Typ in PROC-Formalparameter.
* 02: Unbekannter Ergebnistyp in SPC-RETURNS.

Das ist eine Recovery-Pruefung, kein RTOS-UH-Compilerkonformitaetstest.
Die bestehende Typgleichheitsfunktion wurde so korrigiert, dass ein nicht
aufgeloester Typ niemals einem konkreten Typ gleich ist. Die getrennte
Signaturkonflikt-Pruefung unterdrueckt Sekundaerdiagnosen bei unvollstaendigen
Signaturen.
