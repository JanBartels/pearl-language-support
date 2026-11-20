# Dev_0_3 — Kontextauswahl einzelner Include-Vorkommen (Paket 06)

**Wichtig:** Den Ordner `dev03-occurrences06` selbst als Ordner im Extension
Development Host öffnen. Seine `.vscode/settings.json` weist `*.h` der Sprache
PEARL zu. `npm run build` vor dem Debug-Start nicht vergessen.

## Zwei Vorkommen, nur eine Hauptdatei

1. Öffne nur `HSharedVar.h`. In `RepeatedInOneUnit.P` ist der Header in
   `First` und `Second` eingebunden. Die CodeLens sollte zwei Zeilen
   aus **derselben** `.P`-Datei anbieten.
2. Wähle die Include-Zeile in `First` (oben in der Auswahlliste). Fahre im
   Header mit der Maus über `Var`. Der Hover sollte `FIXED` zeigen.
3. Wähle nun die Include-Zeile in `Second` und hovere erneut über `Var`.
   Hier sollte `FLOAT` erscheinen. Im Hauptmodul bleiben die beiden
   Prozeduren unabhängig voneinander.
4. Wechsle mehrfach zwischen den Optionen. Die Typdarstellung muss
   jeweils dem ausgewählten Vorkommen entsprechen.
5. Ändere den Header zunächst nur durch eine zusätzliche Leerzeile und
   kontrolliere die CodeLens. Die Auswahl muss erhalten bleiben, solange
   die `#include`-Zeilen in `RepeatedInOneUnit.P` unverändert sind.
6. Ändere die Reihenfolge oder Position einer `#include`-Direktive in der
   Hauptdatei. Die Auswahl kann dann ungültig werden; sie darf keinesfalls
   lautlos das andere Vorkommen auswählen.

## Technische Grenzen

Die Compiler-Semantik bleibt pro Übersetzungseinheit. Paket 06 ordnet Hover,
AST-basierte Navigation, semantische Tokens, Find References und Signature Help
nach Möglichkeit dem ausgewählten Vorkommen zu. Präprozessor-spezifische
Hover- und Navigationsanfragen werden bei mehrfachen Vorkommen zurzeit
vorsichtshalber nicht angeboten, wenn ihre Herkunft nicht eindeutig ist.

**Diagnosen sind in diesem Schritt weiterhin pro Übersetzungseinheit**
veröffentlicht. Mehrere Meldungen derselben Headerdatei aus unterschiedlichen
Vorkommen können daher zusammen sichtbar sein. Eine vorkommensbezogene
Diagnoseauswahl ist noch nicht implementiert.
