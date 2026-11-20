// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from "path";
import { filePathFromUri, uriFromFilePath } from './uriUtils'
import { AnalysisResult } from '../validation/analysisResult';
import type { IncludeOccurrence } from '../preproc/includeOccurrence';
import type { SourceOffset } from '../core/sourceOffset';

/** One selectable semantic context of a physical include file. */
export interface IncludeContextOption {
    readonly unitUri: string;
    /** Absent only for legacy analyses without include occurrence metadata. */
    readonly occurrence?: IncludeOccurrence;
}


export class DocumentRegistry {
  private documents: TextDocuments<TextDocument>;
  // Filecaching anhand vom Timestamp auf der Platte
  private includeCache: Map<
    string,
    { mtimeMs: number; doc: TextDocument }
  > = new Map();
  
  // Legacy/manual include edges (used by existing parser tests). Production
  // dependencies are committed atomically with AnalysisResult instead.
  private readonly includes = new Map<string, Set<string>>();
  private readonly includedBy = new Map<string, Set<string>>();

  /** Actual dependency relationships of completed translation units. */
  private readonly sourcesByUnit = new Map<string, Set<string>>();
  private readonly unitsBySource = new Map<string, Set<string>>();

  // Analysis is owned by a translation unit. Included files have no independent
  // result unless they were explicitly analyzed as a root.
  private readonly analysisResults = new Map<string, {
      version: number;
      result: AnalysisResult;
      /** Versions of all source documents used by this analysis. */
      sourceVersions: ReadonlyMap<string, number>;
  }>();

  /** Root URIs with an active analysis lifecycle (also while analyzing). */
  private readonly translationUnits = new Set<string>();
  /** Monotonically changing request identities reject superseded results. */
  private readonly requestIds = new Map<string, number>();

  /** User-selected translation unit for a multiply included source. */
  private readonly preferredUnitBySource = new Map<string, string>();
  /** The include directive chain, not an expanded-text offset, is stable across edits. */
  private readonly preferredOccurrenceBySource = new Map<string, string>();

  constructor(documents: TextDocuments<TextDocument>) {
    this.documents = documents;
  }

  /**
   * Liefert ein TextDocument zu einer URI
   * (offen oder included)
   */
  get(uri: string): TextDocument | null {
    const openDoc = this.documents.get(uri);
    if (openDoc) {
      return openDoc;
    }

    return this.loadFromFileSystem(uri);
  }

  private loadFromFileSystem(uri: string): TextDocument | null {
    let fsPath: string | undefined;

    try {
      fsPath = filePathFromUri(uri);
      const stat = fs.statSync(fsPath);
      const mtimeMs = stat.mtimeMs;

      const cached = this.includeCache.get(fsPath);
      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.doc;
      }

      const text = fs.readFileSync(fsPath, 'utf8');
      const doc = TextDocument.create(uri, 'pearl', 0, text);

      this.includeCache.set(fsPath, { mtimeMs, doc });
      return doc;
    } catch {
      if (fsPath) {
        this.includeCache.delete(fsPath);
      }
      return null;
    }
  }

  resolveInclude(sourceUri: string, includePath: string): TextDocument | null {

      const sourcePath = filePathFromUri(sourceUri);

      const includeFsPath = path.resolve(
          path.dirname(sourcePath),
          includePath
      );

      const includeUri = uriFromFilePath(includeFsPath);

      return this.get(includeUri);
  }

  /** Register a new analysis request before awaiting settings or I/O. */
  beginAnalysis(uri: string): number {
      this.translationUnits.add(uri);
      return this.bumpRequestId(uri);
  }

  isCurrentAnalysis(uri: string, requestId: number): boolean {
      return this.translationUnits.has(uri)
          && this.requestIds.get(uri) === requestId;
  }

  closeTranslationUnit(uri: string): void {
      for (const [sourceUri, selectedUnit] of this.preferredUnitBySource) {
          if (selectedUnit === uri) {
              this.preferredUnitBySource.delete(sourceUri);
              this.preferredOccurrenceBySource.delete(sourceUri);
          }
      }
      this.translationUnits.delete(uri);
      this.bumpRequestId(uri);
      this.clearAnalysisResult(uri);
      this.removeUnitSources(uri);
  }

  getActiveTranslationUnits(): string[] {
      return [...this.translationUnits];
  }

  private bumpRequestId(uri: string): number {
      const next = (this.requestIds.get(uri) ?? 0) + 1;
      this.requestIds.set(uri, next);
      return next;
  }

  /**
   * Invalidate a source and all its transitive includers. Return only active
   * translation units that need reanalysis; never analyze intermediate includes
   * as if they were complete modules.
   */
  invalidateUri(uri: string): string[] {
      this.includeCache.delete(filePathFromUri(uri));
      const affected = new Set<string>(this.unitsBySource.get(uri) ?? []);
      if (this.translationUnits.has(uri)) affected.add(uri);

      for (const unitUri of affected) {
          this.clearAnalysisResult(unitUri);
          this.bumpRequestId(unitUri);
      }
      return [...affected].filter(unitUri => this.translationUnits.has(unitUri));
  }

  /** Also invalidate results after a settings change (without editing text). */
  invalidateAllAnalyses(): string[] {
      for (const uri of this.translationUnits) {
          this.clearAnalysisResult(uri);
          this.bumpRequestId(uri);
      }
      return [...this.translationUnits];
  }

  invalidateAllIncludes(): void {
    this.includeCache.clear();
  }

  addInclude(source: string, include: string): void {

      let set = this.includes.get(source);
      if (!set) {
          set = new Set();
          this.includes.set(source, set);
      }
      set.add(include);

      let reverse = this.includedBy.get(include);
      if (!reverse) {
          reverse = new Set();
          this.includedBy.set(include, reverse);
      }
      reverse.add(source);
  }

  clearIncludes(source: string): void {

      const includes = this.includes.get(source);
      if (!includes) {
          return;
      }

      for (const include of includes) {
          this.includedBy.get(include)?.delete(source);
      }

      this.includes.delete(source);
  }

  private removeUnitSources(unitUri: string): void {
      for (const sourceUri of this.sourcesByUnit.get(unitUri) ?? []) {
          const owners = this.unitsBySource.get(sourceUri);
          owners?.delete(unitUri);
          if (owners?.size === 0) this.unitsBySource.delete(sourceUri);
      }
      this.sourcesByUnit.delete(unitUri);
  }

  private getLegacyIncludedSources(uri: string): string[] {
      const sources = new Set<string>();
      const pending = [uri];
      const visited = new Set<string>();
      while (pending.length) {
          const current = pending.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          for (const child of this.includes.get(current) ?? []) {
              if (child !== uri) sources.add(child);
              pending.push(child);
          }
      }
      return [...sources];
  }

  setAnalysisResult(
    uri: string,
    version: number,
    result: AnalysisResult
  ): void {
      // A completed analysis replaces the previous include relationships.
      // Only executed (not inactive #ifdef) includes participate. The fallback
      // is for synthetic AST tests which still use addInclude().
      const sources = new Set<string>([
          uri,
          ...(result.includedSourceUris ?? this.getLegacyIncludedSources(uri))
      ]);
      const sourceVersions = new Map<string, number>();
      for (const sourceUri of sources) {
          const document = this.get(sourceUri);
          if (document) sourceVersions.set(sourceUri, document.version);
      }

      const previousSources = this.sourcesByUnit.get(uri);
      this.removeUnitSources(uri);
      // The chosen root may stop including a file after a #ifdef change.
      // Only then discard the previous explicit choice for that source.
      for (const sourceUri of previousSources ?? []) {
          if (!sources.has(sourceUri) && this.preferredUnitBySource.get(sourceUri) === uri) {
              this.preferredUnitBySource.delete(sourceUri);
              this.preferredOccurrenceBySource.delete(sourceUri);
          }
      }
      this.sourcesByUnit.set(uri, sources);
      for (const sourceUri of sources) {
          let units = this.unitsBySource.get(sourceUri);
          if (!units) {
              units = new Set<string>();
              this.unitsBySource.set(sourceUri, units);
          }
          units.add(uri);
      }
      this.analysisResults.set(uri, { version, result, sourceVersions });
  }

  /** Read-only dependency snapshot for LSP presentation refreshes. */
  getIncludedSourcesOfUnit(unitUri: string): string[] {
      return [...(this.sourcesByUnit.get(unitUri) ?? [])]
          .filter(sourceUri => sourceUri !== unitUri);
  }

  /** Open document versions are checked without filesystem I/O per request. */
  private isFresh(entry: {
      version: number;
      sourceVersions: ReadonlyMap<string, number>;
  }): boolean {
      for (const [sourceUri, recordedVersion] of entry.sourceVersions) {
          const open = this.documents.get(sourceUri);
          if (open && open.version !== recordedVersion) return false;
      }
      return true;
  }

  getAnalysisResult(uri: string, version: number): AnalysisResult | undefined {
      const entry = this.analysisResults.get(uri);
      if (!entry || entry.version !== version || !this.isFresh(entry)) return undefined;
      return entry.result;
  }

  clearAnalysisResult(uri: string): void {
      this.analysisResults.delete(uri);
  }

  /**
   * Available, current translation-unit contexts of an included source.
   * The dependency graph comes from actual preprocessor include expansion.
   * No root is chosen implicitly when there are multiple candidates.
   */
  getIncludeContextCandidates(uri: string, version: number): string[] {
      const candidates: string[] = [];
      for (const unitUri of this.unitsBySource.get(uri) ?? []) {
          if (unitUri === uri) continue;
          const entry = this.analysisResults.get(unitUri);
          if (!entry) continue;
          // Synthetic/legacy include edges may have no readable document and
          // therefore no recorded version. Preserve their previously supported
          // lookup behavior, but reject any known mismatching source version.
          const sourceVersion = entry.sourceVersions.get(uri);
          if (sourceVersion !== undefined && sourceVersion !== version) continue;
          if (this.getAnalysisResult(unitUri, entry.version)) candidates.push(unitUri);
      }
      return candidates.sort();
  }

  /** One option per actual #include execution, including repeated nested sites. */
  getIncludeContextOptions(uri: string, version: number): IncludeContextOption[] {
      const options: IncludeContextOption[] = [];
      for (const unitUri of this.getIncludeContextCandidates(uri, version)) {
          const result = this.analysisResults.get(unitUri)?.result;
          if (!result) continue;
          const occurrences = result.includeOccurrences.filter(item => item.sourceUri === uri);
          if (occurrences.length === 0) {
              // Synthetic analyses and legacy tests have no occurrence metadata.
              options.push({ unitUri });
          } else {
              for (const occurrence of occurrences) options.push({ unitUri, occurrence });
          }
      }
      return options.sort((a, b) => a.unitUri.localeCompare(b.unitUri)
          || (a.occurrence?.expandedSpan.start ?? 0) - (b.occurrence?.expandedSpan.start ?? 0));
  }

  /** Never choose one occurrence arbitrarily, even within a single parent. */
  getSelectedIncludeContextOption(uri: string, version: number): IncludeContextOption | undefined {
      // A source opened and successfully analyzed as a root owns its result.
      // Include occurrences from other roots must not constrain its offsets.
      if (this.getAnalysisResult(uri, version)) return undefined;
      const options = this.getIncludeContextOptions(uri, version);
      const preferred = this.preferredUnitBySource.get(uri);
      if (preferred) {
          const selectedOccurrence = this.preferredOccurrenceBySource.get(uri);
          if (selectedOccurrence !== undefined) {
              return options.find(option => option.unitUri === preferred
                  && option.occurrence?.id === selectedOccurrence);
          }
          const matching = options.filter(option => option.unitUri === preferred);
          return matching.length === 1 ? matching[0] : undefined;
      }
      // In-flight analyses must not let the first completed includer win.
      const owners = this.unitsBySource.get(uri);
      return owners?.size === 1 && options.length === 1 ? options[0] : undefined;
  }

  getSelectedIncludeContext(uri: string, version: number): string | undefined {
      return this.getSelectedIncludeContextOption(uri, version)?.unitUri;
  }

  /** Retain the existing unit-level API for exactly one occurrence in that unit. */
  selectIncludeContext(uri: string, version: number, unitUri: string): boolean {
      const matching = this.getIncludeContextOptions(uri, version)
          .filter(option => option.unitUri === unitUri);
      if (matching.length !== 1) return false;
      return this.selectIncludeContextOption(uri, version, unitUri, matching[0].occurrence?.id);
  }

  selectIncludeContextOption(
      uri: string, version: number, unitUri: string, occurrenceId?: string
  ): boolean {
      const matching = this.getIncludeContextOptions(uri, version)
          .filter(option => option.unitUri === unitUri
              && option.occurrence?.id === occurrenceId);
      if (matching.length !== 1) return false;
      this.preferredUnitBySource.set(uri, unitUri);
      if (occurrenceId === undefined) this.preferredOccurrenceBySource.delete(uri);
      else this.preferredOccurrenceBySource.set(uri, occurrenceId);
      return true;
  }

  /** Clearing an explicit choice returns a shared include to its ambiguous state. */
  clearIncludeContext(uri: string): void {
      this.preferredUnitBySource.delete(uri);
      this.preferredOccurrenceBySource.delete(uri);
  }

  /** True when an unscoped physical lookup could conflate two executions. */
  hasRepeatedSourceOccurrences(uri: string, version: number): boolean {
      const selected = this.getSelectedIncludeContextOption(uri, version);
      if (!selected?.occurrence) return false;
      const result = this.analysisResults.get(selected.unitUri)?.result;
      return (result?.includeOccurrences.filter(item => item.sourceUri === uri).length ?? 0) > 1;
  }

  /** A physical cursor scoped to the selected occurrence's expanded range. */
  getSourceLookupPosition(uri: string, version: number, offset: number): SourceOffset {
      const selected = this.getSelectedIncludeContextOption(uri, version);
      if (!selected?.occurrence) return { uri, offset };
      // A unique occurrence within its unit is already unambiguous. Leave
      // existing lexical/macro lookups unchanged in that common case.
      if (!this.hasRepeatedSourceOccurrences(uri, version)) return { uri, offset };
      return { uri, offset, occurrenceSpan: selected.occurrence.expandedSpan };
  }

  getAnalysisResultForSource(uri: string, version: number): AnalysisResult | undefined {
      const own = this.getAnalysisResult(uri, version);
      if (own) return own;
      const selected = this.getSelectedIncludeContextOption(uri, version);
      if (!selected) return undefined;
      const entry = this.analysisResults.get(selected.unitUri);
      return entry && this.getAnalysisResult(selected.unitUri, entry.version);
  }

  // BEGIN TEMP-NAV-DEBUG: read-only analysis version snapshot
  describeAnalysisForSource(uri: string, version: number): string {
    const own = this.analysisResults.get(uri);
    const parents = [...(this.unitsBySource.get(uri) ?? [])]
        .filter(unit => unit !== uri)
        .map(unit => `${unit}@${this.analysisResults.get(unit)?.version ?? 'none'}`);
    return `analysisRequested=${version} ownAnalysis=${own ? own.version : 'none'} parentAnalyses=[${parents.join(', ')}]`;
  }
  // END TEMP-NAV-DEBUG

  /** Kept for existing Find References clients. All navigation uses the same policy. */
  getAnalysisResultForReferences(uri: string, version: number): AnalysisResult | undefined {
    return this.getAnalysisResultForSource(uri, version);
  }

  stats(): { openDocuments: number; cachedIncludes: number } {
    return {
      openDocuments: this.documents.all().length,
      cachedIncludes: this.includeCache.size
    };
  }
}
