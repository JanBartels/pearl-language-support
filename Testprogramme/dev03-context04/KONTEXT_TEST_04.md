# Dev_0_3: Open Folder - Mehrfach eingebundene Includes

Im Extension Development Host den Ordner `src/server/manualTests/dev03-context04` als Ordner öffnen.
Die `.vscode/settings.json` muss in genau diesem geöffneten Ordner liegen,
damit alle `.h`-Dateien den Sprachmodus PEARL erhalten.

1. `H42_Variables.h` öffnen, ohne ein `.P`-Modul als Tab öffnen zu müssen.
2. Oben im Editor erscheint eine CodeLens: `PEARL: Include-Kontext auswählen (2 Module)`.
   Falls sie nicht sofort erscheint, die Initialanalyse der beiden `.P`-Module abwarten
   bzw. den Editor einmal schließen und erneut öffnen.
3. Auf die CodeLens klicken und `40_Declaration.P` wählen.
   Hover über `Var` im Header und in der Zuweisung der zugehörigen `.P`-Datei soll den DCL-Kontext (Array 0:40) zeigen.
4. CodeLens erneut anklicken und `41_Specification.P` wählen.
   Hover über `Var` soll nun den SPC-Kontext (virtuelle Dimension) zeigen.  Der Hover in der jeweiligen `.P`-Datei bleibt unabhängig davon korrekt.
5. Zurück auf `H42_Variables.h` wechseln: auch Definition/Referenzen und
   semantische Tokens müssen diesem ausgewählten Kontext entsprechen.
6. In `H42_Variables.h` Count von 40 auf 50 ändern. Der gewählte Kontext soll
   bestehen bleiben; bei DCL wird aus 0:40 nun 0:50.
7. In `H12_SharedTypes.h` muss dieselbe CodeLens sichtbar sein; hier zwei
   unterschiedliche Einbindungskontexte auswählen und Hover auf SharedScalar testen.
8. `H32_Inner.h` ist nur einmal eingebunden: Hier erscheint keine Auswahl-
   CodeLens, der Hover funktioniert ohne manuelle Kontextwahl.

Falls keine CodeLens erscheint: Sprachmodus PEARL, Einstellung
`editor.codeLens` und PEARL-Output-Kanal prüfen.

Die Auswahl ist absichtlich pro Includedatei und nicht global pro Workspace.
Die Zuordnung der `.P`-Module erfolgt ausschließlich über tatsächlich aktive
`#include`-Expansionen aus dem Präprozessor.
