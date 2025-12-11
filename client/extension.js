/*
 * Copyright (C) 2025 Jan Bartels
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

const path = require('path');
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(
    path.join('server', 'server.js')
  );

  const serverOptions = {
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

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pearl' }],
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

  client.start();
}

function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = {
  activate,
  deactivate
};
