// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token } from '../lexer/token';
import { ProblemCollection } from '../core/problemCollection';
import { Severity } from '../core/severity';

export class FileAnalysis {

  readonly uri: string;
  readonly tokens: readonly Token[];
  readonly problems: ProblemCollection;

  private constructor(
    uri: string,
    tokens: readonly Token[],
    problems: ProblemCollection
  ) {
    this.uri = uri;
    this.tokens = tokens;
    this.problems = problems;
  }

  static create(
    uri: string,
    tokens: readonly Token[],
    problems: ProblemCollection
  ): FileAnalysis {
    return new FileAnalysis(uri, tokens, problems);
  }

  static empty(uri: string): FileAnalysis {
    return new FileAnalysis(uri, [], new ProblemCollection());
  }

  hasErrors(): boolean {
    return this.problems.some(p => p.severity === Severity.Error);
  }  

  hasWarnings(): boolean {
    return this.problems.some(p => p.severity === Severity.Warning);
  }  
}