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
  DiagnosticSeverity,
  DiagnosticTag,
  Hover,
  FoldingRange,
  MarkupKind
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
import { mapDiagnostics } from './lsp/diagnosticMapper';
import { mapLspLocation } from './lsp/lspLocationMapper';
import { createHover } from './lsp/createHover';
import { findReferences } from './lsp/findReferences';
import { findMacroReferences } from './lsp/findMacroReferences';
import { ConnectionLogger } from './utility/logging/connectionLogger';
import { SemanticTokenService } from './semanticTokens/semanticTokenService';
import { TokenLegend } from './semanticTokens/tokenLegend';
import { CompilerOptionLookup } from './lexer/compilerOptionLookup';
import { PreprocessorConditionalBlockLookup } from './preproc/preprocessorConditionalBlockLookup';
import { AnalysisResult } from './validation/analysisResult';
import { MacroDocumentationProvider } from './documentation/macroDocumentationProvider';
import { CompilerOptionDocumentationProvider } from './documentation/compilerOptionDocumentProvider';
import { PreprocessorConditionalBlockDocumentationProvider } from './documentation/preprocessorConditionalBlockDocumentationProvider';
import { AstLookupResultDocumentationProvider } from './documentation/astLookupResultDocumentationProvider';
import { lookupSymbolDefinition, lookupBoundSymbol } from './semantic/bindingIndex';
import { appendIncludeOriginDocumentation } from './documentation/includeOriginDocumentation';
import { lookupLocalSpecificationRelation } from './semantic/localSpecificationRelation';
import { FoldingRegionCollection } from './folding/foldingRegionCollection';
import { mapFoldingRegion } from './lsp/foldingMapper';
import { CommentFoldingCollector } from './lexer/commentFoldingCollector';
import { PreprocessorFoldingCollector } from './preproc/preprocessorFoldingCollector';
import { AstFoldingCollector } from './ast/astFoldingCollector';
import { SourceOffset } from './core/sourceOffset';
import { createSignatureHelp } from './lsp/createSignatureHelp';

const connection = createConnection(ProposedFeatures.all);

const logger = new ConnectionLogger(connection);

// BEGIN TEMP-NAV-DEBUG: central diagnostic switch and request IDs
// Navigation tracing is enabled for this diagnostic build. Set PEARL_NAV_DEBUG=0 to disable.
// All diagnostics go to the existing LSP output channel.
const navigationDebugEnabled = process.env.PEARL_NAV_DEBUG !== '0';
let navigationRequestId = 0;
function navigationTrace(id: number, message: string): void {
    if (navigationDebugEnabled) logger.debug(`[Navigation #${id}] ${message}`);
}


// END TEMP-NAV-DEBUG

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
//      completionProvider: { resolveProvider: true },
      hoverProvider: true,
      definitionProvider: true,
      declarationProvider: true,
      referencesProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
        retriggerCharacters: [',']
      },
      foldingRangeProvider: true,
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
// Hover
// ------------------------------

connection.onHover(params => {

  const document = documentRegistry.get(params.textDocument.uri);
    if (!document) {
        return undefined;
    }

    const analysisResult = documentRegistry.getAnalysisResultForSource(params.textDocument.uri, document.version);
    if (!analysisResult) {
      return undefined;
    }

    const position: SourceOffset = {
        uri: params.textDocument.uri,
        offset: document.offsetAt(params.position)
    };

    //
    // Compiler-Options
    //
    const option = CompilerOptionLookup.lookupAt(analysisResult.rootAnalysis.blockComments, position);
    if (option) {
        return createHover( CompilerOptionDocumentationProvider.getDocumentation(option) );
    }

    //
    // Preprocessor conditionals
    //
    const conditional =
        PreprocessorConditionalBlockLookup.lookup(
            analysisResult.rootAnalysis.preprocessorConditionalBlocks,
            position
        );
    if (conditional) {
        return createHover( PreprocessorConditionalBlockDocumentationProvider.getDocumentation(conditional) );
    }

    //
    // Macro hover
    //
    const macro = analysisResult.lookupMacro(position);
    if (macro) {
        const markdown = MacroDocumentationProvider.getDocumentation(macro);
        return createHover(appendIncludeOriginDocumentation(
            markdown,
            macro.definition.location,
            position.uri,
            analysisResult.rootAnalysis.source.uri
        ));
    }

    //
    // AST hover
    //
    const result = analysisResult.rootAnalysis.ast.lookupSourceValue(position);
    if (result) {

        const markdown = AstLookupResultDocumentationProvider.getDocumentation(
            result,
            analysisResult.rootAnalysis.semanticContext,
            analysisResult.rootAnalysis.callSignatures
        );
        if (markdown) {
            const symbol = analysisResult.rootAnalysis.semanticContext
                && lookupBoundSymbol(analysisResult.rootAnalysis.semanticContext.bindings, result.element);
            return createHover(appendIncludeOriginDocumentation(
                markdown,
                (symbol?.definition ?? symbol?.name)?.location,
                position.uri,
                analysisResult.rootAnalysis.source.uri
            ));
        }
    }
});

// ------------------------------
// Goto Definition
// ------------------------------

// BEGIN TEMP-NAV-DEBUG: instrumented Definition handler; restore original handler when removing
connection.onDefinition(params => {
    const id = ++navigationRequestId;
    const uri = params.textDocument.uri;
    navigationTrace(id, `Definition START uri=${uri} position=${params.position.line}:${params.position.character}`);
    const document = documentRegistry.get(uri);
    if (!document) {
        navigationTrace(id, 'END reason=document-missing');
        return undefined;
    }
    navigationTrace(id, `documentVersion=${document.version} ${documentRegistry.describeAnalysisForSource(uri, document.version)}`);
    const analysisResult = documentRegistry.getAnalysisResultForSource(uri, document.version);
    if (!analysisResult) {
        navigationTrace(id, 'END reason=analysis-unavailable');
        return undefined;
    }
    const position: SourceOffset = { uri, offset: document.offsetAt(params.position) };
    const macro = analysisResult.lookupMacro(position);
    if (macro?.definition.location) {
        const target = mapLspLocation(macro.definition.location, documentRegistry);
        navigationTrace(id, `END reason=macro target=${JSON.stringify(target)}`);
        return target;
    }
    const lookup = analysisResult.rootAnalysis.ast.lookupSourceValue(position);
    const semanticContext = analysisResult.rootAnalysis.semanticContext;
    navigationTrace(id, `lookup=${lookup ? JSON.stringify(lookup.element.value) : 'missing'} semanticContext=${!!semanticContext}`);
    if (!lookup || !semanticContext) {
        navigationTrace(id, `END reason=${!lookup ? 'lookup-missing' : 'semantic-context-missing'}`);
        return undefined;
    }
    const bound = lookupBoundSymbol(semanticContext.bindings, lookup.element);
    navigationTrace(id, `boundSymbol=${bound ? String(bound.name.value) : 'missing'}`);
    const relation = lookupLocalSpecificationRelation(
        semanticContext.localSpecificationRelations, lookup.element
    );
    const definition = relation?.definition
        ?? lookupSymbolDefinition(semanticContext.bindings, lookup.element);
    if (!definition?.location) {
        navigationTrace(id, 'END reason=definition-missing');
        return undefined;
    }
    const target = mapLspLocation(definition.location, documentRegistry);
    navigationTrace(id, `END reason=resolved target=${JSON.stringify(target)}`);
    return target;
});

// ------------------------------
// END TEMP-NAV-DEBUG

// Goto Declaration (local SPC -> PROC/TASK relation)
// ------------------------------

connection.onDeclaration(params => {
    const document = documentRegistry.get(params.textDocument.uri);
    if (!document) {
        return undefined;
    }

    const analysisResult = documentRegistry.getAnalysisResultForSource(
        params.textDocument.uri,
        document.version
    );
    if (!analysisResult) {
        return undefined;
    }

    const position: SourceOffset = {
        uri: params.textDocument.uri,
        offset: document.offsetAt(params.position)
    };
    const lookup = analysisResult.rootAnalysis.ast.lookupSourceValue(position);
    const semanticContext = analysisResult.rootAnalysis.semanticContext;
    if (!lookup || !semanticContext) {
        return undefined;
    }

    const relation = lookupLocalSpecificationRelation(
        semanticContext.localSpecificationRelations,
        lookup.element
    );
    if (!relation?.specification.location) {
        return undefined;
    }

    return mapLspLocation(relation.specification.location, documentRegistry);
});

// ------------------------------
// Find References (one translation unit; no external linker lookup)
// ------------------------------

// BEGIN TEMP-NAV-DEBUG: instrumented References handler; restore original handler when removing
connection.onReferences(params => {
    const id = ++navigationRequestId;
    const uri = params.textDocument.uri;
    navigationTrace(id, `References START uri=${uri} position=${params.position.line}:${params.position.character} includeDeclaration=${params.context.includeDeclaration}`);
    const document = documentRegistry.get(uri);
    if (!document) {
        navigationTrace(id, 'END count=0 reason=document-missing');
        return [];
    }
    navigationTrace(id, `documentVersion=${document.version} ${documentRegistry.describeAnalysisForSource(uri, document.version)}`);
    const analysisResult = documentRegistry.getAnalysisResultForSource(uri, document.version);
    if (!analysisResult) {
        navigationTrace(id, 'END count=0 reason=analysis-unavailable');
        return [];
    }
    const macros = findMacroReferences(
        analysisResult.rootAnalysis.macroOccurrences,
        uri, params.position, params.context.includeDeclaration, documentRegistry
    );
    if (macros !== undefined) {
        navigationTrace(id, `END count=${macros.length} reason=macro`);
        return macros;
    }
    const refs = findReferences(
        analysisResult.rootAnalysis,
        uri, params.position, params.context.includeDeclaration,
        documentRegistry,
        message => navigationTrace(id, message)
    );
    navigationTrace(id, `END count=${refs.length} reason=semantic`);
    return refs;
});

// ------------------------------
// END TEMP-NAV-DEBUG

// Signature Help (compiler-side call position index)
// ------------------------------

connection.onSignatureHelp(params => {
    const document = documentRegistry.get(params.textDocument.uri);
    if (!document) return undefined;

    const analysisResult = documentRegistry.getAnalysisResultForSource(
        params.textDocument.uri, document.version
    );
    if (!analysisResult) return undefined;

    const position: SourceOffset = {
        uri: params.textDocument.uri,
        offset: document.offsetAt(params.position)
    };
    const context = analysisResult.rootAnalysis.callSignatureHelp?.lookup(position);
    return context ? createSignatureHelp(context) : undefined;
});

// ------------------------------
// Folding
// ------------------------------

connection.onFoldingRanges((params) => {
    const document =
        documentRegistry.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    const analysisResult =
        documentRegistry.getAnalysisResultForSource(params.textDocument.uri, document.version);
    if (!analysisResult) {
        return [];
    }

    const regions = new FoldingRegionCollection();

    //
    // Block comments
    //
    CommentFoldingCollector.collect(
        analysisResult.rootAnalysis.source,
        analysisResult.rootAnalysis.blockComments,
        regions
    );

    //
    // Präprozessor
    //
    PreprocessorFoldingCollector.collect(
        analysisResult.rootAnalysis.source,
        analysisResult.rootAnalysis.preprocessorConditionalBlocks,
        regions
    );

    //
    // AST
    //
    AstFoldingCollector.collect(
        analysisResult.rootAnalysis.source,
        analysisResult.rootAnalysis.ast,
        regions
    );

    //
    // Map to LSP
    //
    const result: FoldingRange[] = [];
    for (const region of regions) {
        const folding = mapFoldingRegion(document, region);

        if (folding) {
            result.push(folding);
        }
    }    

    return result;
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
    const snapshot = TextDocument.create(
      document.uri,
      document.languageId,
      document.version,
      document.getText()
    );

    const settings = await settingsManager.getDocumentSettings(snapshot.uri);

    const result = await validator.analyze(snapshot, settings);

    // Während der Analyse kann bereits eine neuere Dokumentversion
    // eingetroffen sein. In diesem Fall darf das veraltete Ergebnis
    // weder gespeichert noch als Diagnostics veröffentlicht werden.
    const currentDocument = documentRegistry.get(snapshot.uri);

    if (
        !currentDocument ||
        currentDocument.version !== snapshot.version
    ) {
        return;
    }

    // Analyse für spätere LSP-Features zwischenspeichern.
    documentRegistry.setAnalysisResult(snapshot.uri, snapshot.version, result);

    // aktuelle Diagnostics melden
    const oldUris = documentRegistry.takeReportedDiagnosticUris();
    const diagnosticsByUri = mapDiagnostics(result.problems, documentRegistry);
    for (const [uri, diagnostics] of diagnosticsByUri) {
        connection.sendDiagnostics({
            uri,
            diagnostics
        });

        // uri für gesendete Diagnostics merken
        documentRegistry.markDiagnosticsReported(uri);
        oldUris.delete(uri);
    }

    // leere Diagnostics müssen (!) gesendet werden
    for (const uri of oldUris) {
        connection.sendDiagnostics({
            uri,
            diagnostics: []
        });
    }    
  } catch (err) {
    if (err instanceof Error) {
        logger.error(`Validation error in ${document.uri}: ${err.message}`);
        logger.error(err.stack ?? '<no stack>');
    } else {
        logger.error(`Validation error in ${document.uri}: ${String(err)}`);
    }
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
  documentRegistry.clearAnalysisResult(uri);

  connection.sendDiagnostics({
    uri,
    diagnostics: []
  });
});

connection.onDidChangeWatchedFiles((event) => {
  for (const change of event.changes) {
    documentRegistry.invalidateUri(change.uri);
  }

  for (const document of documents.all()) {
    void validateAndPublish(document);
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
