// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Range, Position } from 'vscode-languageserver/node';
import type { Location } from '../core/location';
import { mapToOriginalLocation } from '../core/sourceOffset';
import type { SemanticSymbol } from '../semantic/symbol';
import { SymbolKind } from '../semantic/symbolKind';
import { SemanticTypeKind, type SemanticType } from '../semantic/semanticType';
import { SemanticDiagnosticCode } from '../semantic/semanticDiagnostic';
import { UNUSED_MACRO_DIAGNOSTIC_CODE } from '../preproc/unusedMacroAnalyzer';
import type { AnalysisResult } from '../validation/analysisResult';

/** Presentation-only evidence from one *committed* translation unit. */
export interface CrossUnitUnusedFact {
    /** Identifies the *same* physical declaration in different executions. */
    readonly identity: string;
    /** Used to match an actual Unused warning in this execution. */
    readonly diagnosticSite: string;
    readonly sourceUri: string;
    readonly used: boolean;
}

/** Physical positions use LSP coordinates, independent of expanded-text offsets. */
export function unusedDiagnosticSite(uri: string, code: string, range: Range): string {
    return JSON.stringify([uri, code, range.start.line, range.start.character,
        range.end.line, range.end.character]);
}

/**
 * Conservative signature: two declarations at the same original token with
 * different resolved types must NOT be treated as the same declaration. Avoid
 * object identities (which differ between workers) and cyclic semantic graphs.
 */
function typeSignature(type: SemanticType | undefined, seen: Set<object> = new Set()): unknown {
    if (!type) return null;
    if (seen.has(type)) return ['cycle'];
    seen.add(type);
    let signature: unknown;
    switch (type.kind) {
        case SemanticTypeKind.Fixed:
        case SemanticTypeKind.Float:
            signature = [type.kind, type.precision]; break;
        case SemanticTypeKind.Bit:
        case SemanticTypeKind.Character:
            signature = [type.kind, type.length]; break;
        case SemanticTypeKind.Dation:
            signature = [type.kind, type.direction, type.dationClass]; break;
        case SemanticTypeKind.Reference:
            signature = [type.kind, type.targetInvariant, typeSignature(type.target, seen)]; break;
        case SemanticTypeKind.VoidReference:
            signature = [type.kind, type.targetInvariant]; break;
        case SemanticTypeKind.Array:
            signature = [type.kind, type.dimensions.map(d => [d.lowerBound.toString(), d.upperBound.toString()]),
                typeSignature(type.elementType, seen)]; break;
        case SemanticTypeKind.VirtualArray:
            signature = [type.kind, type.rank, typeSignature(type.elementType, seen)]; break;
        case SemanticTypeKind.Struct:
            signature = [type.kind, type.components.map(c => [c.name.value, typeSignature(c.type, seen)])]; break;
        case SemanticTypeKind.Named: {
            const location = type.symbol.name.location;
            const original = location ? mapToOriginalLocation(location) : undefined;
            signature = [type.kind, type.symbol.name.value, original?.source.uri,
                original?.span.start, original?.span.end];
            break;
        }
        case SemanticTypeKind.Procedure:
            signature = [type.kind, type.callingConvention, type.hasResult,
                typeSignature(type.resultType, seen), type.parameters.map(p => [
                    p.byIdentification, p.assignmentProtected, typeSignature(p.type, seen)])]; break;
        default:
            signature = [type.kind];
    }
    seen.delete(type);
    return signature;
}

function symbolSignature(symbol: SemanticSymbol): string {
    switch (symbol.kind) {
        case SymbolKind.DataObject:
            return JSON.stringify([symbol.kind, symbol.assignmentProtected,
                typeSignature(symbol.type)]);
        case SymbolKind.Parameter:
        case SymbolKind.Identification:
            return JSON.stringify([symbol.kind, symbol.assignmentProtected,
                symbol.byIdentification, typeSignature(symbol.type)]);
        case SymbolKind.Procedure:
            return JSON.stringify([symbol.kind, typeSignature(symbol.signature),
                typeSignature(symbol.resultType)]);
        default:
            return JSON.stringify([symbol.kind]);
    }
}

/**
 * Collect only physical declarations from included files. Macro-generated
 * declaration *names* are deliberately excluded: one expansion position is
 * not sufficient proof that two runtime definitions have the same meaning.
 */
export function collectCrossUnitUnusedFacts(
    result: AnalysisResult,
    documents: { get(uri: string): { positionAt(offset: number): Position } | null | undefined }
): readonly CrossUnitUnusedFact[] {
    const rootUri = result.rootAnalysis.source.uri;
    const included = new Set(result.includedSourceUris ?? []);
    const facts = new Map<string, CrossUnitUnusedFact>();

    const add = (location: Location | undefined, name: string, code: string,
        signature: string, used: boolean): void => {
        if (!location) return;
        const physical = mapToOriginalLocation(location);
        const uri = physical.source.uri;
        if (uri === rootUri || !included.has(uri)) return;
        // In particular, do not equate different macro-expanded identifiers.
        if (physical.source.getText(physical.span) !== name) return;
        const document = documents.get(uri);
        if (!document) return;
        const range: Range = {
            start: document.positionAt(physical.span.start),
            end: document.positionAt(physical.span.end)
        };
        const site = unusedDiagnosticSite(uri, code, range);
        const identity = JSON.stringify([site, name, signature]);
        const previous = facts.get(identity);
        facts.set(identity, { sourceUri: uri, diagnosticSite: site, identity,
            used: used || previous?.used === true });
    };

    for (const usage of result.rootAnalysis.semanticContext?.symbolUsages.all ?? []) {
        add(usage.declaration.location, usage.declaration.value,
            SemanticDiagnosticCode.UnusedSymbol, symbolSignature(usage.symbol),
            !usage.unused && !usage.externallyVisible);
    }
    for (const group of result.rootAnalysis.macroOccurrences.all) {
        add(group.definition.location, group.definition.name,
            UNUSED_MACRO_DIAGNOSTIC_CODE,
            JSON.stringify(['macro', group.definition.replacement]),
            group.references.some(ref => ref.kind !== 'undef'));
    }
    return [...facts.values()];
}
