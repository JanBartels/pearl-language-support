// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import {
    SourceHighlightAttribute,
    SourceHighlightKind,
    type SourceHighlight
} from './sourceHighlight';
import type { SemanticContext } from './semanticContext';
import type { SemanticSymbol } from './symbol';
import { SymbolKind } from './symbolKind';
import type { SymbolOccurrenceIndex } from './symbolOccurrenceIndex';

/**
 * Classifies already bound PEARL symbol occurrences for editor highlighting.
 *
 * Neither lexing nor name resolution belongs here: the semantic bindings
 * decide what a name denotes, and SymbolOccurrenceIndex decides which
 * SourceValues are declarations (including local SPC/definition pairs).
 */
export class SymbolHighlightCollector {
    collect(semantic: SemanticContext, occurrences: SymbolOccurrenceIndex): readonly SourceHighlight[] {
        const result: SourceHighlight[] = [];
        const seen = new Set<SourceValue<string>>();

        for (const group of occurrences.all) {
            // A declaration may be absent from bindings during error recovery;
            // another bound occurrence of the same declaration is sufficient.
            const symbol = semantic.bindings.get(group.declaration)
                ?? group.declarations.map(name => semantic.bindings.get(name)).find(Boolean)
                ?? group.references.map(name => semantic.bindings.get(name)).find(Boolean);
            if (!symbol) continue;

            const kind = this.kind(symbol);
            if (kind === undefined) continue;

            const add = (identifier: SourceValue<string>, declaration: boolean): void => {
                if (!identifier.location || seen.has(identifier)) return;
                // Do not color an unresolved or recoverable name using a
                // different occurrence's spelling. Every emitted occurrence
                // must itself be semantically bound to this declaration.
                const bound = semantic.bindings.get(identifier);
                if (!bound || this.kind(bound) !== kind) return;
                if (bound.kind === SymbolKind.Type && !bound.definition) return;

                const attributes: SourceHighlightAttribute[] = [];
                if (declaration) attributes.push(SourceHighlightAttribute.Declaration);
                if (this.readonly(bound)) attributes.push(SourceHighlightAttribute.Readonly);
                result.push({ element: identifier, kind, attributes });
                seen.add(identifier);
            };

            for (const identifier of group.declarations) add(identifier, true);
            for (const identifier of group.references) add(identifier, false);
        }

        return result;
    }

    private kind(symbol: SemanticSymbol): SourceHighlightKind | undefined {
        switch (symbol.kind) {
            case SymbolKind.Module:
                return SourceHighlightKind.Module;
            case SymbolKind.Type:
                return symbol.definition ? SourceHighlightKind.Type : undefined;
            case SymbolKind.DataObject:
            case SymbolKind.LoopControlVariable:
                return SourceHighlightKind.DataObject;
            case SymbolKind.Parameter:
            case SymbolKind.Identification:
                return SourceHighlightKind.Parameter;
            case SymbolKind.Procedure:
                return SourceHighlightKind.Procedure;
            case SymbolKind.Task:
                return SourceHighlightKind.Task;
            case SymbolKind.StructComponent:
                return SourceHighlightKind.StructComponent;
            case SymbolKind.Label:
            case SymbolKind.Format:
                return SourceHighlightKind.Label;
        }
    }

    private readonly(symbol: SemanticSymbol): boolean {
        switch (symbol.kind) {
            case SymbolKind.DataObject:
            case SymbolKind.Parameter:
            case SymbolKind.Identification:
                return symbol.assignmentProtected;
            default:
                return false;
        }
    }
}
