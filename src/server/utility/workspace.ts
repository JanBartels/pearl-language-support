// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import {
  WorkspaceFolder,
  InitializeParams,
  WorkspaceFoldersChangeEvent,
  Connection
} from 'vscode-languageserver/node';

import { filePathFromUri } from './uriUtils';

export class WorkspaceManager {

  private workspaceFolders: WorkspaceFolder[] | null = null;
  private legacyRootUri: string | null = null;
  private hasWorkspaceFolderCapability = false;

  initialize(params: InitializeParams): void {
    const capabilities = params.capabilities;

    this.hasWorkspaceFolderCapability = !!(
        capabilities.workspace &&
        capabilities.workspace.workspaceFolders
    );

    this.workspaceFolders = params.workspaceFolders ?? null;

    if (!this.workspaceFolders || this.workspaceFolders.length === 0) {
        if (params.rootUri) {
        this.legacyRootUri = params.rootUri;
        } else if (params.rootPath) {
        this.legacyRootUri = params.rootPath;
        } else {
        this.legacyRootUri = null;
        }
    } else {
        this.legacyRootUri = null;
    }
  }

    registerWorkspaceFolderListener(connection: Connection, onChange?: () => void): void {
    if (!this.hasWorkspaceFolderCapability) return;

    connection.workspace.onDidChangeWorkspaceFolders(event => {
        this.updateWorkspaceFolders(event);
        onChange?.();
    });
    }

  updateWorkspaceFolders(event: WorkspaceFoldersChangeEvent): void {
    if (this.workspaceFolders === null) {
      this.workspaceFolders = [];
    }

    const removedUris = new Set(event.removed.map(f => f.uri));
    this.workspaceFolders = this.workspaceFolders.filter(
      f => !removedUris.has(f.uri)
    );

    this.workspaceFolders.push(...event.added);
  }

  getWorkspaceFolderForUri(docUri: string): WorkspaceFolder | undefined {
    if (!this.workspaceFolders || this.workspaceFolders.length === 0) {
      return undefined;
    }

    let best: WorkspaceFolder | undefined;
    let bestLen = -1;

    for (const folder of this.workspaceFolders) {
      let folderUri = folder.uri;
      if (!folderUri.endsWith('/')) {
        folderUri += '/';
      }

      if (docUri.startsWith(folderUri) && folderUri.length > bestLen) {
        best = folder;
        bestLen = folderUri.length;
      }
    }

    return best;
  }

  /** Filesystem folders supplied by the client; no implicit folder in Open File mode. */
  getWorkspaceRoots(): string[] {
    if (this.workspaceFolders?.length) {
      return this.workspaceFolders.map(folder => filePathFromUri(folder.uri));
    }
    return this.legacyRootUri ? [filePathFromUri(this.legacyRootUri)] : [];
  }

  getAnyWorkspaceRoot(): string | undefined {
    const [first] = this.workspaceFolders ?? [];

    if (first) {
        return filePathFromUri(first.uri);
    }

    if (this.legacyRootUri) {
        return filePathFromUri(this.legacyRootUri);
    }

    return undefined;
  }
}
