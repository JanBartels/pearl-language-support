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
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  DiagnosticTag,
  Hover,
  CodeLens,
  MarkupKind
} from 'vscode-languageserver/node';

import { fileURLToPath, pathToFileURL } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { DocumentRegistry } from './utility/documentRegistry';
import { filePathFromUri, uriFromFilePath } from './utility/uriUtils';
import { WorkspaceManager } from './utility/workspace';
import { FolderTranslationUnitIndex } from './utility/folderTranslationUnitIndex';
import { PearlSettings, defaultSettings } from './settings/pearlSettings';
import { SettingsManager } from './settings/settingsManager';
import { Validator } from './validation/validator';
import { mapDiagnostics } from './lsp/diagnosticMapper';
import { DiagnosticPublicationManager } from './lsp/diagnosticPublicationManager';
import { mapLspLocation } from './lsp/lspLocationMapper';
import { createHover } from './lsp/createHover';
import { findReferences } from './lsp/findReferences';
import { findMacroReferences } from './lsp/findMacroReferences';
import { identifierEndFallbackPosition } from './lsp/identifierEndFallback';
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
import { createFoldingRangesForDocument } from './lsp/createFoldingRangesForDocument';
import { FoldingRangeRefreshController } from './lsp/foldingRangeRefreshController';
import { CodeLensRefreshController } from './lsp/codeLensRefreshController';
import { AnalysisTrace } from './utility/logging/analysisTrace';
import { AnalysisScheduler, type AnalysisRequest, type AnalysisPriority } from './utility/analysisScheduler';
import type { AnalysisExecutor, AnalysisSourceSnapshot } from './utility/analysisExecutor';
import { AnalysisSnapshotCollector, StaleAnalysisSnapshotError } from './utility/analysisSnapshotCollector';
import { LocalAnalysisExecutor } from './utility/localAnalysisExecutor';
import { SourceOffset, mapToOriginalLocation, containsSourceOffset } from './core/sourceOffset';
import { createSignatureHelp } from './lsp/createSignatureHelp';
import { definitionNavigationContext, matchesDefinitionTarget } from './lsp/definitionNavigationContext';
import type { DefinitionNavigationContextRequest } from './lsp/definitionNavigationContext';

const connection = createConnection(ProposedFeatures.all);

const logger = new ConnectionLogger(connection);
const analysisTrace = new AnalysisTrace(logger);
let analysisTriggerNumber = 0;
const analysisPassByUri = new Map<string, number>();
/** The TextDocuments manager raises didChangeContent also for didOpen. */
const lastSeenOpenDocument = new Map<string, { version: number; text: string }>();

function nextAnalysisTrigger(reason: string, attributes: Record<string, unknown> = {}): string {
  const trigger = `${reason}:${++analysisTriggerNumber}`;
  analysisTrace.event('trigger', { trigger, ...attributes });
  return trigger;
}


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
const folderTranslationUnits = new FolderTranslationUnitIndex();
const settingsManager = new SettingsManager(connection);

const documents = new TextDocuments(TextDocument);
const documentRegistry = new DocumentRegistry(documents);
const analysisScheduler = new AnalysisScheduler(
  validateAndPublish,
  request => documentRegistry.isCurrentAnalysis(request.rootUri, request.requestId),
  (error, request) => {
    analysisTrace.event('analysis.schedulerError', {
      uri: request.rootUri, requestId: request.requestId, error: String(error)
    });
    logger.error(`Analysis scheduler failed for ${request.rootUri}: ${String(error)}`);
  }
);
/** Debounce only typing, never folder scans, configuration or disk watches. */
const interactiveEditDebounceMs = 200;

/** DocumentRegistry remains the single authority for request invalidation. */
function queueAnalysis(
  rootUri: string, trigger: string, priority: AnalysisPriority, debounceMs = 0
): void {
  const requestId = documentRegistry.beginAnalysis(rootUri);
  const state = analysisScheduler.enqueue({ rootUri, requestId, trigger, priority }, debounceMs);
  analysisTrace.event('analysis.queued', {
    trigger, uri: rootUri, requestId, priority: state.effectivePriority,
    debounceMs, replaced: state.replaced, pendingCount: state.pendingCount
  });
}

const diagnosticPublicationManager = new DiagnosticPublicationManager(
  (uri, diagnostics) => connection.sendDiagnostics({ uri, diagnostics })
);

/** Full snapshots let the client reconcile subscriptions after changed includes.
 * The revision also prevents a delayed initial snapshot from undoing an update. */
const includeWatchSession = randomUUID();
let includeWatchRevision = 0;
let lastIncludeSnapshotContent = '';
function includeWatchSnapshot(): {
  sessionId: string; revision: number; uris: string[]; includedUris: string[]
} {
  return {
    sessionId: includeWatchSession,
    revision: includeWatchRevision,
    uris: documentRegistry.getWatchedIncludeUris(),
    includedUris: documentRegistry.getKnownIncludedSourceUris()
  };
}
function publishIncludeWatchSnapshot(): void {
  const snapshot = includeWatchSnapshot();
  // The watch targets can stay identical when a missing include is restored.
  // Its semantic source membership nevertheless changes and must be published.
  const next = JSON.stringify([snapshot.uris, snapshot.includedUris]);
  if (next === lastIncludeSnapshotContent) return;
  lastIncludeSnapshotContent = next;
  includeWatchRevision++;
  logger.debug(`[IncludeWatch] targets revision=${includeWatchRevision} count=${snapshot.uris.length}`);
  void connection.sendNotification('pearl/includeWatchTargets', includeWatchSnapshot());
}
connection.onRequest('pearl/getIncludeWatchTargets', () => includeWatchSnapshot());

const validator = new Validator(
  workspaceManager,
  documentRegistry,
  logger
);
const analysisExecutor: AnalysisExecutor = new LocalAnalysisExecutor(
  (document, settings, includes) => validator.analyze(document, settings, includes)
);
const analysisSnapshotCollector = new AnalysisSnapshotCollector(documentRegistry, logger);

let clientSupportsSemanticTokenRefresh = false;
let clientSupportsDynamicFileWatches = false;

const codeLensRefresh = new CodeLensRefreshController(
  () => {
    analysisTrace.event('codeLens.refresh.send');
    const request = connection.sendRequest('workspace/codeLens/refresh');
    void request.then(
      () => analysisTrace.event('codeLens.refresh.ack'),
      (error: unknown) => analysisTrace.event('codeLens.refresh.rejected', { error: String(error) })
    );
    return request;
  },
  (error: unknown) => logger.warn(`Include context CodeLens refresh failed: ${String(error)}`)
);

const foldingRangeRefresh = new FoldingRangeRefreshController(
  () => connection.sendRequest('workspace/foldingRange/refresh'),
  (error: unknown) => logger.warn(`Folding-range refresh failed: ${String(error)}`)
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
  clientSupportsSemanticTokenRefresh =
    params.capabilities.workspace?.semanticTokens?.refreshSupport === true;
  const codeLensSupported = params.capabilities.workspace?.codeLens?.refreshSupport === true;
  codeLensRefresh.setSupported(codeLensSupported);
  analysisTrace.event('server.initialize', {
    codeLensRefreshSupported: codeLensSupported,
    workspaceFolders: params.workspaceFolders?.map(folder => folder.uri) ?? [],
    semanticTokenRefreshSupported: clientSupportsSemanticTokenRefresh
  });
  clientSupportsDynamicFileWatches =
    params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
  // This capability was introduced with LSP 3.18.
  const foldingWorkspaceCapability = params.capabilities.workspace as
    ({ foldingRange?: { refreshSupport?: boolean } } | undefined);
  const foldingRefreshSupported = foldingWorkspaceCapability?.foldingRange?.refreshSupport === true;
  foldingRangeRefresh.setSupported(foldingRefreshSupported);
  logger.debug(`[FoldingRefresh] client refreshSupport=${foldingRefreshSupported}`);

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
      codeLensProvider: { resolveProvider: false },
      executeCommandProvider: { commands: ['pearl.selectIncludeContext'] },
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
  analysisTrace.event('server.initialized');
  workspaceManager.registerWorkspaceFolderListener(
    connection, () => refreshFolderTranslationUnits('workspaceFoldersChanged')
  );
  settingsManager.registerConfigurationListener();
  refreshFolderTranslationUnits('initialized');

  // VS Code may not otherwise watch PEARL roots or headers. Register only
  // when the client advertises dynamic file-watching support.
  if (clientSupportsDynamicFileWatches) {
    void connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [
        { globPattern: '**/*.P' },
        { globPattern: '**/*.p' },
        { globPattern: '**/*.h' },
        { globPattern: '**/*.H' }
      ]
    }).catch((error: unknown) => {
      logger.warn(`Could not register PEARL file watchers: ${String(error)}`);
    });
  }
});

// ------------------------------
// Include context selection (LSP-only; no editor extension command needed)
// ------------------------------

/** Suppress identical diagnostic snapshots across repeated VS Code requests. */
const lastIncludeContextDiagnostic = new Map<string, string>();

/** Refresh the CodeLens display when the include graph or selection changes. */
function refreshIncludeCodeLenses(reason = 'unspecified'): void {
  analysisTrace.event('codeLens.refresh.schedule', { reason });
  codeLensRefresh.schedule();
}

/** Apply the already validated context through the same path as CodeLens. */
function activateIncludeContext(uri: string, unitUri: string, occurrenceId?: string): boolean {
  const document = documentRegistry.get(uri);
  if (!document || !documentRegistry.selectIncludeContextOption(
    uri, document.version, unitUri, occurrenceId
  )) return false;

  diagnosticPublicationManager.selectContext(uri, unitUri, occurrenceId);
  refreshIncludeCodeLenses();
  foldingRangeRefresh.schedule();
  if (clientSupportsSemanticTokenRefresh) {
    void connection.languages.semanticTokens.refresh().catch((error: unknown) => {
      logger.warn(`Semantic-token refresh failed: ${String(error)}`);
    });
  }
  return true;
}

/** A complete include path is required for nested duplicates with equal inner sites. */
function includeOptionLabel(option: { unitUri: string; occurrence?: {
  sites: readonly { includingUri: string; directiveOffset: number }[]
} }): string {
  const folder = workspaceManager.getWorkspaceFolderForUri(option.unitUri);
  const base = folder ? filePathFromUri(folder.uri) : undefined;
  const fileLabel = (uri: string) => base
    ? path.relative(base, filePathFromUri(uri))
    : filePathFromUri(uri);
  const sites = option.occurrence?.sites.map(site => {
    const doc = documentRegistry.get(site.includingUri);
    const line = doc ? doc.positionAt(site.directiveOffset).line + 1 : '?';
    return `${fileLabel(site.includingUri)}:${line}`;
  });
  return sites?.length ? sites.join(' → ') : fileLabel(option.unitUri);
}

connection.onCodeLens(params => {
  const uri = params.textDocument.uri;
  const document = documents.get(uri);
  if (!document) {
    analysisTrace.event('codeLens.request', { uri, result: 0, reason: 'notOpen' });
    return [];
  }

  const options = documentRegistry.getIncludeContextOptions(uri, document.version);
  const knownIncluded = documentRegistry.getKnownIncludedSourceUris().includes(uri);
  analysisTrace.event('codeLens.request', {
    uri, version: document.version, options: options.length,
    knownIncluded, result: options.length >= 2 ? 1 : 0
  });

  // Log the exclusion reason for EACH formerly included owner, including when
  // some (but not all) contexts are ready. A single valid include occurrence
  // correctly has no selection CodeLens; it is not a lost-context error.
  if (analysisTrace.enabled) {
    const availability = documentRegistry.describeIncludeContextAvailability(uri, document.version);
    const excluded = availability.owners.filter(owner => owner.status !== 'available');
    const relevant = knownIncluded || availability.watchedOwnerCount > 0;
    const countMismatch = availability.optionCount !== options.length;
    if (relevant && (countMismatch || excluded.length > 0 || availability.optionCount < 2)) {
      const reason = countMismatch ? 'optionCountMismatch'
        : excluded.length > 0 ? 'excludedOwners'
        : availability.optionCount === 1 ? 'singleContextNoLens' : 'noContexts';
      const snapshot = JSON.stringify({ reason, availability, returnedOptions: options.length });
      if (lastIncludeContextDiagnostic.get(uri) !== snapshot) {
        lastIncludeContextDiagnostic.set(uri, snapshot);
        analysisTrace.event('codeLens.contextAvailability', {
          reason, ...availability, returnedOptions: options.length
        });
      }
    } else if (lastIncludeContextDiagnostic.delete(uri)) {
      analysisTrace.event('codeLens.contextRecovered', {
        uri, version: document.version, options: options.length
      });
    }
  }
  if (options.length < 2) return [];

  const selected = documentRegistry.getSelectedIncludeContextOption(uri, document.version);
  const title = selected
    ? `PEARL: Include-Kontext ${includeOptionLabel(selected)} (wechseln)`
    : `PEARL: Include-Kontext auswählen (${options.length} Vorkommen)`;
  const lens: CodeLens = {
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    command: {
      title,
      command: 'pearl.selectIncludeContext',
      arguments: [uri]
    }
  };
  return [lens];
});

connection.onExecuteCommand(async params => {
  if (params.command !== 'pearl.selectIncludeContext') return;
  const uri = params.arguments?.[0];
  if (typeof uri !== 'string') return;
  const document = documents.get(uri);
  if (!document) return;
  const options = documentRegistry.getIncludeContextOptions(uri, document.version);
  if (options.length < 2) return;

  const choices = options.map((option, index) => ({
    option,
    // The index guarantees an unambiguous action even if labels coincide.
    title: `${index + 1}. ${includeOptionLabel(option)}`
  }));
  const answer = await connection.window.showInformationMessage(
    `PEARL: Einbindungskontext für ${path.basename(filePathFromUri(uri))} auswählen`,
    ...choices.map(choice => ({ title: choice.title }))
  );
  if (!answer) return;
  const selected = choices.find(choice => choice.title === answer.title)?.option;
  if (!selected || !activateIncludeContext(
    uri, selected.unitUri, selected.occurrence?.id
  )) {
    logger.warn(`Include context selection is no longer valid for ${uri}`);
    return;
  }
  logger.debug(`Include context ${uri} -> ${selected.unitUri} / ${selected.occurrence?.id ?? 'legacy'}`);
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

    const position = documentRegistry.getSourceLookupPosition(
        params.textDocument.uri, document.version, document.offsetAt(params.position)
    );

    // Some preprocessor metadata lacks execution provenance. Do not expose
    // an arbitrary interpretation for those features in a repeated include.
    const repeatedInclude = documentRegistry.hasRepeatedSourceOccurrences(
        position.uri, document.version
    );

    //
    // Compiler-Options
    //
    const option = repeatedInclude ? undefined : CompilerOptionLookup.lookupAt(analysisResult.rootAnalysis.blockComments, position);
    if (option) {
        return createHover( CompilerOptionDocumentationProvider.getDocumentation(option) );
    }

    //
    // Preprocessor conditionals
    //
    const conditional = PreprocessorConditionalBlockLookup.lookup(
        analysisResult.rootAnalysis.preprocessorConditionalBlocks,
        position,
        documentRegistry.getSelectedIncludeContextOption(
            params.textDocument.uri, document.version
        )?.occurrence?.id
    );
    if (conditional) {
        return createHover( PreprocessorConditionalBlockDocumentationProvider.getDocumentation(conditional) );
    }

    //
    // Macro hover
    //
    const macro = repeatedInclude ? undefined : analysisResult.lookupMacro(position);
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
    const position = documentRegistry.getSourceLookupPosition(uri, document.version, document.offsetAt(params.position));
    // BEGIN TEMP-MACRO-NAV-DIAG: inspect the macro index before the AST fallback.
    // Remove the entire marked section after investigating the Boundary regression.
    const macroIndex = analysisResult.rootAnalysis.macroOccurrences;
    const matchingGroups = macroIndex.all.flatMap(group => {
        const locations = [
            { kind: 'definition', location: group.definition.location },
            { kind: 'directive', location: group.definition.directiveLocation },
            ...group.references.map(ref => ({ kind: 'reference', location: ref.location }))
        ];
        return locations.filter(item => item.location && containsSourceOffset(item.location, position))
            .map(item => `${group.definition.name}:${item.kind}`);
    });
    const nearbyBoundary = macroIndex.all
        .filter(group => group.definition.name === 'Boundary')
        .map(group => ({
            definition: group.definition.location
                ? mapToOriginalLocation(group.definition.location) : undefined,
            references: group.references.map(ref => mapToOriginalLocation(ref.location))
        }));
    const formatMacroLocation = (loc: { source: { uri: string }, span: { start: number, end: number } } | undefined) =>
        loc ? `${loc.source.uri}@${loc.span.start}:${loc.span.end}` : 'missing';
    navigationTrace(id, `macroLookup cursor=${uri}@${position.offset} indexGroups=${macroIndex.all.length} matching=${JSON.stringify(matchingGroups)}`);
    navigationTrace(id, `macroBoundary=${JSON.stringify(nearbyBoundary.map(group => ({
        definition: formatMacroLocation(group.definition),
        references: group.references.map(formatMacroLocation)
    })) )}`);
    // END TEMP-MACRO-NAV-DIAG
    const fallbackCursor = identifierEndFallbackPosition(document, params.position);
    const fallbackPosition: SourceOffset | undefined = fallbackCursor
        ? documentRegistry.getSourceLookupPosition(uri, document.version, document.offsetAt(fallbackCursor))
        : undefined;
    const repeatedInclude = documentRegistry.hasRepeatedSourceOccurrences(uri, document.version);
    const macro = repeatedInclude ? undefined : (
        analysisResult.lookupMacro(position)
        ?? (fallbackPosition ? analysisResult.lookupMacro(fallbackPosition) : undefined)
    );
    // BEGIN TEMP-MACRO-NAV-DIAG: report HIT/MISS separately from AST lookup.
    navigationTrace(id, `macroLookup=${macro ? 'HIT' : 'MISS'} macroName=${macro?.definition.name ?? 'missing'} macroDefinitionLocation=${formatMacroLocation(macro?.definition.location)}`);
    // END TEMP-MACRO-NAV-DIAG
    if (macro?.definition.location) {
        const target = mapLspLocation(macro.definition.location, documentRegistry);
        navigationTrace(id, `END reason=macro target=${JSON.stringify(target)}`);
        return target;
    }
    const semanticContext = analysisResult.rootAnalysis.semanticContext;
    let lookup = analysisResult.rootAnalysis.ast.lookupSourceValue(position);
    let relation = lookup && semanticContext
        ? lookupLocalSpecificationRelation(semanticContext.localSpecificationRelations, lookup.element)
        : undefined;
    let definition = lookup && semanticContext
        ? relation?.definition ?? lookupSymbolDefinition(semanticContext.bindings, lookup.element)
        : undefined;

    // An editor selection can put the caret immediately after the identifier.
    // Retry only if the exact position has no resolvable definition. Keep the
    // AST and its half-open SourceValue locations unchanged.
    if (!definition?.location && fallbackPosition && semanticContext) {
        const leftLookup = analysisResult.rootAnalysis.ast.lookupSourceValue(fallbackPosition);
        if (leftLookup) {
            const leftRelation = lookupLocalSpecificationRelation(
                semanticContext.localSpecificationRelations, leftLookup.element
            );
            const leftDefinition = leftRelation?.definition
                ?? lookupSymbolDefinition(semanticContext.bindings, leftLookup.element);
            if (leftDefinition?.location) {
                lookup = leftLookup;
                definition = leftDefinition;
                // TEMP-NAV-DEBUG: caret-at-identifier-end fallback.
                navigationTrace(id, `identifierEndFallback=${fallbackCursor?.line}:${fallbackCursor?.character}`);
            }
        }
    }
    navigationTrace(id, `lookup=${lookup ? JSON.stringify(lookup.element.value) : 'missing'} semanticContext=${!!semanticContext}`);
    if (!lookup || !semanticContext) {
        navigationTrace(id, `END reason=${!lookup ? 'lookup-missing' : 'semantic-context-missing'}`);
        return undefined;
    }
    const bound = lookupBoundSymbol(semanticContext.bindings, lookup.element);
    navigationTrace(id, `boundSymbol=${bound ? String(bound.name.value) : 'missing'}`);
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

/**
 * The VS Code client asks for provenance after a normal definition request.
 * This request is read-only: Peek and other definition queries MUST NOT
 * change the stored context of a physical include document.
 */
connection.onRequest('pearl/resolveDefinitionContext', (request: DefinitionNavigationContextRequest) => {
  const source = documentRegistry.get(request.textDocument.uri);
  if (!source) return null;
  const result = documentRegistry.getAnalysisResultForSource(source.uri, source.version);
  const semantic = result?.rootAnalysis.semanticContext;
  if (!result || !semantic) return null;

  const position = documentRegistry.getSourceLookupPosition(
    source.uri, source.version, source.offsetAt(request.position)
  );
  const fallback = identifierEndFallbackPosition(source, request.position);
  const positions: SourceOffset[] = [position];
  if (fallback) positions.push(documentRegistry.getSourceLookupPosition(
    source.uri, source.version, source.offsetAt(fallback)
  ));
  for (const candidate of positions) {
    const lookup = result.rootAnalysis.ast.lookupSourceValue(candidate);
    if (!lookup) continue;
    const relation = lookupLocalSpecificationRelation(
      semantic.localSpecificationRelations, lookup.element
    );
    const definition = relation?.definition
      ?? lookupSymbolDefinition(semantic.bindings, lookup.element);
    if (!definition?.location || !matchesDefinitionTarget(definition, request, documentRegistry)) continue;
    return definitionNavigationContext(result, definition, request.targetUri) ?? null;
  }
  return null;
});

/** Only a real editor navigation may call this operation. */
connection.onRequest('pearl/activateNavigationContext', (selection: {
  uri: string; unitUri: string; occurrenceId: string
}) => {
  if (!selection || typeof selection.uri !== 'string'
      || typeof selection.unitUri !== 'string'
      || typeof selection.occurrenceId !== 'string') return false;
  return activateIncludeContext(selection.uri, selection.unitUri, selection.occurrenceId);
});

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

    const position = documentRegistry.getSourceLookupPosition(
        params.textDocument.uri, document.version, document.offsetAt(params.position)
    );
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
    const macros = documentRegistry.hasRepeatedSourceOccurrences(uri, document.version)
        ? undefined
        : findMacroReferences(
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
        message => navigationTrace(id, message),
        documentRegistry.getSelectedIncludeContextOption(uri, document.version)?.occurrence?.expandedSpan
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

    const position = documentRegistry.getSourceLookupPosition(
        params.textDocument.uri, document.version, document.offsetAt(params.position)
    );
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

    // Physical folding must be available even before the include context
    // has been selected or the parent translation unit has finished.
    const analysisResult =
        documentRegistry.getAnalysisResultForSource(params.textDocument.uri, document.version);

    const ranges = createFoldingRangesForDocument(
        document,
        analysisResult,
        documentRegistry.getSelectedIncludeContextOption(
            params.textDocument.uri, document.version
        )?.occurrence,
        logger
    );
    return ranges;
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

async function validateAndPublish(request: AnalysisRequest): Promise<void> {
  const { rootUri, requestId, trigger } = request;
  // Resolve the freshest editor/disk snapshot only when this job starts.
  const document = documentRegistry.get(rootUri);
  if (!document) {
    analysisTrace.event('analysis.skipped', { trigger, uri: rootUri, requestId, reason: 'sourceMissing' });
    return;
  }
  const pass = (analysisPassByUri.get(document.uri) ?? 0) + 1;
  analysisPassByUri.set(document.uri, pass);
  const startedAt = analysisTrace.now();
  try {
    const snapshot: AnalysisSourceSnapshot = {
      uri: document.uri,
      languageId: document.languageId,
      version: document.version,
      text: document.getText()
    };
    analysisTrace.event('analysis.begin', {
      trigger, uri: snapshot.uri, requestId, pass,
      version: snapshot.version, textLength: snapshot.text.length
    });
    const settings = await settingsManager.getDocumentSettings(snapshot.uri);
    if (!documentRegistry.isCurrentAnalysis(snapshot.uri, requestId)) {
      analysisTrace.event('analysis.discard', {
        trigger, uri: snapshot.uri, requestId, pass, stage: 'afterSettings',
        elapsedMs: Math.round(analysisTrace.now() - startedAt)
      });
      return;
    }

    const settingsWaitMs = Math.round(analysisTrace.now() - startedAt);
    const settingsSnapshot = { ...settings, macros: { ...settings.macros } };
    const captureStartedAt = analysisTrace.now();
    // The real preprocessor discovers all executed lookups before the executor
    // starts. A worker must never have to consult the live DocumentRegistry.
    const includeSnapshots = analysisSnapshotCollector.collect(snapshot, settingsSnapshot);
    const snapshotCaptureMs = Math.round(analysisTrace.now() - captureStartedAt);
    const changedBefore = analysisSnapshotCollector.changedSources(snapshot, includeSnapshots);
    analysisTrace.event('analysis.capture', {
      trigger, uri: snapshot.uri, requestId, pass,
      snapshotCaptureMs,
      capturedSources: includeSnapshots.sources.length,
      capturedResolutions: includeSnapshots.resolutions.length,
      changedSources: changedBefore
    });
    if (changedBefore.length > 0) {
      analysisTrace.event('analysis.discard', {
        trigger, uri: snapshot.uri, requestId, pass, stage: 'afterCapture',
        changedSources: changedBefore,
        elapsedMs: Math.round(analysisTrace.now() - startedAt)
      });
      retryStaleSnapshot(snapshot.uri, requestId, changedBefore);
      return;
    }

    analysisTrace.event('analysis.execute', {
      trigger, uri: snapshot.uri, requestId, pass,
      settingsWaitMs, snapshotCaptureMs
    });
    const analysisStartedAt = analysisTrace.now();
    // The current local executor invokes Validator.analyze synchronously
    // before returning its Promise. A future worker executor will instead
    // spend this time dispatching the job; publication rules stay here.
    const validation = analysisExecutor.execute({
      source: snapshot,
      settings: settingsSnapshot,
      includeSnapshots
    });
    const validatorSyncMs = Math.round(analysisTrace.now() - analysisStartedAt);
    const result = await validation;
    const analysisWallMs = Math.round(analysisTrace.now() - analysisStartedAt);
    const validatorAwaitMs = analysisWallMs - validatorSyncMs;

    // Version and request-id verification stay unchanged.
    const currentDocument = documentRegistry.get(snapshot.uri);
    const requestCurrent = documentRegistry.isCurrentAnalysis(snapshot.uri, requestId);
    if (!currentDocument || currentDocument.version !== snapshot.version || !requestCurrent) {
      analysisTrace.event('analysis.discard', {
        trigger, uri: snapshot.uri, requestId, pass, stage: 'afterAnalyze',
        snapshotVersion: snapshot.version,
        currentVersion: currentDocument?.version ?? null,
        requestCurrent, validatorSyncMs, validatorAwaitMs, analysisWallMs,
        elapsedMs: Math.round(analysisTrace.now() - startedAt)
      });
      return;
    }
    const changedAfter = analysisSnapshotCollector.changedSources(snapshot, includeSnapshots);
    if (changedAfter.length > 0) {
      analysisTrace.event('analysis.discard', {
        trigger, uri: snapshot.uri, requestId, pass, stage: 'afterSnapshotValidation',
        changedSources: changedAfter,
        snapshotCaptureMs, validatorSyncMs, validatorAwaitMs, analysisWallMs,
        elapsedMs: Math.round(analysisTrace.now() - startedAt)
      });
      retryStaleSnapshot(snapshot.uri, requestId, changedAfter);
      return;
    }

    const previousIncludes = documentRegistry.getIncludedSourcesOfUnit(snapshot.uri);
    documentRegistry.setAnalysisResult(snapshot.uri, snapshot.version, result);
    publishIncludeWatchSnapshot();
    analysisTrace.event('analysis.commit', {
      trigger, uri: snapshot.uri, requestId, pass, version: snapshot.version,
      snapshotCaptureMs, validatorSyncMs, validatorAwaitMs, analysisWallMs,
      elapsedMs: Math.round(analysisTrace.now() - startedAt),
      includesBefore: previousIncludes.length,
      includesAfter: result.includedSourceUris?.length ?? 0,
      occurrences: result.includeOccurrences.length,
      problems: result.problems.size()
    });

    if (clientSupportsSemanticTokenRefresh) {
      void connection.languages.semanticTokens.refresh().catch((error: unknown) => {
        logger.warn(`Semantic-token refresh failed: ${String(error)}`);
      });
    }

    const diagnosticsByUri = mapDiagnostics(result.problems, documentRegistry);
    diagnosticPublicationManager.publish(
        snapshot.uri,
        diagnosticsByUri,
        [...result.files.keys(), ...(result.includedSourceUris ?? [])],
        result.includeOccurrences
    );
    const changedOpenIncludes = [...new Set([...previousIncludes, ...(result.includedSourceUris ?? [])])]
      .filter(sourceUri => !!documents.get(sourceUri));
    analysisTrace.event('analysis.publish', {
      trigger, uri: snapshot.uri, pass,
      openIncludesForRefresh: changedOpenIncludes.length
    });
    if (changedOpenIncludes.length > 0) {
      refreshIncludeCodeLenses(`analysisCommit:${snapshot.uri}#${pass}`);
      foldingRangeRefresh.schedule();
    }
  } catch (err) {
    if (err instanceof StaleAnalysisSnapshotError) {
      analysisTrace.event('analysis.discard', {
        trigger, uri: document.uri, requestId, pass, stage: 'duringCapture',
        changedSources: err.changedUris,
        elapsedMs: Math.round(analysisTrace.now() - startedAt)
      });
      retryStaleSnapshot(document.uri, requestId, err.changedUris);
      return;
    }
    analysisTrace.event('analysis.error', {
      trigger, uri: document.uri, requestId, pass,
      elapsedMs: Math.round(analysisTrace.now() - startedAt), error: String(err)
    });
    if (err instanceof Error) {
        logger.error(`Validation error in ${document.uri}: ${err.message}`);
        logger.error(err.stack ?? '<no stack>');
    } else {
        logger.error(`Validation error in ${document.uri}: ${String(err)}`);
    }
  }
}

/**
 * A source changed while the closed-world input was being collected or used.
 * Let DocumentRegistry invalidate the affected owners, then schedule fresh
 * requests. Never publish a result based on an inconsistent input set.
 */
function retryStaleSnapshot(rootUri: string, requestId: number, changedUris: readonly string[]): void {
  if (!documentRegistry.isCurrentAnalysis(rootUri, requestId)) return;
  const affected = new Set<string>();
  for (const uri of changedUris) {
    for (const unitUri of documentRegistry.invalidateUri(uri)) affected.add(unitUri);
  }
  if (!affected.has(rootUri)) {
    for (const unitUri of documentRegistry.invalidateUri(rootUri)) affected.add(unitUri);
  }
  for (const unitUri of affected) {
    queueAnalysis(unitUri, 'snapshot:sourceChanged', 'interactive');
  }
}

/**
 * Discover complete .P translation units in the currently opened folders.
 * The preprocessor, not this folder index, establishes include dependencies.
 * A file already open as an independent document keeps that analysis when a
 * folder is removed; unopened roots are removed from the analysis registry.
 */
function refreshFolderTranslationUnits(reason: string): void {
  const trigger = nextAnalysisTrigger(`folder:${reason}`, {
    workspaceRoots: workspaceManager.getWorkspaceRoots()
  });
  const changes = folderTranslationUnits.refresh(workspaceManager.getWorkspaceRoots());
  analysisTrace.event('folder.reconcile', {
    trigger, added: changes.added.length, removed: changes.removed.length,
    addedUris: changes.added, removedUris: changes.removed,
    activeBefore: documentRegistry.getActiveTranslationUnits().length
  });
  for (const uri of changes.removed) {
    if (!documents.get(uri)) {
      analysisScheduler.cancel(uri);
      documentRegistry.closeTranslationUnit(uri);
      diagnosticPublicationManager.removeUnit(uri);
      publishIncludeWatchSnapshot();
    }
  }
  const activeRoots = new Set(documentRegistry.getActiveTranslationUnits());
  for (const uri of changes.added) {
    if (activeRoots.has(uri)) continue;
    if (documentRegistry.get(uri)) {
      queueAnalysis(uri, trigger, documents.get(uri) ? 'interactive' : 'background');
    }
  }
}

/**
 * Invalidate first, then reanalyze the affected roots using current document
 * snapshots. This also handles unsaved edits in an included source.
 *
 * In Open Folder mode, a newly opened header is not a translation unit.
 * When its including roots have already been discovered, their analyses
 * provide the header's language features instead.
 */
function revalidateChangedSource(
  uri: string, reason: string, fallback?: TextDocument
): void {
  const trigger = nextAnalysisTrigger(reason, {
    uri, version: fallback?.version ?? documents.get(uri)?.version ?? null,
    languageId: fallback?.languageId ?? documents.get(uri)?.languageId ?? null
  });
  const affectedRoots = documentRegistry.invalidateUri(uri);
  analysisTrace.event('source.invalidate', {
    trigger, uri, rootCount: affectedRoots.length, rootUris: affectedRoots
  });
  if (affectedRoots.length === 0 && fallback) {
    if (folderTranslationUnits.shouldAnalyzeAsRoot(uri)) {
      // Preserve the existing Open File workflow (no workspace folder).
      queueAnalysis(uri, trigger, 'interactive',
        reason === 'didChangeContent' ? interactiveEditDebounceMs : 0);
    } else {
      // An include without a known parent has no syntactic context yet.
      logger.debug(`No including translation unit available for ${uri}`);
    }
    return;
  }
  for (const rootUri of affectedRoots) {
    if (documentRegistry.get(rootUri)) {
      queueAnalysis(rootUri, trigger,
        reason === 'didOpen' || reason === 'didChangeContent' ? 'interactive'
          : documents.get(rootUri) ? 'interactive' : 'background',
        reason === 'didChangeContent' ? interactiveEditDebounceMs : 0);
    }
  }
}

/**
 * Distinguish a changed source buffer from simply opening it in VS Code.
 * The analyzed preprocessor snapshots (not disk mtimes) are authoritative.
 * A duplicate content event for the same document/version must not trigger
 * a second analysis request. A new version with identical text is adopted
 * only if the registry can prove all affected results are still valid.
 */
function handleOpenSourceDocument(document: TextDocument, reason: string): void {
  const previous = lastSeenOpenDocument.get(document.uri);
  const text = document.getText();
  lastSeenOpenDocument.set(document.uri, { version: document.version, text });

  if (previous?.version === document.version && previous.text === text) {
    analysisTrace.event('source.eventDuplicate', {
      reason, uri: document.uri, version: document.version
    });
    return;
  }

  const adoptedUnits = documentRegistry.tryAdoptSourceDocument(document);
  if (adoptedUnits > 0) {
    analysisTrace.event('source.versionAdopted', {
      reason, uri: document.uri, version: document.version,
      affectedUnits: adoptedUnits, textLength: text.length
    });
    // The source can now offer existing semantic contexts at its new editor
    // version; notify VS Code even if the include tab was restored late.
    refreshIncludeCodeLenses(`sourceVersionAdopted:${document.uri}`);
    foldingRangeRefresh.schedule();
    return;
  }

  analysisTrace.event('source.contentRequiresAnalysis', {
    reason, uri: document.uri, version: document.version,
    textChangedSinceLastEvent: previous === undefined || previous.text !== text
  });
  revalidateChangedSource(document.uri, reason, document);
}

documents.onDidOpen((event) => {
  handleOpenSourceDocument(event.document, 'didOpen');
});

documents.onDidChangeContent((event) => {
  handleOpenSourceDocument(event.document, 'didChangeContent');
});

documents.onDidClose((event) => {
  const uri = event.document.uri;
  lastSeenOpenDocument.delete(uri);
  lastIncludeContextDiagnostic.delete(uri);
  const trigger = nextAnalysisTrigger('didClose', {
    uri, version: event.document.version, languageId: event.document.languageId
  });
  logger.info(`onDidClose ${uri}`);
  settingsManager.clearDocument(uri);
  const affectedRoots = documentRegistry.invalidateUri(uri);
  analysisTrace.event('source.invalidate', {
    trigger, uri, rootCount: affectedRoots.length, rootUris: affectedRoots
  });
  // Discovered folder units remain active even without an editor tab.
  // Include files never own an analysis of their own in folder mode.
  if (!folderTranslationUnits.hasRoot(uri)) {
    analysisScheduler.cancel(uri);
    documentRegistry.closeTranslationUnit(uri);
    diagnosticPublicationManager.removeUnit(uri);
    publishIncludeWatchSnapshot();
  }
  // The included source now comes from disk, not the editor buffer.
  for (const rootUri of affectedRoots) {
    if (rootUri === uri && !folderTranslationUnits.hasRoot(uri)) continue;
    if (documentRegistry.get(rootUri)) {
      queueAnalysis(rootUri, trigger, documents.get(rootUri) ? 'interactive' : 'background');
    }
  }
});

connection.onDidChangeWatchedFiles((event) => {
  // React to additions/removals of .P files as well as include content changes.
  refreshFolderTranslationUnits('watchedFiles');
  const trigger = nextAnalysisTrigger('didChangeWatchedFiles', {
    changes: event.changes.map(change => ({ uri: change.uri, type: change.type }))
  });
  const roots = new Set<string>();
  for (const change of event.changes) {
    logger.debug(`[IncludeWatch] file event type=${change.type} uri=${change.uri}`);
    for (const uri of documentRegistry.invalidateUri(change.uri)) roots.add(uri);
  }
  analysisTrace.event('watch.invalidate', {
    trigger, rootCount: roots.size, rootUris: [...roots]
  });
  for (const rootUri of roots) {
    if (documentRegistry.get(rootUri)) {
      queueAnalysis(rootUri, trigger, documents.get(rootUri) ? 'interactive' : 'background');
    }
  }
});

connection.onDidChangeConfiguration((event) => {
  const trigger = nextAnalysisTrigger('didChangeConfiguration');
  settingsManager.handleConfigurationChange(event.settings);
  validator.handleConfigurationChanged();
  const roots = documentRegistry.invalidateAllAnalyses();
  analysisTrace.event('configuration.invalidateAll', {
    trigger, rootCount: roots.length, rootUris: roots
  });
  for (const rootUri of roots) {
    if (documentRegistry.get(rootUri)) {
      queueAnalysis(rootUri, trigger, documents.get(rootUri) ? 'interactive' : 'background');
    }
  }
});

connection.onShutdown(() => {
  analysisScheduler.dispose();
  codeLensRefresh.dispose();
  foldingRangeRefresh.dispose();
});

documents.listen(connection);
connection.listen();
