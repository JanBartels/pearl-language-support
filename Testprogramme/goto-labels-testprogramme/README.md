# PEARL GOTO- und Label-Testprogramme

Die Dateien sind eigenstaendige PEARL-Module (.P). Jeweils einzeln im LSP oeffnen.
Vor jedem MODULE steht SC=$2000, damit die Warnung wegen fehlender Modulinitialisierung nicht stoert.
OK = keine GOTO-/Label-Diagnose; ERROR = erwartete Diagnose; CHECK = semantische Auslegung pruefen; PARSE = Lexer-/Parser-Regression.
Die Testprogramme wurden aus den bereitgestellten Parserquellen und dem Sprachreport abgeleitet; kein vollstaendiger Lauf gegen das aktuelle Repository ist erfolgt.

## Erwartete Ergebnisse

### 01_OK_Basics.P [OK]
- Keine GOTO-Diagnose. Vorwaertsreferenz und zwei Marken vor einer Anweisung.

### 02_OK_LeaveBlock.P [OK]
- Keine GOTO-Diagnose. Aus einem geschachtelten BEGIN-Block nach aussen springen.

### 03_ERR_EnterBlock.P [ERROR]
- Eine GOTO-Diagnose an 'Inside' in 'GOTO Inside;': Sprung von aussen in BEGIN verboten.

### 04_ERR_SiblingBlocks.P [ERROR]
- Eine GOTO-Diagnose an 'Right': Sprung zwischen benachbarten BEGIN-Bloecken.

### 05_OK_RepeatInternalExit.P [OK]
- Keine GOTO-Diagnose: innerer Ruecksprung und Verlassen von REPEAT.

### 06_ERR_EnterRepeat.P [ERROR]
- Eine GOTO-Diagnose an 'LoopBody': Sprung in REPEAT verboten.

### 07_ERR_SiblingLoops.P [ERROR]
- Eine GOTO-Diagnose an 'OtherLoop': Sprung zwischen Schleifenkoerpern.

### 08_ERR_NestedRepeatEntry.P [ERROR]
- Eine GOTO-Diagnose an 'DeepLoop': Sprung von aeusserer in innere Schleife.

### 09_OK_NestedRepeatExit.P [OK]
- Keine GOTO-Diagnose: Sprung aus innerer zur aeusseren Schleife.

### 10_OK_CaseExit.P [OK]
- Keine GOTO-Diagnose: CASE mit GOTO nach FIN verlassen.

### 11_ERR_EnterCase.P [ERROR]
- Eine GOTO-Diagnose an 'InCase': Sprung von aussen in CASE verboten.
- Hinweis: Bekannte Luecke im derzeitigen LabelResolver: CASE erzeugt keinen eigenen Scope.

### 12_CHECK_CaseBetweenAlts.P [CHECK]
- Prueffall: Sprung in einen anderen ALT-Zweig; voraussichtlich zu untersagen, aber durch Reportformulierung nicht explizit einzeln erlaeutert.
- Hinweis: Nicht als verbindlich erwarteter Fehler einstufen, bis die Regel fuer Wechsel zwischen ALT-Zweigen festgelegt ist.

### 13_ERR_CrossProcedures.P [ERROR]
- Zwei Diagnosen 'Unbekannte Sprungmarke': Spruenge duerfen Prozedurgrenzen nicht ueberschreiten.

### 14_ERR_DuplicateUnknown.P [ERROR]
- Eine Diagnose fuer doppelte Marke 'Duplicate' und eine fuer unbekanntes Ziel 'Missing'.

### 15_OK_AssignmentDiscriminator.P [PARSE]
- Keine falsche Diagnose 'Expected : after statement label A'.
- GOTO WithAssignment soll das vorangehende Label aufloesen.
- Hinweis: Zuweisungs-Statements werden vom aktuellen StatementParser noch uebersprungen; hier wird nur das Lexing/Label-Parsing getestet.

## Relevante Sprachregeln

PEARL-Sprachreport (deutsch, 1995):
- Abschnitt 4.3: Spruenge in BEGIN-Bloecke hinein sind untersagt.
- Abschnitt 7.2: Spruenge in eine CASE-Anweisungsauswahl hinein sind verboten.
- Abschnitt 7.3: Spruenge in den Schleifenkoerper hinein sind untersagt; Verlassen per GOTO ist moeglich.
- Abschnitt 7.4: Ein GOTO-Ziel muss eine Anweisung im Koerper derselben TASK oder PROC sein; mehrere Labels pro Anweisung sind moeglich.

## Gegenwaertig erkennbare Implementierungsluecke

Der LabelResolver nutzt ScopeKind.Module/Task/Procedure/Block/Repetition. CASE und ALT erzeugen laut AST keinen Scope. Das kann dazu fuehren, dass 11_ERR_EnterCase.P keine Fehlermeldung ausloest, obwohl der Sprachreport sie verlangt. Bei 12_CHECK_CaseBetweenAlts.P ist die Auslegung der inneren Zweiggrenzen gesondert zu entscheiden.

Alle Programme sind statische Compiler-/LSP-Tests; sie sind nicht fuer die Ausfuehrung gedacht (Rueckspruenge koennen Endlosschleifen bilden).
