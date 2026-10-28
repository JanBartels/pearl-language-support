// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SemanticContext } from '../semantic/semanticContext';
import type { SemanticSymbol } from '../semantic/symbol';
import { SymbolKind } from '../semantic/symbolKind';
import { formatSemanticType } from './semanticTypeDocumentation';

export function appendSemanticSymbolDocumentation(
    documentation: string,
    symbol: SemanticSymbol,
    semanticContext: SemanticContext,
    displaySignature?: string
): string {
    switch (symbol.kind) {
        case SymbolKind.DataObject:
            return appendDataObjectDocumentation(documentation, symbol, displaySignature);

        case SymbolKind.Type: {
            const type = semanticContext.typeDefinitions.get(symbol);
            return type ? `${documentation}\n\n**Type:** \`${formatSemanticType(type)}\``
                + (displaySignature ? `\n\n**Signature:** \`${displaySignature}\`` : '')
                : documentation;
        }

        case SymbolKind.StructComponent:
            return `${documentation}\n\n**Symbol:** structure component`
                + `\n\n**Type:** \`${formatSemanticType(symbol.type)}\``;

        case SymbolKind.Module:
            return `${documentation}\n\n**Symbol:** module`;

        case SymbolKind.Parameter:
        case SymbolKind.Identification:
            return `${documentation}\n\n**Symbol:** ${symbol.byIdentification ? 'identification' : 'parameter'}`
                + (symbol.type ? `\n\n**Type:** \`${formatSemanticType(symbol.type)}\`` : '')
                + (symbol.assignmentProtected ? '\n\n**Assignment protection:** INV' : '');

        case SymbolKind.Procedure:
            return `${documentation}\n\n**Symbol:** procedure`
                + (symbol.signature
                    ? `\n\n**Signature:** \`${displaySignature ?? formatSemanticType(symbol.signature)}\`` : '')
                + (symbol.resultType
                    ? `\n\n**Result type:** \`${formatSemanticType(symbol.resultType)}\``
                    : '');

        case SymbolKind.Task:
            return `${documentation}\n\n**Symbol:** task`;

        case SymbolKind.LoopControlVariable:
            return `${documentation}\n\n**Symbol:** loop control variable`
                + `\n\n**Type:** \`${formatSemanticType(symbol.type)}\``;

        case SymbolKind.Label:
            return `${documentation}\n\n**Symbol:** label`;
    }
}

function appendDataObjectDocumentation(
    documentation: string,
    symbol: Extract<SemanticSymbol, { kind: SymbolKind.DataObject }>,
    displaySignature?: string
): string {
    let result = `${documentation}\n\n**Type:** \`${formatSemanticType(symbol.type)}\``;

    if (displaySignature) {
        result += `\n\n**Signature:** \`${displaySignature}\``;
    }

    if (symbol.assignmentProtected) {
        result += '\n\n**Assignment protection:** `INV`';
    }

    if (symbol.global) {
        result += '\n\n**Global object**';
    }

    return result;
}
