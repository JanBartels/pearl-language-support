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

// https://github.com/microsoft/vscode/wiki/Semantic-Highlighting-Overview/887dec50de3282c23983130f72e2f94a8e7e5368

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  WorkspaceFolder,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity,
  DiagnosticTag
} from 'vscode-languageserver/node';

import { fileURLToPath, pathToFileURL } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { DocumentRegistry } from './utility/documentRegistry';
import { filePathFromUri, uriFromFilePath } from './utility/uriUtils';
import { WorkspaceManager } from './utility/workspace';
import { PearlSettings, defaultSettings } from './settings/pearlSettings';
import { SettingsManager } from './settings/settingsManager';
import { Validator } from './validation/validator';
import { DiagnosticMapper } from './lsp/diagnosticMapper';
import { ConnectionLogger } from './utility/logging/connectionLogger';
import { SemanticTokenService } from './semanticTokens/semanticTokenService';
import { TokenLegend } from './semanticTokens/tokenLegend';
const connection = createConnection(ProposedFeatures.all);

const logger = new ConnectionLogger(connection);

const workspaceManager = new WorkspaceManager();
const settingsManager = new SettingsManager(connection);

const documents = new TextDocuments(TextDocument);
const documentRegistry = new DocumentRegistry(documents);

const validator = new Validator(
  workspaceManager,
  documentRegistry,
  logger
);

const tokenLegend = new TokenLegend();
const semanticTokenService = new SemanticTokenService(
  documentRegistry,
  logger,
  tokenLegend
);

connection.onInitialize((params: InitializeParams) => {
//  connection.console.log(`onInialize: ${JSON.stringify(params, null, 2)}`);

  workspaceManager.initialize(params);
  settingsManager.initialize(params);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },      
      completionProvider: { resolveProvider: true },
      hoverProvider: false,
      definitionProvider: false,
      foldingRangeProvider: false,
      semanticTokensProvider: {
        legend: tokenLegend.getLegend(),
        full: true,     // wir liefern das ganze Dokument
        range: false    // Range-Unterstützung erstmal nicht
      }
    }
  };
});

connection.onInitialized(() => {
  workspaceManager.registerWorkspaceFolderListener(connection);
  settingsManager.registerConfigurationListener();
});

// ------------------------------
// Semantische Tokens
// ------------------------------

connection.languages.semanticTokens.on(async (params) => {
  return semanticTokenService.handleFull(params);
});

// ------------------------------
// Events & Start
// ------------------------------

async function validateAndPublish(document: TextDocument): Promise<void> {
  try {
    const settings = await settingsManager.getDocumentSettings(document.uri);

    const analysis = await validator.analyze(document, settings);

    const diagnosticsByUri = DiagnosticMapper.mapAll(analysis.problems, documentRegistry);

    for (const [uri, diagnostics] of diagnosticsByUri) {
      connection.sendDiagnostics({
        uri,
        diagnostics
      });
    }

  } catch (err) {
    logger.error(`Validation error in ${document.uri}: ${String(err)}`);
  }
}

documents.onDidOpen((event) => {
  void validateAndPublish(event.document);
});

documents.onDidChangeContent((event) => {

  semanticTokenService.invalidate(
    event.document.uri
  );

  void validateAndPublish(event.document);
});

documents.onDidClose((event) => {
const uri = event.document.uri;

  logger.info(`onDidClose ${uri}`);

  semanticTokenService.clear(uri);
  settingsManager.clearDocument(uri);

  connection.sendDiagnostics({
    uri,
    diagnostics: []
  });
});

connection.onDidChangeWatchedFiles((event) => {
  for (const change of event.changes) {
    documentRegistry.invalidateUri(change.uri);
  }
});

// React to configuration changes
connection.onDidChangeConfiguration((event) => {
  settingsManager.handleConfigurationChange(event.settings);

  // Revalidate all open documents with the new settings
  validator.handleConfigurationChanged();
for (const document of documents.all()) {
    void validateAndPublish(document);
  }
});

documents.listen(connection);
connection.listen();

