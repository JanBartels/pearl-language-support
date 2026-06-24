// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { Problem } from '../core/problem';
import { Severity } from '../core/severity';
import { DocumentRegistry } from '../utility/documentRegistry';
import { SourceFile } from '../source/sourceFile';

export class DiagnosticMapper {

  static map(
    problem: Problem,
    registry: DocumentRegistry
  ): Diagnostic {

    const { uri, span } = problem.location;

    const sourceFile = getSourceFile(uri, registry);

    const start = sourceFile.positionAt(span.start);
    const end = sourceFile.positionAt(span.end);

    return {
      range: { start, end },
      message: problem.message,
      severity: mapSeverity(problem.severity),
      source: 'pearl',
      ...(problem.code !== undefined && { code: problem.code })      
    };
  }

  static mapAll(
    problems: readonly Problem[],
    registry: DocumentRegistry
  ): Map<string, Diagnostic[]> {

    const result = new Map<string, Diagnostic[]>();

    for (const problem of problems) {

      const uri = problem.location.uri;

      let diagnostics = result.get(uri);

      if (!diagnostics) {
        diagnostics = [];
        result.set(uri, diagnostics);
      }

      diagnostics.push(
        DiagnosticMapper.map(problem, registry)
      );
    }

    return result;
  }
}

function getSourceFile(
  uri: string,
  registry: DocumentRegistry
): SourceFile {

  const document = registry.get(uri);

  if (!document) {
    // Fallback – sollte eigentlich nicht passieren
    return new SourceFile(uri, '');
  }

  return new SourceFile(uri, document.getText());
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

