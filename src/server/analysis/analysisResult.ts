// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Analysis } from './analysis';
import { ProblemCollection } from '../core/problemCollection';
import { Severity } from '../core/severity';

export class AnalysisResult {

  readonly rootUri: string;
  readonly files: ReadonlyMap<string, Analysis>;
  readonly problems: ProblemCollection;

  private constructor(
    rootUri: string,
    files: ReadonlyMap<string, Analysis>,
    problems: ProblemCollection
  ) {
    this.rootUri = rootUri;
    this.files = files;
    this.problems = problems;
  }

  static create(
    rootUri: string,
    analyses: readonly Analysis[]
  ): AnalysisResult {

    const fileMap = new Map<string, Analysis>();

    for (const file of analyses) {
      fileMap.set(file.rootUri, file);
    }

    const allProblems = new ProblemCollection();
    for (const file of analyses) {
      allProblems.addAll(file.problems);
    }

    return new AnalysisResult(rootUri, fileMap, allProblems);
  }

  static empty(rootUri: string): AnalysisResult {
    return new AnalysisResult(rootUri, new Map(), new ProblemCollection());
  }

  getFile(uri: string): Analysis | undefined {
    return this.files.get(uri);
  }

  hasErrors(): boolean {
    return this.problems.some(p => p.severity === Severity.Error);
  }

  hasWarnings(): boolean {
    return this.problems.some(p => p.severity === Severity.Warning);
  }  

  getAllTokens(): readonly unknown[] {
    // später evtl. typisieren
    return Array.from(this.files.values())
      .flatMap(f => f.tokens);
  }
}