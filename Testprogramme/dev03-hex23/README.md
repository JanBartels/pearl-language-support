# Manuelle Regression: Hexzahlen mit A-F am Anfang (0.3.2 / Paket 23)

Oeffne diesen Ordner in VS Code und anschliessend `Main.P`.

- Fuer `Port1: BU(FF0F0006,8) <->;` darf **keine** Diagnose
  `Expected hexadecimal number.` entstehen (RTOS-UH 6.2, Beispiel 3).
- `Port2: BU(0240FFFC) <-;` bleibt fehlerfrei.
- `EventHex: EV(ABCDEF12);` und `EventNumeric: EV(12345678);`
  muessen beide vom Parser akzeptiert werden.
- `DCL FACE FIXED;` bleibt eine normale Bezeichner-Deklaration,
  auch wenn der Name ausschliesslich aus Hexziffern besteht.

Gegenprobe: Aendere `FF0F0006` auf `FG0F0006`; dann wird die
Hexadresse vom Parser zu Recht abgewiesen.

Die Syntaxhervorhebung aus Paket 22 wird hier nicht veraendert.
