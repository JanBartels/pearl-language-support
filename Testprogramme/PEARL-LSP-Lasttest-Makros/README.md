# PEARL-LSP Lasttest V2: rekursive Makroexpansion

Dieses synthetische Projekt dient nur der Analyse durch den PEARL-Language-Server.
Es wird nicht ausgefuehrt oder mit einem Codegenerator uebersetzt.

## Aufbau

- `Project/`: **15** unabhaengige `.P`-Uebersetzungseinheiten mit 560 bis 2920 physischen Zeilen.
- `ExternalIncludes/`: **5** kleine Includedateien zu je 100 physischen Zeilen.
- `ExternalIncludes/SHARED_VARS.TYP`: 2019 physische Zeilen, davon pro Uebersetzungseinheit 960 aktive Vereinbarungen der Form `VAR StressSharedNNNN( Boundary ) FIXED GLOBAL;`.
- `COMMON_TYPES.TYP` bindet `NESTED_RECORDS.INC` transitiv ein. Somit wird auch eine zweistufige Include-Kette getestet.
- Alle 15 Dateien binden die grosse Datei und die kleinen Dateien ein (4 direkt, 1 indirekt).
- Jede gerade Dateinummer definiert `DEKLARATIONEN` und erhaelt GLOBAL-Deklarationen.
  Jede ungerade Dateinummer spezifiziert dieselben Objekte mit `SPC ... GLOBAL`.
  Beide Zweige entstehen aus denselben **960 Quelltextzeilen**, nicht aus unterschiedlichen direkten DCL-/SPC-Zeilen.

**Wichtig:** Nur den Ordner `Project` in VS Code oeffnen, nicht den uebergeordneten Ordner.
Die Include-Dateien befinden sich bewusst *ausserhalb* des geoeffneten Workspace.
Die im Projekt enthaltene Einstellung `pearl.macros.InclDir` verweist relativ auf `../ExternalIncludes`.
Die Dateiendungen `.XYZ`, `.DEF`, `.INC`, `.H` und `.TYP` benoetigen keine
`files.associations`, sofern die Include-Sprachzuordnung des LSP funktioniert.

## Reproduzierbarer manueller Test

1. VS Code / Extension Development Host mit dem **Ordner `Project`** starten.
2. Die Analyse aller 15 `.P`-Dateien abwarten. Anfangs kann die CodeLens
   voruebergehend fehlen; sie soll nach abgeschlossener Analyse automatisch erscheinen.
3. `ExternalIncludes/SHARED_VARS.TYP` im Editor oeffnen (z.B. mit `Datei oeffnen`).
   Die CodeLens soll mindestens 15 einbindende Kontexte anbieten.
4. Den Dateitab geoeffnet lassen und die LSP-Neuanalyse durch eine beliebige
   kleine Aenderung (z.B. eine neue Kommentarzeile) in `SHARED_VARS.TYP` anstossen.
   Nach Abschluss muessen die Kontexte wieder verfuegbar sein, ohne den Tab zu schliessen.
5. Einen zweiten Test waehrend einer laufenden Neuanalyse machen: eine weitere
   `.P`-Datei speichern oder die Include-Datei erneut aendern.
   Hierbei sind Debugmeldungen mit Ursache und Dauer der Analysen besonders hilfreich.
6. Die CodeLens anschliessend auch in `COMMON_TYPES.TYP` und `NESTED_RECORDS.INC`
   pruefen. Letzteres testet indirekte Includes.

## Sollwerte und Hinweise

- Im stabilen Zustand sind **15 Besitzer-Uebersetzungseinheiten** pro Includedatei zu erwarten.
  Die genaue Zahl sichtbarer Optionen kann sich bei noch laufender Analyse aendern.
- Die grosse Datei bleibt in beiden Makrovarianten physisch dieselbe URI,
  aber der AST unterscheidet sich je nach Uebersetzungseinheit.
- Hinweise auf unbenutzte Objekte sind bei den synthetischen Variablen normal.
  Es ist *kein* Ziel, einen fehler- oder warnungsfreien Lauf unter jedem
  Entwicklungsstand des Compilers zu garantieren.
- Zeitmessungen fuer Kaltstart, nach dem ersten Oeffnen einer Includedatei,
  und bei wiederholten Aenderungen getrennt erfassen. Gerade das Oeffnen
  einer Include-Datei kann `didOpen` ausloesen.
- Protokolle koennen Projektpfade enthalten. Fuer eine Rueckmeldung reichen
  Analyseanzahl, Laufzeiten, Kontextzahl und die zugehoerigen Ereignisse.

## Umfang

| Datei | physische Zeilen | Zweig der grossen Includedatei |
|---|---:|---|
| `Project/STRESS_01.P` | 560 | SPC |
| `Project/STRESS_02.P` | 720 | DCL |
| `Project/STRESS_03.P` | 880 | SPC |
| `Project/STRESS_04.P` | 1040 | DCL |
| `Project/STRESS_05.P` | 1200 | SPC |
| `Project/STRESS_06.P` | 1360 | DCL |
| `Project/STRESS_07.P` | 1520 | SPC |
| `Project/STRESS_08.P` | 1680 | DCL |
| `Project/STRESS_09.P` | 1840 | SPC |
| `Project/STRESS_10.P` | 2000 | DCL |
| `Project/STRESS_11.P` | 2160 | SPC |
| `Project/STRESS_12.P` | 2320 | DCL |
| `Project/STRESS_13.P` | 2480 | SPC |
| `Project/STRESS_14.P` | 2680 | DCL |
| `Project/STRESS_15.P` | 2920 | SPC |
| `ExternalIncludes/COMMON_TYPES.TYP` | 100 | – |
| `ExternalIncludes/COMMON_CONST.DEF` | 100 | – |
| `ExternalIncludes/COMMON_ARRAYS.H` | 100 | – |
| `ExternalIncludes/COMMON_MISC.XYZ` | 100 | – |
| `ExternalIncludes/NESTED_RECORDS.INC` | 100 | – |
| `ExternalIncludes/SHARED_VARS.TYP` | 2019 | – |

## Architekturbezug

Das Projekt verwendet normale RTOS-UH-PEARL-Konstrukte (`MODULE`, `PROBLEM`,
`TYPE`, `DCL`, `SPC`, `PROC`, `TASK`) und die externe `#include`-/
`#ifdef`-Praeprozessierung des aktuellen LSP. Entscheidend fuer den Test ist,
dass der Praeprozessor pro Uebersetzungseinheit die physischen Include-Vorkommen
und Makrobedingungen ermittelt und die `DocumentRegistry` daraus die Kontexte
bereitstellt. **Der Dateiname der Includedatei besitzt keine semantische Bedeutung.**

## Neu in V2: Nachbildung des realen Makromusters

Die grosse Includedatei beginnt mit:

```pearl
#ifdef DEKLARATIONEN
#define VAR "DCL"
#define WertIst " "
#define WertEnde " "
#else
#define VAR "SPC"
#define WertIst "/*"
#define WertEnde "*/"
#endif
#define Count "40"
#define Boundary "WertIst 0:Count WertEnde"

VAR StressShared0001( Boundary ) FIXED GLOBAL;
```

Fuer DCL wird daraus `DCL StressShared0001( 0:40 ) FIXED GLOBAL;`.
Fuer SPC wird daraus `SPC StressShared0001( /* 0:40 */ ) FIXED GLOBAL;`.
Der Preprozessor muss auf jeder der 960 Variablenzeilen `VAR` und `Boundary`
expandieren und dann innerhalb von `Boundary` drei weitere Makros rekursiv
aufloesen. Das ergibt mindestens 4.800 Makroreferenzen pro Uebersetzungseinheit
und mindestens 72.000 ueber alle 15 Einheiten, ohne Includes und
bedingte Direktiven mitzuzahlen.

Vergleich mit der **urspruenglichen** Lasttestfassung:

- 15 `.P`-Dateien, Dateigroessen und Include-Graph sind unveraendert.
- Die grosse Include-Datei hat weiterhin 2019 Zeilen und 960 aktive
  Variablenvereinbarungen pro Einheit.
- Geaendert ist bewusst die Art der Erzeugung der Deklarationen
  (verschachtelte Makroexpansion statt #ifdef-Gruppen mit direkten DCL/SPC).
- Die urspruengliche Testfassung getrennt aufheben, damit Messungen mit
  identischem LSP-Build moeglich bleiben.
- Dieses Paket ist ein **Stress-Test**. Das reine syntaktische Entstehen der
  beiden Varianten ist durch das Muster aus den bestehenden Praeprozessor-Tests
  begruendet; ein vollstaendiger LSP-Diagnose-Test der generierten Dateien
  wurde hier nicht ausgefuehrt.

Vorschlag: Den Kaltstart von V1 und V2 mit demselben LSP-Build vergleichen,
jeweils `analysis.execute`/`analysis.commit` auswerten und `problems`
mitprotokollieren. VS Code mit `Project/` als Workspace oeffnen.
