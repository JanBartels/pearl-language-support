// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Analysis } from './analysis';
import { ProblemCollection } from '../core/problemCollection';
import { MacroReference } from '../preproc/macroReference';
import { contains } from '../core/span';
import { Severity } from '../core/severity';

export class AnalysisResult {

readonly rootAnalysis: Analysis;
    readonly files: ReadonlyMap<string, Analysis>;
    readonly problems: ProblemCollection;
    readonly macroReferences: readonly MacroReference[];

    private constructor(
      rootAnalysis: Analysis,
      files: ReadonlyMap<string, Analysis>,
      problems: ProblemCollection,
      macroReferences: readonly MacroReference[]      
    ) {
      this.rootAnalysis = rootAnalysis;
      this.files = files;
      this.problems = problems;
      this.macroReferences = macroReferences;
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
      const allMacroReferences: MacroReference[] = [];

      for (const analysis of analyses) {
        allProblems.addAll(analysis.problems);
        allMacroReferences.push(...analysis.macroReferences);
      }

      return new AnalysisResult(
        rootAnalysis,
        fileMap,
        allProblems,
        allMacroReferences
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

  lookupMacro(offset: number): MacroReference | undefined {
    for (const reference of this.macroReferences) {
        if (contains(reference.location.span, offset)) {
            return reference;
        }
    }

    return undefined;
  }

}