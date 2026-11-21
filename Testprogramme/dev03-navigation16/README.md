# Dev_0_3 – Navigation zu externen Includedateien (Paket 16)

Den Ordner `Project` (nicht das übergeordnete Testverzeichnis) im
Extension Development Host mit **Datei → Ordner öffnen** öffnen.
`Library` liegt absichtlich **außerhalb** dieses Ordners. Die Include-Dateien
haben absichtlich andere Endungen als `.h`.

1. In `MainA.P` auf `NavType` bei `DCL FromA NavType` **Go to Definition**.
   Erwartung: `../Library/H0/nested/var.def` öffnet sich, der Client
   setzt dafür gezielt den Sprachmodus `PEARL`, und der Hover über
   `NavType` zeigt einen `FIXED`-Typ. Die CodeLens darf den gewählten
   Kontext anzeigen, ohne dass ein manuelles Auswählen nötig ist.
2. Zurück in `MainB.P`: von `NavType` aus wieder Go to Definition.
   Erwartung: dieselbe physische `var.def`, diesmal aber `FLOAT`.
3. `var.def` schließen und über den Explorer direkt öffnen (bei Bedarf
   Sprachmodus manuell auf PEARL setzen). Ohne vorherige Navigation darf
   bei Mehrdeutigkeit keine willkürliche neue Auswahl entstehen. Beachte:
   bewusst gespeicherte Kontextwahlen bleiben wie bisher erhalten.
4. **Peek Definition**: Diese erste Stufe garantiert noch keine eigene,
   vom normalen Editor unabhängige Kontextwahl im Peek-Editor. Ein Peek
   darf nicht allein eine neue Auswahl erzwingen.

Die Makros sind absichtlich projektlokal gesetzt; in echten Projekten kann
`InclDir` wie bisher aus den Benutzereinstellungen kommen. Weder die
Client-Erweiterung noch der Server verlangen dafür eine bestimmte Endung.

Wenn `Go to Definition` nicht direkt zum Header führt, bitte die LSP-
Debug-Ausgabe prüfen und beim Test zuerst sicherstellen, dass `MainA.P`
und `MainB.P` ohne Include-Fehler analysiert werden.
