// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { Problem } from '../core/problem';
import { mapToOriginalLocation } from '../core/sourceOffset';
import type { Location } from '../core/location';
import { ProblemCollection } from '../core/problemCollection';
import { Severity } from '../core/severity';
import { DocumentRegistry } from '../utility/documentRegistry';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function mapDiagnostics(
  problems: ProblemCollection,
  registry: DocumentRegistry
): Map<string, Diagnostic[]> {

  const result = new Map<string, Diagnostic[]>();

  for (const problem of problems.toArray()) {

    // Lexer, preprocessor and parser diagnostics can originate from a
    // MacroSource. Resolve the complete source chain before using offsets
    // together with the editor document URI.
    const location = mapToOriginalLocation(problem.location);
    const uri = location.source.uri;
    const document = registry.get(uri);
    if (!document) {
        // interner Fehler
        continue;
    }

    let diagnostics = result.get(uri);

    if (!diagnostics) {
      diagnostics = [];
      result.set(uri, diagnostics);
    }

    diagnostics.push(
      mapDiagnostic(problem, location, document)
    );
  }

  return result;
}

function mapDiagnostic(
  problem: Problem,
  location: Location,
  document: TextDocument
): Diagnostic {

  const span = location.span;

  const start = document.positionAt(span.start);
  const end = document.positionAt(span.end);

  return {
    range: { start, end },
    message: problem.message,
    severity: mapSeverity(problem.severity),
    source: 'pearl',
    ...(problem.code !== undefined && { code: problem.code })      
  };
}

function mapSeverity(severity: Severity): DiagnosticSeverity {
  switch (severity) {
    case Severity.Error:
      return DiagnosticSeverity.Error;
    case Severity.Warning:
      return DiagnosticSeverity.Warning;
    case Severity.Info:
      return DiagnosticSeverity.Information;
    case Severity.Hint:
      return DiagnosticSeverity.Hint;
  }

  return assertNever(severity);  
}

function assertNever(x: never): never {
  throw new Error(`Unhandled severity: ${x}`);
}

