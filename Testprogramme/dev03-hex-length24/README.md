# Dev_0_3 / 0.3.2: RTOS-UH-Hexlängen

`Main.P` als PEARL-Datei öffnen oder den gesamten Ordner als Workspace laden.
Zu Beginn darf keine Fehlermeldung zur Länge der Hexzahlen auftreten.

## Positive Prüfungen

- `EV(F)` und `EV(FFFFFFFF)` sind gültig (1 bis 8 Hexziffern).
- `AI=$3C` ist gültig (2 Hexziffern, ohne Timeout-Byte).
- `MB=$80,AI=$3C00` sind gültig (MB genau 2; AI auch 4 Hexziffern).

## Negative Prüfungen – einzeln abändern und wieder zurücksetzen

1. `EV(F)` in `EV(FFFFFFFFF)` ändern: Diagnose `event mask must consist of 1 to 8 hexadecimal digits.`
2. `AI=$3C` in `AI=$3C0` ändern: Diagnose `AI requires 2 or 4 hexadecimal digits.`
3. `MB=$80` in `MB=$800` ändern: Diagnose `MB requires exactly 2 hexadecimal digits.`
4. Danach Werte korrigieren: Alle drei Längendiagnosen müssen verschwinden.

Wichtig: Lexer und TextMate-Syntaxhervorhebung werden für diese Korrektur nicht verändert.
