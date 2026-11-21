# Manueller Test: Hexzahlen in TextMate (0.3.2 / Paket 22)

Öffne `Highlight.P` in VS Code und verwende bei Bedarf `Developer: Inspect Editor Tokens and Scopes`.
Die Werte in EV(12345678), EV(12AB5678), im ersten BU-Argument sowie
S/SC, CODE, VAR, MB=$80 und AI=$3C00 sollen alle den Scope
`constant.numeric.hex.pearl` erhalten. Der Zugriffscode `8` in BU(...,8)
bleibt eine normale Integerzahl. Das Compilersteuerkommentar-Argument von
`/*+R=$5000 ... */` und `/*-R5000 ... */` erhält ebenfalls den Hex-Scope.

Die INIT-Zahl `12345678` bleibt `constant.numeric.integer.pearl`,
`'00AF'B4` bleibt `constant.numeric.bitstring.pearl`.

Die Datei dient der Farbprüfung; unimplementierte RTOS-UH-Konstrukte
können unabhängig davon Parserdiagnosen auslösen.
