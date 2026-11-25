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
import { AnalysisWorkerConfigurationCoordinator } from './analysisWorkerConfigurationCoordinator';
import {
  IncludeContextRequestGate, includeContextQuickPickItems, presentIncludeContextStatus
} from './includeContextPresentation';
import type {
  IncludeContextUiState, SelectIncludeContextUiRequest
} from '../shared/includeContextUiProtocol';
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
let notifyIncludeContextStatusChange: (() => void) | undefined;

// Temporary, read-only Windows URI investigation (Dev_0_3, package 28).
// Kept separate from the Language Server output so a real project's token/AST
// dumps and hundreds of unrelated diagnostics do not drown out these events.
let includeUriTrace: vscode.OutputChannel | undefined;
let lastKnownIncludedUris: readonly string[] = [];
function traceIncludedUri(message: string): void {
  includeUriTrace?.appendLine(`[IncludeURI] ${message}`);
}

function traceOpenedSource(document: vscode.TextDocument, reason: string): void {
  if (document.uri.scheme !== 'file' || /\.[pP]$/.test(document.uri.path)) return;
  const openedUri = document.uri.toString();
  const openedBase = document.uri.path.split('/').pop()?.toLowerCase();
  const similar = lastKnownIncludedUris.filter(raw => {
    try {
      return vscode.Uri.parse(raw).path.split('/').pop()?.toLowerCase() === openedBase;
    } catch {
      return false;
    }
  });
  traceIncludedUri(`${reason} language=${document.languageId} exact=${knownIncludedSources.includes(openedUri)} candidatesByName=${similar.length} document=${openedUri}`);
  for (const raw of similar.slice(0, 5)) {
    const candidate = vscode.Uri.parse(raw);
    const samePathIgnoreCase = candidate.authority.toLowerCase() === document.uri.authority.toLowerCase()
      && candidate.path.toLowerCase() === document.uri.path.toLowerCase();
    traceIncludedUri(`  server=${raw} samePathIgnoreCase=${samePathIgnoreCase}`);
  }
  if (similar.length > 5) traceIncludedUri(`  ... ${similar.length - 5} further same-name entries omitted`);
}

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
  traceOpenedSource(document, 'open/reconcile');
  if (knownIncludedSources.includes(document.uri.toString())) {
    traceIncludedUri(`assign PEARL document=${document.uri.toString()}`);
    void ensurePearlDocumentLanguage(document);
  }
}

function acceptIncludeSnapshot(snapshot: IncludeWatchSnapshot, watchers: IncludeDependencyWatcher): void {
  watchers.update(snapshot);
  if (!knownIncludedSources.update(snapshot)) return;
  lastKnownIncludedUris = snapshot.includedUris ?? [];
  traceIncludedUri(`snapshot session=${snapshot.sessionId ?? '-'} revision=${snapshot.revision} watched=${snapshot.uris.length} included=${lastKnownIncludedUris.length}`);
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
      notifyIncludeContextStatusChange?.();
    }
  } catch (error) {
    console.warn('PEARL navigation context could not be activated:', error);
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  includeUriTrace = vscode.window.createOutputChannel('PEARL Include URI Trace');
  context.subscriptions.push(includeUriTrace);
  traceIncludedUri('client extension activated');

  // Two mutually exclusive surfaces: a clickable selector and a read-only
  // context indicator while there is no meaningful choice.
  const contextStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const passiveContextStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  contextStatus.name = 'PEARL Include-Kontext';
  contextStatus.command = 'pearl.pickIncludeContext';
  passiveContextStatus.name = 'PEARL Include-Kontext';
  context.subscriptions.push(contextStatus, passiveContextStatus);
  function hideIncludeContextStatus(): void {
    contextStatus.hide();
    passiveContextStatus.hide();
  }
  const contextRequests = new IncludeContextRequestGate();
  let statusRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  async function refreshIncludeContextStatus(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !client || editor.document.uri.scheme !== 'file'
        || editor.document.languageId !== 'pearl') {
      contextRequests.cancel();
      hideIncludeContextStatus();
      return;
    }
    const uri = editor.document.uri.toString();
    // Failed/stopped clients return null; the server remains the only source
    // of selected occurrences. Never retain a stale client-side selection.
    const state = await contextRequests.read(uri, requestedUri =>
      client!.sendRequest<IncludeContextUiState | null>(
        'pearl/getIncludeContextState', { uri: requestedUri }
      ).catch(() => null)
    );
    if (!state || vscode.window.activeTextEditor?.document.uri.toString() !== uri) return;
    const presentation = presentIncludeContextStatus(state);
    if (!presentation) {
      hideIncludeContextStatus();
      return;
    }
    const target = presentation.canChoose ? contextStatus : passiveContextStatus;
    const other = presentation.canChoose ? passiveContextStatus : contextStatus;
    other.hide();
    target.text = presentation.text;
    target.tooltip = presentation.tooltip;
    target.show();
  }

  function scheduleIncludeContextStatusRefresh(): void {
    if (statusRefreshTimer !== undefined) clearTimeout(statusRefreshTimer);
    statusRefreshTimer = setTimeout(() => {
      statusRefreshTimer = undefined;
      void refreshIncludeContextStatus();
    }, 40);
  }

  notifyIncludeContextStatusChange = scheduleIncludeContextStatusRefresh;
  context.subscriptions.push({ dispose: () => {
    notifyIncludeContextStatusChange = undefined;
    contextRequests.cancel();
    if (statusRefreshTimer !== undefined) clearTimeout(statusRefreshTimer);
  } });

  context.subscriptions.push(vscode.commands.registerCommand(
    'pearl.pickIncludeContext', async (requestedUri?: unknown) => {
      const editor = vscode.window.activeTextEditor;
      if (!client || !editor || editor.document.uri.scheme !== 'file') return;
      const uri = typeof requestedUri === 'string' ? requestedUri : editor.document.uri.toString();
      if (editor.document.uri.toString() !== uri) return;
      const state = await client.sendRequest<IncludeContextUiState | null>(
        'pearl/getIncludeContextState', { uri }
      ).catch(() => null);
      if (!state || state.uri !== uri || state.options.length < 2) return;

      const items = includeContextQuickPickItems(state);
      const picked = await vscode.window.showQuickPick(items, {
        title: 'PEARL: Include-Kontext auswählen',
        placeHolder: `${state.options.length} Einbindungsvorkommen – nach Übersetzungseinheit oder Include-Stelle filtern`,
        matchOnDescription: true
      });
      if (!picked || !client) return;
      // A picker may remain open during edits or a change of editor tab.
      if (vscode.window.activeTextEditor?.document.uri.toString() !== uri
          || vscode.window.activeTextEditor.document.version !== state.version) {
        scheduleIncludeContextStatusRefresh();
        return;
      }
      const option = state.options[picked.optionIndex];
      if (!option) return;
      const request: SelectIncludeContextUiRequest = {
        uri, version: state.version, unitUri: option.unitUri,
        occurrenceId: option.occurrenceId
      };
      const accepted = await client.sendRequest<boolean>(
        'pearl/activateIncludeContext', request
      ).catch(() => false);
      if (!accepted) {
        void vscode.window.showInformationMessage(
          'Der gewählte PEARL-Include-Kontext ist nicht mehr gültig. Bitte erneut auswählen.'
        );
      }
      scheduleIncludeContextStatusRefresh();
    }
  ));
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

  const configuredWorkerCount = (): number => vscode.workspace
    .getConfiguration('pearl').get<number>('analysis.workerCount', 0);
  const workerConfiguration = new AnalysisWorkerConfigurationCoordinator(
    configuredWorkerCount,
    async () => {
      if (!client) return;
      contextRequests.cancel();
      hideIncludeContextStatus();
      try {
        await client.restart();
        const snapshot = await client.sendRequest<IncludeWatchSnapshot>(
          'pearl/getIncludeWatchTargets'
        );
        acceptIncludeSnapshot(snapshot, dependencyWatchers);
        scheduleIncludeContextStatusRefresh();
      } catch (error) {
        // Keep restart failures separate from configuration-delivery errors.
        // The language client otherwise labels any middleware rejection as a
        // failed workspace/didChangeConfiguration notification.
        console.warn('PEARL analysis worker setting could not restart the language server:', error);
      }
    }
  );

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pearl' }],
    middleware: {
      workspace: {
        // The language client owns workspace/didChangeConfiguration. Its
        // sendNotification must finish before restarting the server; calling
        // restart from a competing VS Code configuration listener races it.
        didChangeConfiguration: (
          sections: string[] | undefined,
          next: (sections: string[] | undefined) => Promise<void>
        ) => workerConfiguration.forwardConfiguration(sections, next)
      },
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
    // Re-evaluate for every LSP (re)initialization, including after a settings
    // change. The server builds its executor and scheduler with one capacity.
    initializationOptions: () => {
      const workerCount = configuredWorkerCount();
      workerConfiguration.noteInitialization(workerCount);
      return { analysis: { workerCount } };
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
    if (document.uri.toString() === vscode.window.activeTextEditor?.document.uri.toString()) {
      scheduleIncludeContextStatusRefresh();
    }
  }));

  // Register before starting the client. The snapshot request below covers
  // any initial compilation that completed before this handler was ready.
  context.subscriptions.push(client.onNotification(
    'pearl/includeWatchTargets', (snapshot: IncludeWatchSnapshot) => {
      acceptIncludeSnapshot(snapshot, dependencyWatchers);
      scheduleIncludeContextStatusRefresh();
    }
  ));
  context.subscriptions.push(client.onNotification(
    'pearl/includeContextsChanged', () => scheduleIncludeContextStatusRefresh()
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
  scheduleIncludeContextStatusRefresh();
  // Worker-capacity changes are handled by the LanguageClient configuration
  // middleware above, after delivery to the current server.
  context.subscriptions.push(client);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      contextRequests.cancel();
      hideIncludeContextStatus();
      if (editor) void activateTarget(editor);
      scheduleIncludeContextStatusRefresh();
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.toString() === vscode.window.activeTextEditor?.document.uri.toString()) {
        scheduleIncludeContextStatusRefresh();
      }
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
