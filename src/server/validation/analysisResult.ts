// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Analysis } from './analysis';
import { ProblemCollection } from '../core/problemCollection';
import { MacroReference } from '../preproc/macroReference';
import { SourceOffset } from '../core/sourceOffset';
import { AMBIGUOUS_MACRO_OCCURRENCE } from '../preproc/macroOccurrenceIndex';
import { Severity } from '../core/severity';
import type { IncludeOccurrence } from '../preproc/includeOccurrence';

export class AnalysisResult {

readonly rootAnalysis: Analysis;
    readonly files: ReadonlyMap<string, Analysis>;
    readonly problems: ProblemCollection;
    readonly macroReferences: readonly MacroReference[];
    /** Actual, active includes; undefined only for legacy/manual analyses. */
    readonly includedSourceUris: readonly string[] | undefined;
    /** Executed include instances with their site chains and expanded ranges. */
    readonly includeOccurrences: readonly IncludeOccurrence[];
    /** Attempted include targets, including files missing on disk. Not semantic sources. */
    readonly watchedIncludeUris: readonly string[] | undefined;

    private constructor(
      rootAnalysis: Analysis,
      files: ReadonlyMap<string, Analysis>,
      problems: ProblemCollection,
      macroReferences: readonly MacroReference[],
      includedSourceUris?: readonly string[],
      includeOccurrences: readonly IncludeOccurrence[] = [],
      watchedIncludeUris?: readonly string[]
    ) {
      this.rootAnalysis = rootAnalysis;
      this.files = files;
      this.problems = problems;
      this.macroReferences = macroReferences;
      this.includedSourceUris = includedSourceUris;
      this.includeOccurrences = includeOccurrences;
      this.watchedIncludeUris = watchedIncludeUris;
    }

    static create(
      rootAnalysis: Analysis,
      analyses: readonly Analysis[],
      includedSourceUris?: readonly string[],
      includeOccurrences: readonly IncludeOccurrence[] = [],
      watchedIncludeUris?: readonly string[]
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
        allMacroReferences,
        includedSourceUris,
        Object.freeze([...includeOccurrences]),
        watchedIncludeUris === undefined ? undefined : Object.freeze([...watchedIncludeUris])
      );
    }

    /**
     * Assemble a previously validated graph after crossing a transport boundary.
     * Unlike create(), this preserves the global diagnostic/reference collections
     * independently of the individual file analyses.
     */
    static rehydrate(
      rootAnalysis: Analysis,
      files: ReadonlyMap<string, Analysis>,
      problems: ProblemCollection,
      macroReferences: readonly MacroReference[],
      includedSourceUris?: readonly string[],
      includeOccurrences: readonly IncludeOccurrence[] = [],
      watchedIncludeUris?: readonly string[]
    ): AnalysisResult {
      return new AnalysisResult(rootAnalysis, new Map(files), problems, macroReferences,
        includedSourceUris === undefined ? undefined : Object.freeze([...includedSourceUris]),
        Object.freeze([...includeOccurrences]),
        watchedIncludeUris === undefined ? undefined : Object.freeze([...watchedIncludeUris]));
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

  /** Find a macro name at either its #define or a usage site. */
  lookupMacro(position: SourceOffset): MacroReference | undefined {
    const match = this.rootAnalysis.macroOccurrences.lookupAt(position);
    if (!match || match === AMBIGUOUS_MACRO_OCCURRENCE) return undefined;
    if (!match.isDefinition) {
      const reference = match.group.references.find(ref => ref.location === match.location);
      if (reference) return reference;
    }
    // Definition locations have no MacroReference in the original stream.
    return { definition: match.group.definition, location: match.location };
  }

}