// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/*
 * Copyright (C) 2025, 2026 Jan Bartels
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { PendingNavigationIntent, type NavigationIntent } from './navigationIntent';
import { IncludeDependencyWatcher, type IncludeWatchSnapshot } from './includeDependencyWatcher';
import { KnownIncludedSources } from './knownIncludedSources';
import {
  LanguageClient,
  TransportKind,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
const pendingDefinition = new PendingNavigationIntent();
const knownIncludedSources = new KnownIncludedSources();
const languageUpdates = new Set<string>();

/** Shared by direct include opening and proven Go to Definition navigation. */
async function ensurePearlDocumentLanguage(document: vscode.TextDocument): Promise<void> {
  const uri = document.uri.toString();
  if (document.uri.scheme !== 'file' || document.languageId === 'pearl'
      || languageUpdates.has(uri)) return;
  languageUpdates.add(uri);
  try {
    // This sends didClose/didOpen through the LanguageClient. The server will
    // re-use the owning translation unit, not parse the include as a root.
    await vscode.languages.setTextDocumentLanguage(document, 'pearl');
  } catch (error) {
    console.warn('PEARL include language could not be assigned:', error);
  } finally {
    languageUpdates.delete(uri);
  }
}

/** VS Code does not infer PEARL for an included .def/.inc/.h file. */
function assignKnownIncludeLanguage(document: vscode.TextDocument): void {
  if (knownIncludedSources.includes(document.uri.toString())) {
    void ensurePearlDocumentLanguage(document);
  }
}

function acceptIncludeSnapshot(snapshot: IncludeWatchSnapshot, watchers: IncludeDependencyWatcher): void {
  watchers.update(snapshot);
  if (!knownIncludedSources.update(snapshot)) return;
  // Also cover documents opened while the initial folder analysis was running
  // or before the LanguageClient finished starting.
  for (const document of vscode.workspace.textDocuments) {
    void assignKnownIncludeLanguage(document);
  }
}

interface DefinitionContextReply {
  readonly uri: string;
  readonly unitUri: string;
  readonly occurrenceId: string;
}

function singleDefinitionTarget(result: vscode.Definition | vscode.DefinitionLink[] | null | undefined): {
  uri: vscode.Uri;
  range: vscode.Range;
} | undefined {
  if (!result) return undefined;
  const item = Array.isArray(result) ? (result.length === 1 ? result[0] : undefined) : result;
  if (!item) return undefined;
  if ('targetUri' in item) return { uri: item.targetUri, range: item.targetSelectionRange };
  return { uri: item.uri, range: item.range };
}

async function activateTarget(editor: vscode.TextEditor): Promise<void> {
  // Only activate a normal editor column, never a view without an editor column.
  if (editor.viewColumn === undefined) return;
  const caret = editor.selection.active;
  const intent = pendingDefinition.take(
    editor.document.uri.toString(), caret.line, caret.character
  );
  if (!intent || !client) return;

  try {
    const accepted = await client.sendRequest<boolean>('pearl/activateNavigationContext', {
      uri: intent.uri, unitUri: intent.unitUri, occurrenceId: intent.occurrenceId
    });
    if (accepted) {
      // Navigation may precede the next include snapshot; share the language
      // transition guard with the direct-open path.
      await ensurePearlDocumentLanguage(editor.document);
    }
  } catch (error) {
    console.warn('PEARL navigation context could not be activated:', error);
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pearl' }],
    middleware: {
      // Both Go to Definition and Peek call this provider. Collect provenance
      // here, but do not mutate the server's selected context until an actual
      // editor change confirms the navigation.
      async provideDefinition(document, position, token, next) {
        const definition = await next(document, position, token);
        if (token.isCancellationRequested || !client) return definition;
        const target = singleDefinitionTarget(definition);
        if (!target || target.uri.scheme !== 'file') return definition;
        try {
          const reply = await client.sendRequest<DefinitionContextReply | null>(
            'pearl/resolveDefinitionContext', {
              textDocument: { uri: document.uri.toString() },
              position: { line: position.line, character: position.character },
              targetUri: target.uri.toString(),
              targetStart: {
                line: target.range.start.line,
                character: target.range.start.character
              }
            }, token
          );
          if (reply && reply.uri === target.uri.toString()
            && !token.isCancellationRequested) {
            const intent: NavigationIntent = {
              ...reply,
              start: {
                line: target.range.start.line,
                character: target.range.start.character
              },
              end: {
                line: target.range.end.line,
                character: target.range.end.character
              }
            };
            pendingDefinition.remember(intent);
          }
        } catch (error) {
          console.warn('PEARL definition provenance unavailable:', error);
        }
        return definition;
      }
    },
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{p,P}')
    },
    outputChannelName: 'PEARL LSP Debug'
  };

  client = new LanguageClient(
    'pearlLanguageServer',
    'PEARL Language Server',
    serverOptions,
    clientOptions
  );

  // The server reports attempted include paths, including files temporarily
  // missing on disk. Watch only their parent directories, not
  // the user's whole library tree. The glob '*' is nonrecursive.
  const dependencyWatchers = new IncludeDependencyWatcher((directory, onChange) => {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(directory), '*')
    );
    const events = [
      watcher.onDidCreate(uri => onChange(uri.toString(), 1)),
      watcher.onDidChange(uri => onChange(uri.toString(), 2)),
      watcher.onDidDelete(uri => onChange(uri.toString(), 3))
    ];
    return { dispose() {
      events.forEach(event => event.dispose());
      watcher.dispose();
    } };
  }, (uri, type) => {
    // Open PEARL documents already generate textDocument/didChange. Avoid
    // a second invalidation for their on-disk save notifications.
    const openPearl = vscode.workspace.textDocuments.some(document =>
      document.uri.toString() === uri && document.languageId === 'pearl'
    );
    if (!openPearl && client) {
      void client.sendNotification('workspace/didChangeWatchedFiles', {
        changes: [{ uri, type }]
      }).catch(error => console.warn('PEARL include file event was not delivered:', error));
    }
  }, uri => {
    const documentUri = vscode.Uri.parse(uri);
    if (documentUri.scheme !== 'file') return false;
    // Existing workspace globs already cover .p/.P and .h/.H. Outside the
    // workspace, and for other suffixes inside it, we need exact watchers.
    return !vscode.workspace.getWorkspaceFolder(documentUri)
      || !/\.(p|h)$/i.test(documentUri.path);
  });
  context.subscriptions.push({ dispose: () => dependencyWatchers.dispose() });

  // A directly opened known include may have no registered PEARL file suffix.
  // The Open-Folder snapshot also reconciles documents opened before startup.
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
    void assignKnownIncludeLanguage(document);
  }));

  // Register before starting the client. The snapshot request below covers
  // any initial compilation that completed before this handler was ready.
  context.subscriptions.push(client.onNotification(
    'pearl/includeWatchTargets', (snapshot: IncludeWatchSnapshot) => {
      acceptIncludeSnapshot(snapshot, dependencyWatchers);
    }
  ));

  await client.start();
  try {
    const snapshot = await client.sendRequest<IncludeWatchSnapshot>(
      'pearl/getIncludeWatchTargets'
    );
    acceptIncludeSnapshot(snapshot, dependencyWatchers);
  } catch (error) {
    console.warn('PEARL include watchers could not be initialized:', error);
  }
  context.subscriptions.push(client);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) void activateTarget(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        void activateTarget(event.textEditor);
      }
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
