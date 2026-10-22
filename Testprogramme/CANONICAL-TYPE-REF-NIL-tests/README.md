# Regressionstests: kanonische Typidentitaet, REF STRUCT[] und NIL

Die Tests sind zur Ausfuehrung im PEARL-LSP bestimmt. Fuer die aktuelle
Teilimplementierung (ohne LENGTH-Verarbeitung) gelten die RTOS-UH-Standardlaengen
FIXED(15), FLOAT(23), BIT(1), CHAR(1).

| Datei | Erwartete LSP-Semantik |
| --- | --- |
| 00_CanonicalSPCProc.P | keine Signaturdiagnose: Kurz-/Langformen gleich |
| 01_CanonicalRefProc.P | `NIL` in REF PROC INIT ist erlaubt; SPC ist GLOBAL |
| 02_NilSimpleRefs.P | vier erlaubte NIL-Initialisierungen inklusive VOID-REF |
| 03_NilReferenceArray.P | NIL in REF-Feldinitialisierung ist erlaubt |
| 04_NilScalarInvalid.P | NIL als FIXED-Initialisierung wird beanstandet |
| 05_RefVoidSignatureMismatch.P | SPC/PROC-Signaturkonflikt: VOID-REF != REF FIXED |
| 06_FloatPrecisionMismatch.P | SPC/PROC-Signaturkonflikt: FLOAT(55) != FLOAT(23) |
| 07_IdenticalVoidSignature.P | kein Signaturfehler: identische VOID-REF-Typen |
| 08_ShellDefaultPrecisions.P | Shellsignatur: FIXED(15) und BIT gleich FIXED und BIT(1) |

Beachte: Die Tests sind ohne den realen RTOS-UH-Compiler angelegt und in der
hier vorliegenden Teilkopie des Repositories nicht als vollstaendige LSP-Integration
verifizierbar. In Test 00 kann eine noch fehlende RETURN-Ausdruckssemantik
keine Rolle fuer den hier untersuchten Signaturvergleich spielen.
