RTOS-UH: Akzeptiert der Originalcompiler RST bei OPEN und CLOSE?
================================================================

Ziel: reine Sprachakzeptanz pruefen. Jede PEARL-Datei ist ein
vollstaendiges, einzeln zu uebersetzendes Testprogramm.

Testreihenfolge:
  1. 00_BASELINE.pearl -- OPEN und CLOSE ohne BY/RST.
  2. 01_OPEN_RST.pearl -- nur OPEN erhaelt BY RST(...).
  3. 02_CLOSE_RST.pearl -- nur CLOSE erhaelt BY RST(...).

Alle drei Programme verwenden die dokumentierte System-DATION /NIL
("Schwarzes Loch") mit OUT ALPHIC. Es werden keine Dateien erzeugt
oder geloescht; auf CAN wird verzichtet.

Die Pruefung ist zunaechst ausschliesslich als Compiler-Test gedacht.
Die Programme nicht ausfuehren, bevor die lokalen Eigenschaften der
System-DATION und der Laufzeitumgebung geklaert sind.

Auswertung:
  - BASELINE muss uebersetzen. Wenn nicht, zuerst Testumgebung oder
    Systemteil-Syntax korrigieren, nicht aus den RST-Tests schliessen.
  - OPEN_RST zeigt die Akzeptanz von RST bei OPEN.
  - CLOSE_RST zeigt die Akzeptanz von RST bei CLOSE.
  - Fehlermeldungen und Compiler-Version notieren.

Dokumentationslage:
  - PEARL-90-Sprachreport 1995, Abschnitt 10.3, S. 10-10/10-11:
    RST bei OPEN und CLOSE beschrieben.
  - RTOS-UH-Handbuch, Abschnitt 5.5.5, S. 313-314:
    RST bei OPEN/CLOSE nicht explizit dokumentiert.

Die drei Testquellen unterscheiden sich nur an den fuer diesen
Vergleich notwendigen Stellen.
