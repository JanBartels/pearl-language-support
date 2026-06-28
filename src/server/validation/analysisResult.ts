// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Analysis } from './analysis';
import { ProblemCollection } from '../core/problemCollection';
import { Severity } from '../core/severity';

export class AnalysisResult {

readonly rootAnalysis: Analysis;
    readonly files: ReadonlyMap<string, Analysis>;
    readonly problems: ProblemCollection;

    private constructor(
      rootAnalysis: Analysis,
      files: ReadonlyMap<string, Analysis>,
      problems: ProblemCollection
    ) {
      this.rootAnalysis = rootAnalysis;
      this.files = files;
      this.problems = problems;
    }

    static create(
      rootAnalysis: Analysis,
      analyses: readonly Analysis[]
    ): AnalysisResult {

      const fileMap = new Map<string, Analysis>();

      for (const analysis of analyses) {
        fileMap.set(analysis.source.uri, analysis);
      }

      const allProblems = new ProblemCollection();

      for (const analysis of analyses) {
        allProblems.addAll(analysis.problems);
      }

      return new AnalysisResult(
        rootAnalysis,
        fileMap,
        allProblems
      );
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