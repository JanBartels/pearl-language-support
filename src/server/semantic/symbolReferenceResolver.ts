// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { Location } from '../core/location';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticContext } from './semanticContext';
import { SymbolReferenceKind } from './symbolReference';
import type { SymbolReference } from './symbolReference';
import type { SymbolReferenceResolution } from './symbolReferenceResolution';
import { SymbolReferenceResolutionIndex } from './symbolReferenceResolutionIndex';
import type { SymbolReferenceIndex } from './symbolReferenceIndex';
import { SymbolKind } from './symbolKind';

/**
 * Combines the syntax-only 7.1 reference index with the EXISTING semantic
 * binding decisions. Never performs a second lexical/scope lookup: those
 * decisions (including shadowing, forward TYPE references, SPC and GOTO)
 * belong to their existing resolvers. This pass produces no diagnostics.
 *
 * GLOBAL specifications are locally bound symbols; their eventual external
 * definitions are resolved by the RTOS-UH loader, not by the compiler.
 */
export class SymbolReferenceResolver {
    resolve(references: SymbolReferenceIndex, semantic: SemanticContext): SymbolReferenceResolutionIndex {
        const results: SymbolReferenceResolution[] = [];

        // Diagnostics are associated with a compiler location, not an editor
        // location. Never map macro expansions before matching them.
        const diagnosticsAt = (reference: SymbolReference): readonly SemanticDiagnostic[] => {
            const location = reference.identifier.location;
            return location
                ? semantic.diagnostics.filter(diagnostic => sameLocation(diagnostic.location, location))
                : [];
        };

        for (const reference of references.all) {
            const diagnostics = diagnosticsAt(reference);
            const source = reference.identifier;
            const symbol = semantic.bindings.get(source);
            // REF UnknownType deliberately gets a provisional TypeSymbol so
            // the type analyzer can continue. It has no real declaration and
            // must never be exposed as a successful reference binding.
            if (symbol && !(symbol.kind === SymbolKind.Type && !symbol.definition)) {
                results.push({
                    kind: 'bound', reference, symbol,
                    declaration: symbol.definition ?? symbol.name,
                    diagnostics
                });
                continue;
            }

            const builtin = semantic.builtinBindings.get(source);
            if (builtin) {
                results.push({ kind: 'builtin', reference, builtin, diagnostics });
                continue;
            }

            // END identifiers name the surrounding block/repetition, but the
            // existing semantic symbol model has no symbol/declaration for
            // these structural names. Do not misdiagnose them as unknown names.
            if (reference.kind === SymbolReferenceKind.BlockEnd
                || reference.kind === SymbolReferenceKind.RepetitionEnd) {
                results.push({ kind: 'deferred', reference, reason: 'structuralName', diagnostics });
                continue;
            }

            results.push({ kind: 'unresolved', reference, diagnostics });
        }

        return new SymbolReferenceResolutionIndex(results);
    }
}

function sameLocation(left: Location, right: Location): boolean {
    return left.source === right.source
        && left.span.start === right.span.start
        && left.span.end === right.span.end;
}
