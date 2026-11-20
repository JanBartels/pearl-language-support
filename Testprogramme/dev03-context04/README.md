# Dev_0_3: Manuelle LSP-Tests fuer Analyse-Lebensdauer

## Installation

Dieses Paket enthaelt **nur Testdaten**, keine Aenderungen am LSP-Code.
Alle Pfade im Archiv sind relativ zu `src/server`.

    tar -xzf Dev_0_3_Manuelle_Tests_02.tar.gz -C src/server

Dann die Extension wie gewohnt mit F5 im Extension Development Host starten.
Oeffne die P-Dateien der einzelnen Tests als Tabs. Die `.h`-Dateien
sind Fragmente und keine eigenstaendigen PEARL-Module.

Hinweis: `Open Folder` als automatische Projekt-/Kontexterkennung wird erst
in einem spaeteren Schritt implementiert. Das Oeffnen des Ordners allein
ist also noch kein Test der zukuenftigen Workspace-Unterstuetzung.

## Test 1: Unabhaengige Dateien (01_UnitA.P, 02_UnitB.P)

1. Beide Module als Tabs oeffnen; anfangs keine Syntaxfehler erwartet.
2. In `01_UnitA.P` `FIXED` zu `UnbekannterTyp` aendern (nicht speichern noetig).
3. Ein Fehler muss nur zu `01_UnitA.P` erscheinen.
4. Mehrfach A <-> B wechseln: Fehler in A darf nicht verschwinden,
   B darf nicht den Analysekontext von A uebernehmen.
5. `FIXED` wiederherstellen: Fehler in A verschwindet.
6. Optional denselben Vorgang mit B wiederholen.

## Test 2: Eine Include-Datei, zwei Eltern

Dateien: `10_IncludeParentA.P`, `11_IncludeParentB.P`, `H12_SharedTypes.h`.

1. Zuerst BEIDE P-Dateien oeffnen und auf abgeschlossene Analyse warten.
2. Nun `H12_SharedTypes.h` oeffnen.
3. Im Header `SharedScalar` zu `RenamedScalar` aendern.
4. BEIDE Eltern muessen wegen des unbekannten Typs `SharedScalar` neu
   diagnostiziert werden, auch wenn sie selbst nicht bearbeitet wurden.
5. Aenderung rueckgaengig machen: Beide Fehler muessen verschwinden.

Die direkte semantische Analyse einer gemeinsam verwendeten Headerdatei
ist noch nicht Teil dieses Schrittes: es gibt noch keine Auswahl eines
aktiven Include-Kontexts. Darum vor allem die DIAGNOSTIK DER ELTERN pruefen.

## Test 3: Bedingter Include-Zweig

Dateien: `20_Conditional.P`, `H21_FixedTypes.h`, `H22_FloatTypes.h`.

1. `20_Conditional.P` oeffnen: `USE_FIXED` ist definiert, der Fixed-Zweig
   ist aktiv. Die Float-Datei ist nicht Teil dieser Analyse.
2. In `H21_FixedTypes.h` `SelectedScalar` zu `BrokenScalar` aendern:
   im Parent muss der unbekannte Typ `SelectedScalar` gemeldet werden.
3. Header wiederherstellen.
4. In `20_Conditional.P` die Zeile `#define USE_FIXED` entfernen
   (oder auskommentieren): nun ist der Float-Zweig aktiv.
5. In `H22_FloatTypes.h` `SelectedScalar` zu `BrokenScalar` aendern:
   jetzt muss der Fehler im Parent erscheinen. Aenderung rueckgaengig machen.
6. Der Fixed-Header darf im Float-Zweig keine Abhaengigkeit des Parents
   mehr darstellen. Falls Du ihn separat oeffnest, beachte, dass eine
   eigenstaendige Fragmentanalyse noch nicht sinnvoll sein muss.
7. `#define USE_FIXED` in `20_Conditional.P` wiederherstellen.

## Test 4: Verschachtelte Include-Abhaengigkeit

Dateien: `30_Nested.P`, `H31_Outer.h`, `H32_Inner.h`.

1. Zuerst `30_Nested.P` oeffnen.
2. `H32_Inner.h` oeffnen und `NestedScalar` zu `BrokenScalar` aendern.
3. Ohne Aenderung an `30_Nested.P` muss dort ein Fehler wegen des
   nicht mehr existierenden Typs `NestedScalar` erscheinen.
4. Aenderung rueckgaengig machen; Fehler verschwindet.

## Test 5: Ein Header, zwei verschiedene Makrokontexte

Dateien: `40_Declaration.P`, `41_Specification.P`, `H42_Variables.h`.

1. Beide P-Dateien oeffnen; jeweils einzeln im Editor beurteilen.
2. Die Deklarations-Unit expandiert `VAR` zu `DCL` und `Boundary` zu `0:40`.
3. Die Spezifikations-Unit expandiert `VAR` zu `SPC` und kommentiert
   die Feldgrenzen per Makro aus. Beide sollten grammatisch verarbeitbar sein.
4. Editiere `H42_Variables.h`, z. B. `FIXED` zu `FLOAT` und zurueck.
   Beide Eltern werden neu analysiert, ohne im jeweiligen Eltern-Modul zu tippen.
5. Hover/Go-to-Definition direkt im mehrfach eingebundenen Header ist
   *noch kein Bestehens-Kriterium*: die Kontextauswahl fehlt noch.

## Worauf achten?

- Uebernommene Fehler in *anderen* Modulen duerfen nicht verschwinden.
- Die betroffenen Eltern muessen auf ungespeicherte Include-Aenderungen
  reagieren. Ein explizites Save ist nicht erforderlich.
- Rueckgaengigmachen muss die erzeugten Fehler wieder entfernen.
- Ohne Aenderung soll wiederholtes Wechseln der Tabs keine neuen
  Parserfehler oder fremde Hover-/Syntaxinformationen erzeugen.
- Eventuelle Warnungen zu unbenutzten Symbolen sind von den gezielt
  erzeugten Fehlern zu unterscheiden.
- Falls eine `.h`-Datei im Editor als C erkannt wird: den Sprachmodus
  fuer diese Datei auf PEARL stellen, sofern die direkte LSP-Ansicht
  der Headerdatei getestet wird.

Bitte bei Abweichungen angeben: Testnummer, bearbeitete Datei, genaues
Edit, erwartetes und beobachtetes Verhalten sowie ggf. LSP-Protokoll.

## Korrektur zum ersten Testpaket

Die Dateinamen der Include-Dateien wurden von einem Ziffernpraefix auf
einen Buchstabenpraefix (`H12_...` statt `12_...`) umgestellt. Der
PEARL-Lexer interpretiert eine Folge wie `12_SharedTypes` in einer
Include-Direktive sonst als ungueltiges numerisches Literal.

Falls das alte Testpaket bereits ausgepackt wurde, verbleiben die sechs
alten `12_...`, `21_...`, `22_...`, `31_...`, `32_...` und `42_...`
Headerdateien nach dem Entpacken. Diese werden von den korrigierten
Modulen nicht mehr eingebunden und koennen geloescht werden.
