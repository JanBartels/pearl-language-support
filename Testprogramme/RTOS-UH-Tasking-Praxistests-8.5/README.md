# RTOS-UH / PEARL – Praxistests für Roadmap 8.5.3

**Zweck:** eigenständige Testprogramme für AST, Parser, Semantik, Hover,
Go to Definition, Find References und Compilervergleich. Alle `.P`-Dateien
sind einzelne Module und enthalten `P=MPC603;` sowie `SC=2000;`.

**Wichtig:** Die Programme sind in erster Linie **Übersetzungs- und Editor-Tests**.
Sie sind **nicht** als sichere, sofort ausführbare Steuerungsanwendungen gedacht.
Insbesondere können zyklische Einplanungen mit `ALL 0 SEC` einen Timer-Tick pro
Aktivierung auslösen, und das uninitialisierte `REF TASK` aus Programm 09 darf
nicht dereferenziert werden. Die `EV(...)`-Masken sind nur illustrative Werte;
sie können hardwareabhängig andere Interrupts bezeichnen. Programme weder
auf einer produktiven Maschine starten noch automatisch ausführen.

## Ordner und Erwartungen

### `gueltig/` – **0 Parser-/Semantikdiagnosen erwartet**

| Datei | Szenario / Prüfschwerpunkt |
|---|---|
| `01_Anlagenanlauf.P` | Typische MAIN-Task mit zwei periodischen Tasks, FIXED-Zähler, PREVENT |
| `02_Zeitfenster.P` | `AT … ALL … UNTIL` und `AFTER … ALL … DURING` mit PRIO |
| `03_Watchdog.P` | Periodische Überwachung, bedingtes TERMINATE und PREVENT |
| `04_InterruptEinplanung.P` | `SYSTEM; EV(...)`, `SPC … INTERRUPT`, `WHEN … ACTIVATE/CONTINUE` |
| `05_SemaphorUndTasking.P` | SEMA mit `PRESET`, `REQUEST/RELEASE`, periodische Tasks |
| `06_SymbolischeZeiten.P` | CLOCK-/DURATION-/FIXED-Ausdrücke über Symbolnamen, Hover/Definitionen |
| `07_NullwerteUndArithmetik.P` | `0 SEC` bei AFTER/ALL/DURING, Zeit-Arithmetik (`5 * 0.1 SEC`) |
| `08_Tasksteuerung.P` | ACTIVATE, SUSPEND, CONTINUE PRIO, PREVENT und TERMINATE |
| `09_RefTaskNavigation.P` | `REF TASK`-Operand, Hover/Find References; nicht ausführbar ohne Initialisierung |
| `10_MakroZeitplanung.P` | Zeitangaben aus `#define`, Quelldateiabbildung und Navigation |

Einige Beispiele sind bewusst nur zum Übersetzen gedacht, auch wenn die
Anweisungen für sich gültig sind: Ein echter Ablauf erfordert einen passenden
Tasklebenszyklus und angemessene Synchronisation.

### `ungueltig/` – **Fehler erwartet**

| Datei | Erwartete Diagnosen des LSP in 8.5.3 |
|---|---|
| `01_FalscheTasknamen.P` | 3: falsche Operandentypen / unbekannter Task |
| `02_FalscheZeittypen.P` | 6: AT/UNTIL benötigen CLOCK; AFTER/ALL/DURING DURATION; WHEN INTERRUPT |
| `03_NegativeDauern.P` | 4: negative bekannte Dauern, auch eine benannte `INV`-Konstante |
| `04_FalschePrioritaeten.P` | 3: nicht-FIXED, 0 und 32768; gültiger Kontrastfall |
| `05_FalscheKombinationen.P` | 4: WHEN mit Zeitklausel, zwei Limits, ALL bei CONTINUE |
| `06_FalschePositionen.P` | 6: fehlender Taskname, Klausel hinter ACTIVATE, nackte Priorität, RESUME mit Namen, RESUME ohne Startbedingung; zwei Folgefehler bei einer Anweisung |

**Hinweis:** Negative Tests sind für die Diagnostik des LSP erstellt. Der
RTOS-UH-Compiler muss nicht dieselbe Anzahl, Position oder Formulierung
von Folgefehlern melden. In erster Linie die fachliche Zulässigkeit prüfen.

### `compilerproben/` – **Compilerentscheidung noch offen**

| Datei | Zu klärende Frage |
|---|---|
| `01_PRIORITY_Probe.P` | Akzeptiert RTOS-UH `PRIORITY` statt `PRIO`? |
| `02_EVERY_Probe.P` | Akzeptiert RTOS-UH `EVERY` statt `ALL`? |
| `03_WHEN_RESUME_Probe.P` | Akzeptiert RTOS-UH `WHEN Interrupt RESUME;` tatsächlich? (`WRES` legt dies nahe.) |

Der derzeitige LSP akzeptiert diese drei Programme. Der tatsächliche
RTOS-UH-Compiler ist entscheidend, falls er sie ablehnt.

## Empfehlung für die manuelle Prüfung

1. Jede Datei einzeln im Editor öffnen; in `gueltig/` sollten keine Diagnosen erscheinen.
2. Im `SYSTEM`-Teil von `04_InterruptEinplanung.P` bei `DatenBereit` bzw. `Alarm`
   auf das jeweilige `WHEN` navigieren; umgekehrt Definition/Referenzen testen.
3. Mit `06_SymbolischeZeiten.P` Hover und Navigation auf `StartUhr`, `EndeUhr`,
   `Zyklus`, `Fenster` und `NeuePrio` prüfen. Wiederholte Bezeichner müssen
   auf dieselbe Definition führen.
4. Die sechs Fehlerdateien nacheinander öffnen und prüfen, ob der LSP die
   Fehler auf der tatsächlich fehlerhaften Klausel markiert, ohne gültige
   Nachbaranweisungen zu beschädigen.
5. Die drei Compilerproben **separat** gegen den realen RTOS-UH-Compiler
   testen; dessen Resultat entscheidet über die RTOS-UH-Grammatik.
6. Bei Abweichungen die konkrete Datei und die vollständigen Meldungen
   zusammen mit dem Compilerergebnis festhalten.

## Lokale Vorprüfung

Die 19 `.P`-Dateien wurden mit dem Parser und dem `SemanticAnalyzer` aus dem
rekonstruierten Stand von Roadmap 8.5.3 analysiert. Ergebnis:

- 10 erwartungsgemäß gültige Module mit je **0 Diagnosen**.
- 6 negative Module mit den oben genannten diagnostischen Anzahlen.
- 3 experimentelle Compilerproben mit je **0 LSP-Diagnosen**.

**Nicht durchgeführt:** Übersetzung mit dem originalen RTOS-UH-Compiler.
Die Datei `LOCAL-VALIDATION.txt` enthält den vollständigen LSP-Diagnosebefund
für jede Datei.
