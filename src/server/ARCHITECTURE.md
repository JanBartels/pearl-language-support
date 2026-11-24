# Projektquellen

Dieses Dokument beschreibt die Architektur des Projekts.

Die Implementierung befindet sich im öffentlichen GitHub-Repository:

https://github.com/JanBartels/pearl-language-support/tree/Dev_0_3

Die hier genannten Referenzimplementierungen sind Einstiegspunkte in den
Quellcode und gelten als maßgebliche Beispiele für die jeweiligen
Architekturkonzepte.

# Allgemeine Grundsätze

Eine Verletzung einer Architekturinvariante ist ein Programmierfehler und soll möglichst früh und möglichst laut sichtbar werden.

Wenn genau ein Objekttyp die nötige Information vollständig besitzt und keine zentrale Typabfrage entstehen soll, dann darf dieses Objekt auch die entsprechende Auswertungsmethode besitzen.

instanceof ist in der fachlichen Compilerlogik verboten. Zulässig ist es nur an klar definierten Infrastrukturgrenzen, wenn damit technische Eigenschaften geprüft werden, die sich nicht sinnvoll polymorph ausdrücken lassen (z. B. Typprüfung eines unknown im catch oder Prüfung auf FileSource für #include).

---

## Fachliche Modelle möglichst klein halten

Neue fachliche Konzepte sollen nur die Informationen enthalten, die sie
tatsächlich beschreiben.

Es sollen keine Methoden oder zusätzliche Zustände eingeführt werden,
solange diese fachlich nicht erforderlich sind.

Beispiele:

- `SourceValue` beschreibt einen Wert mit Quelltextposition.
- `AstLookupResult` beschreibt das Ergebnis einer AST-Suche.
- `MacroReference` beschreibt eine Makroverwendung.
- `FoldingRegion` beschreibt einen faltbaren Quelltextbereich.

---

# Parser- und Recovery-Strategien

## Allgemein

### Infrastruktur zuerst entwickeln

Neue Sprachbereiche sollen zunächst genutzt werden, um Parserinfrastruktur aufzubauen.

Erst danach werden größere Sprachbereiche implementiert.

Beispiel:

Der SYSTEM-Teil diente als Experimentierfeld für

- Parserstruktur
- Recovery
- ParserBase
- Validierung
- TailParser

Dadurch steht für den wesentlich komplexeren PROBLEM-Teil bereits eine stabile Infrastruktur zur Verfügung.

## Parserstrategien

### Parser entsprechend der Grammatik strukturieren

Parser sollen möglichst direkt die Grammatik widerspiegeln. Die Implementierung soll sich wie eine EBNF-Regel lesen und nicht durch Tokenverwaltung oder Fehlerbehandlung dominiert werden.

**Gut:**

```text
Declaration =
    Identifier
    ":"
    Object
    ";"
```

```ts
const identifier = this.expectIdentifier();
this.expectColon();

const object = this.parseObject();

this.expectSemicolon();
```

---

## Parser dürfen "langweilig" sein

Ein guter Parser besteht überwiegend aus:

- `expect...()`
- `accept...()`
- `parse...()`

Recovery ist auf wenige klar benannte Stellen beschränkt.

Die Grammatik soll beim Lesen unmittelbar erkennbar sein.

---

### Parser in kleine Produktionen zerlegen

Komplexe Produktionen werden in kleine, fachlich benannte Methoden zerlegt.

Beispiele:

- `parseDirection()`
- `parseHexNumber()`
- `parseParameterList()`
- `parseHexParameter()`
- `parseIntegerParameter()`

Dadurch wird die Grammatik sichtbar und die Fehlerbehandlung lokalisiert.

---
### Parserprimitive möglichst dumm halten

Parserprimitive sollen nur eine klar definierte Aufgabe erfüllen.

Beispiele:

- `parseDirection()` liest lediglich eine Richtung.
- `expectIdentifier()` liest lediglich einen Identifier.
- `expectHexLiteral()` kennt keine fachlichen Regeln.

Ob ein Grammatikbestandteil optional oder verpflichtend ist, entscheidet ausschließlich die aufrufende Grammatikproduktion.

Dadurch bleiben Parserprimitive universell wiederverwendbar.

---

### Fachliche Entscheidungen möglichst spät treffen

Der Parser soll Informationen zunächst möglichst unverändert übernehmen.

Beispiele:

- fehlende Richtung wird erst beim AST-Aufbau auf einen Defaultwert gesetzt.
- Hexzahlen werden zunächst als Text übernommen.
- Platzhalter werden erst beim Knotenaufbau eingefügt.

Dadurch bleibt möglichst lange erhalten, was tatsächlich im Quelltext stand.

---

### Kleine Parserprozeduren statt tiefer if-Kaskaden

Komplexe Produktionen werden in kleine fachliche Prozeduren zerlegt, die einen einzelnen Grammatikbestandteil vollständig verarbeiten.

Bei einem Fehler wird die lokale Recovery durchgeführt und anschließend unmittelbar mit `return` beendet.

Beispiel:

```ts
private parseHexParameter(
    name: string,
    digits: number
): string | undefined {

    if (!this.expectEquals()) {
        this.synchronizeParameter();
        return undefined;
    }

    const literal = this.expectHexLiteral(...);
    if (!literal) {
        this.synchronizeParameter();
        return undefined;
    }

    if (!this.checkHexLiteralComplete(...)) {
        this.synchronizeParameter();
        return undefined;
    }

    ...
    return value;
}
```

Dadurch entstehen keine tief verschachtelten `if`-Konstruktionen.

Jede Parserprozedur besitzt genau einen fachlichen Verantwortungsbereich und beendet ihre Arbeit unmittelbar nach einem nicht mehr lokal behandelbaren Fehler.

Vorteile:

- lineare Kontrollstruktur
- klar erkennbare Recovery-Punkte
- geringe Verschachtelung
- Wiederverwendbarkeit
- Parsercode folgt unmittelbar der Grammatik

---

### LL(1)-Grammatik bewusst auf Tail-Parser zuschneiden

Nicht jede fachliche Grammatik eignet sich unmittelbar für einen rekursiven Abstieg.

Deshalb darf die interne Parsergrammatik bewusst umgeformt werden, solange sie dieselbe Sprache beschreibt.

Beispiel:

```text
SystemDeclaration =
      Identifier ";"
    | Identifier ":" InterruptSystem
    | Identifier ":" DationSystem
```

wird intern zu

```text
SystemDeclaration =
    Identifier SystemDeclarationTail ;

SystemDeclarationTail =
      ";"
    | ":" InterruptSystemTail
    | ":" DationSystemTail ;
```

Dadurch wird nach dem gemeinsamen Präfix (`Identifier ":"`) genau einmal entschieden, welcher Tail-Parser zuständig ist.

Vorteile:

- keine doppelte Implementierung gemeinsamer Präfixe
- natürliche LL(1)-Entscheidung
- Parser spiegeln die gemeinsame Struktur der Grammatik wider
- Tail-Parser können gemeinsame Hilfsroutinen (`parseDirection()`, Parameterparser usw.) verwenden

Dieses Prinzip kann später auch im PROBLEM-Teil auf größere Sprachkonstrukte angewendet werden.

Referenzimplementierung:
- `/src/server/parser/moduleParser.ts`
- `/src/server/parser/shellCommandParser.ts`
- `/src/server/parser/parserBase.ts`
- `/src/server/parser/tailParser.ts`

---

### Gemeinsame Parserprimitive in ParserBase

Wiederkehrende Parseroperationen gehören in `ParserBase`.

Beispiele:

- `acceptComma()`
- `expectSemicolon()`
- `expectLeftParenthesis()`
- `acceptEquals()`

Dadurch verschwindet Tokenmechanik aus den Fachparsern.

---

### Semantik nicht in den Parser verlagern

Der Parser entscheidet ausschließlich anhand der Grammatik.

Beispiel:

```pearl
MyEv: EV12345678);
```

ist grammatisch eine ALPHIC-Dation.

Ob `MyEv` später als `INTERRUPT` verwendet wird, entscheidet ausschließlich die Semantik.

Der Parser soll niemals versuchen, die Absicht des Programmierers zu erraten.

---

### Parser erzeugen möglichst vollständige ASTs

Auch bei Syntaxfehlern soll der Parser möglichst einen vollständigen AST erzeugen.

Fehlende Werte werden durch sinnvolle Platzhalter ersetzt.

Beispiele:

- Modulname → `<error>`
- fehlende Interruptmaske → `"00000000"`
- fehlende Richtung → Standardwert beim Knotenaufbau

Dadurch können spätere Compilerphasen weiterarbeiten.

Nur vollständig zerstörte Konstruktionen werden verworfen.

---

### Lexer und Parser sauber trennen

Objektiv erkennbare Zeichenklassen gehören in den Lexer.

Beispiel:

```
0240FFFC
```

wird als

```
HexDigitSequence
```

tokenisiert.

Der Parser entscheidet anschließend, ob dieses Token an der aktuellen Grammatikstelle zulässig ist.

Dadurch entfallen Parserkonstruktionen, die mehrere Tokens wieder zusammensetzen müssen.

---

### Fachliche Typen statt Stringanalysen

Auch lexikalisch eindeutig unterscheidbare Formen derselben fachlichen
Kategorie erhalten eigene Tokenarten, wenn diese Unterscheidung für die
Grammatik relevant ist.

Beispiel:

- `IntegerLiteral`
- `FloatingPointLiteral`

Der Lexer trifft diese Unterscheidung ausschließlich anhand der Schreibweise.

Gemeinsame grammatische Abstraktionen werden dagegen im `ParserBase`
bereitgestellt. So können Parser je nach Grammatikproduktion gezielt

- `acceptIntegerLiteral()`
- `acceptFloatingPointLiteral()`
- `acceptNumberLiteral()`

verwenden.

`acceptNumberLiteral()` ist dabei keine Tokenart, sondern eine gemeinsame
Parserprimitive für beide numerischen Tokenarten.

---

### Syntax und Semantik konsequent trennen

Der Parser prüft ausschließlich grammatische Regeln.

Fachliche Regeln gehören in die Semantik.

Beispiele:

Parser:

- Parameter vorhanden?
- Klammern korrekt?
- Richtung angegeben?

Semantik:

- TFU zwischen 1 und 32767
- BU-Zugriffscode 0...8
- Objekt als INTERRUPT verwendbar?

---

### Kleine Code-Duplizierung ist akzeptabel

Methoden dürfen ähnlich aussehen, wenn sie unterschiedliche fachliche Konzepte behandeln.

Beispiele:

- `validateHexLiteralLength()`
- `validateHexDigitSequenceLength()`

Fachliche Klarheit ist wichtiger als maximale Wiederverwendung.

---

# Recoverystrategien

## Recovery lokal durchführen

Jede Grammatikproduktion ist selbst für ihre Recovery verantwortlich.

Beispiel:

```
BU(...)
```

kennt ihre eigenen Synchronisationspunkte.

Der aufrufende Parser muss diese Details nicht kennen.

Beispiel:

Nicht der SYSTEM-Parser behandelt Parameterfehler.

Sondern der Parameterparser selbst.

Dadurch bleibt Recovery lokal und nachvollziehbar.

---

## Synchronisation möglichst spät

Synchronisiert wird immer auf das Ende der aktuellen Konstruktion.

Beispiele:

Parameter:

```
,
)
```

Deklaration:

```
;
```

SYSTEM-Teil:

```
PROBLEM
MODEND
```

Je kleiner der Synchronisationsbereich, desto weniger Quelltext geht verloren.

---

### Recovery niemals mit Heuristiken vermischen

Recovery soll ausschließlich die Grammatik wieder synchronisieren.

Der Parser soll niemals versuchen, die vermutete Absicht des Programmierers zu erraten.

Beispiel:

```pearl
MyEv: EV12345678);
```

wird als ALPHIC-Dation geparst.

Die spätere Semantik erkennt den eigentlichen Fehler.

Dadurch bleiben Parser und Semantik klar getrennt.

---

## Unterschiedliche Recovery-Methoden benennen

Recovery soll nicht als anonyme `synchronize(...)`-Aufrufe im Code stehen.

Stattdessen kleine Hilfsmethoden verwenden.

Beispiele:

- `synchronizeParameterList()`
- `synchronizeBUDeclaration()`
- `synchronizeInterruptDeclaration()`

Dadurch wird die Recoverystrategie dokumentiert.

---

## Nach fatalen Fehlern Konstruktion verwerfen

Kann eine Konstruktion nicht sinnvoll fortgesetzt werden, wird bis zu ihrem Ende synchronisiert.

Beispiel:

```
Expected ':' after system declaration name.
```

→ Synchronisation bis zum nächsten Semikolon.

Es wird keine teilweise Deklaration erzeugt.

---

## Nach kleinen Fehlern lokal weitermachen

Fehler innerhalb einer ansonsten gültigen Konstruktion sollen möglichst lokal behandelt werden.

Beispiele:

- ungültiger Parameterwert
- unbekannter Parameter
- fehlendes '='

Die übrigen Parameter werden weiterhin geparst.

---

## Recovery und Fehlermeldung trennen

Parserprimitive melden den Fehler.

Der aufrufende Parser entscheidet über die Recovery.

Beispiel:

```ts
const direction = this.parseDirection();

if (!direction) {
    this.synchronizeBUDeclaration();
}
```

Dadurch bleiben Parserprimitive universell einsetzbar.

---

## Synchronisationspunkte grammatikorientiert wählen

Synchronisiert wird niemals auf beliebige Tokens, sondern auf Grammatikgrenzen.

Typische Synchronisationspunkte sind:

- `)`
- `]`
- `}`
- `;`
- Abschnittsanfänge (`SYSTEM`, `PROBLEM`, `MODEND`)

---

## Recovery möglichst wenig invasiv

Es wird immer versucht, den Parser mit minimalem Informationsverlust fortzusetzen.

Beispiel:

Nach einem unbekannten Parameter wird nur bis zur schließenden Klammer synchronisiert.

Nicht der gesamte SYSTEM-Teil wird verworfen.

---

# Präprozessor

Der externe Präprozessor bildet eine eigenständige Compilerphase vor dem Parser.
Er erzeugt aus dem ursprünglichen Quelltext einen vollständig expandierten
PEARL-Quelltext mit Herkunftsinformationen. Erst danach wird dieser Text erneut
lexikalisch analysiert und an den Parser übergeben.

Die externe Präprozessierung ist nicht mit den internen RTOS-UH-Compiler-
Direktiven (z. B. `#DEFINE` und `#IF`) gleichzusetzen. Diese stellen einen
separaten, derzeit nicht in dieser Pipeline implementierten Sprachbereich dar.
Ihre spätere Verarbeitung darf die Trennung der externen Textphase von Parser
und Semantik nicht umgehen.

Parser und externer Präprozessor bleiben vollständig voneinander getrennt.

---

## Klare Trennung vom Parser

Der Parser kennt keine Präprozessor-Konstrukte.

Insbesondere kennt er nicht

- Makroexpandierung
- bedingte Übersetzung
- Include-Dateien

Er verarbeitet ausschließlich den Tokenstrom, den ein zweiter PEARL-Lexer
aus dem vollständig expandierten Quelltext erzeugt.

Dadurch bleibt der Parser unabhängig von der externen Präprozessorsemantik.

---

## Rekursive Verarbeitung von Includes und Makros

Include-Dateien werden rekursiv mit einer eigenen Präprozessorinstanz
verarbeitet; die dafür erforderlichen Zustände werden kontrolliert geteilt.
Nach dem Include wird die Verarbeitung der aufrufenden Quelldatei fortgesetzt.
Die Include-Tiefe ist begrenzt.

Makroersetzungen werden dagegen **nicht** als eigenständiger PEARL-Tokenstrom
lexikalisiert. `MacroTextExpander` expandiert ihre Texte rekursiv und erkennt
Zyklen sowie eine zu große Schachtelungstiefe.

Diese Unterscheidung ist verbindlich: Ein Makro kann erst im Zusammenspiel mit
benachbarten Textfragmenten gültige PEARL-Tokens oder Kommentargrenzen bilden.
---

## Editorinformationen erhalten

Obwohl Makros vor dem Parsen expandiert werden, dürfen editorrelevante Informationen nicht verloren gehen.

Der Präprozessor erzeugt deshalb für jede Makroverwendung eine `MacroReference`.

Dadurch können spätere LSP-Funktionen wie

- Hover
- Peek Definition
- Gehe zu Definition

implementiert werden, ohne dass Parser oder AST Makros kennen müssen.

---

## Makroexpandierung als Texttransformation

`MacroTextExpander` durchsucht Makroersetzungstexte nach weiteren Makronamen,
ohne deren Ergebnis mit dem PEARL-Lexer zu tokenisieren. Er liefert Textfragmente
und die dabei erkannten Makroreferenzen. Die Rekursion besitzt Schutz gegen
Zyklen und übermäßige Schachtelung.

`ExternalMacroExpansionWriter` überführt diese Fragmente samt Referenzen in den
Ergebnis-Builder. Zwischen Fragmenten werden **keine künstlichen Trennzeichen**
eingefügt. Deshalb können Makros beispielsweise die Zeichen `/*` und `*/`
erzeugen, die erst der abschließende Compiler-Lexer als Kommentarbegrenzer
erkennt.

Der äußere Präprozessor bleibt für Direktiven, bedingte Übersetzung, Includes
und den aktiven Makrobestand verantwortlich. Diese Aufgaben werden nicht in den
`MacroTextExpander` verlagert.

Referenzimplementierungen:
- `/src/server/preproc/macroTextExpander.ts`
- `/src/server/preproc/externalMacroExpansionWriter.ts`
- `/src/server/preproc/externalPreprocessorResult.ts`
---

## Makroreferenzen

Jede erfolgreiche Auflösung eines Makronamens erzeugt eine `MacroReference`.

Eine `MacroReference` enthält

- die Position der Makroverwendung
- die referenzierte `MacroDefinition`

Die `MacroDefinition` enthält

- Makroname
- Ersetzungstext
- Definitionsposition (falls vorhanden)

Vordefinierte Makros besitzen bewusst keine Definitionsposition.

Bei verschachtelten Makros wird die Referenz des inneren Makros auf dessen
Schreibweise im Ersetzungstext der äußeren Makrodefinition bezogen, soweit
diese physisch vorhanden ist. Die unmittelbar im Programm geschriebene äußere
Makroverwendung behält ihre eigene Position. Damit dürfen verschachtelte
Referenzen die Navigation an der äußeren Aufrufstelle nicht verdecken.

Makroreferenzen gehören zu den Präprozessormetadaten und werden nicht aus dem
AST oder den Tokens des zweiten Lexers rekonstruiert.

Referenzimplementierung:
- `/src/server/preproc/macroDefinition.ts`
- `/src/server/preproc/macroReference.ts`

---

## Makrotabelle

Die `MacroTable` repräsentiert die aktuell gültigen Makrodefinitionen.

Nur der Präprozessor greift auf die Makrotabelle zu.

Der Parser kennt weder die Makrotabelle noch Makronamen.

Referenzimplementierung:
- `/src/server/preproc/macroTable.ts`
- `/src/server/preproc/macroDefinition.ts`

---

## Include-Dateien

Include-Dateien werden rekursiv präprozessiert und als Text in das gemeinsame
Ergebnis eingefügt. Der nachfolgende Compiler-Lexer sieht einen durchgehenden,
expandierten PEARL-Quelltext. Der Parser benötigt keine Kenntnis der Dateigrenzen.

Jede eingebundene Datei besitzt eine eigene `FileSource`; ihre Textfragmente
bewahren diese Herkunft in der `ExpandedSource`. Dadurch können Diagnosen und
Editoranfragen auf die ursprünglichen Dateien zurückgeführt werden.

Die Include-Pfadsyntax wird **im externen Präprozessor** verarbeitet, nicht im
PEARL-Parser. Auch Makros innerhalb des Include-Pfads werden dort aufgelöst.
Beispielsweise funktionieren beide Formen:

```text
#define InclDir "'/home/jan/pearl-lsp'"
#include InclDir/testinc.h
#include "InclDir/testinc.h"
```

Die vorhandene Behandlung der Begrenzungszeichen und der Pfadmakros ist von
der lexikalischen Analyse des abschließenden PEARL-Texts unabhängig.

Der **erste Lexer** erkennt `#include`-Pfadfragmente, die mit einer Ziffer
beginnen (beispielsweise `12_SharedTypes.h`), als opaken
`PreprocessorText` statt als PEARL-Zahlenliterale. Dies gilt bis zum
Zeilenende der Direktive und auch für numerische Fragmente hinter einem Punkt.
Der Präprozessor fügt diese Fragmente mit den übrigen Pfad-Tokens zusammen;
gewöhnliche Bezeichner im Pfad bleiben für die Makroauflösung erhalten.
Nach dem Zeilenende gelten wieder die normalen Lexerregeln.

Die **PEARL-Zahlenliteralprüfung** wird dadurch nicht abgeschwächt. Der
zweite Lexer prüft den expandierten PEARL-Text weiterhin uneingeschränkt.
Die Korrektur findet weder im Parser noch in der Include-Dateisuche statt.

Regressionstest: `/src/server/preproc/tests/numericIncludeFilename.test.ts`.

Referenzimplementierung:
- `/src/server/preproc/preprocessor.ts`
- `/src/server/source/fileSource.ts`
---

## Herkunfts-Mapping des expandierten Textes

`ExpandedSource` repräsentiert den vollständigen expandierten Text als Folge
von Fragmenten. Unverändert übernommene Quelltextbereiche besitzen eine
zeichengetreue Zuordnung (`direct`); erzeugter Makrotext besitzt einen Anker
an seiner Makroverwendung (`generated`). Includes behalten ihre jeweilige
`FileSource` als physische Herkunft.

Eine normale `Location` bezeichnet weiterhin genau einen zusammenhängenden
Bereich innerhalb **einer** `Source`. Zwei unterschiedliche Ursprünge dürfen
nicht zu einem erfundenen, zusammenhängenden Quelltextbereich verschmolzen
werden.

- `Source.mapLocation()` und `mapToOriginalLocation()` liefern weiterhin die
  primäre Position. Bei einem Token aus verschiedenen Fragmenten bleibt der
  erste Ursprungsabschnitt der Anker.
- Direkt benachbarte, unverändert übernommene Fragmente derselben physischen
  Quelle können verlustfrei zu einem vollständigen Bereich zusammengefasst
  werden.
- `Source.mapLocations()` (optional) und `mapToOriginalLocations()` geben alle
  beitragenden Ursprungsbereiche in Ausgabereihenfolge zurück, auch über
  verschachtelte Sources hinweg.

Die Mehrfachherkunft ergänzt das bisherige Mapping; sie ersetzt weder
`Location` noch `SourceValue`. Bestehende LSP-Funktionen dürfen für ihre
primäre Navigationsposition weiterhin das einfache Mapping verwenden.

Referenzimplementierungen:
- `/src/server/source/source.ts`
- `/src/server/source/expandedSource.ts`
- `/src/server/source/fileSource.ts`
- `/src/server/core/sourceOffset.ts`
---

## ConditionStack

Der Präprozessor verwaltet den aktuellen Zustand bedingter Übersetzung mit
einem `ConditionStack`.

Jeder Eintrag beschreibt den Zustand eines geöffneten

- `#ifdef`
- `#ifndef`

Blocks.

Der Stack entscheidet darüber, ob die Eingabe aktuell verarbeitet oder
übersprungen wird. Aus deaktivierten Zweigen dürfen keine compilerseitig
wirksamen Textfragmente oder Kommentare entstehen.

Die eigentliche Makroverwaltung bleibt davon vollständig unabhängig.

Diese Trennung vereinfacht sowohl die Implementierung als auch spätere
Erweiterungen der bedingten Übersetzung.

Nach Verlassen eines Bedingungsblocks wird der vorherige Zustand automatisch
wiederhergestellt.

---

## Präprozessordirektiven

Präprozessordirektiven werden ausschließlich vom Präprozessor verarbeitet.

Beispiele:

- `#define`
- `#undef`
- `#ifdef`
- `#ifndef`
- `#include`

Sie erscheinen niemals im AST.

---

## Vollständigen Quelltext erzeugen

Der erste Lexer erkennt die ursprünglichen Präprozessordirektiven und die
Kommentare im Eingabetext. Der externe Präprozessor verarbeitet diesen
Tokenstrom, entfernt Direktiven und inaktive Zweige, expandiert Makros
zeichenweise und fügt Includes ein. Dabei erhält er notwendige
Zeilenumbrüche und unveränderten Whitespace, ohne Trennzeichen zwischen
Makrofragmenten zu erfinden.

`ExternalPreprocessorResult` umfasst:

- `source`: den vollständig expandierten Text als `ExpandedSource`,
- `macroReferences`: Referenzen für die LSP-Makronavigation,
- `conditionalBlocks`: Metadaten bedingter Übersetzung.

Der Validator lexikalisiert die gesamte `ExpandedSource` mit einem **zweiten
PEARL-Lexer** und übergibt dessen Tokens über `ArrayTokenStream` an den Parser.
Compiler und LSP beziehen Makroreferenzen aus
`ExternalPreprocessorResult.macroReferences`; parallele veraltete
Referenzsammlungen dürfen nicht zur primären Quelle werden.

Referenzimplementierungen:
- `/src/server/preproc/preprocessor.ts`
- `/src/server/preproc/externalPreprocessorResult.ts`
- `/src/server/validation/validator.ts`
---

## Einheitliche Textpipeline und Kompatibilitätsadapter

Die maßgebliche externe Verarbeitung ist `Preprocessor.createExpanded()`:

```text
Originaldatei
  -> erster Lexer (Präprozessordirektiven und Originalkommentare)
  -> externer Präprozessor (Makros, Bedingungen, Includes)
  -> ExternalPreprocessorResult / ExpandedSource
  -> zweiter Lexer (vollständige PEARL-Lexik)
  -> TokenStream / Parser -> AST -> Semantik -> LSP
```

`Preprocessor.create()` bleibt als Kompatibilitätseinstieg für vorhandene
Parser- und Semantiktests erhalten, führt jedoch **dieselbe Textpipeline** aus
und liefert erst nach dem zweiten Lexer einen `TokenStream` zurück.
Es darf keine zweite tokenbasierte Makroexpansionslogik daneben entstehen.

Der Präprozessor kennt keine PEARL-Grammatik und erzeugt keinen AST. Damit
bleiben die Verantwortlichkeiten von Präprozessor, Lexer und Parser getrennt.

Referenzimplementierungen:
- `/src/server/preproc/preprocessor.ts`
- `/src/server/lexer/arrayTokenStream.ts`
---

## Informationen für den LSP erhalten

Informationen, die ausschließlich während der Präprozessierung bekannt sind und später für Editorfunktionen benötigt werden, sollen bereits im Präprozessor gesammelt und nicht nachträglich rekonstruiert werden.

Beispiele sind

- Makroreferenzen
- inaktive Quelltextbereiche
- Include-Hierarchie
- weitere präprozessorspezifische Metadaten

---

# Lexer

Der Lexer zerlegt den Quelltext in eine Folge objektiv erkennbarer Token.

Er trifft ausschließlich lexikalische Entscheidungen und enthält keine
grammatikspezifischen oder semantischen Regeln.

---

## Klare Trennung von Lexer und Parser

Der Lexer erkennt ausschließlich Zeichenfolgen.

Der Parser entscheidet, ob ein Token an der aktuellen Grammatikstelle zulässig
ist.

Beispiele:

- Hexzahlen
- Bezeichner
- Zeichenketten
- Operatoren

Dadurch bleibt der Lexer unabhängig von der Grammatik.

---

## Objektive Tokenisierung

Der Lexer entscheidet ausschließlich anhand des Quelltextes.

Er versucht niemals, die Bedeutung eines Tokens zu erraten.

Beispiel:

```
0240FFFC
```

wird stets als Hexziffernfolge erkannt.

Ob diese an der aktuellen Grammatikstelle zulässig ist, entscheidet ausschließlich
der Parser.

---

## Fachliche Token statt Textanalysen

Wiederkehrende fachliche Zeichenfolgen erhalten eigene Tokenarten.

Beispiele:

- `HexDigitSequence`
- `BitStringLiteral`
- `CharacterStringLiteral`

Dadurch entfallen spätere Textanalysen oder reguläre Ausdrücke im Parser.

Referenzimplementierung:
- `/src/server/lexer/token.ts`

### Mehrdeutige Hexziffernfolgen am Anfang eines Identifiers (0.3.2)

Im RTOS-UH-SYSTEM-Teil sind unpräfixierte Hexwerte zulässig, die mit
`A` bis `F` anfangen, beispielsweise `BU(FF0F0006,8)` (RTOS-UH 6.2)
oder `EV(ABCDEF12)`. Diese Zeichenfolgen entsprechen zugleich der
lexikalischen Schreibweise normaler Bezeichner (`DCL FACE FIXED;`).

Ein globales Umtokenisieren in `HexDigitSequence` würde gültige Bezeichner
zerstören und verstieße gegen die kontextfreie Lexerentscheidung.
Daher gilt:

- Der Lexer erzeugt weiterhin `TokenKind.Identifier` und kennzeichnet
  ausschließlich lexikalisch, ob alle Zeichen Hexziffern sind
  (`Token.hexDigitIdentifier`). `HexDigitSequence` für ziffernbeginnende
  Hexfolgen bleibt bestehen.
- Nur die Parserprimitive `acceptHexDigitSequence()` berücksichtigt bei
  entsprechendem Grammatikbedarf auch diese gekennzeichneten Identifier.
  `parseHexNumber()` bleibt die gemeinsame Schnittstelle für `BU` und `EV`.
- Normale Identifier-Produktionen bleiben unverändert. Weder Parser noch
  Semantik zerlegen dazu Tokens nachträglich oder verwenden reguläre
  Ausdrücke zur Erkennung der Zeichenfolge.
- Die TextMate-Farbgebung ist hiervon unabhängig und entscheidet nicht über
  die syntaktische Zulässigkeit.

---

## Zwei Sichten auf Quelltextpositionen

Während der Präprozessierung entstehen zwei gleichberechtigte Sichtweisen auf
eine Position im Quelltext.

### Compilersicht

Die Compilersicht beschreibt nach der externen Präprozessierung die Position
im vollständig expandierten Text (`ExpandedSource`). Der zweite Lexer und die
compilerseitige Kommentarverarbeitung verwenden diese gemeinsame Quelle.

Originaltokens des ersten Lexers besitzen dagegen Positionen in der jeweiligen
Eingabe-`Source`. Solche Positionen dürfen nicht ohne explizite Zuordnung mit
Offsets aus der `ExpandedSource` verglichen werden.

### Editorsicht

Die Editorsicht beschreibt die Position des Quelltexts, den der Benutzer
tatsächlich geschrieben hat.

Sie wird für sämtliche LSP-Funktionen verwendet, beispielsweise

- Hover
- Go to Definition
- Peek Definition
- Diagnosen
- Semantic Tokens

### Explizites Location-Mapping

Eine `Location` beschreibt zunächst immer die Position innerhalb ihrer
aktuellen `Source`.

Die Abbildung auf die ursprüngliche Quelldatei erfolgt bewusst nicht
automatisch.

Stattdessen wird sie bei Bedarf explizit über `Source.mapLocation()` bzw.
`mapToOriginalLocation()` durchgeführt. Wenn mehrere Ursprungsbereiche
benötigt werden, stehen ergänzend `Source.mapLocations()` und
`mapToOriginalLocations()` zur Verfügung.

Dadurch kann jede Compilerphase selbst entscheiden, welche Sicht auf den
Quelltext benötigt wird.

Diese Trennung vermeidet implizite Positionsumrechnungen und macht den
Übergang zwischen Compiler- und Editorsicht jederzeit nachvollziehbar.

---

## Quelltextpositionen

Der Lexer erzeugt für jedes Token eine vollständige `Location`.

Eine `Location` beschreibt einen Bereich innerhalb einer `Source` ausschließlich
durch Offsets.

Dadurch können Positionen effizient verglichen, verschoben und auf andere
Quellen abgebildet werden.

Die Umrechnung in Zeilen- und Spaltennummern erfolgt erst bei der Kommunikation
mit dem Language Server Protocol.

Referenzimplementierung:
- `/src/server/core/location.ts`

---

## Source-Mapping

Die Tokens des zweiten Lexers besitzen `Location`s in der `ExpandedSource`.
Diese Positionen sind für zusammenhängende compilerseitige Analysen geeignet.

Für LSP-Ausgaben wird die Herkunft explizit über
`mapToOriginalLocation()` ermittelt. `mapToOriginalLocations()` kann bei
Fragmenten mit unterschiedlicher Herkunft zusätzlich alle ursprünglichen
Bereiche erhalten. Eine einzelne `Location` kann solche nicht zusammenhängenden
Ursprünge nicht vollständig repräsentieren.

Parser und AST behalten die vorhandenen Regeln für `SourceValue` und originale
Editorpositionen. Wo die Auswertung *lexikalische Nachbarschaft* im expandierten
Text benötigt (insbesondere die Zuordnung von Parameternamen aus Kommentaren),
steht die lexikalische Position zusätzlich zur Verfügung.

Referenzimplementierungen:
- `/src/server/core/sourceOffset.ts`
- `/src/server/core/sourceValue.ts`
- `/src/server/parser/parserBase.ts`
---

## Zwei Kommentarsichten

Kommentare gehören nicht zur PEARL-Grammatik. In der Präprozessorpipeline
gibt es jedoch **zwei bewusst unterschiedliche Kommentarsichten**:

- **Originalkommentare:** Der erste Lexer erkennt Kommentare im geschriebenen
  Quelltext. Diese Sicht wird für editorbezogene Funktionen wie Folding und
  die Anzeige ursprünglich geschriebener Kommentare benötigt.
- **Compilerkommentare:** Der zweite Lexer erkennt Kommentare im vollständig
  expandierten Text. Nur diese Sicht ist maßgeblich für compilerseitige
  Optionen, semantische Auswertungen und die Dokumentation von Parametern.

Durch Makroexpansion erzeugte `/*`- und `*/`-Grenzen gehören zur zweiten Sicht.
Kommentare in deaktivierten Präprozessorzweigen dürfen die Compilersicht nicht
beeinflussen. Compiler-Steuerkommentare und AST-Positionen müssen für direkte
Positionsvergleiche auf dieselbe `Source` bezogen sein.

Referenzimplementierungen:
- `/src/server/validation/validator.ts`
- `/src/server/validation/analysis.ts`
---

## Whitespace und Kommentare

Leerzeichen und Tabulatoren besitzen in der PEARL-Grammatik gewöhnlich keine
syntaktische Bedeutung. Für die **Textexpansion** ist ihr Erhalt jedoch wichtig:
Der externe Präprozessor übernimmt unveränderte Zwischenräume und notwendige
Zeilenumbrüche aus dem Originaltext.

Zeilenumbrüche und Kommentare werden als eigene Tokens erkannt. Der Parser
überspringt solche Trivia im Allgemeinen mit `skipTrivia()`; die endgültige
Tokenisierung erfolgt aber erst nach dem Zusammenbau des gesamten Textes.

Insbesondere darf der Präprozessor an Fragmentgrenzen weder bestehende
Trennung unabsichtlich verlieren noch zusätzliche Trennung erfinden.

---

## Präprozessordirektiven

Externe Präprozessordirektiven werden vom **ersten** Lexer erkannt und als
eigene Tokenarten erzeugt.

Beispiele:

- `#define`
- `#undef`
- `#ifdef`
- `#ifndef`
- `#include`

Der Lexer interpretiert diese Direktiven jedoch nicht.

Ihre Verarbeitung erfolgt ausschließlich im Präprozessor.

Der Parser erhält diese Direktiven niemals zu Gesicht, da sie vor dem
zweiten Lexer vom externen Präprozessor vollständig verarbeitet wurden.

---

## Fehler möglichst lokal erkennen

Lexikalische Fehler werden bereits vom Lexer erkannt und gemeldet.

Beispiele:

- ungültige Escape-Sequenzen
- unvollständige Zeichenketten
- nicht abgeschlossene Blockkommentare

Der Lexer versucht anschließend, den Tokenstrom möglichst vollständig
fortzusetzen.

---

## Lexer als Quelltextanalysator

Der Lexer erzeugt nicht nur Token.

Er sammelt zusätzlich Informationen, die ausschließlich während der
lexikalischen Analyse objektiv erkannt werden können.

Beispiele:

- Tokenstrom
- Blockkommentare
- Compiler-Steuerkommentare

Weitere editorrelevante Informationen sollen ebenfalls bereits im Lexer
gewonnen werden, sofern sie ausschließlich dort eindeutig erkannt werden
können.

## Informationen möglichst früh gewinnen

Informationen, die in einer Compilerphase eindeutig erkannt werden können,
sollen bereits dort gewonnen und für spätere Phasen erhalten bleiben.

Sie sollen nicht später aus anderen Datenstrukturen rekonstruiert werden.

Beispiele:

- Token → Lexer
- Blockkommentare → Lexer
- Makroreferenzen → Präprozessor
- Sprachelemente → AST

# SourceValue

`SourceValue<T>` verbindet einen fachlichen Wert mit seiner Position im
Quelltext.

Es bildet die zentrale Verbindung zwischen Parser, AST und LSP.

Referenzimplementierung:
- `/src/server/core/sourceValue.ts`

---

## Motivation

Nicht jeder Bestandteil eines AST-Knotens besitzt eine Position im Quelltext.

Beispiel:

```pearl
MODULE Test;
```

Der AST-Knoten `ModuleNode` repräsentiert die gesamte Moduldeklaration.

Im Quelltext existieren jedoch zwei unterschiedliche Sprachelemente:

- `MODULE`
- `Test`

Beide benötigen

- Hover
- Go to Definition
- Semantic Tokens
- weitere Editorfunktionen

Ein einzelner `Location`-Eintrag im AST-Knoten wäre dafür ungeeignet.

---

## Positionen gehören zu Sprachelementen

Positionen gehören nicht zu AST-Knoten, sondern zu den tatsächlich im
Quelltext vorkommenden Sprachelementen.

Deshalb besitzt nicht der AST-Knoten eine Position, sondern jedes
`SourceValue`.

Beispiele:

- Schlüsselwörter
- Bezeichner
- Literale
- Operatoren (falls erforderlich)

Dadurch können Editorfunktionen einzelne Sprachelemente eines Knotens
unterscheiden.

---

## Syntax bleibt vollständig erhalten

Ein `SourceValue` enthält sowohl

- den fachlichen Wert
- die Position im Quelltext

Dadurch muss der Parser keine getrennten Datenstrukturen für Werte und
Quelltextpositionen verwalten.

---

## Grundlage für LSP-Funktionen

`SourceValue` bildet die Grundlage für

- Hover
- Go to Definition
- Peek Definition
- Semantic Tokens
- zukünftige Refactorings

Der AST beschreibt die syntaktische Struktur.

`SourceValue` beschreibt die einzelnen Sprachelemente innerhalb dieser
Struktur.

---

# Abstract Syntax Tree (AST)

Der Abstract Syntax Tree (AST) beschreibt ausschließlich die syntaktische
Struktur eines PEARL-Programms.

Er bildet die gemeinsame Grundlage für

- semantische Analyse
- Hover
- Go to Definition
- Folding
- weitere LSP-Funktionen

Referenzimplementierung:
- `/src/server/ast/astNode.ts`
- `/src/server/ast/astKind.ts`

---

## Syntax und Semantik trennen

Der AST beschreibt ausschließlich die erkannte Grammatik.

Er enthält insbesondere keine Informationen über

- Symbolauflösung
- Typen
- Sichtbarkeiten
- Verwendungen
- Gültigkeit eines Sprachkonstrukts

Diese Informationen werden ausschließlich in späteren Compilerphasen bestimmt.

Dadurch bleibt der AST unabhängig von der semantischen Analyse.

---

## AST-Knoten entsprechen Grammatikproduktionen

Jeder AST-Knoten repräsentiert genau eine Produktion der Grammatik.

Beispiele:

- `ModuleNode`
- `ProblemPartNode`
- `ProcedureNode`
- `TaskNode`

Der Aufbau des AST soll die Grammatik möglichst unmittelbar widerspiegeln.

Referenzimplementierung:
- `/src/server/ast/module/moduleNode.ts`

---

## AST-Knoten besitzen keine Quelltextposition

`AstNode` besitzt selbst bewusst keine eigene `Location`, die seine Position und Ausdehnung beschreibt.

Ein AST-Knoten beschreibt eine syntaktische Konstruktion.

Quelltextpositionen gehören dagegen ausschließlich zu den tatsächlich im
Quelltext vorkommenden Sprachelementen und werden deshalb durch
`SourceValue<T>` repräsentiert.

Dadurch bleibt die Zuordnung zwischen Sprachelement und Quelltext eindeutig.

Referenzimplementierung:
- `/src/server/ast/module/moduleNode.ts`

---

## AST-Knoten kennen ihre Kinder

Jeder AST-Knoten verwaltet ausschließlich seine unmittelbaren Kindknoten.

Die Baumstruktur entsteht durch explizites Einhängen der Kinder.

Dadurch bleibt die AST-Struktur unabhängig von späteren Compilerphasen.

---

## Sprachelemente werden durch SourceValue beschrieben

Alle im Quelltext vorkommenden Sprachelemente werden durch `SourceValue<T>`
repräsentiert.

Beispiele:

- Schlüsselwörter
- Bezeichner
- Literale

Ein `SourceValue` enthält

- den fachlichen Wert
- seine Position im Quelltext

Dadurch können mehrere Sprachelemente innerhalb desselben AST-Knotens
unabhängig voneinander verwendet werden.

AST-Knoten setzen sich aus mehreren `SourceValue`s sowie ihren Kindknoten
zusammen.

Beispiel:

```text
ModuleNode

    keyword : SourceValue<String>
    name    : SourceValue<String>
    modend  : SourceValue<String>
```

Dadurch spiegeln AST und Quelltext dieselbe Struktur wider.

Referenzimplementierung:
- `/src/server/core/sourceValue.ts`
- `/src/server/ast/module/moduleNode.ts`

---

## Lookup erfolgt im AST

Jeder AST-Knoten implementiert

```ts
lookupSourceValue(position: SourceOffset): AstLookupResult | undefined
```

`SourceOffset` enthält die URI der physischen Quelldatei und einen Offset
innerhalb dieser Datei. Ein gleich großer Offset in einer anderen Includedatei
ist **kein** gültiger Treffer. `SourceValue` und das Herkunfts-Mapping
ermöglichen diese quellbewusste Suche auch innerhalb eines gemeinsam
präprozessierten AST.

Diese Methode entscheidet

- welche `SourceValue`s zum Knoten gehören,
- welche Kindknoten durchsucht werden.

Dadurch bleibt das Wissen über die syntaktische Struktur vollständig im
jeweiligen AST-Knoten.

Referenzimplementierung:
- `/src/server/ast/module/moduleNode.ts`

---

## AstLookupResult

Ein `AstLookupResult` beschreibt das Ergebnis einer Positionssuche.

Er enthält

- den gefundenen AST-Knoten
- das zugehörige Sprachelement (`SourceValue`)

Dadurch können Editorfunktionen zwischen verschiedenen Sprachelementen
desselben Knotens unterscheiden.

Beispiel:

```pearl
MODULE Test;
```

liefert unterschiedliche Ergebnisse für

- `MODULE`
- `Test`

obwohl beide demselben `ModuleNode` angehören.

Referenzimplementierung:
- `/src/server/ast/astLookupResult.ts`

---

## Dokumentation gehört zum AST

Jeder AST-Knoten kann einen `DocumentationProvider` bereitstellen.

Der `DocumentationProvider`

- kennt ausschließlich seinen eigenen Knotentyp,
- kennt keine Kindknoten,
- erhält das `AstLookupResult`.

Die Suche nach dem passenden Sprachelement erfolgt vollständig durch den AST.

Dadurch bleiben Dokumentation und Baumstruktur sauber getrennt.

Referenzimplementierung:
- `/src/server/ast/astNode.ts`
- `/src/server/ast/module/moduleNode.ts`
- `/src/server/documentation/documentationProvider.ts`
- `/src/server/documentation/moduleDocumentationProvider.ts`

---

## AST als zentrale Infrastruktur

Der AST bildet die gemeinsame Infrastruktur für sämtliche höheren
Compiler- und Editorfunktionen.

Neue Sprachkonstrukte sollen deshalb möglichst ausschließlich

- einen Parser,
- einen AST-Knoten
- und gegebenenfalls einen `DocumentationProvider`

benötigen.

Vorhandene Infrastruktur wie

- Hover
- Go to Definition
- Folding

soll dadurch ohne Änderungen weiterverwendet werden.

---

## AST-Knoten sind weitgehend passiv

AST-Knoten speichern in erster Linie die syntaktische Struktur des Programms.

Sie enthalten nur solches Verhalten, das unmittelbar zu dieser Struktur gehört.

Beispiele:

- Verwaltung der Kindknoten
- Lookup von Sprachelementen
- Bereitstellung des DocumentationProviders

Semantische Analysen oder komplexe Auswertungen erfolgen dagegen in
separaten Visitoren oder Analysephasen.

# Language Server Protocol (LSP)

Der LSP bildet die Schnittstelle zwischen Editor und Compiler.

Seine Aufgabe besteht darin, Editoranfragen auf die internen Compilerstrukturen
abzubilden.

Der LSP enthält deshalb möglichst keine sprachspezifische Logik.

---

## Compiler als Grundlage des LSP

Der LSP arbeitet ausschließlich auf den Ergebnissen der Compilerphasen.

Insbesondere verwendet er

- AST
- Präprozessorinformationen
- Symboltabelle
- semantische Analyse

Dadurch existiert jede Sprachinformation nur an einer Stelle.

---

## Compilerphasen bleiben unabhängig

Die einzelnen Compilerphasen kennen den LSP nicht.

Insbesondere wissen

- Lexer
- Präprozessor
- Parser
- Semantik

nichts über Hover, Folding oder Go to Definition.

Der LSP greift ausschließlich lesend auf die Analyseergebnisse zu.

---

## Gemeinsame Infrastruktur

Möglichst viele LSP-Funktionen sollen dieselbe Infrastruktur verwenden.

Beispiele:

- Hover
- Go to Definition
- Peek Definition

verwenden dieselbe Positionssuche im AST.

Dadurch müssen neue Sprachelemente nur einmal in die gemeinsame
Infrastruktur integriert werden.

---

## Sprachelemente statt AST-Knoten

Editorfunktionen arbeiten auf Sprachelementen (`SourceValue`) und nicht auf
ganzen AST-Knoten.

Dadurch können unterschiedliche Bestandteile desselben AST-Knotens
unterschiedliche Informationen liefern.

Beispiel:

```pearl
MODULE Test;
```

liefert unterschiedliche Ergebnisse für

- `MODULE`
- `Test`

obwohl beide zum selben `ModuleNode` gehören.

---

## Hover

Für PEARL-Sprachelemente wird Hover über die Positionssuche im AST und
`DocumentationProvider` realisiert. Das Ergebnis wird als `AstLookupResult`
weitergegeben; ein Provider beschreibt dabei seine eigene AST-Struktur.

Präprozessorkonstrukte sind **keine AST-Knoten**. Ihre Hover-Informationen
werden aus den eigens erhaltenen Makroreferenzen bzw. Metadaten bedingter
Übersetzung gewonnen. Diese Erkennung muss vor einem irreführenden AST-Lookup
in den expandierten Text möglich sein.

Referenzimplementierungen:
- `/src/server/documentation/documentationProvider.ts`
- `/src/server/documentation/macroDocumentationProvider.ts`
- `/src/server/ast/astLookupResult.ts`
- `/src/server/server.ts`
---

## Go to Definition

Für normale PEARL-Sprachelemente nutzt die Navigation die AST-Positionssuche,
die Semantik und die Symbolbindung.

Für Makroverwendungen wird zuerst die vom Präprozessor überlieferte
`MacroReference` ausgewertet. Ihre originale Verwendungsposition kann sonst
mit einem ganz anderen, aus der Makroexpansion entstandenen AST-Sprachelement
zusammenfallen. Erst wenn keine Präprozessorreferenz zutrifft, greift die
semantische Navigation.

Referenzimplementierungen:
- `/src/server/ast/astLookupResult.ts`
- `/src/server/preproc/macroReference.ts`
- `/src/server/server.ts`
---

## Folding

Folding hat zwei voneinander getrennte Informationsquellen:

- **Physische Quelltextstruktur:** Mehrzeilige Blockkommentare und die
  syntaktische Schachtelung von `#ifdef`, `#ifndef`, `#else` und `#endif`
  werden lexikalisch aus dem *geöffneten Dokument* ermittelt, unabhängig
  von einer Übersetzungseinheit, der Makroauswertung oder einem ausgewählten
  Include-Vorkommen. Das funktioniert bereits vor Abschluss einer Analyse.
- **AST-Struktur:** Sprachkonstrukte wie Prozeduren werden aus dem AST
  ergänzt, sofern ein gültiger Analysekontext vorliegt. Bei einer mehrfach
  eingebundenen Datei muss dafür das konkrete Include-Vorkommen bekannt sein.

  Mehrzeilige `STRUCT [...]`-Typen (`TYPE`, `DCL` und verschachtelte
  Strukturen) liefern ebenfalls AST-Faltungsbereiche. `StructTypeParser`
  bewahrt dafür neben dem `STRUCT`-Schlüsselwort auch die Originalposition
  der schließenden `]` als `SourceValue` auf; `StructTypeNode` erzeugt den
  Faltungsbereich nur, wenn beide Grenzen zur angefragten `Source` gehören.
  Ohne schließende Klammer oder bei inaktiver Expansion entsteht keine
  AST-Faltungsregion. Ein Include-Guard bleibt unabhängig davon physisch
  faltbar.

Die Bedingungsauswertung eines Include-Guards beeinflusst die Abdunklung,
**nicht** die Faltbarkeit seiner Direktiven. Für die physischen Bereiche
wird die bereits vorhandene `Lexer`-Infrastruktur verwendet; es gibt keinen
zweiten Parserlauf. Beide Arten von Faltungsbereichen werden auf die
Originalpositionen abgebildet und vor der LSP-Antwort dedupliziert.

Eine Folding-Anfrage darf nicht allein wegen eines fehlenden
`AnalysisResult` oder einer fehlenden CodeLens-Auswahl mit `[]`
beantwortet werden. Der Folding-Refresh wird weiterhin benötigt, wenn
nachträglich kontextabhängige AST-Bereiche hinzukommen.

---

## Positionen

Alle an den Editor zurückgegebenen Positionen beziehen sich auf den
ursprünglichen Quelltext.

Vor der Übergabe an den LSP werden Positionen deshalb gegebenenfalls über
das Source-Mapping auf ihre Ursprungsdatei zurückgeführt.

Dadurch arbeiten sämtliche Editorfunktionen auf dem Quelltext, den der
Benutzer tatsächlich bearbeitet.

---

## LSP-spezifische Hilfsklassen

Die Umwandlung zwischen Compilerdatenstrukturen und LSP-Datenstrukturen
erfolgt in eigenen Mapper-Klassen.

Beispiele:

- `DiagnosticMapper`
- `LspLocationMapper`

Dadurch bleiben Compiler und LSP sauber voneinander getrennt.

---

## Editorfunktionen entstehen aus Compilerinformationen

Neue LSP-Funktionen sollen nach Möglichkeit ausschließlich vorhandene
Compilerinformationen verwenden.

Beispiele:

- Hover → AST/DocumentationProvider oder Präprozessormetadaten
- Go to Definition → Symbolbindung oder Makroreferenzen
- Folding → AST, Originalkommentare und Präprozessorinformationen
- Semantic Tokens → AST und Semantik

Es sollen keine editor­spezifischen Parallelstrukturen aufgebaut werden.

---

## Compiler und LSP gemeinsam entwickeln

Die Architektur des Compilers wird bewusst so gestaltet, dass sie
Editorfunktionen unterstützt.

Umgekehrt sollen neue LSP-Funktionen möglichst ohne Änderungen an den
Compilerphasen realisierbar sein.

Compiler und LSP werden daher nicht als zwei getrennte Systeme betrachtet,
sondern als zwei unterschiedliche Sichten auf dieselbe Programmanalyse.

# Analyseverwaltung und Open Folder (Dev_0_3)

## Übersetzungseinheiten statt isolierter Includes

Eine **Übersetzungseinheit** beginnt bei einer vollständigen PEARL-Hauptdatei.
Sie wird als Ganzes vorverarbeitet, geparst und semantisch analysiert.
Includedateien sind Teile dieser Übersetzungseinheit; sie benötigen weder
einen künstlichen `MODULE`-/`PROBLEM`-Rahmen noch einen eigenen Fragmentparser.
Die Compilerpipeline bleibt unabhängig davon, ob die Analyse durch „Open File“
oder durch einen geöffneten Ordner ausgelöst wurde.

`Validator.analyze()` liefert ein `AnalysisResult` mit `rootAnalysis`,
aggregierten Problemen und Präprozessorinformationen sowie den tatsächlich
aktiven Includes (`includedSourceUris`). Die derzeitige `files`-Zuordnung
enthält im regulären Validatorlauf eine `Analysis` für die Hauptdatei; sie
ist **keine** eigene AST- oder Semantikanalyse je Include-Datei. Die
physische Herkunft eingebundener Sprachelemente wird durch das bestehende
Source-Mapping erhalten.

Referenzimplementierungen:
- `/src/server/validation/validator.ts`
- `/src/server/validation/analysis.ts`
- `/src/server/validation/analysisResult.ts`

---

## Verantwortlichkeiten der Infrastruktur

Die Verwaltung von Analyseergebnissen, Dateibeziehungen und LSP-Darstellung
ist getrennt:

- **`DocumentRegistry`** stellt offene Editor-Dokumente und bei Bedarf Dateien
  vom Dateisystem bereit. Sie verwaltet Analyseergebnisse pro Hauptdatei,
  Versionen, aktive Include-Abhängigkeiten, Invalidierung und die Auswahl des
  semantischen Include-Kontexts.
- **`FolderTranslationUnitIndex`** erkennt vollständige `.P`-Hauptdateien
  direkt in den vom `WorkspaceManager` gelieferten Ordnern. Er untersucht
  weder PEARL-Grammatik noch Include-Anweisungen und besitzt keine
  Analyseergebnisse.
- **`DiagnosticPublicationManager`** verwaltet die an den Editor gemeldeten
  Diagnosen getrennt nach Übersetzungseinheit und physischer Quelldatei.
  Seine Aufgabe ist Veröffentlichung, nicht syntaktische oder semantische
  Analyse.
- **`server.ts`** verbindet diese Komponenten mit dem LSP-Lebenszyklus.
  Compilerphasen und AST kennen weder Workspace-Ordner noch CodeLens oder
  die Darstellung von Diagnosen.

Eine zusätzliche, parallele Compilerpipeline für Includedateien oder eine
zweite unabhängige Analyseverwaltung darf daraus nicht entstehen.

Referenzimplementierungen:
- `/src/server/utility/documentRegistry.ts`
- `/src/server/utility/folderTranslationUnitIndex.ts`
- `/src/server/utility/workspace.ts`
- `/src/server/lsp/diagnosticPublicationManager.ts`
- `/src/server/server.ts`

---

## Analyseplanung der Übersetzungseinheiten (AnalysisScheduler)

Der LSP besitzt einen zentralen `AnalysisScheduler` für vollständige
Übersetzungseinheiten. Die Ausführung eines Auftrags wird über eine
`AnalysisRequest` beschrieben (Hauptdatei-URI, Anforderungskennung, Auslöser,
Priorität). **Die `DocumentRegistry` bleibt alleinige Instanz für aktive
Übersetzungseinheiten, Include-Abhängigkeiten, Dokumentversionen und
Gültigkeit von Analyseergebnissen.** Der Scheduler speichert lediglich noch
nicht ausgeführte Aufträge, keine ASTs oder Compilerergebnisse.

- Jede Anforderung wird **vor dem Einreihen** durch
  `DocumentRegistry.beginAnalysis()` gekennzeichnet. So kann ein neuer Auftrag
  auch eine bereits gestartete, aber noch nicht übernommene Analyse überholen.
  `isCurrentAnalysis()` bleibt die maßgebliche Prüfung vor der Ausführung und
  vor der Ergebnisübernahme.
- Für eine Hauptdatei existiert höchstens **ein ausstehender Auftrag**.
  Spätere Anforderungen ersetzen die ältere Warteschlangenposition; die
  höchste vorhandene Priorität (`interactive` vor `background`) bleibt erhalten.
  Eine bereits laufende synchrone Analyse lässt sich dadurch nicht abbrechen.
- Änderungen während der Eingabe werden mit einer kurzen, nachlaufenden
  Wartezeit gebündelt (derzeit 200 ms). Die Invalidierung betroffener Analysen
  erfolgt dagegen **sofort** und niemals erst nach Ablauf des Debounce-Timers.
  Workspace-Scans, Dateiwächter und Konfigurationsänderungen erzeugen selbst
  keinen neuen Eingabe-Timer. Steht für dieselbe Hauptdatei bereits ein
  interaktiver Auftrag an, kann dessen Debounce-Fenster erhalten bleiben.
- Interaktive Aufträge werden vor Hintergrundaufträgen ausgeführt. Ein
  interaktiver Auftrag in seiner Debounce-Phase verhindert, dass unmittelbar
  vorher ein möglicherweise lang laufender Hintergrundauftrag beginnt.
- Der Scheduler führt derzeit **höchstens einen Analyseauftrag zur gleichen
  Zeit** aus und gibt zwischen Übersetzungseinheiten an den Node.js-Event-Loop
  zurück. Der lokale Executor führt `Validator.analyze()` weiterhin im
  Hauptthread aus. Innerhalb dieses synchronen CPU-Anteils bleibt der
  Hauptthread blockiert. Echte CPU-Parallelität und die sofortige Bearbeitung
  von CodeLens-Anfragen während eines Validatorlaufs sind damit noch nicht
  erreicht.
- Beim Schließen oder Entfernen einer Übersetzungseinheit werden ausstehende
  Aufträge entfernt; eine bereits laufende Analyse wird zusätzlich über die
  Anforderungskennung bei der Ergebnisübernahme abgewiesen.

Die Ausführung wird über einen `AnalysisExecutor` vom Scheduling getrennt.
Weder Executor noch Scheduler dürfen eigene semantische Analyseergebnisse
verwalten oder den Präprozessor und Includedateien als selbständige
Übersetzungseinheiten neu interpretieren. Ein Worker-Executor darf diese
Abstraktion später ergänzen.

Referenzimplementierungen:
- `/src/server/utility/analysisScheduler.ts`
- `/src/server/utility/analysisExecutor.ts`
- `/src/server/utility/localAnalysisExecutor.ts`
- `/src/server/utility/documentRegistry.ts`
- `/src/server/server.ts`

---

## Ausführung der Analyse (AnalysisExecutor)

Die **Analyseplanung** (`AnalysisScheduler`) und die **Durchführung der
Compilerpipeline** (`AnalysisExecutor`) haben unterschiedliche Aufgaben:

- Der Scheduler hält nur ausstehende `AnalysisRequest`s vor und bestimmt ihre
  Reihenfolge. Er kennt keine Compilerinstanz, Source-Mappings oder ASTs.
- `server.ts` ermittelt **erst beim Start des Auftrags** den aktuellen Snapshot
  der PEARL-Hauptdatei und die zugehörigen Einstellungen. Die
  `AnalysisExecutionInput` enthält URI, Sprachkennung, Version und vollständigen
  Text der Hauptdatei sowie eine Kopie der Einstellungen einschließlich der
  Makrodefinitionen. Die ursprüngliche `AnalysisRequest` mit `requestId`
  verbleibt in der LSP-Orchestrierung.
- `LocalAnalysisExecutor` erstellt aus diesem Snapshot ein `TextDocument`
  und delegiert an die bestehende `Validator.analyze()`-Pipeline. Er verwaltet
  weder `DocumentRegistry` noch Diagnosen oder LSP-Anfragen. Die bestehende
  Validatorinstanz verwendet für die Include-Auflösung weiterhin die vom LSP
  bereitgestellte `DocumentRegistry`.
- Der Executor liefert ein `AnalysisResult`, **ohne es selbst zu registrieren**.
  Ausschließlich `server.ts` prüft nach der Rückkehr Dokumentversion und
  `DocumentRegistry.isCurrentAnalysis()`, übernimmt gültige Ergebnisse in die
  Registry und stößt Diagnoseveröffentlichung sowie LSP-Refreshes an.
- Die lokale Ausführung bewahrt das bisherige Zeitverhalten: Der CPU-intensive
  Teil von `Validator.analyze()` beginnt bereits beim Executor-Aufruf. Der
  Executor führt derzeit keine Hintergrundarbeit aus und erzeugt keine
  zusätzlichen nebenläufigen Analysen.

Der Hauptdatei-Snapshot ist **noch kein vollständiger Snapshot der
Übersetzungseinheit**: Der Präprozessor kann verschachtelte Includes auflösen,
auch aus ungespeicherten Editordokumenten. Bevor ein Worker-Executor eingeführt
werden kann, muss ein konsistentes, vom LSP-Lebenszyklus unabhängiges Modell für
alle hierfür benötigten Quelltexte geschaffen werden. Auch `AnalysisResult`
ist ein klassenbasiertes Objekt mit AST, `Source`, `SourceValue` und weiteren
Indizes; die Übertragung über Threadgrenzen muss vorab explizit definiert
werden. Eine stillschweigende `structuredClone()`-Übertragung ist **keine**
Architekturentscheidung.

Referenzimplementierungen:
- `/src/server/utility/analysisExecutor.ts`
- `/src/server/utility/localAnalysisExecutor.ts`
- `/src/server/server.ts`

---

## Quelltextzugang und Snapshot-Vertrag (Vorbereitung für Worker)

Der Präprozessor hängt für `#include` nicht mehr vom konkreten
`DocumentRegistry`-Typ ab, sondern vom kleinen, **nur lesenden**
`IncludeSourceResolver`. Er benötigt ausschließlich `resolveInclude()` und
(optional für ältere Testdoubles) `resolveIncludeUri()`. Der lokale
`DocumentRegistry` erfüllt diesen Vertrag strukturell und bleibt für die
Editor-/Dateisystemauflösung sowie Cache-Invalidierung zuständig. Im
Präprozessor werden keine Include-Beziehungen in der Registry registriert;
aktive Includes, fehlgeschlagene Zielpfade und wiederholte Include-Vorkommen
werden wie bisher pro Analyselauf gesammelt und erst nach gültigem Abschluss
in `DocumentRegistry` übernommen.

Für eine spätere isolierte Ausführung sind datenbasierte Verträge definiert:

- `AnalysisSourceSnapshot` enthält physische URI, Sprachkennung, Version und
  den vollständigen Text. `AnalysisExecutionInput.source` ist weiterhin der
  Snapshot der Hauptdatei.
- `AnalysisIncludeSourceSnapshotSet` umfasst die erfassten weiteren
  physischen Quellen und `AnalysisIncludeResolutionSnapshot`-Einträge.
  Ein Lookup-Schlüssel besteht aus **URI der jeweils inkludierenden Datei und
  bereits makroexpandiertem Include-Pfad**; das Ergebnis enthält die Ziel-URI
  und den Status `found`. Auch fehlende Dateien behalten so ihren Zielpfad
  für File-Watches. Gleiche physische URIs dürfen innerhalb eines Laufs nicht
  mit widersprüchlichen Inhalten oder Versionen auftreten.
- `SnapshotIncludeSourceResolver` kann diese Daten ohne Dateisystem- oder
  Editorzugriff synchron an den unveränderten Präprozessor zurückgeben.
  Unbekannte Lookups und unvollständige Snapshots sind **Fehler**, nicht
  stillschweigend fehlende Includes. Der Resolver ist keine zweite Registry.
- `AnalysisExecutionInput.includeSnapshots` ist zunächst **optional**.
  Solange es fehlt, verwendet `LocalAnalysisExecutor` weiter den lokalen
  `DocumentRegistry` über den Validator. Liegt es vor, übergibt der Executor
  den Snapshot-Resolver explizit an `Validator.analyze()`.

Die vollständige **Snapshot-Erfassung** erfolgt über den
`AnalysisSnapshotCollector` mit einem aufzeichnenden `IncludeSourceResolver`:

- Der Collector führt einen **regulären Lexer-/Präprozessordurchlauf** aus,
  mit denselben vordefinierten Makros wie der Validator
  (`createPredefinedMacroTable`). Es gibt weder einen zweiten
  Präprozessor noch eine statische Include-Suche. Nur tatsächlich ausgeführte
  Lookups, einschließlich verschachtelter, wiederholter und fehlgeschlagener
  Includes, werden aufgezeichnet; inaktive `#ifdef`-Zweige erzeugen keine
  Auflösungseinträge.
- `SnapshotSourceProvider` ist eine ausschließlich für die **Erfassung**
  verwendete, lesende Ergänzung des Compiler-Vertrags um URI-Lookup und
  Dokumentversion. Der `DocumentRegistry` erfüllt sie strukturell. Eine
  erfolgreich gelesene physische Quelle wird innerhalb eines Snapshots nur
  einmal mit URI, Sprachkennung, Version und Text gespeichert. Widersprüche
  bei wiederholten Zugriffen führen zu einem Abbruch des Erfassungsversuchs.
- Unmittelbar nach der Erfassung und vor der Ergebnisübernahme vergleicht
  `changedSources()` die gespeicherten Versionen **und vollständigen Texte**
  mit der aktuellen Dokumentquelle. Bei diskbasierten Dateien genügt Version
  `0` nicht. Auch verschwundene und neu entstandene Include-Ziele sowie
  geänderte Pfadauflösungen werden geprüft.
- `server.ts` startet `LocalAnalysisExecutor` jetzt mit den aufgezeichneten
  `includeSnapshots`. Nur dort entscheidet die Orchestrierung, ob ein
  Ergebnis gültig ist. Bei veränderten Quellen invalidiert sie über die
  `DocumentRegistry` und stellt neue Scheduler-Aufträge ein. Scheduler,
  Executor und Collector besitzen **keine zweite Ergebnisverwaltung**.
- Der Snapshot-Resolver gibt gespeicherte Quellen unverändert an den
  Präprozessor zurück. Wiederholte Include-Ausführungen behalten ihre
  unterschiedlichen `IncludeOccurrence`s und Source-Mappings. Unbekannte
  Lookups bleiben harte Fehler statt fiktiv fehlender Dateien.

Der lokale Pfad führt damit den Präprozessor zunächst zur **Erfassung** und
anschließend in der vollständigen Compilerpipeline noch einmal aus. Dieser
zusätzliche synchrone Aufwand ist vorerst bewusst akzeptiert, wird im
AnalysisTrace als `snapshotCaptureMs` gesondert ausgewiesen und ersetzt noch
**keine Worker-Isolation**. Insbesondere bleibt die Event-Loop während des
Erfassungsdurchlaufs blockiert. Die getrennte Executor-Schnittstelle ermöglicht
später den Austausch gegen eine Worker-Ausführung, ohne diese Zuständigkeiten
oder die Compilerpipeline zu verschieben.

Der Snapshot-Vertrag beschreibt **Eingaben**, nicht den vollständigen
Rücktransport von `AnalysisResult`. Eine erste, getrennte Transportschicht
für `Source`, `SourceValue`, AST und `SemanticContext` ist unten dokumentiert.
Der vollständige `AnalysisResult`-Transport muss vor Einführung von Worker-Threads
noch ergänzt und integriert werden.
Die Source-Mapping-Semantik der Compilerpipeline bleibt unverändert.

Referenzimplementierungen:
- `/src/server/preproc/includeSourceResolver.ts`
- `/src/server/preproc/preprocessorContext.ts`
- `/src/server/utility/analysisSourceSnapshot.ts`
- `/src/server/utility/snapshotIncludeSourceResolver.ts`
- `/src/server/utility/analysisSnapshotCollector.ts`
- `/src/server/preproc/createPredefinedMacroTable.ts`
- `/src/server/utility/analysisExecutor.ts`
- `/src/server/utility/localAnalysisExecutor.ts`
- `/src/server/validation/validator.ts`

---

## Rücktransport von Analyseergebnissen: Identitätsgraph (Worker-Vorbereitung)

`AnalysisResult` darf **nicht** als gewöhnliches Objekt per `structuredClone()`
oder `postMessage()` in die `DocumentRegistry` übernommen werden. Der
Compiler liefert aktive Klassenobjekte und Identitätsbeziehungen:

- `AnalysisResult` enthält `Analysis`, `ProblemCollection`, Makro- und
  Include-Metadaten sowie die `files`-Map. Der Hauptthread verwendet u. a.
  `hasErrors()`, `getFile()`, `lookupMacro()` und die Methoden der untergeordneten
  Objekte.
- AST-Knoten sind konkrete `AstNode`-Unterklassen. `parent`,
  `lookupSourceValue()`, `documentationProvider()` und Folding-Methoden
  müssen erhalten bleiben. Die Knotenidentität wird auch in semantischen
  Maps verwendet.
- `SemanticContext.bindings`, `expressionTypes`, weitere semantische Maps,
  `SymbolReferenceResolutionIndex` und `SymbolOccurrenceIndex` referenzieren
  **konkrete** `AstNode`-/`SourceValue`-/Symbolinstanzen, nicht bloß deren
  Namen oder physische Offsets. Wiederholte Makro- und Include-Ausführungen
  können dieselbe physische Position besitzen, aber unterschiedliche
  lexikalische Identitäten darstellen.
- `Location.source` referenziert eine konkrete `Source`-Instanz. Eine
  `ExpandedSource` enthält Fragmente mit eigenen Ursprungsquellen,
  `MacroSource` einen Aufruf-Anker; `mapLocation()` und `mapLocations()` müssen
  transitive Herkunft und Objektidentität erhalten. **URI ist kein
  Objektidentifikator**: wiederholt inkludierte Dateien können mehrere
  `FileSource`-Instanzen mit gleicher URI erzeugen.
- Einige Indizes (`Analysis.callSignatures`, `Analysis.callSignatureHelp`,
  `Analysis.blockComments`) werden absichtlich **lazy** aus AST und Semantik
  erzeugt. Diese Caches sind keine primären Compilerergebnisse.

### Expliziter Transport statt generischem Prototype-Patching

Der Rücktransport wird **schrittweise als versionierter, datenbasierter
Identitätsgraph** definiert. Auf dem Draht werden Referenzen durch lokale IDs
beschrieben; auf der Empfängerseite müssen die Originalklassen über ihre
fachlichen Konstruktoren bzw. explizite Rehydrationsfabriken entstehen.
Weder `Object.setPrototypeOf()` für beliebige geklonte Objekte noch ein
rekursiver, reflektionsbasierter Serializer für alle Compilerklassen ist
zulässig. Der Transport gehört ausschließlich zur technischen
Compiler-/Worker-Grenze; er darf weder den AST noch LSP-Provider um zusätzliche
Persistenzzustände erweitern.

**Erste implementierte Schicht:**

- `SourceGraphWire` (Version 1) kodiert ausschließlich `FileSource`,
  `MacroSource`, `ExpandedSource` und deren Ursprungsfragmente. Quellinstanzen
  besitzen pro Nachricht eine eigene numerische ID. `SourceGraphEncoder`
  wird für alle von einem Ergebnis referenzierten Quellen **gemeinsam**
  verwendet; sonst würden identische Objekte getrennt wiederhergestellt.
- `SourceLocationWire` speichert Quell-ID und Start-/End-Offset. Der Decoder
  erzeugt echte Source-Klassen, prüft unbekannte/zyklische Referenzen,
  ungültige Bereiche und inkonsistente direkte Fragmente. `ExpandedSource`
  und `MacroSource` stellen hierfür ausschließlich lesende Zugriffe auf ihre
  Ursprungsinformationen bereit; das fachliche Mapping bleibt unverändert.
- `SourceValueGraphWire` führt ein **separates** Identitätsregister für
  `SourceValue`. Zwei Werte mit gleichem Text und gleicher Location sind
  nicht automatisch dieselbe Instanz. Beide Locations (`location` und
  `lexicalLocation`) verwenden dieselben `SourceGraph`-IDs. Unterstützt
  werden derzeit skalare Werte einschließlich als Dezimaltext kodiertem
  `bigint`; andere Nutzlasten werden ausdrücklich abgewiesen.
- Beide Drahtformate enthalten nur übertragbare Daten, keine Methoden oder
  Compilerobjekte. Ihre IDs gelten nur innerhalb **eines** Transportvorgangs
  und dürfen nicht als Cache-Schlüssel über Analysen hinweg dienen.

**Zweite implementierte Schicht: AST-Knotengraph (Version 1)**

- `AstGraphWire` transportiert die konkrete `AstKind`-Variante, eine pro
  Analyse lokale Knoten-ID und ausschließlich explizit deklarierte
  Konstruktorargumente. Die 103 aktuell vorhandenen **konkreten AST-Klassen**
  werden über ihre Originalkonstruktoren wiederhergestellt; damit bleiben
  `documentationProvider()`, `lookupSourceValue()`, Folding und `dumpLabel()`
  als echte Klassenmethoden erhalten.
- `AstGraphEncoder` verwendet denselben `SourceValueGraphEncoder`, den später
  auch der Semantiktransport verwenden soll. `SourceValue`-Referenzen erhalten
  also gemeinsame IDs. AST-Knoten-IDs werden für semantische Verweise zur
  Verfügung gestellt, unabhängig von Kind, Text oder Quelltextposition.
- Die veränderlichen AST-Bestandteile von `TranslationUnitNode`, `ModuleNode`,
  `ProblemPartNode` und `SystemPartNode` werden gesondert erfasst und über
  die bestehenden `addChild()`-/`adopt()`-Methoden rekonstruiert.
  Elternzeiger entstehen über die **originalen Konstruktoren** und diese
  bestehenden Methoden, nicht durch nachträgliches Kopieren von `parent`.
- Verschachtelte fachliche Record- und Variantentypen (z. B.
  `ConstantFixedFactorOperand` und `InitElementValue`) besitzen explizite
  Drahtrepräsentationen. Der Decoder prüft Version, Feldanzahl,
  Referenz-IDs und Zyklen. Nicht unterstützte `AstKind`-Werte werden
  ausdrücklich abgewiesen.
- Die expliziten Klassenzweige in `astGraphTransport.ts` werden durch
  `utility/transport/tools/generateAstGraphTransport.cjs` **nur zur
  Entwicklungszeit** aus den AST-Konstruktorsignaturen erzeugt. Der Generator
  prüft neue Instanzfelder auf Abdeckung. Im laufenden LSP findet weder
  Typreflexion noch generische Klassenserialisierung statt. Bei Änderungen
  an den AST-Klassen muss der Transport regeneriert und getestet werden.

**Dritte implementierte Schicht: Semantischer Identitätsgraph (Version 1)**

- `SemanticGraphWire` kombiniert einen `AstGraphWire` mit eigenen ID-Tabellen
  für `SemanticSymbol`, `SemanticType` und `SymbolReference`. Symbolnamen,
  Definitionen, Strukturkomponenten und AST-Referenzen verwenden **dieselben**
  `SourceValue`- und AST-IDs wie der Syntaxbaum. Gleich geschriebene Namen
  an derselben physischen Position bleiben unterschiedliche Objekte.
- Die konkreten `SymbolKind`- und `SemanticTypeKind`-Varianten werden mit
  ausdrücklich beschriebenen Feldern übertragen. Benannte und rekursive
  Typbeziehungen, Strukturkomponenten, Array-Grenzen, `REF`-Invarianz und
  Prozedursignaturen bleiben erhalten. Der Encoder weist neue, noch nicht
  erfasste Felder an Symbolen und Typen ausdrücklich zurück; eine Erweiterung
  der Fachmodelle erfordert daher eine Anpassung des Transportvertrags.
  Symbole und semantische Typen sind
  fachlich reine Datenobjekte: Ihre Identität wird beim Dekodieren durch
  **einmalig angelegte Datensätze**, nicht durch Klassen-Prototyp-Patching,
  erhalten. Die `SemanticContext`-Klasse selbst wird regulär konstruiert.
- `SemanticContextWire` enthält Bindungen, Typdefinitionen, Ausdruckstypen,
  Konstanten/Initialisierungen, Konfigurationen, semantische Diagnosen,
  lokale SPC-Relationen, Builtin-Bindungen, Schutzinformationen und
  Verwendungsinformationen. `bigint` wird als validierter Dezimaltext
  übertragen. Built-ins werden anhand ihres Namens **aus dem bestehenden
  RTOS-UH-Katalog** rekonstruiert; unbekannte Einträge sind Fehler.
- Wahlweise enthält der Transport die Primärdaten von
  `SymbolReferenceIndex` und `SymbolReferenceResolutionIndex`. Die Klassen
  werden über ihre **vorhandenen Konstruktoren** rekonstruiert.
  `SymbolOccurrenceIndex` wird daraus und aus dem `SemanticContext` neu
  berechnet, statt dessen private Lookup-Caches zu übertragen.
  `SymbolUsageIndex` erhält dasselbe Referenz-ID-Register, damit die
  referenzierten Vorkommen in allen Indizes dieselben Instanzen sind.
- Der Transport bleibt **außerhalb** des laufenden LSP-Pfads. Weder
  Compilerobjekte noch LSP-Provider werden zur Serialisierung verändert.

**Vierte implementierte Schicht: vollständiges `AnalysisResult`-Objekt (Version 1)**

- `AnalysisResultWire` fasst den gemeinsam aufgebauten semantischen Graphen
  und die restlichen Analysefelder zusammen. Pro `Analysis` werden AST-Wurzel,
  physische Source und `SemanticContext`/Referenzindizes mit **IDs aus derselben
  Sitzung** referenziert. `decodeSemanticGraphBundle()` rekonstruiert mehrere
  Kontexte in einer einzigen Decoder-Sitzung. Mehrere Analysen dürfen deshalb
  dieselben AST-, SourceValue-, Symbol- und Typobjekte teilen, ohne beim
  Dekodieren unbeabsichtigt Kopien zu erhalten.
- Tokens werden mit ihren Quell-Locations explizit transportiert. Der Decoder
  verwendet `createToken()` und `createCommentToken()`; so bleibt insbesondere
  die Methode `CommentToken.compilerOption()` verfügbar. Geteilte Tokenobjekte
  aus `tokens` und `activeBlockComments` erhalten gemeinsame IDs.
- Diagnosen einschließlich Severity, Code, Tags und Include-Vorkommens-ID
  werden wieder mit den `Problem`-Fabriken erstellt und in echte
  `ProblemCollection`s eingefügt. Die globale Problemsammlung und die
  Analysesammlungen behalten durch **ein gemeinsames Problem-ID-Register**
  die Identität gemeinsam referenzierter Probleme.
- Makrodefinitionen und -referenzen bekommen eigene ID-Register. Dadurch
  bleiben Definitionen auch nach `#undef`, erneutem `#define` sowie bei
  `#ifdef` mit gleichnamigen, aber verschiedenen Definitionen unterscheidbar.
  `MacroOccurrenceIndex` wird aus den Originaldaten neu aufgebaut.
  `PreprocessorConditionalBlock` und dessen Collection werden mit ihren
  normalen Konstruktoren wiederhergestellt.
- Include-Vorkommen erhalten ihre Ausführungsidentität, Pfadkette,
  Expansionsspanne und (wenn vorhanden) den Verweis auf **die konkrete**
  Source-Instanz. Aktive und beobachtete Include-URIs, Source-Highlights und
  deren `SourceValue`-Referenzen werden ebenfalls übernommen.
- Das `AnalysisResult` wird durch `AnalysisResult.rehydrate()` aus validierten,
  konstruierten Bestandteilen aufgebaut. Diese Fabrik übernimmt anders als
  `create()` die globalen Problemsammlungen und Makroreferenzen explizit,
  statt sie nur anhand der einzelnen Analysen erneut zu sammeln.
  Die bestehenden Lazy-Caches für Signaturen und Blockkommentare werden
  ausdrücklich **nicht** serialisiert; ihre bisherigen Getter erzeugen sie
  nach dem Transport bei Bedarf neu.
- Der Encoder weist neue, unbekannte Felder an `AnalysisResult`, `Analysis`,
  Problemen, Tokens, Makrodefinitionen/-referenzen, Präprozessorbedingungen,
  Include-Vorkommen und Source-Highlights zurück. Neue Compilerzustände
  müssen bewusst dem versionierten Transport hinzugefügt werden.
- `encodeAnalysisResult()`/`decodeAnalysisResult()` sind der einzige
  vorgesehene vollständige Transportpfad. Die bestehenden einzelnen
  Graphtransporte bleiben eigenständige, testbare Bausteine.

**Validierung und Grenze zum Worker:**

- Echte Validatorergebnisse wurden über `structuredClone()` und den
  vollständigen Roundtrip geprüft: AST, Bindungen, Probleme, Makros,
  verschachtelte/wiederholte Includes, Quell-IDs, Highlights und mehrere
  Analysen mit gemeinsam verwendeten Objekten. Die bereits vorhandenen
  Tests für die einzelnen Teiltransporte bleiben gültig.
- Große synthetische Übersetzungseinheiten (`STRESS_01` und `STRESS_15`)
  wurden erfolgreich rekonstituiert. Der Decoder ist aber **synchron** und
  kostet bei großen ASTs messbar Zeit. Vor produktivem Workerbetrieb müssen
  deshalb auch die Auswirkungen der Rehydration auf die Reaktionsfähigkeit
  des LSP-Hauptthreads gemessen werden; ein Worker beschleunigt nicht
  automatisch jeden Schritt der Gesamtkette.
- Ein **LSP-Provider-Paritätstest** vergleicht echte Validator-Ergebnisse
  vor und nach `encodeAnalysisResult()` / `structuredClone()` /
  `decodeAnalysisResult()` über die vorhandenen Provider und eine reale
  `DocumentRegistry` mit reproduzierbaren In-Memory-Dokumenten. Abgedeckt
  sind AST-Hover, Definitionen, Referenzen (inklusive Makros),
  Präprozessor-Hover, Folding, Signature Help, Diagnose-Mapping und
  -Veröffentlichung, semantische Tokens sowie Include-Kontextoptionen und
  -auswahl. Zwei Übersetzungseinheiten mit insgesamt drei Einbindungen
  derselben Datei prüfen auch unterschiedliche `#ifndef`-Ausführungen.
  Jede Prüfung verlangt sinnvolle Nicht-Leer-Ergebnisse; identische leere
  Antworten gelten nicht als hinreichender Nachweis.
  Diese Tests verwenden die **Produktions-Provider-Bausteine**, jedoch
  noch keine echte LSP-Verbindung und keine Worker-Threads. Sie belegen
  Verhalten unter den getesteten Eingaben, keine vollständige
  Serialisierbarkeit aller zukünftigen Compilerzustände.
- Der **LSP-Hauptpfad bleibt unverändert**: `LocalAnalysisExecutor` liefert
  bis zur gesonderten Worker-Integration weiterhin die ursprünglichen
  Live-Klassenobjekte, nicht einen Roundtrip-Clone. Vor einer Umschaltung
  ist nach den Provider-Paritätstests noch eine Integration an der
  tatsächlichen LSP-Verbindung sowie eine Reaktionszeitmessung mit
  asynchronem Worker und synchroner Dekodierung erforderlich.
- Ein zukünftiger `WorkerExecutor` darf nur vollständig rekonstruierte
  `AnalysisResult`-Objekte zurückgeben. `AnalysisScheduler`,
  `AnalysisSnapshotCollector` und `DocumentRegistry` bleiben unverändert
  für Auftragsplanung, konsistente Eingaben und Ergebnisgültigkeit zuständig.
  Worker publizieren keine LSP-Diagnosen und verwalten keine Include-Kontexte.

Die Transportobjekte sind **keine neuen fachlichen Compilerrepräsentationen**.
Sie bilden ausschließlich die technische Grenze zwischen Analyseausführung
und zurückkehrendem Compilerergebnis ab.

Referenzimplementierungen:
- `/src/server/utility/transport/sourceGraphTransport.ts`
- `/src/server/utility/transport/sourceValueGraphTransport.ts`
- `/src/server/utility/transport/astGraphTransport.ts`
- `/src/server/utility/transport/semanticGraphTransport.ts`
- `/src/server/utility/transport/analysisResultTransport.ts`
- `/src/server/utility/transport/tools/generateAstGraphTransport.cjs`
- `/src/server/source/fileSource.ts`
- `/src/server/source/expandedSource.ts`
- `/src/server/source/macroSource.ts`
- `/src/server/core/sourceValue.ts`
- `/src/server/validation/analysis.ts`
- `/src/server/validation/analysisResult.ts`

---

## Include-Abhängigkeiten und Gültigkeit der Analyse

Die aktive Include-Menge wird vom Präprozessor **für den jeweiligen
Analyselauf** gesammelt. Nur tatsächlich ausgeführte `#include`-Anweisungen
zählen; Includes aus inaktiven `#ifdef`-Zweigen nicht. Nach Abschluss der
Analyse ersetzt `DocumentRegistry` die Abhängigkeiten dieser
Übersetzungseinheit einschließlich ihrer Rückwärtszuordnung. Werden
Includes entfernt, dürfen keine alten Beziehungen bestehen bleiben.

Bei der Änderung einer Quelldatei werden die Analysen aller bekannten
einbindenden Übersetzungseinheiten invalidiert und neu angefordert. Das
gilt auch für indirekte Includes und ungespeicherte Änderungen in geöffneten
PEARL-Dokumenten. Eine Includedatei wird dafür **nicht** als vollständiges
Hauptmodul geparst.

Analyseergebnisse werden anhand der Hauptdokumentversion und der erfassten
Quellversionen auf Gültigkeit geprüft. Änderungen an offenen Dokumenten
sowie Dateisystem- und Konfigurationsereignisse führen zur Invalidierung.
Eine monoton fortgeschriebene Anforderungskennung verhindert, dass ein
überholter asynchroner Analyselauf sein Ergebnis nachträglich veröffentlicht.
Die Gültigkeitsprüfung darf nicht durch bloßes Umschalten zwischen Tabs
ersetzt werden.

Die Registry behält `addInclude()` für ältere, synthetische Tests bei.
Solche Include-Beziehungen können ohne zugängliches physisches Dokument
existieren; fehlt ihre Quellversion, ist dies nicht automatisch ein
Versionskonflikt. **Bekannte**, abweichende Versionen sind dagegen
zurückzuweisen.

Referenzimplementierungen:
- `/src/server/preproc/preprocessorContext.ts`
- `/src/server/preproc/preprocessor.ts`
- `/src/server/utility/documentRegistry.ts`
- `/src/server/server.ts`

---

## Open File und Open Folder

„Open File“ behält die bisherige Analyse einer einzeln geöffneten PEARL-Datei
bei. Im Modus „Open Folder“ werden `.P`-Dateien **unmittelbar im geöffneten
Ordner** automatisch als Hauptdateien erkannt und analysiert, auch wenn sie
nicht als Editor-Tab geöffnet sind. Ihre Analysen bleiben nach dem Schließen
des Tabs erhalten, solange sie zum Ordner gehören.

Eine im Ordner geöffnete `.h`-Includedatei wird nicht allein deshalb zu
einer eigenständigen Übersetzungseinheit. Ihre Sprachinformationen stammen
aus einer einbindenden Hauptdatei. Hinzukommende oder entfernte `.P`-Dateien
werden über die Ordneraktualisierung berücksichtigt; Änderungen bekannter
Quellen über Editor- oder Dateisystemereignisse.

Die Ordnererkennung ist derzeit **nicht rekursiv**. Eine umfassende
Projekt-/Workspace-Konfiguration mit mehreren Quellverzeichnissen ist noch
keine implementierte Architekturentscheidung. Der `WorkspaceManager`
kennt jedoch bereits vom LSP-Client gelieferte Workspace-Folder.

Für korrektes LSP-Feedback muss VS Code eine bearbeitete Includedatei im
Sprachmodus **PEARL** öffnen. Der VS-Code-Client weist diesen Modus beim
direkten Öffnen **bekannter, tatsächlich erfolgreich eingebundener Dateien**
automatisch zu – auch außerhalb des Workspace und bei beliebigen Endungen.
Diese Kenntnis stammt aus abgeschlossenen Übersetzungseinheitsanalysen, nicht
aus Dateiendungen oder einem zusätzlichen Verzeichnisscan. Der Client holt die
zugehörigen URIs zusammen mit den Include-Watch-Zielen ab und übernimmt sie
auch bei späteren Aktualisierungen des Include-Graphen. Bereits geöffnete
Dateien werden beim Erhalt eines neuen Snapshots ebenfalls berücksichtigt.

**Versuchte, fehlgeschlagene Includes** bleiben reine Watch-Abhängigkeiten und
berechtigen nicht zur PEARL-Sprachzuordnung. Die Sprachzuordnung setzt auch
keinen semantischen Include-Kontext: Bei mehreren Einbindungskontexten muss
die bestehende CodeLens-Auswahl verwendet werden. Die `.h`-Endung wird
weiterhin nicht global PEARL zugeordnet. Testordner können zusätzlich lokale
`.vscode/settings.json` mit `files.associations` bereitstellen.

VS Code löst bei `setTextDocumentLanguage` einen Dokument-Schließen- und
anschließend einen Dokument-Öffnen-Vorgang aus. Der Server verwendet dabei
seine bekannten Include-Abhängigkeiten, statt eine solche Datei als eigene
Übersetzungseinheit zu analysieren. Dateien ohne bekannte Einbindung werden
nicht automatisch umklassifiziert.

**Datei-URI-Identität unter Windows:** Der Client liefert für Windows-Dateien
über `vscode.Uri.toString()` eine URI wie `file:///c%3A/Projekt/Typen.H`.
`node:url.pathToFileURL()` erzeugt für denselben Pfad dagegen gewöhnlich
`file:///C:/Projekt/Typen.H`. Beide URIs sind gültig, aber als rohe
Zeichenketten verschieden. Da `DocumentRegistry`, Include-Provenienz,
Diagnosen, CodeLens und Include-Watcher bisher URI-Strings als Schlüssel
verwenden, muss die Darstellung beim Erzeugen von Dateiquellen-URIs
vereinheitlicht werden. Die Projektion erfolgt ausschließlich an der zentralen
Grenze `utility/uriUtils.uriFromFilePath()`; der Windows-Laufwerksbuchstabe
wird kleingeschrieben und sein Doppelpunkt als `%3A` kodiert. Pfadkomponenten
werden weder pauschal kleingeschrieben noch auf den Workspace begrenzt.
Relative Includes (`../...`), absolute externe Pfade, UNC und POSIX behalten
ihre bisherigen Auflösungsregeln. Für neue LSP-Clients mit anderer
URI-Serialisierung kann später eine unabhängige URI-Identitätsabbildung
nötig werden.

Referenzimplementierungen:
- `/src/server/utility/folderTranslationUnitIndex.ts`
- `/src/server/utility/workspace.ts`
- `/src/server/server.ts`

---


## Dateisystemüberwachung bekannter Include-Abhängigkeiten (Dev_0_3 / 0.3.1)

Der Präprozessor ermittelt die **tatsächlich ausgeführten** `#include`-
Anweisungen im Kontext einer vollständigen Übersetzungseinheit. Ihre
physischen Zielpfade sind unabhängig von der Dateiendung und von der Lage
relativ zum geöffneten Workspace. Verschachtelte Includes werden rekursiv
beim jeweiligen Analyselauf berücksichtigt. Es gibt **keinen** zusätzlichen
Bibliotheksscan, keine automatische Aufnahme externer Header als
Übersetzungseinheiten und keine eigene semantische Analyse pro Header.

Für die Dateisystemüberwachung werden auch fehlgeschlagene Include-Auflösungen
als **versuchte Zielpfade** erfasst (`PreprocessorContext.watchedIncludeUris`).
Nur so kann das spätere Wiederanlegen einer zuvor gelöschten Includedatei
einen neuen Analyselauf auslösen. Die erfolgreich eingebundenen Dateien
(`includedSourceUris`, `includeOccurrences`) bleiben davon getrennt:
Ein nicht existierendes Ziel darf keine semantische Include-Kontextoption
oder erfundene Deklaration erzeugen.

`DocumentRegistry` übernimmt diese Watch-Abhängigkeiten erst mit einem
akzeptierten `AnalysisResult`; überholte Analysen dürfen weder den
Include-Graphen noch die Watch-Menge ersetzen. Die Registry verwaltet für
jeden aktiven Übersetzungseinheits-Root die aktuellen Watch-Pfade und
zugehörige Rückwärtsbeziehungen. Werden Includes durch `#ifdef` oder
Makroänderungen entfernt, werden auch die entsprechenden Watch-Pfade beim
nächsten akzeptierten Ergebnis entfernt. Beim Schließen eines Roots fallen
seine Abhängigkeiten weg; gemeinsam verwendete Pfade bleiben erhalten,
solange noch ein anderer Root darauf verweist.

Der Language Server liefert dem VS-Code-Client die **vollständige Menge**
aktuell bekannter Watch-Ziel-URIs über `pearl/getIncludeWatchTargets` und
`pearl/includeWatchTargets`. Zusätzlich enthält derselbe Snapshot in
`includedUris` ausschließlich erfolgreich eingebundene Quelldateien aus dem
akzeptierten Include-Graphen. Änderungen dieser zweiten Menge erhöhen die
Snapshot-Revision selbst dann, wenn die Watch-Pfade identisch bleiben (z. B.
beim Wiederanlegen einer zuvor fehlenden Datei). Eine monoton steigende Revision verhindert,
dass ein verspätet eingetroffener Anfangssnapshot eine neuere Menge
überschreibt. Eine zusätzliche Server-Session-ID erlaubt die Neuinitialisierung
nach einem Language-Server-Neustart. Der Client verwendet `vscode.RelativePattern` mit explizitem
Verzeichnis und nicht rekursivem `*`-Glob; pro Verzeichnis wird ein Watcher
angelegt. Die Ereignisse werden nach den tatsächlich bekannten Ziel-URIs
gefiltert und über `workspace/didChangeWatchedFiles` zum bestehenden
Server-Ereignisweg zurückgesendet. Dadurch funktionieren die Watcher auch
**außerhalb** aller geöffneten Workspace-Folder. Eine starre Liste
unterstützter Include-Endungen ist nicht vorgesehen.

Bestehende Workspace-Watcher für `.p`/`.P` und `.h`/`.H` werden nicht
doppelt registriert; innerhalb des Workspace werden zusätzliche
Client-Watcher nur für bislang nicht abgedeckte Endungen benötigt.
Geöffnete PEARL-Dokumente melden Änderungen weiterhin über den LSP-
Dokumentlebenszyklus; Dateisystemereignisse ersetzen diesen nicht.

Referenzimplementierungen:
- `/src/server/preproc/preprocessorContext.ts`
- `/src/server/preproc/preprocessor.ts`
- `/src/server/validation/analysisResult.ts`
- `/src/server/utility/documentRegistry.ts`
- `/src/server/server.ts`
- `/src/client/includeDependencyWatcher.ts`
- `/src/client/extension.ts`
- `/src/server/utility/tests/externalIncludeWatch.test.ts`
- `/src/client/tests/includeDependencyWatcher.test.ts`

---

## Mehrere Einbindungskontexte derselben Datei

Eine physische Includedatei kann in mehreren Übersetzungseinheiten mit
**unterschiedlichen Makrodefinitionen** vorkommen. Ihre AST- und
Semantikergebnisse sind daher kontextabhängig. Es darf weder eine
willkürliche gemeinsame Semantik noch eine Vereinigung dieser Ergebnisse
geben.

`DocumentRegistry.getAnalysisResultForSource()` liefert für eine Include-URI
nur einen gültigen, eindeutigen beziehungsweise **explizit ausgewählten**
Kontext. Bei mehreren möglichen, noch nicht ausgewählten Kontexten gibt sie
kein beliebiges Analyseergebnis zurück. Solange eine ausdrücklich gewählte
Übersetzungseinheit nach einer Quelländerung erneut analysiert wird, darf die
Anfrage nicht vorübergehend auf eine andere umschalten.

Für mehrfach eingebundene Dateien stellt der LSP eine **CodeLens** bereit.
Über `pearl.selectIncludeContext` und eine Auswahlliste kann eine einbindende
`.P`-Datei ausgewählt oder die Wahl geändert werden. Die Auswahl gilt pro
physischer Include-URI und wird von Hover, Navigation und Semantic Tokens
beachtet. Sie bleibt erhalten, solange die gewählte Einbindung gültig ist.
Bei nur einem Einbindungskontext erfolgt die Auswahl automatisch.

Die Diagnoseergebnisse werden **pro Übersetzungseinheit** getrennt
verwaltet. Ein neuer Analyselauf darf die Ergebnisse anderer Module nicht
löschen. Die CodeLens wählt einen semantischen Kontext für Hover,
Navigation und kontextbezogene Darstellungen; sie ist **keine Voraussetzung**
für die projektweite Diagnoseerfassung.

**Diagnoseveröffentlichung in Dev_0_3, Paket 14:** Die projektweite Übersicht
veröffentlicht bei noch nicht ausgewählten, mehrfach eingebundenen Dateien
die Compilerfehler und Warnungen **aller** beteiligten Übersetzungseinheiten,
mit Herkunftskennzeichnung und Zusammenfassung gleicher Meldungen.
Dabei werden die semantischen Analyseergebnisse nicht vermischt: Vereinigt
werden ausschließlich die fertigen, unveränderten Diagnosebeiträge zur
Problems-Ansicht. Inaktivitäts-Hinweise (`Hint` und `Unnecessary`) werden
in dieser Übersicht weggelassen; bei sonstigen Warnungen wird das
`Unnecessary`-Tag für die Übersicht entfernt, damit eine fremde Auswertung
nicht versehentlich Quellzeilen abdunkelt.

Nach der expliziten CodeLens-Auswahl stammen normale Warnungen, Hinweise
und die Abdunklung aus dem gewählten Include-Vorkommen. **Compilerfehler
aller anderen Kontexte bleiben sichtbar** und erhalten eine Herkunftsangabe.
Das gilt auch, wenn nur ein Vorkommen einen Fehler enthält und im Editor
bereits ein anderes, fehlerfreies Vorkommen ausgewählt ist. Entfernte oder
behobene Fehler verschwinden, sobald die zugehörige Übersetzungseinheit
erneut analysiert beziehungsweise entfernt wurde.

**Deduplizierung auch nach Kontextauswahl (Paket 15):** Die Menge der
Compilerfehler wird für jede physische Datei-URI stets aus **allen**
analysierten Übersetzungseinheiten und Include-Vorkommen gebildet. Der
`DiagnosticPublicationManager` fasst gleiche Fehler anhand ihrer vollständigen
LSP-Diagnosemerkmale (insbesondere Position, Meldung und Schweregrad) zu
einem Eintrag mit sämtlichen Herkunftsangaben zusammen. Die ausgewählte
Einbindung wird dabei **nicht zusätzlich** als unveränderter Fehlerbeitrag
angehängt. Nur Warnungen, Informationen und Hinweise stammen nach einer
CodeLens-Auswahl aus dem gewählten Vorkommen. Verschiedene Fehler an
derselben Quellposition bleiben voneinander unterscheidbar. Dies ist eine
reine Darstellungsregel; die einzelnen Compileranalysen bleiben getrennt.

**Technische Grenze:** LSP `textDocument/publishDiagnostics` liefert nur
eine Liste je physischer Datei-URI. Deshalb kann VS Code ohne zusätzliche
Client-Infrastruktur keine unabhängige projektweite Probleme-Ansicht **und**
eine vollständig separat gefilterte Liste von Editor-Markierungen derselben
Datei darstellen. Die angezeigten Fehler aus anderen Kontexten sind deshalb
auch im Editor sichtbar; ihre Nachricht nennt die Herkunft. Warnungen und
Hinweise anderer Kontexte werden nach einer expliziten Auswahl dagegen
nicht zusätzlich ausgegeben. Für eine dauerhaft vollständige, von der
Editorauswahl unabhängige Anzeige **aller** Meldungen wäre eine eigene
Projekt-Diagnostik-Sicht erforderlich.

Unabhängig von dieser Präsentation gilt weiterhin: Bei mehreren möglichen
Einbindungskontexten darf `DocumentRegistry` für semantische LSP-Anfragen
keinen beliebigen AST- oder Semantikkontext auswählen. Die bislang
implementierte Kontextwahl bleibt unverändert.

### Auswahl einzelner Include-Vorkommen (Paket 06)

Die CodeLens zeigt nun jedes **tatsächlich ausgeführte Include-Vorkommen**
als eigene Auswahlmöglichkeit an. Auch bei nur **einer** Übersetzungseinheit
können mehrere Einträge erscheinen. Ein Eintrag besteht aus der URI der
Übersetzungseinheit und der `IncludeOccurrence.id`; verschachtelte Includes
werden durch die vollständige Kette der einbindenden Direktiven unterschieden.

Die Registry speichert die explizite Wahl pro physischer Includedatei. Wird die
Übersetzungseinheit nach einer Headeränderung neu analysiert, wird das aktuell
gültige `expandedSpan` anhand der stabilen Kennung erneut ermittelt. Ist die
ursprüngliche Einbindung nicht mehr vorhanden, wird **kein** anderes Vorkommen
als Ersatz gewählt. Die bestehenden APIs zur Auswahl einer Übersetzungseinheit
bleiben für Analysen ohne Vorkommensmetadaten und eindeutig eingebundene Dateien
kompatibel.

Für AST-Abfragen erhält `SourceOffset` bei mehrfacher Einbindung **innerhalb
des ausgewählten Moduls** optional `occurrenceSpan` in Koordinaten
des expandierten Textes. `SourceValue.contains()` prüft in diesem Fall neben
URI/physischem Offset auch die `lexicalLocation` im gewählten Expansionsbereich.
So bleiben AST-Knoten, `SourceValue` und DocumentationProvider unverändert;
Quellwerte **ohne** geeignete lexikalische Herkunft werden nicht als
vermeintlich eindeutig ausgegeben. Find References und semantische Tokens
berücksichtigen die gleiche Herkunftsgrenze beim Identifizieren bzw.
Hervorheben. Die Signature-Help-Indexierung berücksichtigt die lexikalischen
Klammerpositionen. Makro-Hervorhebungen mit unzureichender Herkunft werden
bei wiederholten Einbindungen nicht einem beliebigen Vorkommen zugeordnet.

**Vorkommensbezogene Inaktivitätsmarkierungen (Paket 07):**
`PreprocessorConditionalBlock` trägt bei Include-Vorgängen die stabile
`includeOccurrenceId`. `PreprocessorInactiveRegionCollector.collectWithOrigins()`
behält diese Identität beim Erzeugen der Bereiche. Die aus diesen Bereichen
abgeleiteten `ProblemTag.Unnecessary`-Hinweise tragen die ID über
`Problem` und den internen `MappedDiagnostic` bis zur Diagnoseveröffentlichung.
`DiagnosticPublicationManager` filtert sie nach dem ausgewählten
Include-Vorkommen und entfernt die interne Kennung vor dem LSP-Versand.
Ohne eindeutige Auswahl werden statt einer beliebigen Ausführung die
projektweiten Fehlermeldungen und Warnungen publiziert, jedoch keine
kontextfremden Inaktivitäts-Hinweise. Bei einer expliziten Auswahl werden
vorkommensgebundene Warnungen und Hinweise gefiltert, während Fehler aus
anderen Übersetzungskontexten sichtbar bleiben. Damit
wird eine beim ersten Include aktive `#ifndef`-Region nicht wegen eines
späteren, durch den Guard unterdrückten Includes fälschlich abgedunkelt.

**Semantische Diagnosen mit nachgewiesener Herkunft (Paket 13):**
`SemanticDiagnostic` kann zusätzlich zur physischen `location` die
`lexicalLocation` des deklarierenden `SourceValue` weiterreichen. Der
`UnusedSymbolAnalyzer` erhält sie für seine Verwendungswarnungen; der
`Validator` ordnet sie anhand der `IncludeOccurrence.expandedSpan` der
konkreten Einbindung zu. In verschachtelten Includes ist die engste
passende Spanne maßgeblich; bei fehlender oder uneindeutiger Herkunft
wird keine Einbindungskennung geraten. Der Diagnose-Publisher filtert
diese Warnungen genauso wie die Inaktivitätsmarkierungen. Damit
verschwindet beispielsweise die Warnung für eine `DCL`-Variable bei der
Auswahl eines späteren, durch Include-Guard deaktivierten Vorkommens.
Der Semantic Analyzer selbst muss dazu weder CodeLens noch Workspace
kennen. Noch nicht alle übrigen semantischen, syntaktischen oder
präprozessorbezogenen Probleme tragen diese Herkunftsmetadaten.

**Vorkommensbezogener Präprozessor-Hover und Folding (Paket 08):**
`PreprocessorConditionalBlockLookup` filtert die bereits mit
`includeOccurrenceId` versehenen Bedingungsblöcke nach dem explizit
gewählten Include-Vorkommen. Dadurch zeigen `#ifdef`, `#ifndef`, `#else`
und `#endif` im Hover die Auswertung des tatsächlich ausgewählten
Präprozessorlaufs, statt eine Auswertung eines anderen Vorkommens zu
übernehmen. Der bestehende DocumentationProvider bleibt unverändert.

**Hover auf dem geprüften Makronamen (Paket 21):**
Ein bedingter Präprozessorblock speichert neben der Position des
`#ifdef`-/`#ifndef`-Direktivtokens auch die eigene physische
`macroLocation` des geprüften Bezeichners. Der `PreprocessorConditionalBlockLookup`
ordnet beide Positionen demselben Bedingungsblock zu und liefert denselben
`PreprocessorConditionalBlockDocumentationProvider`. Leerraum zwischen den
Tokens und andere Makrovorkommen gehören nicht zum Bedingungs-Hoverbereich.
Die Herkunft nach `IncludeOccurrence.id` wird vor der Positionsprüfung
gefiltert. Das funktioniert auch bei Makronamen ohne aktuelle Definition;
die zuvor ausgewertete Bedingung bleibt maßgeblich. Für diese LSP-Funktion
wird weder erneut präprozessiert noch ein alternativer Makroindex aufgebaut.

Folding verwendet die **physische URI des angefragten Dokuments**.
Die syntaktischen `#ifdef`/`#ifndef`-Regionen und Blockkommentare werden
für jedes Editor-Dokument unabhängig von der Include-Ausführung lexikalisch
gesammelt; hierzu dient `PhysicalPreprocessorFoldingCollector`. Der
bisherige `PreprocessorFoldingCollector`, der evaluierte Bedingungsblöcke
verarbeitet, ist für diese kontextfreie Editorfunktion nicht erforderlich.
`IncludeOccurrence.source` hält die originale `FileSource`-Instanz des
ausgeführten Includes fest; damit kann `AstFoldingCollector` zusätzlich
Faltungsregionen aus genau diesem Vorkommen ermitteln. Für den AST findet
kein zweiter Parserlauf statt. Vor der LSP-Umsetzung werden Bereiche
anderer physischer Quelldateien ausgeschlossen und doppelte Zeilenbereiche
entfernt.

**Weiterhin offen:** Andere Präprozessorindizes (insbesondere Makro- und
Compiler-Options-Hover) sowie weitere Compilerdiagnosen besitzen nicht
durchgängig eine vorkommensbezogene Herkunft. Diese Funktionen dürfen bei
wiederholten Includes keine beliebige Auswertung präsentieren. Weitere
Diagnosen dürfen nicht ohne ausreichenden Herkunftsnachweis einem
beliebigen Include-Vorkommen zugeordnet werden.

### Identität einzelner Include-Vorkommen (Infrastruktur ab Dev_0_3, Paket 05)

Der Präprozessor erfasst zusätzlich zur deduplizierten Abhängigkeitsmenge
`includedSourceUris` nun die **einzelnen tatsächlich ausgeführten**
`#include`-Vorkommen in `PreprocessorContext.includeOccurrences`. Jedes
`IncludeOccurrence` enthält eine Kette physischer `#include`-Stellen
(URI der einbindenden Datei, Offset der Direktive und URI der eingebundenen
Datei) sowie den Bereich dieses Vorkommens im gemeinsamen expandierten Text.
Damit sind zwei Einbindungen derselben Datei innerhalb einer Übersetzungseinheit
und auch mehrfach erreichte verschachtelte Includes unterscheidbar.

Die aus der Kette gebildete Identität ist unabhängig von der Länge des
Expansionstextes. Ein normaler Textwechsel innerhalb der eingebundenen Datei
ändert ihre Identität daher nicht; wird eine einbindende Direktive verschoben
oder die Einbindungskette verändert, kann eine spätere Auswahl ungültig werden.
Die Bereiche im Expansionstext dürfen dagegen nach jeder Analyse neu sein.

`Validator.analyze()` übergibt diese Vorkommen als Metadaten in
`AnalysisResult.includeOccurrences`. Es wird weiterhin **genau ein**
expandierter Text, Parserlauf, AST und semantischer Kontext pro
Übersetzungseinheit erzeugt. `SourceValue.lexicalLocation` enthält bereits
die Position im expandierten Text, während `location` auf die physische
Quelle verweist; diese Unterscheidung bildet die Grundlage für eine spätere
vorkommensbezogene Positionssuche.

Die Ergänzung der vorkommensbezogenen CodeLens und AST-Lookup-Grenze ist
in Paket 06 umgesetzt; verbleibende Besonderheiten der Präprozessorindizes
und Diagnoseveröffentlichung sind oben ausdrücklich als offen dokumentiert.

Referenzimplementierungen:
- `/src/server/preproc/includeOccurrence.ts`
- `/src/server/preproc/preprocessor.ts`
- `/src/server/preproc/preprocessorContext.ts`
- `/src/server/source/expandedSource.ts`
- `/src/server/validation/analysisResult.ts`
- `/src/server/preproc/tests/includeOccurrences.test.ts`
- `/src/server/utility/tests/includeOccurrenceSelection.test.ts`
- `/src/server/core/sourceValue.ts`
- `/src/server/semanticTokens/sourceHighlightMapper.ts`

Referenzimplementierungen:
- `/src/server/utility/documentRegistry.ts`
- `/src/server/lsp/diagnosticPublicationManager.ts`
- `/src/server/server.ts`
- `/src/server/utility/tests/includeContextSelection.test.ts`

### Navigationsbezogene Include-Kontextübernahme (Dev_0_3, Paket 16)

Die bestehende CodeLens-Auswahl ist ein **expliziter** Nutzerzustand pro
physischer Includedatei. Eine reine `textDocument/definition`-Abfrage darf
diesen Zustand nicht verändern, weil VS Code denselben Request auch für
Peek Definition verwendet.

Der Compiler ermittelt die Definition einschließlich ihrer
`SourceValue.lexicalLocation`. Der Server kann daraus über
`IncludeOccurrence` die vollständige Einbindungskette und ihre stabile ID
bestimmen. Die read-only Anfrage `pearl/resolveDefinitionContext` liefert
nur dann ein Ergebnis, wenn der tatsächliche Definitionsort und die
konkrete Einbindung eindeutig übereinstimmen. Der Client merkt sich dieses
Ergebnis kurzzeitig und aktiviert es über `pearl/activateNavigationContext`
erst nach einem zum Definitionsziel passenden Wechsel in den aktiven Editor.
Die Aktivierung verwendet dieselbe Registry- und Refresh-Funktion wie die
manuelle CodeLens-Auswahl; der Compiler bleibt davon unabhängig.

Der Herkunftsnachweis folgt **der tatsächlichen Include-Kette**, unabhängig
von Dateiendungen oder Workspace-Grenzen. Beim Navigieren in eine bekannte
externe Includedatei kann der Client gezielt deren Dokument-Sprachmodus auf
PEARL setzen. Er ordnet aber **nicht** pauschal alle Dateien mit einer
bestimmten Endung zu. Die Behandlung von direktem Öffnen unbekannter
Dateien sowie die Überwachung externer Dateien ohne geöffneten Editor
sind davon getrennte Aufgaben und mit Paket 16 nicht gelöst.

### Native Peek Definition: bewusst akzeptierte Einschränkung (Dev_0_3 / 0.3.1)

Die native Peek-Ansicht von VS Code verwendet für die Definition dieselbe
physische Datei und dieselbe URI wie ein regulärer Editor. Eine
`textDocument/definition`-Anfrage unterscheidet nicht zuverlässig zwischen
*Go to Definition* und *Peek Definition*. Auch anschließende semantische
LSP-Anfragen (beispielsweise Hover und Referenzen) übermitteln keine
Identität der jeweiligen Peek-Ansicht oder die Herkunft des aufrufenden
Include-Vorkommens.

Unsere Include-Kontextauswahl ist dagegen bewusst an die physische Datei
und das konkrete `IncludeOccurrence` gebunden. Sie kann deshalb für ein
Peek-Fenster keinen eigenständigen, gleichzeitig zu einem normalen Editor
abweichenden Kontext garantieren. Daraus folgt die verbindliche Regel:
**Eine Definitionsabfrage allein darf den gespeicherten Include-Kontext
nicht verändern.** Erst die tatsächliche Navigation in einen regulären
Ziel-Editor darf den ermittelten Herkunftskontext automatisch aktivieren.

Bei einer direkt geöffneten, mehrfach eingebundenen Datei ohne gewählten
Kontext bleiben semantische Funktionen in Peek gegebenenfalls eingeschränkt.
Das ist kein Fehler in der Compileranalyse und wird nicht durch die Wahl
eines beliebigen Parent-Moduls kaschiert. Der vorgesehene Weg ist, die
Includedatei regulär zu öffnen und über die CodeLens den passenden
Einbindungskontext auszuwählen. Anschließend können auch die semantischen
Informationen der Peek-Ansicht diesen Kontext verwenden. Ein direkter
*Go to Definition*-Sprung übernimmt den bekannten Herkunftskontext wie
oben beschrieben.

Für Dev_0_3 / 0.3.1 wird **bewusst keine Peek-Sonderlösung** eingeführt:
kein temporäres Umschalten des global gespeicherten Kontexts bei einer
Definitionsanfrage, keine künstlichen virtuellen Kopien physischer Dateien
und keine eigene Peek-Oberfläche. Diese Ansätze würden zusätzliche Zustände,
Source-Mapping und Aktualisierungslogik erfordern beziehungsweise andere
Editoransichten beeinflussen. Der Aufwand und das Stabilitätsrisiko stehen
zurzeit in keinem angemessenen Verhältnis zum Nutzen. Die Entscheidung kann
neu bewertet werden, falls VS Code/LSP künftig eine belastbare,
ansichtsspezifische Kontextübergabe ermöglicht.

---

# Folding

Folding-Regionen werden von dem AST-Knoten erzeugt, der die vollständige syntaktische Struktur kennt – nicht notwendigerweise von dem Knoten, der den gefalteten Bereich selbst repräsentiert.

# Syntaxhervorhebung und RTOS-UH-Hexzahlen (Dev_0_3 / 0.3.2)

Die TextMate-Grammatik (`syntaxes/pearl.tmLanguage.json`) dient ausschließlich
der lexikalischen Darstellung im Editor. Sie ist weder Bestandteil der
Compileranalyse noch die normative Quelle für die PEARL-Syntax.

Fuer RTOS-UH-Hexzahlen ohne `$`-Präfix werden nur eng umrissene
syntaktische Kontexte hervorgehoben: das Hexargument von `EV(...)`, das
erste Argument von `BU(...)`, sowie die Kopfoptionen `S`/`SC`, `CODE`
und `VAR`. Der nachgestellte Zugriffscode bei `BU(hexadresse,code)`
bleibt dezimal. Die Werte von `MB=$...` und `AI=$...` erfasst bereits die
allgemeine Regel für `$`-Hexzahlen. Die Sonderform `/*+R=hexwert ... */`
(bzw. `/*-R... */`) wird innerhalb eines Compilerkommentars gesondert
erkannt. BIT-Literale mit `B4` bleiben eigene Token.

Alle diese Werte erhalten `constant.numeric.hex.pearl`. Eine pauschale
Klassifizierung aller Ziffernfolgen mit Zeichen `A` bis `F` wäre falsch,
da die Bedeutung vom syntaktischen Kontext abhängt. Lexer und Parser
werden für Editorfarben nicht modifiziert. Die TextMate-Grammatik
validiert keine Ausdruecke; verbindliche Diagnosen entstehen ausschließlich
aus der Compileranalyse.

## RTOS-UH: Längen von Hexwerten in SYSTEM-Deklarationen (0.3.2)

Bei `EV(hexnum8)` gelten **1 bis 8** Hexziffern (RTOS-UH,
Abschnitt 6.12; das zugrundeliegende Ereignismuster hat 32 Bit).
Die Schreibweise muss weder links mit Nullen aufgefüllt werden noch exakt
achtstellig sein. Die Prüfung verbleibt bei `InterruptSystemObjectParser`
und verwendet die generische Bereichsprüfung im `ParserBase`.

Bei alphanumerischen SYSTEM-DATIONs verwendet RTOS-UH (Abschnitt 5.5.1)
`MB=$xx` mit **exakt 2** Hexziffern und `AI=$xx` bzw.
`AI=$xxxx` mit **exakt 2 oder 4** Hexziffern. Drei Ziffern sind
insbesondere **nicht** zulässig. `AlphicDationSystemObjectParser`
benutzt dazu die gemeinsame Prüfung für explizit erlaubte Längen;
das `$`-Präfix zählt nicht mit. Die `SourceValue`-Repräsentation
bewahrt die ursprüngliche Schreibweise; es findet keine implizite
Nullauffüllung oder neue Typsemantik statt. Die TextMate-Regeln
sind von diesen Compilerprüfungen unabhängig.

---

## RTOS-UH: 32-Bit-Hexwerte bei Moduloptionen und R-Steuerkommentaren (0.3.2)

Die Modul-Kopfeinstellungen `S=`, `SC=`, `CODE=` und `VAR=` tragen
Modulgroessen bzw. Startadressen im 32-Bit-Format. Sie akzeptieren mit
oder ohne `$`-Praefix **1 bis 8 Hexziffern**. Die achtstellige Grenze
wird in `resolveModuleControls()` waehrend der semantischen Auswertung
geprueft, nicht in der generischen Lexer- oder Parserprimitive.
Dabei zaehlt das `$`-Praefix nicht mit; auch neun Stellen mit fuehrender
Null sind unzulaessig. Bei Ueberschreitung entsteht
`InvalidCompilerSettingValue`. Der AST bewahrt die Quellschreibweise;
es findet weder Rundung noch Abschneiden auf 32 Bit statt.

Der RTOS-UH-Steuerkommentar `/*+R...*/` bzw. `/*-R...*/` (Handbuch
Abschnitt 5.4.8) ist explizit auf **maximal 8 Hexziffern** beschraenkt.
Gleichheitszeichen und `$` sind optional (z.B. `/*+R=$5000 Text */`,
`/*+R5000 Text */`). Compilersteuerkommentare bleiben lexikalische
Information und werden nicht in den PEARL-AST ueberfuehrt.
`CompilerControlAnalyzer` prueft bei erkennbaren R-Hexangaben deren
Laenge. Er meldet eine zu lange Angabe als **LSP-Warnung**, nicht als
Parser- oder Compilerfehler: RTOS-UH dokumentiert, dass fehlerhafte
Steuerkommentare ohne Compilerwarnung wirkungslos bleiben koennen.
Die Implementierung interpretiert die Speicherreservierung selbst nicht
und aendert keine Kompilieroptionen.

---

## Worker-Ausführung der Compilerpipeline (erste Integration)

Nach erfolgreich getesteter Snapshot-Erfassung und vollständigem
`AnalysisResult`-Roundtrip steht ein erster `WorkerAnalysisExecutor` bereit.
Die Ausführung ist **explizit zuschaltbar**, nicht globaler Default:
`PEARL_ANALYSIS_EXECUTOR=worker`. Ohne diese Umgebungsvariable verwendet
`server.ts` weiterhin `LocalAnalysisExecutor`. Die zweite F5-Konfiguration
`Run PEARL Extension (Worker)` startet gezielt den Worker-Modus.

**Zuständigkeiten und Grenzen:**

- `AnalysisScheduler` verwaltet weiterhin Auftragsreihenfolge, Prioritäten und
  Debouncing; `DocumentRegistry` vergibt Request-IDs, besitzt die Ergebnisse
  und entscheidet allein über deren Gültigkeit. Inklusive der Prüfung aller
  Quellversionen **nach** der asynchronen Analyse bleibt die Orchestrierung in
  `server.ts`. Ein Worker publiziert keine Diagnostics und verändert keine
  LSP-Provider oder Registry-Objekte.
- Der `AnalysisSnapshotCollector` zeichnet die tatsächlich ausgeführten
  Includes auf. Erst der **abgeschlossene** `AnalysisExecutionInput` mit
  `includeSnapshots` darf an den Worker gesendet werden; fehlende Daten
  erzeugen einen Fehler. Der Worker besitzt weder `DocumentRegistry` noch
  `WorkspaceManager` und benötigt keinen Dateisystemzugriff. Die für ihn
  verwendete `Validator(logger)`-Konstruktionsform verlangt einen expliziten
  `IncludeSourceResolver` beim Analyseaufruf; die bisherige
  `Validator(workspaceManager, registry, logger)`-Form bleibt vorerst kompatibel.
- `analysisWorkerProtocol.ts` definiert Daten-Nachrichten mit Request-ID.
  Der Worker führt den Validator mit `SnapshotIncludeSourceResolver` aus,
  kodiert das Ergebnis mit `encodeAnalysisResult` und sendet ausschließlich
  `AnalysisResultWire` zurück. `WorkerAnalysisExecutor` rekonstruiert vor
  dem Auflösen des Promise mit `decodeAnalysisResult` die echten Compilerobjekte.
- Der erste Executor hält **einen dauerhaften Worker** und sendet höchstens
  einen Auftrag gleichzeitig. Intern wartet eine FIFO-Liste. Bei Fehlern
  werden die betroffenen Promises abgelehnt, bei Worker-Ausfall alle offenen
  Promises. **Keine stille lokale Ersatzanalyse**, da diese den LSP-Hauptthread
  wieder blockieren würde. Shutdown beendet den Thread und lehnt offene
  Aufträge ab. Ein automatischer Neustart oder ein Worker-Pool gehört noch
  nicht zu dieser Version.
- Das esbuild-Projekt baut `analysisWorker.ts` als **zweites Server-Bundle**
  `dist/server/analysisWorker.js`; `server.ts` übergibt dessen expliziten
  Pfad an den Executor. Das ist für VS-Code-Extension-Hosts erforderlich:
  ein direktes Starten nicht gebündelter TypeScript-Quelldateien ist kein
  verlässlicher Produktionspfad.
- `analysis.worker` protokolliert Validator-, Kodierungs- und
  **Hauptthread-Dekodierungszeit** sowie die Gesamtdauer. Die Dekodierung
  bleibt vorläufig synchron im LSP-Hauptthread; die Event-Loop kann dadurch
  bei großen Übersetzungseinheiten weiterhin verzögert werden. Die
  Snapshot-Erfassung läuft ebenfalls noch im Hauptthread. Der Scheduler
  startet vorerst auch im Worker-Modus keine zweite TU, bevor die erste
  abgeschlossen ist: Dies ist **Isolation, noch keine TU-Parallelisierung**.
- Der Worker erhält standardmäßig keine Debugger-`execArgv` des Elternthreads,
  damit parallele Debug-Ports nicht kollidieren. Debugging des Workers benötigt
  später eine gesonderte Konfiguration.

**Absicherung:**

- Unit-Tests prüfen FIFO-Reihenfolge, Quellversionen, geschlossene Snapshots,
  Worker-Fehler, ungültige IDs, Exit, PostMessage-Fehler und Dispose.
- Ein Integrationstest startet einen **echten Worker-Thread** mit der
  tatsächlichen Validatorpipeline und vergleicht sein rekonstruiertes
  `AnalysisResult` mit einem lokalen Ergebnis. Der Test-Bootstrap lädt die
  TypeScript-Quelldatei nur für `node:test`; produktiv gilt ausschließlich
  der esbuild-Einstiegspunkt.
- Die bisherigen Provider-Paritätstests bleiben maßgeblich. Erst nach
  erfolgreichen F5-Integrationstests im expliziten Worker-Modus darf dessen
  Aktivierung als Default erwogen werden. Mehrere Worker und das
  Last-/Speichermanagement bilden einen eigenen Folgeschritt.

Referenzimplementierungen:
- `/build.mjs`
- `/.vscode/launch.json`
- `/src/server/analysisWorker.ts`
- `/src/server/utility/analysisWorkerProtocol.ts`
- `/src/server/utility/workerAnalysisExecutor.ts`
- `/src/server/utility/analysisExecutor.ts`
- `/src/server/utility/transport/analysisResultTransport.ts`
- `/src/server/validation/validator.ts`
- `/src/server/utility/tests/workerAnalysisExecutor.test.ts`
- `/src/server/utility/tests/workerAnalysisIntegration.test.ts`

---

## Messinstrumentierung und CodeLens-Refresh bei Worker-Analysen

Nach der ersten F5-Messung mit einem Worker (15 Uebersetzungseinheiten)
werden die noch gebuendelten Worker-Transportzeiten aufgeschluesselt, bevor
mehrere Worker eingefuehrt werden. **Die Ausfuehrung bleibt vorerst
sequentiell in genau einem Worker** und weiterhin explizit zuschaltbar.

**Zeitmessung am Thread-Uebergang:**

- `analysis.worker` protokolliert `queueMs` (Wartezeit im Executor),
  `requestPostMs` (synchroner `Worker.postMessage`-Aufruf im LSP),
  `requestTransferMs` (Rueckkehr aus `postMessage` bis Worker-Empfang),
  `workerSetupMs` (Dokument/Resolver/Validator aufbauen),
  `analyzeMs` (Validator), `encodeMs` (Ergebnis kodieren),
  `resultTransferMs` (Beginn des Antwort-`postMessage` bis Empfang im LSP),
  `decodeMs` (Klassen und Indizes wiederherstellen), `otherMs` (verbleibende
  Messdifferenz) sowie `totalMs` (gesamter Auftrag).
- Anfang und Ende der Uebertragungsstrecken werden ueber
  `performance.timeOrigin + performance.now()` in beiden Node-Worker-Threads
  auf derselben Zeitachse gemessen. Die Zeitpunkte liegen im versionierten,
  nur aus Daten bestehenden Worker-Protokoll. Die Tests pruefen auch einen
  echten Worker-Roundtrip mit nahezu geschlossener Zeitbilanz.
- `requestTransferMs` schliesst beim **ersten** Auftrag die Worker-Anlaufzeit
  ein. `resultTransferMs` schliesst **sowohl** Structured-Clone/MessagePort
  **als auch** Wartezeiten des LSP-Eventloops ein. Eine Unterscheidung von
  Klonzeit und Scheduling innerhalb dieser Strecke ist daraus allein noch
  nicht moeglich. Die Zahlen sind Messungen, keine Ursachenzuschreibung.
- `analysis.commit` verwendet weiterhin die bestehenden
  `validatorSyncMs`/`validatorAwaitMs`; `analysis.worker` ist die detaillierte
  Aufschluesselung. Der Transport veraendert die Gueltigkeits- und
  Versionspruefungen des `DocumentRegistry` nicht.

**CodeLens-Refresh bei Analyse-Batches:**

- `AnalysisScheduler` meldet ueber einen allgemeinen Activity-Callback den
  Uebergang von *idle* nach *busy* und zurueck. *Busy* schliesst sowohl
  wartende als auch gerade laufende Analyseauftraege ein; ein Batch endet
  erst, wenn beides leer ist. Der Scheduler selbst kennt keine CodeLens.
- `CodeLensRefreshController.scheduleAnalysis()` fasst
  analysebedingte Aktualisierungen (Commits und Versionenuebernahme beim
  Oeffnen von Includedateien) bis zum Scheduler-Leerlauf zusammen. Ein
  bereits vorgemerkter, noch nicht gesendeter Analyse-Refresh kann in den
  naechsten Batch uebernommen werden.
- `CodeLensRefreshController.schedule()` bleibt fuer explizite
  Benutzeraktionen wie die Auswahl eines Include-Kontexts sofort wirksam.
  Ein laufender Analyse-Batch darf diese Anzeige nicht blockieren.
  Vorhandenes In-Flight-Handling verhindert weiterhin ueberlappende globale
  Refresh-Anfragen. Andere LSP-Funktionen, die Publikation einzelner
  Diagnostics und die CodeLens-Kontextauswahl werden nicht verzoegert.
- Der Batch-Refresh kann die erste automatische CodeLens-Aktualisierung bis
  zum Ende eines groesseren Analyse-Batches verschieben. Das entspricht dem
  gewaehlten Ziel, redundante globale Refresh-Anfragen zu vermeiden; es ist
  kein allgemeines Drosseln aller LSP-Funktionen.

Referenzimplementierungen:
- `/src/server/utility/analysisScheduler.ts`
- `/src/server/lsp/codeLensRefreshController.ts`
- `/src/server/server.ts`
- `/src/server/utility/analysisWorkerProtocol.ts`
- `/src/server/analysisWorker.ts`
- `/src/server/utility/workerAnalysisExecutor.ts`
- `/src/server/utility/tests/analysisScheduler.test.ts`
- `/src/server/lsp/tests/codeLensRefreshController.test.ts`
- `/src/server/utility/tests/workerAnalysisExecutor.test.ts`
- `/src/server/utility/tests/workerAnalysisIntegration.test.ts`

---

## Kontrollierte Parallelisierung kompletter Uebersetzungseinheiten (2 Worker)

Nach der Ein-Worker-Messung und der Aufschluesselung der Ruecktransportzeiten
kann der Worker-Modus fuer einen getrennten Vergleich mit **zwei** Threads
betrieben werden. Der lokale Executor bleibt Standard; die vorhandene
Ein-Worker-F5-Konfiguration bleibt unveraendert. Die zusaetzliche Konfiguration
`Run PEARL Extension (2 Workers)` setzt `PEARL_ANALYSIS_EXECUTOR=worker` und
`PEARL_ANALYSIS_WORKERS=2`. Die Workeranzahl ist explizit (1 bis 16), kein
automatischer Default, damit Benchmark-Ergebnisse reproduzierbar bleiben.

**Verantwortlichkeiten:**

- `AnalysisScheduler` vergibt mit `maxConcurrent=2` bis zu zwei *verschiedene*
  Translation Units gleichzeitig. Priorisierung, Debounce und Ersetzen
  ausstehender Auftraege bleiben dort. Zwei Analysen derselben Root-URI duerfen
  niemals gleichzeitig laufen, auch wenn waehrend eines laufenden Workers
  neue Bearbeitungsereignisse eintreffen. Der lokale Modus bleibt bei
  `maxConcurrent=1`.
- `WorkerPoolAnalysisExecutor` besitzt ausschliesslich mehrere isolierte
  `WorkerAnalysisExecutor`-Instanzen und deren Ressourcennutzung. Seine eigene
  FIFO-Warteschlange ist nur Backpressure und trifft keine fachlichen
  Prioritaets- oder Versionsentscheidungen. Worker besitzen keine Referenzen
  auf `DocumentRegistry` oder `WorkspaceManager`.
- `DocumentRegistry` vergibt weiterhin Request-IDs und prueft allein die
  Ergebnisgueltigkeit. `server.ts` prueft nach jedem asynchronen Resultat die
  Root-Version und alle erfassten Include-Quelltexte erneut. Ein supersediertes
  Ergebnis wird verworfen und nie publiziert; Commit und LSP-Provider verbleiben
  im Hauptthread.
- Der Scheduler meldet `busy`, solange mindestens ein Auftrag laeuft oder
  wartet. Der analysebedingte CodeLens-Refresh wird erst nach dem *gesamten*
  parallelen Batch gesendet; eine ausdrueckliche Kontextwahl bleibt sofort
  wirksam.
- `analysis.executor` protokolliert `workers`, `analysis.worker` enthaelt
  `workerId` (1-basiert). Saemtliche Transportmessungen bleiben je Worker
  erhalten. Der `resultTransferMs` kann auch bei mehreren Workern Eventloop-
  Wartezeit einschliessen; Messungen sind keine Ursachenanalyse. Der
  Hauptthread rekonstruiert Ergebnisse weiterhin synchron, wodurch kurze
  Blockaden beim Decode bestehen bleiben.

Referenzimplementierungen:
- `/src/server/utility/analysisScheduler.ts`
- `/src/server/utility/workerPoolAnalysisExecutor.ts`
- `/src/server/utility/workerAnalysisExecutor.ts`
- `/src/server/server.ts`
- `/.vscode/launch.json`
- `/src/server/utility/tests/analysisScheduler.test.ts`
- `/src/server/utility/tests/workerPoolAnalysisExecutor.test.ts`
