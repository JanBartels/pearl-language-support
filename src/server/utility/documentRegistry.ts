// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from "path";
import { filePathFromUri, uriFromFilePath } from './uriUtils'
import { AnalysisResult } from '../validation/analysisResult';

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

      this.removeUnitSources(uri);
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

  /** No arbitrary choice among multiple contexts of a shared include. */
  getAnalysisResultForSource(uri: string, version: number): AnalysisResult | undefined {
      const own = this.getAnalysisResult(uri, version);
      if (own) return own;

      const candidates = new Set<AnalysisResult>();
      for (const unitUri of this.unitsBySource.get(uri) ?? []) {
          if (unitUri === uri) continue;
          const entry = this.analysisResults.get(unitUri);
          if (!entry) continue;
          const sourceVersion = entry.sourceVersions.get(uri);
          if (sourceVersion !== undefined && sourceVersion !== version) continue;
          const result = this.getAnalysisResult(unitUri, entry.version);
          if (result) candidates.add(result);
      }
      return candidates.size === 1 ? [...candidates][0] : undefined;
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
