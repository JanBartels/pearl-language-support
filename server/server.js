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
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity
} = require('vscode-languageserver');

const { TextDocument } = require('vscode-languageserver-textdocument');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { resolveProvider: true },
      hoverProvider: true,
      definitionProvider: true
    }
  };
});

// --- PEARL-spezifische Daten ---

const PEARL_KEYWORDS = [
  'PROBLEM',
  'MODULE',
  'SHELLMODULE',
  'TASK',
  'PROC',
  'REPEAT',
  'BEGIN',
  'IF',
  'THEN',
  'ELSE',
  'FIN',
  'CASE',
  'END',
  'MODEND',
  'DCL',
  'SPC',
  'SPECIFY',
  'ACTIVATE',
  'PREVENT',
  'TERMINATE',
  'SUSPEND',
  'RESUME',
  'REQUEST',
  'RELEASE',
  'ENTER',
  'LEAVE',
  'RESERVE',
  'FREE',
  'CALL',
  'GOTO'
];

// Block-Ende
const BLOCK_END_MAP = {
  MODULE: 'MODEND',
  SHELLMODULE: 'MODEND',
  TASK: 'END',
  PROC: 'END',
  REPEAT: 'END',
  BEGIN: 'END',
  IF: 'FIN',
  CASE: 'FIN'
};

const BLOCK_START_KEYWORDS = Object.keys(BLOCK_END_MAP);
const END_FOR_STRUCTURE    = ['TASK', 'PROC', 'REPEAT', 'BEGIN'];
const FIN_FOR_STRUCTURE    = ['IF', 'CASE'];
const MODEND_FOR_STRUCTURE = ['MODULE', 'SHELLMODULE'];

// Operationen
const TASK_CTRL_KEYWORDS = ['ACTIVATE', 'PREVENT', 'TERMINATE', 'SUSPEND', 'RESUME'];
const SEMA_OP_KEYWORDS   = ['REQUEST', 'RELEASE'];
const BOLT_OP_KEYWORDS   = ['ENTER', 'LEAVE', 'RESERVE', 'FREE'];

// --- Scope-Hilfsfunktionen ---

function createEmptyScope() {
  return {
    procs: {},   // name -> { kind, line, character }
    tasks: {},
    semas: {},
    bolts: {},
    vars: {}
  };
}

function lookupSymbol(scopeStack, kind, name) {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    const table = scopeStack[i][kind];
    if (table && table[name]) {
      return table[name];
    }
  }
  return undefined;
}

/**
 * Liefert für jede Identifier-Occurrence in der Zeile die erste Spalte.
 * Beispiel: "DCL I FIXED, X FLOAT, D DURATION;"
 * result = { I: posOfI, X: posOfX, D: posOfDIn"D DURATION" }
 */
function computeIdentifierPositions(line) {
  const result = {};
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const id = m[0];
    if (result[id] === undefined) {
      result[id] = m.index;
    }
  }
  return result;
}

/**
 * PROC-Parameter aus einer Zeile extrahieren.
 * Unterstützt z.B.:
 *   something: PROC( A FIXED, B FLOAT);
 *   (bewusst nur Label-Form)
 */
function parseProcParamsFromLine(codePart) {
  const m = /\bPROC\s*\(([^)]*)\)/.exec(codePart);
  if (!m) return [];
  const inside = m[1];
  const parts = inside.split(',');
  const names = [];
  for (const p of parts) {
    const mm = /[A-Za-z_][A-Za-z0-9_]*/.exec(p.trim());
    if (mm) names.push(mm[0]);
  }
  return names;
}

/**
 * Sucht eine Label-Definition "Name:" im ganzen Dokument.
 * Rückgabe: { line, character } oder null
 */
function findLabelDefinition(lines, name) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const commentPos = raw.indexOf('!');
    const codePart   = commentPos === -1 ? raw : raw.slice(0, commentPos);

    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(codePart);
    if (m && m[1] === name) {
      const col = raw.indexOf(m[1]);
      return { line: lineIndex, character: col === -1 ? 0 : col };
    }
  }
  return null;
}

/**
 * Prüft, ob eine Position innerhalb eines String-/Bit-Literals liegt:
 *   'text'
 *   'bits'B
 *   'bits'B1 .. 'bits'B4
 */
function isInsideStringOrBitLiteral(lineText, charIndex) {
  const re = /'[^']*'(?:B(?:[1-4])?)?/g;
  let m;
  while ((m = re.exec(lineText)) !== null) {
    const start = m.index;
    const end   = start + m[0].length;
    if (charIndex >= start && charIndex <= end) {
      return true;
    }
  }
  return false;
}

// --- Completion ---

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

// --- Hover ---

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text  = doc.getText();
  const lines = text.split(/\r?\n/);

  const offset = doc.offsetAt(params.position);
  const targetLine = params.position.line;
  const targetChar = params.position.character;

  const lineText = lines[targetLine] || '';

  // Keine Hover-Infos für String-/Bit-Literale
  if (isInsideStringOrBitLiteral(lineText, targetChar)) {
    return null;
  }

  let start = offset;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && /\w/.test(text[end])) end++;

  const word = text.substring(start, end);
  if (!word) return null;

  // numerische Literale: keine Hover-Infos
  if (/^\d/.test(word)) return null;

  if (PEARL_KEYWORDS.includes(word)) {
    return {
      contents: {
        kind: 'markdown',
        value: `**${word}** ist ein PEARL-Schlüsselwort.`
      }
    };
  }

  return null;
});

// --- Diagnostics mit Scope-Stack ---

function validateTextDocument(textDocument) {
  const text  = textDocument.getText();
  const lines = text.split(/\r?\n/);

  /** @type {import('vscode-languageserver').Diagnostic[]} */
  const diagnostics = [];

  const blockStack = [];
  const scopeStack = [createEmptyScope()]; // 0 = global

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];

    const commentPos = raw.indexOf('!');
    const codePart   = commentPos === -1 ? raw : raw.slice(0, commentPos);
    const trimmed    = codePart.trim();
    if (trimmed === '') continue;

    // --- Blockende (Scope-Pop) ---

    const hasEND    = /\bEND\b/.test(codePart);
    const hasFIN    = /\bFIN\b/.test(codePart);
    const hasMODEND = /\bMODEND\b/.test(codePart);

    if (hasEND) {
      const col = codePart.indexOf('END');
      if (
        blockStack.length === 0 ||
        !END_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: 'Unerwartetes END ohne passenden Block (TASK/PROC/REPEAT/BEGIN).',
          range: {
            start: { line: lineIndex, character: col === -1 ? 0 : col },
            end:   { line: lineIndex, character: col === -1 ? 3 : col + 3 }
          },
          source: 'pearl-lsp'
        });
      } else {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }

    if (hasFIN) {
      const col = codePart.indexOf('FIN');
      if (
        blockStack.length === 0 ||
        !FIN_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: 'Unerwartetes FIN ohne passenden Block (IF/CASE).',
          range: {
            start: { line: lineIndex, character: col === -1 ? 0 : col },
            end:   { line: lineIndex, character: col === -1 ? 3 : col + 3 }
          },
          source: 'pearl-lsp'
        });
      } else {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }

    if (hasMODEND) {
      const col = codePart.indexOf('MODEND');
      if (
        blockStack.length === 0 ||
        !MODEND_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: 'Unerwartetes MODEND ohne passenden Block (MODULE/SHELLMODULE).',
          range: {
            start: { line: lineIndex, character: col === -1 ? 0 : col },
            end:   { line: lineIndex, character: col === -1 ? 6 : col + 'MODEND'.length }
          },
          source: 'pearl-lsp'
        });
      } else {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }

    // --- Blockstart (inkl. Label-Form PROC/TASK) ---

    const labelProcTask = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(PROC|TASK)\b/.exec(
      codePart
    );
    if (labelProcTask) {
      const kind = labelProcTask[2]; // PROC oder TASK
      blockStack.push({ keyword: kind, line: lineIndex });
      scopeStack.push(createEmptyScope());
    } else {
      for (const kw of BLOCK_START_KEYWORDS) {
        const pattern = new RegExp('^\\s*' + kw + '\\b');
        if (pattern.test(codePart)) {
          blockStack.push({ keyword: kw, line: lineIndex });
          scopeStack.push(createEmptyScope());
          break;
        }
      }
    }

    const currentScope = scopeStack[scopeStack.length - 1];
    const globalScope  = scopeStack[0];

    const idPos = computeIdentifierPositions(raw);

    // --- PROC-Parameter im Scope (Label-Form PROC(...)) ---

    const procParams = parseProcParamsFromLine(codePart);
    for (const name of procParams) {
      const col = idPos[name] ?? raw.indexOf(name);
      currentScope.vars[name] = { kind: 'VAR', line: lineIndex, character: col };
    }

    // --- Deklarationen: MODULE/SHELLMODULE/TASK/PROC Name (ohne Label) ---

    const declMatch = /^\s*(MODULE|SHELLMODULE|TASK|PROC)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(
      codePart
    );
    if (declMatch) {
      const kind = declMatch[1];
      const name = declMatch[2];
      const col  = idPos[name] ?? raw.indexOf(name);

      if (kind === 'PROC') {
        globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
      } else if (kind === 'TASK') {
        globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
      }
    }

    // --- Deklarationen: Label-Form "name: PROC/TASK ..." ---

    if (labelProcTask) {
      const name = labelProcTask[1];
      const kind = labelProcTask[2];
      const col  = idPos[name] ?? raw.indexOf(name);

      if (kind === 'PROC') {
        globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
      } else if (kind === 'TASK') {
        globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
      }
    }

    // --- DCL: lokale Deklarationen im aktuellen Scope ---

    if (/^\s*DCL\b/.test(codePart)) {
      const parsed = parseDclLine(codePart);

      for (const name of parsed.semas) {
        const col = idPos[name] ?? raw.indexOf(name);
        currentScope.semas[name] = { kind: 'SEMA', line: lineIndex, character: col };
      }
      for (const name of parsed.bolts) {
        const col = idPos[name] ?? raw.indexOf(name);
        currentScope.bolts[name] = { kind: 'BOLT', line: lineIndex, character: col };
      }
      for (const name of parsed.procVars) {
        const col = idPos[name] ?? raw.indexOf(name);
        currentScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
      }
      for (const name of parsed.vars) {
        const col = idPos[name] ?? raw.indexOf(name);
        currentScope.vars[name] = { kind: 'VAR', line: lineIndex, character: col };
      }
    }

    // --- SPC/SPECIFY: globale Spezifikationen ---

    if (/^\s*(SPC|SPECIFY)\b/.test(codePart)) {
      const parsedSpc = parseSpcLine(codePart);

      for (const name of parsedSpc.tasks) {
        const col = idPos[name] ?? raw.indexOf(name);
        globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
      }
      for (const name of parsedSpc.procs) {
        const col = idPos[name] ?? raw.indexOf(name);
        globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
      }
      for (const name of parsedSpc.semas) {
        const col = idPos[name] ?? raw.indexOf(name);
        globalScope.semas[name] = { kind: 'SEMA', line: lineIndex, character: col };
      }
      for (const name of parsedSpc.bolts) {
        const col = idPos[name] ?? raw.indexOf(name);
        globalScope.bolts[name] = { kind: 'BOLT', line: lineIndex, character: col };
      }
    }

    // --- Aufruf-Diagnostics mit Scope-Lookup ---

    // CALL PROC
    const callRegex = /\bCALL\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let m;
    while ((m = callRegex.exec(codePart)) !== null) {
      const name = m[1];
      const sym  = lookupSymbol(scopeStack, 'procs', name);
      if (!sym) {
        const callStart = m.index;
        const callEnd   = callStart + m[0].length;
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          message: `Aufruf von '${name}' ohne passende PROC-Deklaration (PROC/DCL PROC/SPC PROC/ENTRY).`,
          range: {
            start: { line: lineIndex, character: callStart },
            end:   { line: lineIndex, character: callEnd }
          },
          source: 'pearl-lsp'
        });
      }
    }

    // TASK-Operationen
    for (const kw of TASK_CTRL_KEYWORDS) {
      const re = new RegExp('\\b' + kw + '\\s+([A-Za-z_][A-Za-z0-9_]*)', 'g');
      let m2;
      while ((m2 = re.exec(codePart)) !== null) {
        const taskName = m2[1];
        const sym      = lookupSymbol(scopeStack, 'tasks', taskName);
        if (!sym) {
          const start = m2.index;
          const end   = start + m2[0].length;
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            message: `TASK '${taskName}' wird mit ${kw} verwendet, es existiert aber keine TASK-Deklaration (TASK/SPC TASK).`,
            range: {
              start: { line: lineIndex, character: start },
              end:   { line: lineIndex, character: end }
            },
            source: 'pearl-lsp'
          });
        }
      }
    }

    // SEMA-Operationen
    for (const kw of SEMA_OP_KEYWORDS) {
      const re = new RegExp('\\b' + kw + '\\s+([A-Za-z_][A-Za-z0-9_]*)', 'g');
      let m2;
      while ((m2 = re.exec(codePart)) !== null) {
        const semaName = m2[1];
        const sym      = lookupSymbol(scopeStack, 'semas', semaName);
        if (!sym) {
          const start = m2.index;
          const end   = start + m2[0].length;
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            message: `SEMA '${semaName}' wird mit ${kw} verwendet, es existiert aber keine SEMA-Deklaration (DCL/SPC SEMA).`,
            range: {
              start: { line: lineIndex, character: start },
              end:   { line: lineIndex, character: end }
            },
            source: 'pearl-lsp'
          });
        }
      }
    }

    // BOLT-Operationen
    for (const kw of BOLT_OP_KEYWORDS) {
      const re = new RegExp('\\b' + kw + '\\s+([A-Za-z_][A-Za-z0-9_]*)', 'g');
      let m2;
      while ((m2 = re.exec(codePart)) !== null) {
        const boltName = m2[1];
        const sym      = lookupSymbol(scopeStack, 'bolts', boltName);
        if (!sym) {
          const start = m2.index;
          const end   = start + m2[0].length;
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            message: `BOLT '${boltName}' wird mit ${kw} verwendet, es existiert aber keine BOLT-Deklaration (DCL/SPC BOLT).`,
            range: {
              start: { line: lineIndex, character: start },
              end:   { line: lineIndex, character: end }
            },
            source: 'pearl-lsp'
          });
        }
      }
    }
  }

  // am Ende noch offene Blöcke melden
  for (const open of blockStack) {
    const lineTextRaw = lines[open.line];
    const col = lineTextRaw.indexOf(open.keyword);
    const endKw = BLOCK_END_MAP[open.keyword] || 'END';

    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      message: `Block '${open.keyword}' wird nicht geschlossen. Erwartet ${endKw}.`,
      range: {
        start: {
          line: open.line,
          character: col === -1 ? 0 : col
        },
        end: {
          line: open.line,
          character:
            col === -1 ? lineTextRaw.length : col + open.keyword.length
        }
      },
      source: 'pearl-lsp'
    });
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// --- Go To Definition (mit Scope-Stack + Labels + PROC-Parametern + Literal-Check) ---

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text  = doc.getText();
  const lines = text.split(/\r?\n/);

  const offset = doc.offsetAt(params.position);
  let start = offset;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && /\w/.test(text[end])) end++;
  const word = text.substring(start, end);
  if (!word) return null;

  const targetLine = params.position.line;
  const targetChar = params.position.character;

  const lineText = lines[targetLine] || '';

  // 1) In String-/Bit-Literal? → kein GoTo
  if (isInsideStringOrBitLiteral(lineText, targetChar)) {
    return null;
  }

  // 2) Numerisches Literal? → kein GoTo
  if (/^\d/.test(word)) {
    return null;
  }

  // 3) Keyword? → kein GoTo (nur Hover)
  if (PEARL_KEYWORDS.includes(word)) {
    return null;
  }

  const blockStack = [];
  const scopeStack = [createEmptyScope()];

  for (let lineIndex = 0; lineIndex <= targetLine; lineIndex++) {
    const raw = lines[lineIndex];

    const commentPos = raw.indexOf('!');
    const codePart   = commentPos === -1 ? raw : raw.slice(0, commentPos);
    const trimmed    = codePart.trim();
    if (trimmed === '') continue;

    const idPos = computeIdentifierPositions(raw);

    const hasEND    = /\bEND\b/.test(codePart);
    const hasFIN    = /\bFIN\b/.test(codePart);
    const hasMODEND = /\bMODEND\b/.test(codePart);

    if (hasEND && lineIndex < targetLine) {
      if (
        blockStack.length &&
        END_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }
    if (hasFIN && lineIndex < targetLine) {
      if (
        blockStack.length &&
        FIN_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }
    if (hasMODEND && lineIndex < targetLine) {
      if (
        blockStack.length &&
        MODEND_FOR_STRUCTURE.includes(blockStack[blockStack.length - 1].keyword)
      ) {
        blockStack.pop();
        if (scopeStack.length > 1) scopeStack.pop();
      }
    }

    // Blockstart
    const labelProcTask = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(PROC|TASK)\b/.exec(
      codePart
    );
    if (labelProcTask) {
      blockStack.push({ keyword: labelProcTask[2], line: lineIndex });
      scopeStack.push(createEmptyScope());
    } else {
      for (const kw of BLOCK_START_KEYWORDS) {
        const pattern = new RegExp('^\\s*' + kw + '\\b');
        if (pattern.test(codePart)) {
          blockStack.push({ keyword: kw, line: lineIndex });
          scopeStack.push(createEmptyScope());
          break;
        }
      }
    }

    const currentScope = scopeStack[scopeStack.length - 1];
    const globalScope  = scopeStack[0];

    const beforeCursor = (col) =>
      lineIndex < targetLine || (lineIndex === targetLine && col <= targetChar);

    // PROC-Parameter
    const procParams = parseProcParamsFromLine(codePart);
    for (const name of procParams) {
      const col = idPos[name] ?? raw.indexOf(name);
      if (beforeCursor(col)) {
        currentScope.vars[name] = { kind: 'VAR', line: lineIndex, character: col };
      }
    }

    // Deklaration: klassische FORM
    const declMatch = /^\s*(MODULE|SHELLMODULE|TASK|PROC)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(
      codePart
    );
    if (declMatch) {
      const kind = declMatch[1];
      const name = declMatch[2];
      const col  = idPos[name] ?? raw.indexOf(name);
      if (beforeCursor(col)) {
        if (kind === 'PROC') {
          globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
        } else if (kind === 'TASK') {
          globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
        }
      }
    }

    // Deklaration: Label-Form "name: PROC/TASK"
    if (labelProcTask) {
      const name = labelProcTask[1];
      const kind = labelProcTask[2];
      const col  = idPos[name] ?? raw.indexOf(name);
      if (beforeCursor(col)) {
        if (kind === 'PROC') {
          globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
        } else if (kind === 'TASK') {
          globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
        }
      }
    }

    // DCL
    if (/^\s*DCL\b/.test(codePart)) {
      const parsed = parseDclLine(codePart);
      for (const name of parsed.semas) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          currentScope.semas[name] = { kind: 'SEMA', line: lineIndex, character: col };
        }
      }
      for (const name of parsed.bolts) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          currentScope.bolts[name] = { kind: 'BOLT', line: lineIndex, character: col };
        }
      }
      for (const name of parsed.procVars) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          currentScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
        }
      }
      for (const name of parsed.vars) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          currentScope.vars[name] = { kind: 'VAR', line: lineIndex, character: col };
        }
      }
    }

    // SPC / SPECIFY
    if (/^\s*(SPC|SPECIFY)\b/.test(codePart)) {
      const parsedSpc = parseSpcLine(codePart);
      for (const name of parsedSpc.tasks) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          globalScope.tasks[name] = { kind: 'TASK', line: lineIndex, character: col };
        }
      }
      for (const name of parsedSpc.procs) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          globalScope.procs[name] = { kind: 'PROC', line: lineIndex, character: col };
        }
      }
      for (const name of parsedSpc.semas) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          globalScope.semas[name] = { kind: 'SEMA', line: lineIndex, character: col };
        }
      }
      for (const name of parsedSpc.bolts) {
        const col = idPos[name] ?? raw.indexOf(name);
        if (beforeCursor(col)) {
          globalScope.bolts[name] = { kind: 'BOLT', line: lineIndex, character: col };
        }
      }
    }
  }

  // Reihenfolge: zuerst Variablen (inkl. PROC-Parameter), dann PROCs, dann TASK/SEMA/BOLT
  const kinds = ['vars', 'procs', 'tasks', 'semas', 'bolts'];
  for (const kind of kinds) {
    const sym = lookupSymbol(scopeStack, kind, word);
    if (sym) {
      return {
        uri: doc.uri,
        range: {
          start: { line: sym.line, character: sym.character },
          end:   { line: sym.line, character: sym.character + word.length }
        }
      };
    }
  }

  // Fallback: Label-Definition suchen (MyLabel:)
  const labelDef = findLabelDefinition(lines, word);
  if (labelDef) {
    return {
      uri: doc.uri,
      range: {
        start: { line: labelDef.line, character: labelDef.character },
        end:   { line: labelDef.line, character: labelDef.character + word.length }
      }
    };
  }

  return null;
});

// --- DCL-Parser ---

function parseDclLine(line) {
  const result = {
    semas: [],
    bolts: [],
    procVars: [],
    vars: []
  };

  const dclMatch = /^\s*DCL\b(.*)/.exec(line);
  if (!dclMatch) return result;
  const rest = dclMatch[1];

  const ignoreIds = new Set([
    'REF', 'INV', 'INIT', 'PRESET',
    'GLOBAL', 'RESIDENT', 'REENTRANT', 'MAIN',
    'MUTEX',
    'TASK', 'PROC', 'MODULE', 'SHELLMODULE', 'ENTRY',
    'PRIO', 'PRIORITY',
    'SEMA', 'BOLT',
    'FIXED', 'FLOAT', 'BIT', 'CHAR', 'CHARACTER', 'CLOCK', 'DURATION',
    'TYPE', 'DATION', 'SIGNAL', 'INTERRUPT', 'IRPT'
  ]);

  function collectBeforeKeyword(keyword, targetArray, extraIgnore) {
    const parts = rest.split(new RegExp('\\b' + keyword + '\\b'));
    if (parts.length < 2) return;
    const namesPart = parts[0];
    const ids = namesPart.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];

    for (const id of ids) {
      if (ignoreIds.has(id)) continue;
      if (extraIgnore && extraIgnore.has(id)) continue;
      if (!targetArray.includes(id)) {
        targetArray.push(id);
      }
    }
  }

  collectBeforeKeyword('SEMA', result.semas, null);

  const extraIgnoreBolt = new Set(['MUTEX']);
  collectBeforeKeyword('BOLT', result.bolts, extraIgnoreBolt);

  collectBeforeKeyword('PROC', result.procVars, null);

  const allIds = rest.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const id of allIds) {
    if (ignoreIds.has(id)) continue;
    if (result.semas.includes(id)) continue;
    if (result.bolts.includes(id)) continue;
    if (result.procVars.includes(id)) continue;
    if (!result.vars.includes(id)) {
      result.vars.push(id);
    }
  }

  return result;
}

// --- SPC/SPECIFY-Parser ---

function parseSpcLine(line) {
  const result = {
    tasks: [],
    procs: [],   // PROC + ENTRY
    semas: [],
    bolts: []
  };

  const m = /^\s*(SPC|SPECIFY)\b(.*)/.exec(line);
  if (!m) return result;
  const rest = m[2];

  const ignoreIds = new Set([
    'TASK', 'PROC', 'ENTRY', 'SEMA', 'BOLT',
    'PRIO', 'PRIORITY',
    'GLOBAL', 'RESIDENT', 'REENTRANT', 'MAIN',
    'REF', 'INV', 'INIT', 'PRESET'
  ]);

  function collect(typeKeyword, targetArray) {
    const parts = rest.split(new RegExp('\\b' + typeKeyword + '\\b'));
    if (parts.length < 2) return;
    const namesPart = parts[0];
    const ids = namesPart.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    for (const id of ids) {
      if (ignoreIds.has(id)) continue;
      if (!targetArray.includes(id)) {
        targetArray.push(id);
      }
    }
  }

  collect('TASK',  result.tasks);
  collect('PROC',  result.procs);   // PROC → procs
  collect('ENTRY', result.procs);   // ENTRY → ebenfalls procs
  collect('SEMA',  result.semas);
  collect('BOLT',  result.bolts);

  return result;
}

// --- Events ---

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

documents.onDidOpen((openEvent) => {
  validateTextDocument(openEvent.document);
});

documents.listen(connection);
connection.listen();
