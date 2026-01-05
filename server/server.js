// https://github.com/microsoft/vscode/wiki/Semantic-Highlighting-Overview/887dec50de3282c23983130f72e2f94a8e7e5368

/*
 * Copyright (C) 2025 Jan Bartels
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity,
  DiagnosticTag
} = require('vscode-languageserver');

const { TextDocument } = require('vscode-languageserver-textdocument');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

/*
namespace – Namespaces, Module, Packages
type – generische oder sonstige Typen, die nicht besser zuordenbar sind (Fallback)
class – Klassen
enum – Enums
interface – Interfaces
struct – Structs
typeParameter – Typparameter (z. B. T in List<T>)
parameter – Funktions-/Methodenparameter
variable – lokale Variablen, ggf. auch globale, je nach Sprache
property – Eigenschaften / Felder eines Typs
enumMember – einzelne Enum-Werte
event – Events
function – Funktionen (nicht-methodisch, z. B. freie Funktionen)
method – Methoden an Klassen/Interfaces/Structs
macro – Makros (z. B. C- oder Rust-Makros)
keyword – Sprach-Schlüsselwörter
modifier – Sprach-Modifier wie public, private, static etc. (als Token-Typ, nicht zu verwechseln mit Token-Modifiers)
comment – Kommentare
string – String-Literale
number – numerische Literale
regexp – Regex-Literale
operator – Operatoren (z. B. +, ==)
decorator – Dekoratoren / Attribute (z. B. Component)
label – Sprunglabels
*/

const semanticTokenTypes = [
  'type',       // generische oder sonstige Typen, die nicht besser zuordenbar sind (Fallback)
  'variable',   // DCL-Variablen, SPC-Variablen
  'parameter',  // PROC-Parameter
  'function',   // PROC / ENTRY
  'class',      // TASK (oder "class"-ähnlich)
  'property',   // SEMA, BOLT (kannst du auch anders wählen)
  'label',      // Sprungmarken MyLabel:
  'operator',   // Operatoren (z. B. +, ==)  
  'string',     // String-Literale
  'number'      // numerische Literale
];

/*
declaration – die Stelle, an der etwas deklariert wird
definition – die Stelle, an der etwas definiert/implementiert wird (falls getrennt von der Deklaration)
readonly – schreibgeschütztes Symbol (z. B. const)
static – statisches Element
deprecated – veraltetes Symbol
abstract – abstraktes Symbol
async – asynchrones Symbol (z. B. async function)
modification – Stelle, an der ein Wert verändert wird (Assignment, ++ usw.)
documentation – Dokumentationskommentar o. Ä.
defaultLibrary – Symbol stammt aus der Standardbibliothek / Runtime
*/

const semanticTokenModifiers = [
  'declaration', // an der Deklarationsstelle
  'readonly'
];


// ---- Settings handling ----

let hasConfigurationCapability = false;

// Default settings (fallback if client does not support workspace/configuration)
const defaultSettings = {
  maxNumberOfProblems: 100,
  traceServer: 'off'
};

let globalSettings = defaultSettings;

// Per-document settings cache: uri -> Promise<settings>
/** @type {Map<string, Promise<any>>} */
const documentSettings = new Map();


connection.onInitialize((params) => {

  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace &&
    capabilities.workspace.configuration
  );
  
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { resolveProvider: true },
      hoverProvider: true,
      definitionProvider: true,
      foldingRangeProvider: true,
      semanticTokensProvider: {
        legend: {
            // set your tokens here
            tokenTypes: semanticTokenTypes, 
            tokenModifiers: semanticTokenModifiers
        },        
        full: true,     // wir liefern das ganze Dokument
        range: false    // Range-Unterstützung erstmal nicht
      }      
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for configuration change notifications
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
});

/**
 * Get settings for a single document.
 * @param {string} resource document URI
 * @returns {Promise<any>}
 */
function getDocumentSettings(resource) {
  if (!hasConfigurationCapability) {
    // Client does not support workspace/configuration,
    // use global settings as fallback.
    return Promise.resolve(globalSettings);
  }

  let result = documentSettings.get(resource);
  if (!result) {
    // Section must match your settings namespace: "pearl"
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'pearl'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// ------------------------------
// Präprozessor-spezifische Daten
// ------------------------------

const fs = require('fs');
const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');

// key: absoluter Pfad
// value: { mtimeMs, text }
const includeFileCache = new Map();

function filePathFromUri(uri) {
  if (!uri.startsWith('file://')) return null;
  return fileURLToPath(uri);
}

function uriFromFilePath(absPath) {
  return pathToFileURL(absPath).toString();
}

function loadFileTextCached(absPath) {
  try {
    const stat = fs.statSync(absPath);
    const mtimeMs = stat.mtimeMs;

    const entry = includeFileCache.get(absPath);
    if (entry && entry.mtimeMs === mtimeMs) {
      // Cache liefern
      return {
        text: entry.text,
        error: undefined
      };
    }

    // Datei liefern
    const text = fs.readFileSync(absPath, 'utf8');
    includeFileCache.set(absPath, { mtimeMs, text, error: undefined });
    return {
      text,
      error: undefined
    };
  } catch (e) {
    // Fehler liefern
    includeFileCache.delete(absPath);
    return {
      text: '',
      error: e.message
    };
  }
}

// ------------------------------
// PEARL-spezifische Daten
// ------------------------------

const PEARL_KEYWORDS = [
  'ACTIVATE',
  'AFTER',
  'ALL',
  'ALPHIC',
  'ALT',
  'AT',
  'BASIC',
  'BEGIN',
  'BY',
  'CALL',
  'CASE',
  'CLOSE',
  'CONT',
  'CONTINUE',
  'CONTROL',
  'CONVERT',
  'CREATE',
  'CREATED',
  'CYCLIC',
  'DECLARE',
  'DCL',
  'DELETE',
  'DIM',
  'DIRECT',
  'DISABLE',
  'ELSE',
  'ENABLE',
  'END',
  'ENTER',
  'ENTRY',
  'EVERY',
  'EXIT',
  'FIN',
  'FOR',
  'FORBACK',
  'FORMAT',
  'FORWARD',
  'FREE',
  'FROM',
  'GET',
  'GLOBAL',
  'GOTO',
  'HRS',
  'IDENTICAL',
  'IDENT',
  'IDF',
  'IF',
  'IN',
  'INDUCE',
  'INITIAL',
  'INLINE',
  'INOUT',
  'INTFAC',
  'INV',
  'LEAVE',
  'LENGTH',
  'MATCH',
  'MAX',
  'MIN',
  'MODEND',
  'MODULE',
  'NIL',
  'NOCYCL',
  'NOMATCH',
  'NOSTREAM',
  'ON',
  'ONEOF',
  'OPEN',
  'OPERATOR',
  'OUT',
  'PRECEDENCE',
  'PRESET',
  'PREVENT',
  'PRIORITY',
  'PRIO',
  'PROBLEM',
  'PROCEDURE',
  'PROC',
  'PUT',
  'READ',
  'REENT',
  'REF',
  'RELEASE',
  'REPEAT',
  'REQUEST',
  'RESERVE',
  'RESIDENT',
  'RESUME',
  'RETURN',
  'RETURNS',
  'SEC',
  'SEMASET',
  'SEND',
  'SHELLMODULE',
  'SIGNAL',
  'SPECIFY',
  'SPC',
  'STREAM',
  'STRUCT',
  'SUSPEND',
  'SYS',
  'SYSTEM',
  'TAKE',
  'TASK',
  'TERMINATE',
  'TFU',
  'THEN',
  'TO',
  'TRIGGER',
  'TRY',
  'TYPE',
  'UNTIL',
  'UPON',
  'USING',
  'WHEN',
  'WHILE',
  'WRITE'
];

const TYPE_KEYWORDS = [
  'BIT',
  'BOLT',
  'CHAR',
  'CHARACTER',
  'CLOCK',
  'DATION',
  'DURATION',
  'FIXED',
  'FLOAT',
  'INTERRUPT',
  'INTRPT',
  'SEMA'
];

const OPERATOR_KEYWORDS = [
  'ABS',
  'AND',
  'CAT',
  'COS',
  'CSHIFT',
  'DATE',
  'ENTIER',
  'EQ',
  'EXOR',
  'EXP',
  'FIT',
  'GE',
  'GT',
  'IS',
  'ISNT',
  'LE',
  'LN',
  'LT',
  'LWB',
  'NE',
  'NOT',
  'OR',
  'REM',
  'ROUND',
  'SIGN',
  'SIN',
  'SQRT',
  'TAN',
  'TANH',
  'TOBIT',
  'TOCHAR',
  'TOFIXED',
  'TOFLOAT',
  'UPB'
];

const PREPOCESSOR_KEYWORDS = [
  // RTOS-UH-Compiler-Einbaubefehle
  '#DEFINE',  // #DEFINE identifier = xcompconstexpression; Wirkt global und lokal
  '#INCLUDE', // #INCLUDE filepathlist;
  '#IF',      // #IF xcompconstexpression;
  '#IFDEF',   // #IFDEF identifier;
  '#IFUDEF',  // #IFUDEF identifier;
  '#ELSE',
  '#FIN',
  // RT-PREPROZ
  '#define',  // #define identifier ["value"]
  '#undef',   // #undef identifier
  '#include', // #include filepath
  '#path',    // #path path
  '#ifdef',   // #ifdef identifier
  '#ifndef',  // #ifndef identifier
  '#else',
  '#endif'
];

const BLOCK_START_KEYWORDS = new Set([
  'MODULE',
  'SHELLMODULE',
  'TASK',
  'PROC',
  'BEGIN',
  'REPEAT',
  'IF',
  'CASE'
]);

// Block-Ende-Mapping
const BLOCK_END_MAP = {
  MODULE: 'MODEND',
  SHELLMODULE: 'MODEND',
  TASK: 'END',
  PROC: 'END',
  PROCEDURE: 'END',
  REPEAT: 'END',
  BEGIN: 'END',
  IF: 'FIN',
  CASE: 'FIN'
};

const END_KEYWORD_MAP = {
  END: ['TASK', 'PROC', 'REPEAT', 'BEGIN'],
  ELSE: ['IF'],
  FIN: ['IF', 'ELSE', 'CASE'],
  MODEND: ['MODULE', 'SHELLMODULE']
};

const TASK_CTRL_KEYWORDS = ['ACTIVATE', 'PREVENT', 'TERMINATE', 'SUSPEND', 'RESUME'];
const SEMA_OP_KEYWORDS = ['REQUEST', 'RELEASE'];
const BOLT_OP_KEYWORDS = ['ENTER', 'LEAVE', 'RESERVE', 'FREE'];

// ------------------------------
// Tokenizer
// ------------------------------

const documentTokenCache = new Map();

/**
 * Token an Position (line, character) suchen.
 */
function findTokenAt(tokens, uri, line, character) {
  for (const t of tokens) {
    if (t.line !== line) continue;
    if (t.uri !== uri) continue;
    if (character >= t.column && character <= t.column + t.length) {
      return t;
    }
  }
  return null;
}

// ------------------------------
// Analyse für Diagnostics & Definitionen
// ------------------------------

/**
 * Gemeinsame Analyse:
 * - baut Blockstack und Scope-Stack
 * - trägt DCL/SPC/PROC/TASK/SEMA/BOLT in Scopes ein
 * - erzeugt bei Bedarf Diagnostics
 *
 * options:
 *  - stopOffset: nur Token bis zu diesem Offset auswerten (für GoTo Definition)
 *  - collectDiagnostics: boolean
 */
function analyze(uri, text, settings, options) {
  const diagnostics = [];

  const stopOffset = options && typeof options.stopOffset === 'number'
    ? options.stopOffset
    : Number.POSITIVE_INFINITY;
  const collectDiagnostics = options && options.collectDiagnostics;

//https://www.vscodeapi.com/classes/vscode.diagnostic#tags

  function addDiagnostic(severity, message, diagUri, line, column, length, tags = null ) {
    if (diagUri !== uri)  // nicht bei IncludeDateien
      return;

    if ( !Number.isInteger(line)   || line < 0   ||
         !Number.isInteger(column) || column < 0 ||
         !Number.isInteger(length) || length < 0
       ) {
      connection.console.log(`addDiagnostic ${line}:${column}L${length}: ${message}`);
      return;
    }
    if (!collectDiagnostics) return;
    diagnostics.push({
      severity,
      message,
      range: {
        start: { line, character: column },
        end: { line, character: column + length }
      },
      source: 'pearl-lsp',
      tags
    });
  }

  function addDiagnosticErrorPos(message, diagUri, line, column, length) {
    addDiagnostic(DiagnosticSeverity.Error, message, diagUri, line, column, length);
  }

  function addDiagnosticError(message, token) {
    addDiagnostic(DiagnosticSeverity.Error, message, token.uri, token.line, token.column, token.length);
  }

  function addDiagnosticWarningPos(message, diagUri, line, column, length) {
    addDiagnostic(DiagnosticSeverity.Warning, message, diagUri, line, column, length);
  }

  function addDiagnosticWarning(message, token) {
    addDiagnostic(DiagnosticSeverity.Warning, message, token.uri, token.line, token.column, token.length);
  }

  function addDiagnosticHintPos(message, diagUri, line, column, length, tags) {
    addDiagnostic(DiagnosticSeverity.Hint, message, diagUri, line, column, length, tags);
  }

  function addDiagnosticHint(message, token, tags) {
    addDiagnostic(DiagnosticSeverity.Hint, message, token.uri, token.line, token.column, token.length, tags);
  }

  const blockStack = [];
  const scopeStack = [{}];
  const includeStack = [];
  const defines = new Map();
  const defineStack = [ true ];
  const preprocStack = [{}];
  let section = 'problem';
  const foldingRanges = [];


  // Vordefinierte Makros aus den Einstellungen holen
  const macros = settings.macros || {};

  for (const [name, value] of Object.entries(macros)) {
    // no-value macro: #define NAME → -DNAME
    if (value === "" || value == null) {
      defines.set(name, { value: null, define: undefined });      
    } else {
      // value macro: #define NAME VALUE → -DNAME=VALUE
      defines.set(name, { value, define: undefined });      
    }
  }

  /**
   * Tokenstruktur:
   * {
   *   type: 'keyword' | 'identifier' | 'number' | 'string' | 'bitstring' | 'operator' |
   *         'symbol' | 'comment' | 'inactive' | 'error' | 'preproc',
   *   value: string,
   *   uri: string,
   *   line: number,
   *   column: number,
   *   offset: number,
   *   length: number
   *   definition: identifier (optional)
   * }
   */

  /**
   * Vorherigen "signifikanten" Token suchen (ohne Kommentare),
   * optional nur in derselben Zeile.
   */
  function findPreviousCodeToken(tokens, index, sameLine) {
    const line = sameLine ? tokens[index].line : null;
    for (let i = index - 1; i >= 0; i--) {
      const t = tokens[i];
      if (sameLine && t.line !== line) break;
      if (t.type === 'comment' || t.type === 'inactive') continue;
      return { token: t, index: i };
    }
    return null;
  }

  /**
   * Nächsten "signifikanten" Token suchen (ohne Kommentare).
   */
  function findNextCodeToken(tokens, index) {
    for (let i = index + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'comment' || t.type === 'inactive') continue;
      return { token: t, index: i };
    }
    return null;
  }

  function skipComments(tokens, index) {
    for (let i = index; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'comment' || t.type === 'inactive') continue;
      return { token: t, index: i };
    }
    return null;
  }

  function findNextSemicolonToken(tokens, index) {
    for (let i = index + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'symbol' && t.value === ';') {
        return { token: t, index: i };
      }
    }
    return null;
  }

  function findMatchingParenToken(tokens, index) {
    const openToken = tokens[index];
    let stack = [];
    stack.push( openToken );
    for (let i = index + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'comment' || t.type === 'inactive') continue;
      if (t.type === 'symbol') {
        if (t.value === '(' || t.value === '[') {
          stack.push(t);
        }
        else if (t.value === ')' || t.value === ']') {
          const endToken = stack.pop();
          if (  t.value === ')' && endToken.value === ']'
            || t.value === ']' && endToken.value === ')'
            ) {
            return null;
          }
          if (stack.length === 0) {
            return { token: t, index: i };
          }
        } else if (t.value === ';') {
          // Abbruch
          return null;
        }
      }
    }
    return null;
  }

  function lookupSymbol(scopeStack, name, kind = '') {
connection.console.log( `lookupSymbol ${name} as ${kind} from ${scopeStack.length-1} to 0` );
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const table = scopeStack[i];
      if (table && table[name]){
connection.console.log( `lookupSymbol ${JSON.stringify(table[name])}` );
        if (kind === '' || table[name].typeDescription.typename === kind) {
          return table[name];
        }
        return undefined;
      }
    }
    return undefined;
  }
  
  function tokenize(uri, text, preprocess = true) {
    const tokens = [];
    const lineOffsets = [];
    lineOffsets[ 0 ] = {
      startOfLineOffset: 0,
      startOfLineLine: 0,
      startOfLineColumn: 0
    };
    let offset = 0;
    let line = 0;
    let column = 0;
    const len = text.length;

  //  connection.console.log(`\n--- tokenize() START ---`);
  //  connection.console.log(`URI: ${uri}`);
  //  connection.console.log(`Initial section: ${section}`);

    function addToken(type, startOffset, startLine, startColumn, endOffset) {
      if ( !Number.isInteger(startOffset) || startOffset < 0   ||
          !Number.isInteger(startLine) || startLine < 0 ||
          !Number.isInteger(startColumn) || startColumn < 0 ||
          !Number.isInteger(endOffset) || endOffset < 0 ||
          endOffset < startOffset
        ) {
        connection.console.log(`addToken ${startOffset}/${endOffset} ${startLine}:${startColumn}: ${type}`);
        return null;
      }
      const token = {
        type,
        value: text.slice(startOffset, endOffset),
        uri,
        line: startLine,
        column: startColumn,
        offset: startOffset,
        length: endOffset - startOffset
      };
      tokens.push( token );
      return token;
    }

    // Zeilenanfang bestimmen (für Präprozessor)
    let isLineStart = true;

    function advanceChar() {
      const ch = text[offset];

      if (ch === '\n' || ch === '\r') {
      }
      offset++;
      if (ch === '\n') {
        // Altes Zeilenende
        lineOffsets[ line ].endOfLineOffset = offset - 1;
        lineOffsets[ line ].endOfLineLine = line;
        lineOffsets[ line ].endOfLineColumn = column;
        line++;
        column = 0;
        // Neuer Zeilenanfang
        lineOffsets[ line ] = {
          startOfLineOffset: offset,
          startOfLineLine: line,
          startOfLineColumn: 0
        };
        isLineStart = true;
      } else if (ch === '\r') {
        // Altes Zeilenende
        lineOffsets[ line ].endOfLineOffset = offset - 1;
        lineOffsets[ line ].endOfLineLine = line;
        lineOffsets[ line ].endOfLineColumn = column;
        // CR/LF?
        if (text[offset] === '\n') {
          offset++;
        }
        line++;
        column = 0;
        // Neuer Zeilenanfang
        lineOffsets[ line ] = {
          startOfLineOffset: offset,
          startOfLineLine: line,
          startOfLineColumn: 0
        };
        isLineStart = true;
      } else {
        column++;
      }
    }

    while (offset < len) {
      const ch = text[offset];

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v') {
        advanceChar();
        continue;
      }

      // Zeilenumbrüche
      if (ch === '\n' || ch === '\r') {
        advanceChar();
        continue;
      }

      // Einzeiliger Kommentar: !
      if (ch === '!') {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;
        while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
          offset++;
          column++;
        }
        addToken('comment', startOffset, startLine, startColumn, offset);
        continue;
      }

      // Mehrzeiliger Kommentar: /* ... */
      if (ch === '/' && offset + 1 < len && text[offset + 1] === '*') {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;
        offset += 2;
        column += 2;
        while (offset < len) {
          if (text[offset] === '*' && offset + 1 < len && text[offset + 1] === '/') {
            offset += 2;
            column += 2;
            break;
          }
          advanceChar();
        }
        const token = addToken('comment', startOffset, startLine, startColumn, offset);
        if ( startLine != line ) {
          foldingRanges.push({
            startToken: token,
            endToken: {
              type: 'comment',
              value: '',
              uri,
              line,
              column: column - 2,
              offset: offset - 2,
              length: 0
            },
            kind: 'comment',
            collapsedText: '/* ... */'
          });
        }

        continue;
      }

      // Präprozessor
      if (ch === '#' && preprocess && isLineStart) {    
        // Prüfen, ob wir am (logischen) Zeilenanfang sind
        // (bisherige Whitespace vor '#' haben wir oben schon abgearbeitet,
        // d.h. column==0 ist ein guter Indikator)
        const lineStartOffset = offset;
        const lineStartLine = line;
        const lineStartColumn = column;

        // ganze Zeile einlesen
        let lineBuf = '';
        let tmpOffset = offset;
        while (tmpOffset < len && text[tmpOffset] !== '\n' && text[tmpOffset] !== '\r') {
          lineBuf += text[tmpOffset];
          tmpOffset++;
        }

        const ifdefPattern = /^(\s*)((#ifn?def)\s+([A-Za-z_][A-Za-z0-9_]*))/.exec(lineBuf);
        if (ifdefPattern) {
          const ifdefStart = ifdefPattern[1];
          const ifdefStmt = ifdefPattern[2];
          const ifdefCmd = ifdefPattern[3];
          const ifdefName = ifdefPattern[4];

          const token = addToken('preproc', lineStartOffset + ifdefStart.length, lineStartLine, lineStartColumn + ifdefStart.length, lineStartOffset + ifdefStart.length + ifdefStmt.length);
          if (defineStack.length > 0 && !defineStack[defineStack.length - 1])
            addDiagnosticHint( 'inaktiv', token, [DiagnosticTag.Unnecessary]);

          const value = defines.has(ifdefName);
          const process = ifdefCmd === '#ifdef' ? value : !value;
          const stackProcess = defineStack.reduce(( prev, current ) => {
             return prev && current;
          }, process );

          defineStack.push( stackProcess );
          preprocStack.push( token );

          // Die gesamte #ifdef-Zeile überspringen
          while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
            advanceChar();
          }
          // Zeilenende noch normal verarbeiten:
          if (offset < len) {
            advanceChar();
          }
//          addToken('preproc', lineStartOffset, lineStartLine, lineStartColumn, lineEndOffset);

          continue;
        }

        const elsePattern = /^(\s*)(#else)/.exec(lineBuf);
        if (elsePattern) {
          const elseStart = elsePattern[1];
          const elseStmt = elsePattern[2];

          const token = addToken('preproc', lineStartOffset + elseStart.length, lineStartLine, lineStartColumn + elseStart.length, lineStartOffset + elseStart.length + elseStmt.length);

          const elseValue = !defineStack.pop();
          const stackProcess = defineStack.reduce(( prev, current ) => {
             return prev && current;
          }, elseValue );
          defineStack.push( stackProcess );

          if (defineStack.length > 0 && !defineStack[defineStack.length - 1])
            addDiagnosticHint( 'inaktiv', token, [DiagnosticTag.Unnecessary]);

          if ( preprocStack.length > 0 ) {
            const ifToken = preprocStack.pop();
            foldingRanges.push({
              startToken: ifToken,
              endToken: {
                type: 'preproz',
                value: '',
                uri,
                line: line-1,
                column: lineOffsets[line - 1].endOfLineColumn,
                offset: lineOffsets[line - 1].endOfLineOffset,
                length: 0
              },
              kind: 'preproz',
              collapsedText: '...'
            });
          }
          preprocStack.push( token );

          // Die gesamte #undef-Zeile überspringen
          while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
            advanceChar();
          }
          // Zeilenende noch normal verarbeiten:
          if (offset < len) {
            advanceChar();
          }
//          addToken('preproc', lineStartOffset + elsePattern[1].length, lineStartLine, lineStartColumn + elsePattern[1].length, elsePattern[2].length);

          continue;
        }

        const endifPattern = /^(\s*)(#endif)/.exec(lineBuf);
        if (endifPattern) {
          const endifStart = endifPattern[1];
          const endifStmt = endifPattern[2];

          const token = addToken('preproc', lineStartOffset + endifStart.length, lineStartLine, lineStartColumn + endifStart.length, lineStartOffset + endifStart.length + endifStmt.length);

          if ( defineStack.length > 1 )
            defineStack.pop();

          if ( preprocStack.length > 0 ) {
            const ifElseToken = preprocStack.pop();
            foldingRanges.push({
              startToken: ifElseToken,
              endToken: {
                type: 'preproz',
                value: '',
                uri,
                line: line-1,
                column: lineOffsets[line - 1].endOfLineColumn,
                offset: lineOffsets[line - 1].endOfLineOffset,
                length: 0
              },
              kind: 'preproz',
              collapsedText: '...'
            });
          }

          if (defineStack.length > 0 && !defineStack[defineStack.length - 1])
            addDiagnosticHint( 'inaktiv', token, [DiagnosticTag.Unnecessary]);

          // Die gesamte #undef-Zeile überspringen
          while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
            advanceChar();
          }
          // Zeilenende noch normal verarbeiten:
          if (offset < len) {
            advanceChar();
          }

          continue;
        }

        if (defineStack.length == 0 || defineStack[defineStack.length - 1]) {
          const includePattern = /^(\s*)(#include\s+([^\s]+))/.exec(lineBuf);
          if (includePattern) {
            const includeStart = includePattern[1];
            const includeStmt = includePattern[2];
            const includePath = includePattern[3];

            // Die gesamte #include-Zeile überspringen
            while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
              advanceChar();
            }
            // Zeilenende noch normal verarbeiten:
            if (offset < len) {
              advanceChar();
            }

            const token = addToken('preproc', lineStartOffset + includeStart.length, lineStartLine, lineStartColumn + includeStart.length, lineStartOffset + includeStart.length + includeStmt.length);

            // in #include Makros ersetzen
            let finalIncludePath = includePath.replace(/([A-Za-z_][A-Za-z0-9_]*)/g, (define) => {
              if (defines.has(define)) {
                let value = defines.get(define).value || '';
                const stringPattern = /^'(.*)'$/.exec(value);
                return stringPattern ? stringPattern[1] : value;
              }
              return define;
            });

            const parentPath = filePathFromUri(uri);
            const baseDir = parentPath ? path.dirname(parentPath) : process.cwd();
            const absPath = path.resolve(baseDir, finalIncludePath);
            if (includeStack.length < 100) { // maximale Include-Tiefe erreicht?
              const incText = loadFileTextCached(absPath);
              if (incText.error) {
                // Dateifehler
                addDiagnosticError(`#include: ${incText.error}`, token);
              } else {
                includeStack.push(absPath);
                const childUri = uriFromFilePath(absPath);

                // Rekursiv tokenisieren; section-Status durchreichen
                const incTokenizeData = tokenize(childUri, incText.text, true);
                includeStack.pop();

                // In Ergebnis einfügen
                tokens.push(...incTokenizeData.tokens);
              }
            }

            continue;
          }

          const definePattern = /^(\s*)(#define\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+"([^"]+)")?)/.exec(lineBuf);
          if (definePattern) {
            const defineStart = definePattern[1];
            const defineStmt = definePattern[2];
            const defineName = definePattern[3];
            const defineValue = definePattern[4] || '';

            // Die gesamte #define-Zeile überspringen
            while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
              advanceChar();
            }
            // Zeilenende noch normal verarbeiten:
            if (offset < len) {
              advanceChar();
            }

            const token = addToken('preproc', lineStartOffset + defineStart.length, lineStartLine, lineStartColumn + defineStart.length, lineStartOffset + defineStart.length + defineStmt.length);
            if (defines.has(defineName)) {
              addDiagnosticError(`Makro ${defineName} bereits definiert.`, token);
            }
            else {
              defines.set(defineName, { value: defineValue, define: defineStmt });
            }

            continue;
          }
          
          const undefPattern = /^(\s*)(#undef\s+([A-Za-z_][A-Za-z0-9_]*))/.exec(lineBuf);
          if (undefPattern) {
            const undefStart = undefPattern[1];
            const undefStmt = undefPattern[2];
            const undefName = undefPattern[3];

            // Die gesamte #undef-Zeile überspringen
            while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
              advanceChar();
            }
            // Zeilenende noch normal verarbeiten:
            if (offset < len) {
              advanceChar();
            }

            const token = addToken('preproc', lineStartOffset + undefStart.length, lineStartLine, lineStartColumn + undefStart.length, lineStartOffset + undefStart.length + undefStmt.length);
            if (!defines.has(undefName)) {
              addDiagnosticWarning(`Makro ${undefName} nicht definiert.`, token);
            }
            defines.delete( undefName );

            continue;
          }

          const unknownPattern = /^(\s*)(#[A-Za-z][A-Za-z0-9_]*)/.exec(lineBuf);
          if ( unknownPattern ) {
            const unknownStart = unknownPattern[1];
            const unknownStmt = unknownPattern[2];

            const token = addToken('error', lineStartOffset + unknownStart.length, lineStartLine, lineStartColumn + unknownStart.length, lineStartOffset + unknownStart.length + unknownStmt.length);
            addDiagnosticError(`Unbekannter Präprozessorbefehl ${unknownStmt}`, token);

            // Die gesamte #undef-Zeile überspringen
            while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
              advanceChar();
            }
            // Zeilenende noch normal verarbeiten:
            const lineEndOffset = offset;
            if (offset < len) {
              advanceChar();
            }
  
            continue;
          }
        }
        else {
          const lineStartOffset = offset;
          const lineStartLine = line;

          // Die gesamte Zeile überspringen
          while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
            advanceChar();
          }
          // Zeilenende noch normal verarbeiten:
          const lineEndOffset = offset;
          if (offset < len) {
            advanceChar();
          }

          const token = addToken('inactive', lineStartOffset, lineStartLine, 0, lineEndOffset);
          addDiagnosticHint( 'inaktiv', token, [DiagnosticTag.Unnecessary]);

          continue;
        }
      }

      isLineStart = false;

      // ifdef/ifndef-Block aktiv?
      if (!defineStack[defineStack.length - 1]) {
        const lineStartOffset = offset;
        const lineStartLine = line;

        // Die gesamte Zeile überspringen
        while (offset < len && text[offset] !== '\n' && text[offset] !== '\r') {
          advanceChar();
        }
        // Zeilenende noch normal verarbeiten:
        const lineEndOffset = offset;
        if (offset < len) {
          advanceChar();
        }

        const token = addToken('inactive', lineStartOffset, lineStartLine, 0, lineEndOffset);
        addDiagnosticHint( 'inaktiv', token, [DiagnosticTag.Unnecessary]);

        continue;
      }

      // String / Bitstring: '...'
      if (ch === '\'') {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;
        offset++;
        column++;
        while (offset < len && text[offset] !== '\'') {
          if (text[offset] === '\n' || text[offset] === '\r') {
            // Unterbrochener String – wir beenden trotzdem
            break;
          }
          advanceChar();
        }
        if (offset < len && text[offset] === '\'') {
          offset++;
          column++;
        }
        // Optionales B/B1..B4
        let type = 'string';
        if (offset < len && text[offset] === 'B') {
          let tmpOffset = offset;
          let tmpColumn = column;
          tmpOffset++;
          tmpColumn++;
          if (tmpOffset < len && /[1-4]/.test(text[tmpOffset])) {
            tmpOffset++;
            tmpColumn++;
          }
          offset = tmpOffset;
          column = tmpColumn;
          type = 'bitstring';
        }
        addToken(type, startOffset, startLine, startColumn, offset);
        continue;
      }

      // Zahl: grob – Hauptsache sie wird nicht als Identifier erkannt
      if (/[0-9]/.test(ch) || (ch === '.' && offset + 1 < len && /[0-9]/.test(text[offset + 1]))) {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;

        // Integer/Fraction
        if (ch === '.') {
          offset++;
          column++;
        }
        while (offset < len && /[0-9]/.test(text[offset])) {
          offset++;
          column++;
        }
        // optionaler Dezimalpunkt + weitere Digits
        if (offset < len && text[offset] === '.') {
          offset++;
          column++;
          while (offset < len && /[0-9]/.test(text[offset])) {
            offset++;
            column++;
          }
        }
        // optionaler Exponent
        if (offset < len && /[Ee]/.test(text[offset])) {
          offset++;
          column++;
          if (offset < len && (text[offset] === '+' || text[offset] === '-')) {
            offset++;
            column++;
          }
          while (offset < len && /[0-9]/.test(text[offset])) {
            offset++;
            column++;
          }
        }
        // optionale Länge (z.B. (31))
        if (offset < len && text[offset] === '(') {
          offset++;
          column++;
          while (offset < len && /[0-9]/.test(text[offset])) {
            offset++;
            column++;
          }
          if (offset < len && text[offset] === ')') {
            offset++;
            column++;
          }
        }

        addToken('number', startOffset, startLine, startColumn, offset);
        continue;
      }

      // Identifier / Keyword
      if (/[A-Za-z]/.test(ch)) {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;
        offset++;
        column++;
        while (offset < len && /[A-Za-z0-9_]/.test(text[offset])) {
          offset++;
          column++;
        }
        let value = text.slice(startOffset, offset);

        if (defines.has(value)) {
          /*
          * Präprozessor-define
          * Ersetzung muss geparst werden! z. B. als number, string, identifier ...
          */
          const define = defines.get(value);
          const defineValue = define.value ? define.value : '';
          addToken('preproc', startOffset, startLine, startColumn, offset);
          tokens[ tokens.length - 1].define = defineValue;
connection.console.log(`preproc-Token ${tokens[ tokens.length - 1].type} ${tokens[ tokens.length - 1].value} ${tokens[ tokens.length - 1].define}`);
          const defineTokenizeData = tokenize(uri, defineValue, false);  // Ersetzungstext tokenisieren, aber nicht rekursiv durch den Präprozessor laufen
          const defineTokens = defineTokenizeData.tokens;
          // Tokenposition korrigieren
          defineTokens.map( t => { 
            t.line = startLine;
            t.offset = startOffset;
            t.column = startColumn;
            t.length = offset - startOffset;
          });
          
          // In Ergebnis einfügen
          tokens.push(...defineTokens);
          continue;
        }

        let type = 'identifier';
        if (PEARL_KEYWORDS.includes(value))
          type = 'keyword';
        else if (OPERATOR_KEYWORDS.includes(value))
          type = 'operator';
        else if (TYPE_KEYWORDS.includes(value))
          type = 'type';
        addToken(type, startOffset, startLine, startColumn, offset);
        if ( type === 'keyword' ) {
          if (value === 'SYSTEM') {
            if (section === 'problem')
              section = 'system';
          }
          else if (value === 'PROBLEM') {
            if (section === 'system')
              section = 'problem';
          }
        }
        continue;
      }

      // Symbol
      {
        const startOffset = offset;
        const startLine = line;
        const startColumn = column;

        // DATION-Richtungsoperatoren im SYSTEM-Teil
        if (section === 'system') {
          // Dreier-Operator: "<->"
          if (text[offset] === '<' && offset + 2 < len &&
              text[offset + 1] === '-' && text[offset + 2] === '>') {
            const startOffset = offset;
            const startLine = line;
            const startColumn = column;
            offset += 3;
            column += 3;
            addToken('operator', startOffset, startLine, startColumn, offset);
            continue;
          }

          // "<-" (z.B. Eingabe)
          if (text[offset] === '<' && offset + 1 < len && text[offset + 1] === '-') {
            const startOffset = offset;
            const startLine = line;
            const startColumn = column;
            offset += 2;
            column += 2;
            addToken('operator', startOffset, startLine, startColumn, offset);
            continue;
          }

          // "->" (z.B. Ausgabe)
          if (text[offset] === '-' && offset + 1 < len && text[offset + 1] === '>') {
            const startOffset = offset;
            const startLine = line;
            const startColumn = column;
            offset += 2;
            column += 2;
            addToken('operator', startOffset, startLine, startColumn, offset);
            continue;
          }
        }

        // : := 
        if (ch === ':') {
          offset++;
          column++;
          if (offset < len && text[offset] === '=') {
            offset++;
            column++;
          }
          addToken('symbol', startOffset, startLine, startColumn, offset);
          continue;
        }
        // = == 
        if (ch === '=') {
          offset++;
          column++;
          if (offset < len && text[offset] === '=') {
            offset++;
            column++;
          }
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // < <= <> 
        if (ch === '<') {
          offset++;
          column++;
          if (offset < len && (text[offset] === '=' || text[offset] === '>') ) {
            offset++;
            column++;
          }
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // > >= >< 
        if (ch === '>') {
          offset++;
          column++;
          if (offset < len && (text[offset] === '=' || text[offset] === '<') ) {
            offset++;
            column++;
          }
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // / // /= 
        if (ch === '/') {
          offset++;
          column++;
          if (offset < len && (text[offset] === '/' || text[offset] === '=') ) {
            offset++;
            column++;
          }
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // * ** 
        if (ch === '*') {
          offset++;
          column++;
          if (offset < len && text[offset] === '*') {
            offset++;
            column++;
          }
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // + -
        if (ch === '+' | ch === '-') {
          offset++;
          column++;
          addToken('operator', startOffset, startLine, startColumn, offset);
          continue;
        }
        // + - ( ) [ ] ; , .
        if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === ';' || ch === ',' || ch === '.' ) {
          offset++;
          column++;
          addToken('symbol', startOffset, startLine, startColumn, offset);
          continue;
        }
        // unerlaubtes Zeichen
        offset++;
        column++;
        addToken('error', startOffset, startLine, startColumn, offset);
        continue;
      }
    }

    return {
      tokens,
      lineOffsets
    };
  }

  const tokenizeData = tokenize(uri, text);
  const tokens = tokenizeData.tokens;
  const lineOffsets = tokenizeData.lineOffsets;

  /*
  * Typangabe mit Attributen parsen
  */
  function parseTypeDescription(tokens, startIndex, endIndex) {
    const typeTokens = [];
    let parenLevel = 0;
    let lastIndex = endIndex + 1;
    let arrayDim = 0;
    let inv = false;
    let ref = false;
    let global = false;
    let init = false;
    let ident = false;
    let typename = null;
    let state = 'start';  // dim | dimensions | inv | ref | type | global | init | initval

    for (let i = startIndex; i <= endIndex; i++) {
      const tt = tokens[i];
      if (tt.type === 'comment' || tt.type === 'inactive') continue;
      if (tt.type === 'symbol') {
        if (tt.value === ',') {
          if ( parenLevel === 0 ) {
            lastIndex = i;
            break;
          }
          else {
            if ( state === 'dimensions' ) {
              ++arrayDim;
            }
          }
        } 
        else if (tt.value === '(') {
          if ( state === 'start' ) {
            arrayDim = 1;
            state = 'dimensions';
          }
          ++parenLevel;
        }
        else if (tt.value === ')') {
          if ( state === 'dimensions' ) {
            state = 'inv';
          }
          --parenLevel;
        }
      } 
      else if (tt.type === 'keyword') {
        if ( tt.value === 'INV' && ( state === 'start' || state === 'dim' || state === 'inv' ) ) {
          state = 'ref';
          inv = true;
        }
        else if ( tt.value === 'REF' && ( state === 'start' || state === 'dim' || state === 'inv' || state === 'ref' ) ) {
          state = 'type';
          ref = true;
        }
        else if (  (  tt.value === 'PROC' || tt.value === 'PROCEDURE' || tt.value === 'ENTRY' || tt.value === 'TASK' 
                   || tt.value === 'DATION' || tt.value === 'SEMA'  || tt.value === 'BOLT'
                   ) 
                && ( state === 'start' || state === 'dim' || state === 'inv' || state === 'ref' || state === 'type' )
                ) {
          state = 'global';
          typename = tt;
        }
        else if ( tt.value === 'GLOBAL' && state === 'global' ) {
          state = 'init';
          global = true;
        }
        else if ( ( tt.value === 'INIT' || tt.value === 'PRESET' ) && ( state === 'global' || state === 'init' ) ) {
          state = 'initval';
          init = true;
        }
        else if ( tt.value === 'IDENT' && ( state === 'global' || state === 'init' ) ) {
          state = 'initval';
          ident = true;
        }
      } 
      else if ( tt.type === 'identifier') {
        if ( ( state === 'start' || state === 'dim' || state === 'inv' || state === 'ref' || state === 'type' ) ) {
          state = 'global';
          typename = tt;
        }
      }
      else if ( tt.type === 'type') {
        if ( ( state === 'start' || state === 'dim' || state === 'inv' || state === 'ref' || state === 'type' ) ) {
          state = 'global';
          typename = tt;
        }
      }

      typeTokens.push(tt);
    }

    return { 
      endIndex: lastIndex, 
      typeTokens,
      typeDescription: {
        dim: arrayDim,
        inv,
        ref,
        typename: ( typename ? typename.value : '' ),
        global, 
        init,
        ident
      }
    };
  }

  function parseSpcDclTokens(tokens, startIndex, endIndex) {
    const result = [];

    for (let j = startIndex; j <= endIndex; j++) {

      const nextToken = skipComments(tokens, j);
      j = nextToken.index;
      const t = nextToken.token;

      if (t.type === 'symbol' && t.value === '(') {
        // SPC/DCL (var1,var2) type;
        const nameTokens = [];
        let it = endIndex + 1;
        for (let i = j + 1; i <= endIndex; i++) {
          const tt = tokens[i];
          if (tt.type === 'comment' || tt.type === 'inactive') continue;
          if (tt.type === 'identifier') {
            nameTokens.push(tt);
            continue;
          }
          if (tt.type === 'symbol') {
            if (tt.value === ',') continue;
            if (tt.value === ')') {
              it = i + 1;
              break;
            }
          }
          addDiagnosticWarning(
            `'${tt.value}' nicht erlaubt.`,
            tt
          );

        }

        const typeDescription = parseTypeDescription(tokens, it, endIndex);
        j = typeDescription.endIndex;

        for (const nameToken of nameTokens) {
          result.push({nameToken, typeTokens: typeDescription.typeTokens, typeDescription: typeDescription.typeDescription, used: false});
        }
      }
      else {
        // SPC/DCL var type;
        const typeDescription = parseTypeDescription(tokens, j + 1, endIndex);
        j = typeDescription.endIndex;

        result.push({nameToken: t, typeTokens: typeDescription.typeTokens, typeDescription: typeDescription.typeDescription, used: false});
      }
    }

    return result;
  }

  function createIdentifier( nameToken, typeTokens, dim, inv, ref, typename, global, init )
  {
    return {
      nameToken,
      typeTokens,
      typeDescription: {
        dim,
        inv,
        ref,
        typename,
        global, 
        init
      },
      used: false
    };
  };

  let loopVar = undefined;  // für FOR-Loop
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.offset > stopOffset) break;

    if (t.type === 'comment' || t.type === 'inactive' || t.type === 'string' || t.type === 'bitstring' || t.type === 'number' || t.type === 'error'  || t.type === 'preproc') {
      continue;
    }

    // Label-Definition: Identifier gefolgt von ':'
    if (t.type === 'identifier') {
      const next = findNextCodeToken(tokens, i);
      if (next && next.token.type === 'symbol' && next.token.value === ':') {
        // Prüfen, ob danach PROC/TASK kommt -> dann ist es eine PROC/TASK-Implementierung
        const afterLabel = findNextCodeToken(tokens, next.index);
        if (!(afterLabel && afterLabel.token.type === 'keyword' && (afterLabel.token.value === 'PROC' || afterLabel.token.value === 'PROCEDURE' || afterLabel.token.value === 'TASK'))) {
          // normales Label
          const currentScope = scopeStack[scopeStack.length - 1];
          const identifier = createIdentifier(t, [], false, false, false, '@LABEL', false, false);
          currentScope[t.value] = identifier;   // PROC/TASK ist immer globaler Scope
        }
        continue;
      }
      // Identifier (Verwendung)
connection.console.log( `identifier verwendung: ${t.value} at ${t.line}.${t.column}/${t.offset}`);
      const definition = lookupSymbol(scopeStack, t.value);
      if (definition) {
connection.console.log( `identifier definition: ${t.value} at ${definition.nameToken.line}.${definition.nameToken.column}/${definition.nameToken.offset}`);
        t.definition = definition;
      }
      else {
        addDiagnosticError(`${t.value} nicht definiert.`, t);
      }
    }

    if (t.type !== 'keyword') {
      continue;
    }

    const kw = t.value;

    // ---------------- Blockenden ----------------
    if (kw === 'END') {
      if (
        blockStack.length === 0 ||
        !END_KEYWORD_MAP.END.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        addDiagnosticError('Unerwartetes END ohne passenden Block (TASK/PROC/REPEAT/BEGIN).', t);
      } else {
        const startToken = blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
        let endToken = structuredClone(t);
        endToken.line = t.line - 1;
        endToken.column = lineOffsets[t.line-1].endOfLineColumn;
        endToken.offset = lineOffsets[t.line-1].endOfLineOffset;
        foldingRanges.push({
          startToken: startToken.token,
          endToken,
          kind: 'region'
        })
      }
      continue;
    } 

    if (kw === 'ELSE') {
      if (
        blockStack.length === 0 ||
        !END_KEYWORD_MAP.ELSE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        addDiagnosticError('Unerwartetes ELSE ohne passenden Block (IF).', t);
      } else {
        const startToken = blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
        let endToken = structuredClone(t);
        endToken.line = t.line - 1;
        endToken.column = lineOffsets[t.line-1].endOfLineColumn;
        endToken.offset = lineOffsets[t.line-1].endOfLineOffset;
        foldingRanges.push({
          startToken: startToken.token,
          endToken,
          kind: 'region'
        });
        blockStack.push({ keyword: kw, token: t });
        scopeStack.push({});
      }
      continue;
    }
    
    if (kw === 'FIN') {
      if (
        blockStack.length === 0 ||
        !END_KEYWORD_MAP.FIN.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        addDiagnosticError('Unerwartetes FIN ohne passenden Block (IF/CASE).', t);
      } else {
        const startToken = blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
        let endToken = structuredClone(t);
        endToken.line = t.line - 1;
        endToken.column = lineOffsets[t.line-1].endOfLineColumn;
        endToken.offset = lineOffsets[t.line-1].endOfLineOffset;
connection.console.log( `FIN für ${startToken.token.value} von ${startToken.token.line}`);
        foldingRanges.push({
          startToken: startToken.token,
          endToken,
          kind: 'region'
        })
      }
      continue;
    }
    
    if (kw === 'MODEND') {
      if (
        blockStack.length === 0 ||
        !END_KEYWORD_MAP.MODEND.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        addDiagnosticError('Unerwartetes MODEND ohne passenden Block (MODULE/SHELLMODULE).', t);
      } else {
        const startToken = blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
        let endToken = structuredClone(t);
        endToken.line = t.line - 1;
        endToken.column = lineOffsets[t.line-1].endOfLineColumn;
        endToken.offset = lineOffsets[t.line-1].endOfLineOffset;
        foldingRanges.push({
          startToken: startToken.token,
          endToken,
          kind: 'region'
        })
      }
      continue;
    }

    // ---------------- DCL-Statement ----------------
    if (kw === 'DCL' || kw === 'DECLARE') {
      const semicolon = findNextSemicolonToken(tokens, i);
      if ( semicolon ) {
        let endIndex = semicolon.index;
        const parsedSpc = parseSpcDclTokens(tokens, i + 1, endIndex - 1);

        const currentScope = scopeStack[scopeStack.length - 1];
        for (const dclName of parsedSpc) {
//logIdentifier( dclName, `DCL level: ${scopeStack.length - 1}` );
          const nameToken = dclName.nameToken;
          if (currentScope[dclName.nameToken.value]) {
            addDiagnosticError(`Variable ${nameToken.value} existiert bereits.`, nameToken);
          }
          else {
            currentScope[dclName.nameToken.value] = dclName;   
          }
        }
        i = endIndex;
      }
      continue;
    }

    // ---------------- SPC / SPECIFY ----------------
    if (kw === 'SPC' || kw === 'SPECIFY') {
      const semicolon = findNextSemicolonToken(tokens, i);
      if ( semicolon ) {
        let endIndex = semicolon.index;
        const parsedSpc = parseSpcDclTokens(tokens, i + 1, endIndex - 1);

        const currentScope = scopeStack[scopeStack.length - 1];
        for (const spcName of parsedSpc) {
//logIdentifier( spcName, `SPC level: ${scopeStack.length - 1}` );
          currentScope[spcName.nameToken.value] = spcName;   // SPC ist immer globaler Scope
        }

        i = endIndex;
      }
      continue;
    }

    // ---------------- Blockstarts & Deklarationen ----------------
    if (kw === 'MODULE' || kw === 'SHELLMODULE' || kw === 'IF' || kw === 'CASE') {
      if (kw === 'MODULE' || kw === 'SHELLMODULE') {      
        const next = findNextCodeToken(tokens, i);
        if (next && next.token.type === 'identifier') {
          let endIndex = next.index;
          const identifier = createIdentifier( next.token, [], false, false, false, kw, false, false );
          const currentScope = scopeStack[0];
          currentScope[next.token.value] = identifier;   // MODULE/SHELLMODULE ist immer globaler Scope
          i = endIndex;
        }
      }

      // Blockstart, keine speziellen Deklarationen
      blockStack.push({ keyword: kw, token: t });
      scopeStack.push({});
      continue;
    }

    if (kw === 'SYSTEM' || kw === 'PROBLEM') {      
      if (blockStack.length!==1 || (blockStack[0].keyword !== 'MODULE' && blockStack[0].keyword !== 'SHELLMODULE' ) ) {
        addDiagnosticError('Unerwartetes SYSTEM ohne passenden Block (MODULE/SHELLMODULE).', t);
      }
    }

    // ---------------- Blockstarts & Deklarationen ----------------

    // PROC/TASK als Implementierung oder Deklaration
    if (kw === 'PROC' || kw === 'PROCEDURE' || kw === 'TASK') {
      const kind = kw;

      // name : PROC/TASK
      const prev = findPreviousCodeToken(tokens, i, /*sameLine*/ true);
      const prev2 = prev ? findPreviousCodeToken(tokens, prev.index, true) : null;
      if (
        prev &&
        prev.token.type === 'symbol' &&
        prev.token.value === ':' &&
        prev2 &&
        prev2.token.type === 'identifier'
      ) {
        const labelName = prev2.token.value;
        // Deklaration
        if ( scopeStack.length === 2 )
        {
          // Nur global erlaubt
          const currentScope = scopeStack[scopeStack.length - 1];
          const typeTokens = [ prev2.token, prev.token, t ];
          const identifier = createIdentifier( prev2.token, typeTokens, false, false, false, kind, false, false );
//logIdentifier( identifier, `${kind} level: ${scopeStack.length - 1}` );
          currentScope[labelName] = identifier;   // PROC/TASK ist immer globaler Scope

          // Blockstart
          blockStack.push({ keyword: kind, token: t });
          scopeStack.push({});

          // PROC-Parameter aus Header (Text von PROC bis zum nächsten ')')
          if (kind === 'PROC' || kind === 'PROCEDURE') {
            const nextTok = findNextCodeToken(tokens, i);
            if (nextTok && nextTok.token.type === 'symbol' && nextTok.token.value === '(') {
              const closeParen = findMatchingParenToken(tokens, nextTok.index );
              if ( closeParen ) {
                const parsedParam = parseSpcDclTokens(tokens, nextTok.index + 1, closeParen.index - 1);
                const currentScope = scopeStack[scopeStack.length - 1];
                for (const paramName of parsedParam) {
//logIdentifier( paramName, `Param level: ${scopeStack.length - 1}` );
                  currentScope[paramName.nameToken.value] = paramName;
                }

                i = closeParen.index;
                continue;
              }
            }
          }
        }
        else {
          addDiagnosticError(
            `${kind} '${prev2.token.value}' nur global erlaubt.`,
            prev2.token,
            t.offset + t.length - prev2.token.offset
          );
        }
      }

      continue;
    }

    if (kw === 'FOR') {
      const next = findNextCodeToken(tokens, i);
      if (next && next.token.type === 'identifier') {
        loopVar = next;
        blockStack.push({ keyword: 'REPEAT', token: t });
        scopeStack.push({});
        const identifier = createIdentifier( next.token, [], false, false, false, 'FIXED', false, false );
        const currentScope = scopeStack[scopeStack.length - 1];
        currentScope[next.token.value] = identifier;
        i = next.index + 1;
      }
      continue;
    }

    // REPEAT immer als Blockstart
    if (kw === 'REPEAT') {
      if (!loopVar) {
        blockStack.push({ keyword: kw, token: t });
        scopeStack.push({});
      }
      loopVar = undefined;
      continue;
    }

    // BEGIN immer als Blockstart
    if (kw === 'BEGIN') {
      blockStack.push({ keyword: kw, token: t });
      scopeStack.push({});
      continue;
    }
    // ---------------- Aufrufe & Operationen ----------------

    // CALL PROC
    if (kw === 'CALL') {
      const next = findNextCodeToken(tokens, i);
      if (next && next.token.type === 'identifier') {
        const name = next.token.value;
        const sym = lookupSymbol(scopeStack, name, 'PROC') || lookupSymbol(scopeStack, name, 'PROCEDURE') || lookupSymbol(scopeStack, name, 'ENTRY');
        if (!sym) {
          addDiagnosticWarning(
            `Aufruf von '${name}' ohne passende PROC-Deklaration (PROC/DCL PROC/SPC PROC/ENTRY).`,
            t,
            next.token.offset + next.token.length - t.offset
          );
        }
      }
      continue;
    }

    // TASK-Operationen
    if (TASK_CTRL_KEYWORDS.includes(kw)) {
      const next = findNextCodeToken(tokens, i);
      const semicolon = findNextCodeToken(tokens, i+1);
      const nextSemicolon = findNextSemicolonToken(tokens, i+1);
      if (next && next.token.type === 'identifier') {
        const name = next.token.value;
        const sym = lookupSymbol(scopeStack, name, 'TASK');
        if (!sym) {
          addDiagnosticError(
            `TASK '${name}' wird mit ${kw} verwendet, es existiert aber keine TASK-Deklaration (TASK/SPC TASK).`,
            t,
            next.token.offset + next.token.length - t.offset
          );
        }
      }
      if (!semicolon || !nextSemicolon || nextSemicolon.index !== i+2) {
        addDiagnosticError(
          `${kw} Semikolon erwartet.`,
          semicolon.token,
          semicolon.token.offset + semicolon.token.length
        );
        i = semicolon.index;
      }
      continue;
    }

    // SEMA-Operationen
    if (kw==='SEMASET') {
      const value = findNextCodeToken(tokens, i);
      const comma = findNextCodeToken(tokens, i+1);
      const sema = findNextCodeToken(tokens, i+2);
      const semicolon = findNextCodeToken(tokens, i+3);
      const nextSemicolon = findNextSemicolonToken(tokens, i+3);

      if (value && value.token.type !== 'number') {
        addDiagnosticError(
          `SEMASET Preset-Wert ist ungültig.`,
          value.token,
          value.token.offset + value.token.length
        );
      }
      if (comma && comma.token.type !== 'symbol' && comma.token.value !== ',') {
        addDiagnosticError(
          `SEMASET Komma erwartet.`,
          comma.token,
          comma.token.offset + comma.token.length
        );
      }
      if (sema && sema.token.type === 'identifier') {
        const name = sema.token.value;
        const sym = lookupSymbol(scopeStack, name, 'SEMA');
        if (!sym) {
          addDiagnosticError(
            `SEMA '${name}' wird mit ${kw} verwendet, es existiert aber keine SEMA-Deklaration (DCL/SPC SEMA).`,
            sema.token,
            sema.token.offset + sema.token.length - t.offset
          );
        }
      }
      if (!semicolon || !nextSemicolon || nextSemicolon.index !== i+4) {
        addDiagnosticError(
          `SEMASET Semikolon erwartet.`,
          semicolon.token,
          semicolon.token.offset + semicolon.token.length
        );
        i = semicolon.index;
      }
      continue;
    }

    // ... REQUEST/RELEASE
    if (SEMA_OP_KEYWORDS.includes(kw)) {
      const sema = findNextCodeToken(tokens, i);
      const semicolon = findNextCodeToken(tokens, i+1);
      const nextSemicolon = findNextSemicolonToken(tokens, i+1);
      if (sema && sema.token.type === 'identifier') {
        const name = sema.token.value;
        const sym = lookupSymbol(scopeStack, name, 'SEMA');
        if (!sym) {
          addDiagnosticError(
            `SEMA '${name}' wird mit ${kw} verwendet, es existiert aber keine SEMA-Deklaration (DCL/SPC SEMA).`,
            t,
            sema.token.offset + sema.token.length - t.offset
          );
        }
      }
      if (!semicolon || !nextSemicolon || nextSemicolon.index !== i+2) {
        addDiagnosticError(
          `${kw} Semikolon erwartet.`,
          semicolon.token,
          semicolon.token.offset + semicolon.token.length
        );
        i = semicolon.index;
      }
      continue;
    }

    // BOLT-Operationen
    if (BOLT_OP_KEYWORDS.includes(kw)) {
      const bolt = findNextCodeToken(tokens, i);
      const semicolon = findNextCodeToken(tokens, i+1);
      const nextSemicolon = findNextSemicolonToken(tokens, i+1);
      if (bolt && bolt.token.type === 'identifier') {
        const name = bolt.token.value;
        const sym = lookupSymbol(scopeStack, name, 'BOLT');
        if (!sym) {
          addDiagnosticError(
            `BOLT '${name}' wird mit ${kw} verwendet, es existiert aber keine BOLT-Deklaration (DCL/SPC BOLT).`,
            t,
            bolt.token.offset + bolt.token.length - t.offset
          );
        }
      }
      if (!semicolon || !nextSemicolon || nextSemicolon.index !== i+2) {
        addDiagnosticError(
          `${kw} Semikolon erwartet.`,
          semicolon.token,
          semicolon.token.offset + semicolon.token.length
        );
        i = semicolon.index;
      }
      continue;
    }
  }

  // Offene Blöcke am Ende melden (nur bei vollständiger Analyse)
  if (collectDiagnostics) {
    for (const open of blockStack) {
      const t = open.token;
      const endKw = BLOCK_END_MAP[open.keyword] || 'END';
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        message: `Block '${open.keyword}' wird nicht geschlossen. Erwartet ${endKw}.`,
        range: {
          start: { line: t.line, character: t.column },
          end: { line: t.line, character: t.column + t.length }
        },
        source: 'pearl-lsp'
      });
    }
  }

  return {
    tokens,
    diagnostics,
    scopeStack,
    foldingRanges
  };
}

// ------------------------------
// Diagnostics
// ------------------------------

async function validateTextDocument(textDocument) {
  const settings = await getDocumentSettings(textDocument.uri);
  
connection.console.log('[pearl] settings = ' + JSON.stringify(settings));

  const text = textDocument.getText();
  const analysis = analyze(textDocument.uri, text, settings, { collectDiagnostics: true });
  documentTokenCache.set( textDocument.uri, analysis );    // für onDefinition & Co. cachen
  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics: analysis.diagnostics
  });
}

// ------------------------------
// Hilfsfunktionen für DCL/SPC
// ------------------------------

function logIdentifier( identifier, msg = '' ) {
  const nameToken = identifier.nameToken;
  const typeTokens = identifier.typeTokens;
  let typeString = ' ';
  for (const idType of typeTokens) {
    typeString += idType.value + ' ';
  }
  const td = identifier.typeDescription;          
  connection.console.log(`${msg} ${nameToken.value} ${typeString}; dim: ${td.dim} inv: ${td.inv}, ref: ${td.ref}, typename: ${td.typename} global: ${td.global}, init: ${td.init}`);
}

// ------------------------------
// Completion
// ------------------------------

connection.onCompletion(() => {
  return PEARL_KEYWORDS.map((kw) => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
    data: kw
  }));
});

connection.onCompletionResolve((item) => {
  item.detail = 'PEARL-Schlüsselwort';
  item.documentation = `Dies ist das PEARL-Schlüsselwort \`${item.label}\`.`;
  return item;
});

// ------------------------------
// Hover
// ------------------------------

connection.onHover((params) => {
  const analysis = documentTokenCache.get( params.textDocument.uri );    // Aus dem Cache holen
  if ( !analysis ) return null;

  const fullTokens = analysis.tokens;
  if ( !fullTokens ) return null;

  const pos = params.position;
  const targetToken = findTokenAt(fullTokens, params.textDocument.uri, pos.line, pos.character);
  if (!targetToken) return null;

  // Test----
  if ( targetToken.define ) {
    return {
      contents: {
        kind: 'markdown',
        value: `#define **${targetToken.value}** "${targetToken.define}"`
      }
    };
  }
  else if ( targetToken.definition ) {
    return {
      contents: {
        kind: 'markdown',
        value: `Token: ${targetToken.type}: **${targetToken.value}** at offset **${targetToken.offset}** defined at ${targetToken.definition.nameToken.offset} as ${JSON.stringify( targetToken.definition.typeDescription)}`
      }
    };
  }
  else {
    return {
      contents: {
        kind: 'markdown',
        value: `Token: ${targetToken.type}: **${targetToken.value}** at offset **${targetToken.offset}**`
      }
    };
  }
  // Test----

  // Keine Hoverinfos in Kommentaren, Strings, Bitstrings, Zahlen
  if (targetToken.type === 'comment' || targetToken.type === 'inactive' || targetToken.type === 'string' || targetToken.type === 'bitstring' || targetToken.type === 'number') {
    return null;
  }

  if (targetToken.type === 'keyword' && PEARL_KEYWORDS.includes(targetToken.value)) {
    return {
      contents: {
        kind: 'markdown',
        value: `**${targetToken.value}** ist ein PEARL-Schlüsselwort.`
      }
    };
  }

  if (targetToken.type === 'identifier') {
    return {
      contents: {
        kind: 'markdown',
        value: `**${targetToken.value}** ist ein Identifier.`
      }
    };
  }

  return null;
});

// ------------------------------
// Go To Definition
// ------------------------------

connection.onDefinition((params) => {

  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const analysis = documentTokenCache.get( params.textDocument.uri );    // Aus dem Cache holen
  if ( !analysis ) return null;

  const fullTokens = analysis.tokens;
  if ( !fullTokens ) return null;

  const pos = params.position;
  const targetToken = findTokenAt(fullTokens, params.textDocument.uri, pos.line, pos.character);
  if (!targetToken) return null;

  // Kein GoTo in Kommentaren, Strings, Bitstrings, Zahlen, keyword
  if ( targetToken.type !== 'identifier' ) {
    return null;
  }

  const targetName = targetToken.value;
  const targetOffset = targetToken.offset;
  const definition = targetToken.definition;

  if (definition) {
    const nameToken = definition.nameToken;
    return {
      uri: nameToken.uri,
      range: {
        start: { line: nameToken.line, character: nameToken.column },
        end: { line: nameToken.line, character: nameToken.column + nameToken.length }
      }
    };
  }

  return null;
});

// ------------------------------
// Folding
// ------------------------------

connection.onFoldingRanges((params) => {
  const uri = params.textDocument.uri;
  const doc = documents.get(uri);
  if (!doc) {
    return [];
  }
  
  const analysis = documentTokenCache.get( uri );    // Aus dem Cache holen
  if ( !analysis ) return null;

  const foldingRanges = analysis.foldingRanges;
  if ( !foldingRanges ) return null;

  // Nur Tokens aus *diesem* Dokument berücksichtigen
  const localRanges = foldingRanges.filter(t => t.startToken.uri === uri && t.endToken.uri === uri);

  const ranges = [];
  for (const r of localRanges) {
    ranges.push({
      startLine: r.startToken.line,
      startCharacter: r.startToken.column,
      endLine: r.endToken.line,
      endCharacter: r.endToken.column,
      kind: r.kind,
      collapsedText: r.collapsedText || null
    });
  };

  return ranges;
});

// ------------------------------
// Semantische Tokens
// ------------------------------

function sanitizeSemanticTokensData(data) {
/*
  if (!data instanceof Uint32Array) {
    connection.console.log('[SemanticSanitizer] data is not an Uint32Array.');
    return [];
  }
*/

  if (data.length === 0) {
    connection.console.log('[SemanticSanitizer] data is empty.');
    return [];
  }

  // 1) Länge korrigieren (Vielfaches von 5)
  if (data.length % 5 !== 0) {
    connection.console.log(
      `[SemanticSanitizer] data length ${data.length} is not multiple of 5 -> trimming.`
    );
    data = data.slice(0, Math.floor(data.length / 5) * 5);
  }


  // Legend-Objekt wie vom LSP erwartet:
  const tokenTypesLen = semanticTokenTypes.length;
  const tokenModsLen = semanticTokenModifiers.length;
  const maxModifierMask = tokenModsLen > 0 ? (1 << tokenModsLen) - 1 : 0;

  const absTokens = [];

  // 2) Deltas in absolute Positionen umwandeln
  let line = 0;
  let char = 0;

  for (let i = 0; i < data.length; i += 5) {
    let deltaLine = data[i];
    let deltaChar = data[i + 1];
    let length = data[i + 2];
    let tokenType = data[i + 3];
    let tokenMods = data[i + 4];

    // --- Fehlerstelle: Ungültige Werte ------------------------
    if (
      !Number.isInteger(deltaLine) || deltaLine < 0 ||
      !Number.isInteger(deltaChar) || deltaChar < 0 ||
      !Number.isInteger(length) || length <= 0 ||
      !Number.isInteger(tokenType) || tokenType < 0 ||
      !Number.isInteger(tokenMods) || tokenMods < 0
    ) {
      connection.console.log(
        `[SemanticSanitizer] INVALID raw token at index ${i}: ` +
        `dL=${deltaLine}, dC=${deltaChar}, len=${length}, type=${tokenType}, mods=${tokenMods}`
      );
      continue;
    }

    line += deltaLine;
    char = deltaLine > 0 ? deltaChar : char + deltaChar;

    // --- Fehlerstelle: Token-Type außerhalb der Legend -------
    if (tokenType >= tokenTypesLen) {
      connection.console.log(
        `[SemanticSanitizer] tokenType index ${tokenType} out of range (max=${tokenTypesLen - 1}) at line=${line}, char=${char}`
      );
      continue;
    }

    // --- Fehlerstelle: Modifier-Bits zu groß ------------------
    if ((tokenMods & ~maxModifierMask) !== 0) {
      connection.console.log(
        `[SemanticSanitizer] modifier bits ${tokenMods} exceed legend capacity, masking to ${tokenMods & maxModifierMask}`
      );
      tokenMods &= maxModifierMask;
    }

    absTokens.push({ line, char, length, tokenType, tokenMods });
  }

  if (absTokens.length === 0) {
    connection.console.log('[SemanticSanitizer] no valid absolute tokens found.');
    return [];
  }

  // 3) Sortieren
  absTokens.sort((a, b) =>
    a.line === b.line ? a.char - b.char : a.line - b.line
  );

  // 4) Überlappungen entfernen
  const cleaned = [];
  let lastLine = -1;
  let lastEndChar = 0;

  for (const t of absTokens) {
    const endChar = t.char + t.length;

    // --- Fehlerstelle: Token überlappt mit vorherigem --------
    if (
      t.line < lastLine ||
      (t.line === lastLine && t.char < lastEndChar)
    ) {
      connection.console.log(
        `[SemanticSanitizer] OVERLAP detected: token at line=${t.line}, char=${t.char}, ` +
        `len=${t.length} overlaps with previous ending at line=${lastLine}, char=${lastEndChar}`
      );
      continue;
    }

    cleaned.push(t);
    lastLine = t.line;
    lastEndChar = endChar;
  }

  if (cleaned.length === 0) {
    connection.console.log('[SemanticSanitizer] all tokens removed due to overlap or invalidity.');
    return [];
  }

  // 5) Zurück in Delta-Form
  const out = [];
  let prevLine = 0;
  let prevChar = 0;
  let first = true;

  for (const t of cleaned) {
    let deltaLine;
    let deltaChar;

    if (first) {
      deltaLine = t.line;
      deltaChar = t.char;
      first = false;
    } else {
      deltaLine = t.line - prevLine;
      deltaChar = deltaLine > 0 ? t.char : t.char - prevChar;
    }

    if (deltaLine < 0 || deltaChar < 0) {
      connection.console.log(
        `[SemanticSanitizer] INTERNAL ERROR: negative delta after sorting! ` +
        `line=${t.line}, char=${t.char}, prevLine=${prevLine}, prevChar=${prevChar}`
      );
      continue; // niemals senden
    }

    out.push(deltaLine, deltaChar, t.length, t.tokenType, t.tokenMods);

    prevLine = t.line;
    prevChar = t.char;
  }

  connection.console.log(
    `[SemanticSanitizer] Completed: in=${data.length/5} tokens, out=${out.length/5} tokens.`
  );

  return out;
}

connection.languages.semanticTokens.on((params) => {
try {  
  const uri = params.textDocument.uri
  const doc = documents.get(uri);
  if (!doc) {
    return { data: [] };
  }

  const analysis = documentTokenCache.get(uri);    // Aus dem Cache holen
  if (!analysis) {
    return { data: [] };
  }

  const tokens = analysis.tokens;
  if (!tokens) {
    return { data: [] };
  }

  const semanticTokens = [];
  let prevLine = 0;
  let prevChar = 0;

  function encodeToken(line, char, length, typeName, modifiers) {
    const lineDelta = line - prevLine;
    const charDelta = lineDelta === 0 ? char - prevChar : char;
    prevLine = line;
    prevChar = char;

    const typeIndex = semanticTokenTypes.indexOf(typeName);
    if (typeIndex < 0) {
      return; // unbekannter Typ -> ignorieren
    }

    let modifierBits = 0;
    if (modifiers && modifiers.length) {
      for (const m of modifiers) {
        const idx = semanticTokenModifiers.indexOf(m);
        if (idx >= 0) {
          modifierBits |= 1 << idx;
        }
      }
    }

connection.console.log( `Semantic Token: ${[line, char, length, typeName, modifiers]} -> ${[lineDelta, charDelta, length, typeIndex, modifierBits]}`);
    semanticTokens.push(lineDelta, charDelta, length, typeIndex, modifierBits);
  }  

  const sortedTokens = tokens.filter(t => t.uri === uri && (t.type !== 'comment' && t.type !== 'inactive')).sort((a, b) =>
    a.line === b.line
      ? a.column - b.column
      : a.line - b.line
  );

  for (const t of sortedTokens) {
connection.console.log( `${t.type} ~${t.value}~ ${t.line} ${t.column} ${t.uri}`);

      /**
       * Tokenstruktur:
       * {
       *   type: 'keyword' | 'identifier' | 'number' | 'string' | 'bitstring' | 'operator' |
       *         'symbol' | 'comment' | 'inactive' | 'error' | 'preproc',
       *   value: string,
       *   uri: string,
       *   line: number,
       *   column: number,
       *   offset: number,
       *   length: number
       *   definition: identifier (optional)
       * }
       */


    if (t.type === 'identifier') {
      let typeName = 'variable';
      let mods = [];

/*      
      const sym = lookupSymbol(scopeStack, t.value);
      if (!sym) {
        continue;
      }

      switch( sym.typeDescription.typename ) {
        case 'PROC':
        case 'PROCEDURE':
        case 'ENTRY':
          typeName = 'function';
          mods.push('declaration');
          break;

        case 'TASK':
          typeName = 'class';
          mods.push('declaration');
          break;

        case 'SEMA':
        case 'BOLT':
          typeName = 'property';
          mods.push('declaration');
          break;

        default:
          typeName = 'variable';
          break;
      }
*/
      encodeToken(t.line, t.column, t.length, typeName, mods);
      continue;
    }

    if (t.type === 'type') {
      encodeToken(t.line, t.column, t.length, 'type', []);
      continue;
    }

    if (t.type === 'operator') {
      encodeToken(t.line, t.column, t.length, 'operator', []);
      continue;
    }

    if (t.type === 'number') {
      encodeToken(t.line, t.column, t.length, 'number', []);
      continue;
    }
   
    if (t.type === 'string') {
      encodeToken(t.line, t.column, t.length, 'string', []);
      continue;
    }

    if (t.type === 'bitstring') {
      encodeToken(t.line, t.column, t.length, 'string', []);
      continue;
    }
  }
  connection.console.log( `semanticTokens: ${semanticTokens}`);
  return { data: semanticTokens };
  const safeSemanticTokens = sanitizeSemanticTokensData(semanticTokens);
  connection.console.log( `safeSemanticTokens: ${safeSemanticTokens}`);
  return { data: safeSemanticTokens };  



  const semanticTokenArray = new Uint32Array(semanticTokens);
  connection.console.log( `semanticTokens: ${semanticTokenArray}`);
//  return { data: semanticTokenArray };  

//  const safeSemanticTokens = new Uint32Array(sanitizeSemanticTokensData(semanticTokenArray));
  connection.console.log( `safeSemanticTokens: ${semanticTokenArray}`);
  return { data: safeSemanticTokens };  
}
catch(e) {
  connection.console.log( `exception: ${e.message}`);
  connection.console.log( `${e.stack}`);
  return { data: [] };  
}
});


// ------------------------------
// Events & Start
// ------------------------------

documents.onDidOpen((event) => {
  connection.console.log( `onDidOpen ${event.document.uri}` );
  validateTextDocument(event.document);
});

documents.onDidClose((event) => {
  connection.console.log( `onDidClose ${event.document.uri}` );
  documentTokenCache.delete(event.document.uri);  // Dokument aus Cache kegeln
  documentSettings.delete(event.document.uri);  
});

documents.onDidChangeContent((event) => {
  validateTextDocument(event.document);
});

// React to configuration changes
connection.onDidChangeConfiguration((event) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    // Use global settings from `settings.json`
    globalSettings = (event.settings.pearl || defaultSettings);
  }

  // Revalidate all open documents with the new settings
  documents.all().forEach((doc) => {
    validateTextDocument(doc);
  });
});

documents.listen(connection);
connection.listen();

