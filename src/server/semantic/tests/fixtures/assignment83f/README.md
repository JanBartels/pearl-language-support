# Roadmap 8.3f - Vergleich mit dem RTOS-UH-Compiler

Diese Dateien dienen zum **unabhängigen Gegencheck am echten RTOS-UH-Compiler**.
Sie wurden mit Lexer, Parser und Semantik des LSP geprüft, **nicht** aber mit dem
RTOS-UH-Compiler ausgeführt. Entsprechend sind die Compiler-Erwartungen noch
nicht abschließend bestätigt.

- `valid.P`: Erwartet werden keine Zuweisungsdiagnosen. Enthält Strukturkopien,
  Feldelemente, BIT-/CHAR-Selektoren, REF-Werte, CONT und die Unterscheidung
  zwischen INV REF und REF INV. Ergebnis des LSP: 0 Syntax-, 0 Semantikfehler.
- `invalid_types.P`: Absichtlich falsche Strukturtypen, ganze Feldzuweisung,
  konstante Indizes, zu lange BIT-Werte, inkompatible CHAR-Werte, REF-, CONT-
  und NIL-Zuweisungen. Ergebnis des LSP: 0 Syntax-, 9 Semantikfehler.
- `invalid_protection.P`: Absichtlich unzulässige Änderungen an INV-Objekten,
  INV-REF-Zeigern und REF-INV-Zielen. Ergebnis des LSP: 0 Syntax-,
  5 Semantikfehler.

Beim Vergleich sollten für jeden Fall drei Dinge betrachtet werden:
(1) akzeptiert oder verwirft RTOS-UH die Anweisung, (2) wo liegt die Diagnose,
(3) erzeugt der LSP unerwünschte Folgediagnosen?

**Nur Compilerprüfungen, keine Laufzeittests.** Die absichtlich fehlerhaften
Programme dürfen nicht ausgeführt werden. Falls der Compiler nach einem Fehler
abbricht, die übrigen fehlerhaften Zuweisungen zeitweise auskommentieren.

Bei Abweichungen gilt das tatsächliche RTOS-UH-Verhalten vor dem allgemeinen
PEARL90-Sprachreport. Abweichungen gesondert untersuchen und als Regressionen
festhalten; nicht ohne Prüfung bestehende Semantikregeln lockern.
