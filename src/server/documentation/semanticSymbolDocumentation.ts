// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SemanticContext } from '../semantic/semanticContext';
import type { SemanticSymbol } from '../semantic/symbol';
import { SymbolKind } from '../semantic/symbolKind';
import { formatSemanticType } from './semanticTypeDocumentation';

export function appendSemanticSymbolDocumentation(
    documentation: string,
    symbol: SemanticSymbol,
    semanticContext: SemanticContext
): string {
    switch (symbol.kind) {
        case SymbolKind.DataObject:
            return appendDataObjectDocumentation(documentation, symbol);

        case SymbolKind.Type: {
            const type = semanticContext.typeDefinitions.get(symbol);
            return type ? `${documentation}\n\n**Type:** \`${formatSemanticType(type)}\`` : documentation;
        }

        case SymbolKind.Module:
            return `${documentation}\n\n**Symbol:** module`;

        case SymbolKind.Parameter:
            return `${documentation}\n\n**Symbol:** parameter`;

        case SymbolKind.Identification:
            return `${documentation}\n\n**Symbol:** identification`;

        case SymbolKind.Procedure:
            return `${documentation}\n\n**Symbol:** procedure`;

        case SymbolKind.Task:
            return `${documentation}\n\n**Symbol:** task`;

        case SymbolKind.LoopControlVariable:
            return `${documentation}\n\n**Symbol:** loop control variable`;

        case SymbolKind.Label:
            return `${documentation}\n\n**Symbol:** label`;
    }
}

function appendDataObjectDocumentation(
    documentation: string,
    symbol: Extract<SemanticSymbol, { kind: SymbolKind.DataObject }>
): string {
    let result = `${documentation}\n\n**Type:** \`${formatSemanticType(symbol.type)}\``;

    if (symbol.assignmentProtected) {
        result += '\n\n**Assignment protection:** `INV`';
    }

    if (symbol.global) {
        result += symbol.global.moduleName
            ? `\n\n**Global object:** module \`${symbol.global.moduleName.value}\``
            : '\n\n**Global object**';
    }

    return result;
}
