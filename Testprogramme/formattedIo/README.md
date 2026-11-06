# RTOS-UH-Referenzprogramme fuer 8.6.4.1

Diese Programme sind eigenstaendige PEARL-Programme mit der Endung `.P`.
Sie liegen unter `semantic/tests/fixtures`, wie die anderen PEARL-Referenzprogramme.
`formattedIoReferencePrograms.test.ts` prueft ihre Parser- und Semantikakzeptanz.

| Datei | Schwerpunkt |
|---|---|
| `00_GET_PUT.P` | GET/PUT, RST, SKIP, X, B und dynamische A-Laenge |
| `01_FORMAT_R.P` | FORMAT-Deklaration, R(...) und Wiederholungsgruppen |
| `02_CONVERT.P` | CONVERT in beiden Richtungen und RST |
| `03_WIEDERHOLUNG.P` | Geschachtelte Formate, variable Formatargumente |

Die PEARL-Programme dienen zunaechst der Uebersetzungspruefung im
Originalcompiler. Ihre Akzeptanz durch RTOS-UH ist noch nicht verifiziert.
Die Datenstationen sind an `/NIL` gebunden; GET nicht ohne bewusste
Laufzeitpruefung ausfuehren.

Nicht Bestandteil von 8.6.4.1: Formatablauf, Feldbreitenvalidierung
und Abgleich zwischen Daten- und Formattypen.
