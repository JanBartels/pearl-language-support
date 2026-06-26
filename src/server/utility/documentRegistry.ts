// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from "path";
import { filePathFromUri, uriFromFilePath } from './uriUtils'

export class DocumentRegistry {
  private documents: TextDocuments<TextDocument>;
  private includeCache: Map<
    string,
    { mtimeMs: number; doc: TextDocument }
  > = new Map();

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
    const fsPath = filePathFromUri(uri);
    this.includeCache.delete(fsPath);
  }

  invalidateAllIncludes(): void {
    this.includeCache.clear();
  }

  stats(): { openDocuments: number; cachedIncludes: number } {
    return {
      openDocuments: this.documents.all().length,
      cachedIncludes: this.includeCache.size
    };
  }
}
