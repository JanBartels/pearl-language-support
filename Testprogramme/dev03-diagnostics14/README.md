# Dev_0_3 – Paket 14: Projektweite Diagnosen in Includes

Dieses Verzeichnis als **Ordner** im Extension Development Host öffnen. Die
lokalen `.vscode/settings.json` ordnen `.h` dem PEARL-LSP zu.

1. Nur den Ordner öffnen. `HShared.h` **nicht öffnen** und keine CodeLens
   auswählen. In **Probleme** muss der doppelte Bezeichner `Sample` in
   `HShared.h` erscheinen. Er stammt aus `MainA.P`.
2. `HShared.h` öffnen. Die CodeLens auf `MainB.P` stellen. Dort ist
   `WITH_ERROR` nicht definiert; der `DCL Sample FLOAT`-Zweig ist aktiv.
   Der projektweite Fehler aus `MainA.P` muss dennoch in **Probleme**
   sichtbar bleiben und seinen Ursprung im Text nennen. Das ist bei einem
   einzelnen LSP-Diagnosekanal pro Datei auch im Editor sichtbar.
3. CodeLens auf `MainA.P` umstellen. Der Fehlereintrag darf nicht doppelt
   erscheinen. Der jeweils inaktive `#ifdef`-Zweig wird nur für den gewählten
   Kontext abgedunkelt.
4. In `MainA.P` `#define WITH_ERROR` entfernen oder auskommentieren.
   Der Fehler aus `MainA.P` muss nach der Neuanalyse aus **Probleme**
   verschwinden, ohne dass `MainB.P` geöffnet oder bearbeitet wird.
5. `#define WITH_ERROR` wiederherstellen. Der Fehler erscheint erneut.

Einschränkung: LSP `publishDiagnostics` hat nur **eine** Meldungsliste je
physischer URI. Paket 14 bewahrt projektweite **Fehler** nach einer
Include-Auswahl. Warnungen/Hinweise anderer Kontexte werden nach der Auswahl
nicht parallel in einer zweiten, unabhängigen Probleme-Ansicht angezeigt.
