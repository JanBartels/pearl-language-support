// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { FileAnalysis } from './fileAnalysis';
import { ProblemCollection } from '../core/problemCollection';
import { Severity } from '../core/severity';

export class AnalysisResult {

  readonly rootUri: string;
  readonly files: ReadonlyMap<string, FileAnalysis>;
  readonly problems: ProblemCollection;

  private constructor(
    rootUri: string,
    files: ReadonlyMap<string, FileAnalysis>,
    problems: ProblemCollection
  ) {
    this.rootUri = rootUri;
    this.files = files;
    this.problems = problems;
  }

  static create(
    rootUri: string,
    fileAnalyses: readonly FileAnalysis[]
  ): AnalysisResult {

    const fileMap = new Map<string, FileAnalysis>();

    for (const file of fileAnalyses) {
      fileMap.set(file.uri, file);
    }

    const allProblems = new ProblemCollection();
    for (const file of fileAnalyses) {
      allProblems.addAll(file.problems);
    }

    return new AnalysisResult(rootUri, fileMap, allProblems);
  }

  static empty(rootUri: string): AnalysisResult {
    return new AnalysisResult(rootUri, new Map(), new ProblemCollection());
  }

  getFile(uri: string): FileAnalysis | undefined {
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