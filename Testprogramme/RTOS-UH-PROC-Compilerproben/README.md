# Nachtrag zu den RTOS-UH-PROC-Compilerproben

Dieser Nachtrag ergaenzt die bestehende Sammlung A-D um zwei bisher
uebersehene Fragen. Die realen Compilerreaktionen sind OFFEN; kein Test
wird hier als gueltig oder ungueltig vorausgesetzt.

## Vorgehen

1. Jede .P-Datei EINZELN dem echten RTOS-UH-Compiler uebergeben.
   Innerhalb der E01-E04-Dateien stehen absichtlich zwei MODULEs.
2. Ergebnis und moeglichst genaue Diagnose in ERGEBNISSE-NACHTRAG.tsv
   eintragen. Falls uebersetzt, auch die Zahl und Art der erzeugten
   Objektmodule notieren.
3. Erst E00 testen. Bei E01-E04 ist die Frage gerade, ob die Uebersetzungs-
   einheit mehrere MODULEs haben darf; eventuelle Folgefehler daher von
   der grundlegenden Ablehnung eines zweiten MODULEs trennen.
4. Bei F01, F02 und F04 nur das Compilerverhalten beurteilen. Die
   RTOS-UH-Laderbedingung fuer /*+G*/ laesst sich aus einem erfolgreichen
   Compile NICHT widerlegen. Spaetere Linker-/Ladertests nur in einer
   kontrollierten Testumgebung durchfuehren.
5. Compiler-Version, Optionen und etwaige Quelltextanpassungen notieren.

## E - Zwei MODULEs in einer Uebersetzungseinheit

- E00: Einzelnes MODULE mit PROC und TASK als Basis.
- E01: Zwei komplette MODULEs mit je einer PROC und TASK. Ist das legal?
- E02: Zwei MODULEs ohne TASK. Isoliert die Modulanzahl von der TASK-Logik.
- E03: Wenn mehrere MODULEs erlaubt sind: erste MODULE enthaelt TASK,
  zweite beginnt mit /*+G*/-PROC vor ihrer eigenen TASK. Ist die Grenze
  wirklich modulbezogen?
- E04: Zweites MODULE hat eigene TASK vor seiner /*+G*/-PROC. Vergleich
  zu E03. Auch bei Compilerakzeptanz ist die Laderbedingung gesondert
  zu betrachten.

E03 und E04 sind nur dann fuer eine Aussage zur Modulzuordnung geeignet,
wenn der Compiler mehrere MODULEs in einer Uebersetzungseinheit akzeptiert.

## F - /*+G*/ bei PROC

- F00: /*+G*/-PROC mit GLOBAL vor erster TASK (Vergleichsbasis).
- F01: Gleiche PROC hinter erster TASK. Compilerpruefung oder erst
  Laderproblem? Eine Compilerakzeptanz ist KEIN Nachweis der Ladefaehigkeit.
- F02: /*+G*/ ohne GLOBAL. Prueft, ob der reale Compiler das fehlende
  GLOBAL selbst diagnostiziert.
- F03: Normale PROC ohne /*+G*/ hinter TASK. Kontrolltest zur Reihenfolge.
- F04: G-Prozedur, vor die eine TASK eingefuegt wurde. Prueft das
  praxisrelevante Verschiebungsszenario; technisch aehnlich F01.

## Auswirkung auf den LSP

Falls mehrere MODULEs pro Uebersetzungseinheit nicht unterstuetzt werden,
sollte dies als eigene Syntax-/Semantikdiagnose am zweiten MODULE sichtbar
werden. Der AST kann zur Fehler-Recovery beide Module beibehalten.

Falls der reale Compiler eine zu spaete /*+G*/-PROC akzeptiert, bleibt
unsere LSP-Diagnose trotzdem sachlich notwendig, weil die Ursache in
der MDLE-/TASK-Speicherverkettung und der Ladersuche nach 17er-Scheiben
liegt, nicht zwingend in einer Compiler-Fehlermeldung.

Offen sind ausserdem aus der urspruenglichen Sammlung insbesondere:
REFADD-Namenskonflikte, Verdecken von Builtins, SPC-/PROC-Kompatibilitaet,
Vorwaertsaufrufe und C-Aufrufkonventionen. Diese stehen bereits in A-D.
