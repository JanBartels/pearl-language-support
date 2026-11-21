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
import {
  LanguageClient,
  TransportKind,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
const pendingDefinition = new PendingNavigationIntent();

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
    if (accepted && editor.document.languageId !== 'pearl') {
      // Includes can have any extension and lie outside the workspace. Only a
      // proven #include navigation may change their language, never a blanket
      // *.h association. setTextDocumentLanguage produces new document events.
      await vscode.languages.setTextDocumentLanguage(editor.document, 'pearl');
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

  await client.start();
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
