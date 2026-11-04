# Compilerproben: Virtuelle Felder, REF und IDENT (Roadmap 8.5)

Alle Programme sind eigenstaendige PEARL-Module mit `P=MPC603;` und `SC=2000;`.
Sie sind fuer Compiler- und LSP-Diagnosen gedacht, **nicht fuer die Ausfuehrung**.

**Wichtig:** Nur Test 01 (`RF = AF`) wurde bereits mit dem originalen RTOS-UH-Compiler
bestaetigt. Die Erwartungen der anderen Programme beruhen auf dem PEARL-Sprachreport,
RTOS-UH-Handbuch und der aktuellen LSP-Typsemantik; sie sind **Compilerpruefauftraege**.
Bei Abweichungen gilt der RTOS-UH-Compiler als massgeblich.

## Testmatrix

| Datei | Schwerpunkt | Erwartung | Compilerbestaetigung |
|---|---|---|---|
| `Soll_akzeptiert_werden/01_REF_eindimensional.P` | Referenz auf konkretes eindimensionales FIXED-Feld | keine Diagnose | Ja |
| `Soll_akzeptiert_werden/02_REF_zweidimensional.P` | Referenz auf konkretes zweidimensionales FIXED-Feld | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/03_REF_unterschiedliche_Grenzen.P` | Gleicher Rang, unterschiedliche konkrete Grenzen | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/04_REF_CHAR_Feld.P` | Referenz auf Feld von CHAR(4)-Elementen | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/05_REF_an_REF_zuweisen.P` | Zwei Referenzvariablen desselben virtuellen Feldtyps | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/06_REF_Wert_mit_Feld.P` | REF-Wertparameter erhaelt konkretes Feld (keine IDENT-Uebergabe) | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/07_REF_Wert_mit_REF.P` | REF-Wertparameter erhaelt bestehende virtuelle Referenz | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/08_REF_IDENT_mit_REF.P` | REF IDENT verlangt und erhaelt REF-Variable | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/09_Feld_IDENT_eindimensional.P` | Formaler Feldparameter A() FIXED IDENT erhaelt konkretes Feld | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/10_Feld_IDENT_zweidimensional.P` | Formaler Feldparameter A(,) FIXED IDENT erhaelt 2D-Feld | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/11_REF_Wert_zweidimensional.P` | Zweidimensionales konkretes Feld an REF (,)-Wertparameter | keine Diagnose | Offen |
| `Soll_akzeptiert_werden/12_REF_IDENT_zweidimensional.P` | Zweidimensionaler REF (,) IDENT bekommt REF (,)-Variable | keine Diagnose | Offen |
| `Soll_abgewiesen_werden/13_Falscher_Rang_Zuweisung.P` | Negativ: 2D-Feld in REF () FIXED | Typfehler bei RF = AF | Offen |
| `Soll_abgewiesen_werden/14_Falscher_Elementtyp_Zuweisung.P` | Negativ: FLOAT-Feld in REF () FIXED | Typfehler bei RF = AF | Offen |
| `Soll_abgewiesen_werden/15_REF_Wert_falscher_Rang.P` | Negativ: 2D-Feld an REF () FIXED-Wertparameter | Typfehler bei Verwende(AF) | Offen |
| `Soll_abgewiesen_werden/16_REF_Wert_falscher_Typ.P` | Negativ: CHAR(4)-Feld an REF () FIXED-Wertparameter | Typfehler bei Verwende(AF) | Offen |
| `Soll_abgewiesen_werden/17_REF_IDENT_mit_Feld.P` | Negativ: REF IDENT bekommt konkretes Feld statt REF-Variable | IDENT-Fehler bei Umhaengen(AF) | Offen |
| `Soll_abgewiesen_werden/18_REF_IDENT_falscher_Rang.P` | Negativ: REF (,) an REF () IDENT | Typfehler bei Umhaengen(RF) | Offen |
| `Soll_abgewiesen_werden/19_Feld_IDENT_falscher_Rang.P` | Negativ: 2D-Feld an eindimensionalen Feld-IDENT-Parameter | Typfehler bei Bearbeite(AF) | Offen |

## Unterschied: `REF () ...` und `A() ... IDENT`

- `PROC(X REF () FIXED)` erwartet einen Referenzwert. Eine konkrete Feldvariable
  darf nach RTOS-UH Abschnitt 5.6.2.6 eine Adresse liefern.
- `PROC(X REF () FIXED IDENT)` erwartet **eine Referenzvariable selbst**;
  das Feld `AF` allein ist kein passender IDENT-Aktualparameter.
- `PROC(A() FIXED IDENT)` erwartet **ein Feldobjekt** als IDENT-Parameter.
  Das ist nicht dasselbe wie `REF () FIXED IDENT`.

Die drei Faelle sind absichtlich in eigenstaendigen Testprogrammen untergebracht.

## Durchfuehrung

1. Dateien einzeln mit dem **originalen RTOS-UH-Compiler** uebersetzen.
2. `Soll_akzeptiert_werden`: Ziel ist jeweils ein erfolgreicher Compile ohne Fehler.
3. `Soll_abgewiesen_werden`: Ziel ist ein gezielter Typ- oder IDENT-Fehler.
4. Unerwartete Meldungen einschliesslich Positionsangabe und Dateinamen notieren;
   eine falsche Parserdiagnose ist von einer echten Typabweichung zu unterscheiden.
5. Bei Bedarf dieselben Dateien im LSP pruefen und die Diagnosen vergleichen.

Die Aufteilung stellt sicher, dass ein Fehlschlag nicht die anderen Compilerproben verdeckt.

### Quellen

- RTOS-UH-Handbuch, Abschnitt **5.6.2.6**: REF-Parameteruebergabe per Wert bzw. IDENT.
- PEARL-90-Sprachreport, Abschnitte **5.6** und **8.1**: Referenzvariablen,
  virtuelle Dimensionslisten und Feld-IDENT-Parameter.
