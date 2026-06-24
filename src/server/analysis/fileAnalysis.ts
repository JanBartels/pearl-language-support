// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Token } from '../lexer/token';
import { Problem } from '../core/problem';
import { Severity } from '../core/severity';

export class FileAnalysis {

  readonly uri: string;
  readonly tokens: readonly Token[];
  readonly problems: readonly Problem[];

  private constructor(
    uri: string,
    tokens: readonly Token[],
    problems: readonly Problem[]
  ) {
    this.uri = uri;
    this.tokens = tokens;
    this.problems = problems;
  }

  static create(
    uri: string,
    tokens: readonly Token[],
    problems: readonly Problem[]
  ): FileAnalysis {
    return new FileAnalysis(uri, tokens, problems);
  }

  static empty(uri: string): FileAnalysis {
    return new FileAnalysis(uri, [], []);
  }

  hasErrors(): boolean {
    return this.problems.some(p => p.severity === Severity.Error);
  }  

  hasWarnings(): boolean {
    return this.problems.some(p => p.severity === Severity.Warning);
  }  
}