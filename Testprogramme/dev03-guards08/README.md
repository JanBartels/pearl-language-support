# Dev_0_3 Paket 08: Praeprozessor-Hover und Folding im Include

Oeffne diesen Ordner direkt im Extension Development Host. Die Datei
`.vscode/settings.json` ordnet `*.h` dem Sprachmodus PEARL zu.

`Guard.P` bindet `HGuard.h` viermal ein. Beim ersten Mal ist `_dev03_guard_h_`
undefiniert, bei den folgenden Einbindungen ist es definiert.

1. Oeffne `HGuard.h` und waehle die **erste** Einbindung in der CodeLens.
2. Hover ueber `#ifndef`: **Bedingung erfuellt.** Die Zeile
   `TYPE GuardedType FIXED;` ist nicht abgedunkelt.
3. Klappe den Block zwischen `#ifndef` und `#endif` mit den
   Folding-Pfeilen am Zeilenrand ein und wieder aus.
4. Waehle die **zweite** Einbindung in der CodeLens. Hover ueber
   `#ifndef`: **Bedingung nicht erfuellt.** Die Typzeile ist abgedunkelt.
   Auch hier muss die `#ifndef`-Region faltbar sein.
5. Wiederhole den Hover im dritten und vierten Kontext und wechsle
   zurueck auf den ersten. Beim ersten Kontext muss der Hover wieder
   **Bedingung erfuellt.** melden.

Hinweis: Folding ist eine LSP-Anfrage auf Abruf. Falls VS Code nach der
CodeLens-Auswahl vorhandene Folding-Marker zwischenspeichert, schliesse
`HGuard.h` kurz und oeffne die Datei erneut. Die Regionen dieses konkreten
Guards sind in allen Vorkommen gleich; die Auswertung im Hover nicht.
