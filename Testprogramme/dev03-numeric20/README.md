# Dev_0_3 / 0.3.2: numerische Include-Dateinamen (Paket 20)

Dieses Verzeichnis als Workspace-Ordner in einem neuen Extension Development
Host öffnen. `Main.P` muss **ohne** Diagnose `Invalid number literal.`
analysiert werden. Die drei benannten Typen stammen aus:

- `12_SharedTypes.h` (direkt, in Anführungszeichen),
- `34_Inner.inc` (verschachtelt, in Anführungszeichen),
- `56_Additional.def` (direkt, ohne Anführungszeichen).

In `Main.P` sollten für `FirstType`, `SecondType` und `ThirdType`
die normalen Typdefinitionen auffindbar sein.

Gegenprobe: In einer PEARL-Deklaration ein fehlerhaftes Zahlenliteral wie
`12_BOGUS` eintragen. Dafür muss weiterhin `Invalid number literal.`
gemeldet werden; nur **Include-Pfadfragmente** erhalten die Sonderbehandlung.
