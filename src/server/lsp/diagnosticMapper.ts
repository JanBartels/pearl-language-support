// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { Problem } from '../core/problem';
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

    const uri = problem.location.source.uri;
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
      mapDiagnostic(problem, document)
    );
  }

  return result;
}

function mapDiagnostic(
  problem: Problem,
  document: TextDocument
): Diagnostic {

  const span = problem.location.span;

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

