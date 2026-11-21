// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Position } from 'vscode-languageserver';
import type { SourceValue } from '../core/sourceValue';
import { mapToOriginalLocation } from '../core/sourceOffset';
import { findIncludeOccurrenceIdAt } from '../preproc/includeOccurrence';
import type { AnalysisResult } from '../validation/analysisResult';
import type { DocumentRegistry } from '../utility/documentRegistry';

/** Optional, side-effect-free metadata associated with a definition result. */
export interface DefinitionNavigationContext {
    readonly uri: string;
    readonly unitUri: string;
    readonly occurrenceId: string;
}

export interface DefinitionNavigationContextRequest {
    readonly textDocument: { readonly uri: string };
    readonly position: Position;
    readonly targetUri: string;
    readonly targetStart: Position;
}

/**
 * A definition may point to the same physical URI and offset in several
 * expansions. Only its lexical position identifies the actual execution.
 * Never infer a context from a filename extension, workspace membership,
 * or the first occurrence in an include chain.
 */
export function definitionNavigationContext(
    result: AnalysisResult,
    definition: SourceValue<string>,
    targetUri: string
): DefinitionNavigationContext | undefined {
    if (!definition.location) return undefined;
    const physical = mapToOriginalLocation(definition.location);
    if (physical.source.uri !== targetUri) return undefined;

    // A definition directly in the translation unit does not need a context.
    const unitUri = result.rootAnalysis.source.uri;
    if (targetUri === unitUri) return undefined;

    const candidates = result.includeOccurrences.filter(occurrence =>
        occurrence.sourceUri === targetUri
    );
    if (candidates.length === 0) return undefined;

    const lexical = definition.lexicalLocation;
    const occurrenceId = lexical && lexical.source !== physical.source
        ? findIncludeOccurrenceIdAt(candidates, targetUri, lexical.span)
        : candidates.length === 1 ? candidates[0]!.id : undefined;
    if (!occurrenceId) return undefined;

    return { uri: targetUri, unitUri, occurrenceId };
}

/** Require the actual LSP definition target to match the metadata request. */
export function matchesDefinitionTarget(
    definition: SourceValue<string>,
    request: DefinitionNavigationContextRequest,
    registry: DocumentRegistry
): boolean {
    if (!definition.location) return false;
    const physical = mapToOriginalLocation(definition.location);
    if (physical.source.uri !== request.targetUri) return false;
    const document = registry.get(request.targetUri);
    if (!document) return false;
    const start = document.positionAt(physical.span.start);
    return start.line === request.targetStart.line
        && start.character === request.targetStart.character;
}
