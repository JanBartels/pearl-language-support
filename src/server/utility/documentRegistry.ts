// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from "path";
import { filePathFromUri, uriFromFilePath } from './uriUtils'

export class DocumentRegistry {
  private documents: TextDocuments<TextDocument>;
  // Filecaching anhand vom Timestamp auf der Platte
  private includeCache: Map<
    string,
    { mtimeMs: number; doc: TextDocument }
  > = new Map();
  // Liste, für welche Dokumente Diagnosen gesendet worden sind
  // Wenn keine Diagnose mehr ansteht, muss diese aktiv gelöscht werden
  private reportedDiagnosticUris = new Set<string>();
  // Include-Graph für Re-Validierung bei Änderungen an untergeordneten #includes
  private readonly includes = new Map<string, Set<string>>();
  private readonly includedBy = new Map<string, Set<string>>();

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

  invalidateUri(uri: string): void {

    const visited = new Set<string>();
    this.invalidateRecursive(uri, visited);
  }

  private invalidateRecursive(
      uri: string,
      visited: Set<string>
  ): void {

      if (visited.has(uri)) {
          return;
      }

      visited.add(uri);

      const fsPath = filePathFromUri(uri);
      this.includeCache.delete(fsPath);

      for (const parent of this.includedBy.get(uri) ?? []) {
          this.invalidateRecursive(parent, visited);
      }
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

  takeReportedDiagnosticUris(): Set<string> {

      const result = new Set(this.reportedDiagnosticUris);
      this.reportedDiagnosticUris.clear();

      return result;
  }

  markDiagnosticsReported(uri: string): void {
      this.reportedDiagnosticUris.add(uri);
  }

  stats(): { openDocuments: number; cachedIncludes: number } {
    return {
      openDocuments: this.documents.all().length,
      cachedIncludes: this.includeCache.size
    };
  }
}
