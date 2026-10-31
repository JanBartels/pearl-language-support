# Projektquellen

Dieses Dokument beschreibt die Architektur des Projekts.

Die Implementierung befindet sich im öffentlichen GitHub-Repository:

https://github.com/JanBartels/pearl-language-support/tree/Dev_0_2

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
- `/src/server/ast/moduleNode.ts`

---

## AST-Knoten besitzen keine Quelltextposition

`AstNode` besitzt selbst bewusst keine eigene `Location`, die seine Position und Ausdehnung beschreibt.

Ein AST-Knoten beschreibt eine syntaktische Konstruktion.

Quelltextpositionen gehören dagegen ausschließlich zu den tatsächlich im
Quelltext vorkommenden Sprachelementen und werden deshalb durch
`SourceValue<T>` repräsentiert.

Dadurch bleibt die Zuordnung zwischen Sprachelement und Quelltext eindeutig.

Referenzimplementierung:
- `/src/server/ast/moduleNode.ts`

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
- `/src/server/ast/moduleNode.ts`

---

## Lookup erfolgt im AST

Jeder AST-Knoten implementiert

```ts
lookupSourceValue(offset): AstLookupResult | undefined
```

Diese Methode entscheidet

- welche `SourceValue`s zum Knoten gehören,
- welche Kindknoten durchsucht werden.

Dadurch bleibt das Wissen über die syntaktische Struktur vollständig im
jeweiligen AST-Knoten.

Referenzimplementierung:
- `/src/server/ast/moduleNode.ts`

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
- `/src/server/ast/moduleNode.ts`
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

Folding arbeitet auf den Analyseergebnissen.

Mögliche Informationsquellen sind

- AST
- Blockkommentare

Dadurch können strukturelle und kommentarbezogene Faltungsbereiche
einheitlich behandelt werden.

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

# Folding

Folding-Regionen werden von dem AST-Knoten erzeugt, der die vollständige syntaktische Struktur kennt – nicht notwendigerweise von dem Knoten, der den gefalteten Bereich selbst repräsentiert.
