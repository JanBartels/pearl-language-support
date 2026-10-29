// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import type { SourceValue } from '../core/sourceValue';
import type { CommentToken } from '../lexer/token';
import type { CallSignatureInformation } from './callSignatureInformation';
import type { SemanticContext } from './semanticContext';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType, ProcedureType } from './semanticType';
import type { SemanticSymbol } from './symbol';
import { ProcedureParameterNameIndex } from './procedureParameterNameIndex';
import { SymbolKind } from './symbolKind';

/** Compiler-side index for both CALL and expression-call signature presentation. */
export class CallSignatureIndex {
    private readonly signatures: ReadonlyMap<CallStatementNode, readonly CallSignatureInformation[]>;
    private readonly signaturesByElement: ReadonlyMap<SourceValue<string>, readonly CallSignatureInformation[]>;

    constructor(
        root: AstNode,
        semantic: SemanticContext,
        documentationComments: readonly CommentToken[] = []
    ) {
        const parameterNames = new ProcedureParameterNameIndex(root, documentationComments);
        const calls: CallStatementNode[] = [];
        const visit = (node: AstNode): void => {
            if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);

        const underlying = (type: SemanticType, visited = new Set<object>()): SemanticType | undefined => {
            if (type.kind !== SemanticTypeKind.Named) return type;
            if (visited.has(type.symbol)) return undefined;
            visited.add(type.symbol);
            const definition = semantic.typeDefinitions.get(type.symbol);
            return definition ? underlying(definition, visited) : undefined;
        };

        // Reuse one semantic signature for both Hover and Signature Help,
        // including declarations not referenced by a CALL statement.
        const byElement = new Map<SourceValue<string>, readonly CallSignatureInformation[]>();
        const signatureForSymbol = (
            symbol: SemanticSymbol, name: string
        ): readonly CallSignatureInformation[] | undefined => {
            let procedureType: ProcedureType | undefined;
            let names = parameterNames.namesForSymbol(symbol, semantic);
            if (symbol.kind === SymbolKind.Procedure) {
                procedureType = symbol.signature;
            } else if (symbol.kind === SymbolKind.DataObject) {
                const reference = underlying(symbol.type);
                if (reference?.kind !== SemanticTypeKind.Reference) return undefined;
                const target = underlying(reference.target);
                if (target?.kind !== SemanticTypeKind.Procedure) return undefined;
                procedureType = target;
            } else if (symbol.kind === SymbolKind.Type) {
                const definition = semantic.typeDefinitions.get(symbol);
                if (!definition) return undefined;
                const reference = underlying(definition);
                if (reference?.kind !== SemanticTypeKind.Reference) return undefined;
                const target = underlying(reference.target);
                if (target?.kind !== SemanticTypeKind.Procedure) return undefined;
                procedureType = target;
            }
            if (!procedureType) return undefined;
            if (names?.length !== procedureType.parameters.length) names = undefined;
            return [{
                kind: 'procedure', name, procedureType,
                parameters: procedureType.parameters.map((parameter, index) => ({
                    type: parameter.type,
                    byIdentification: parameter.byIdentification,
                    name: names?.[index]?.name,
                    nameOrigin: names?.[index]?.origin
                }))
            }];
        };
        for (const [element, symbol] of semantic.bindings) {
            const signature = signatureForSymbol(symbol, element.value);
            if (signature) byElement.set(element, signature);
        }
        for (const symbol of new Set(semantic.bindings.values())) {
            for (const element of [symbol.name, symbol.definition]) {
                if (element && !byElement.has(element)) {
                    const signature = signatureForSymbol(symbol, element.value);
                    if (signature) byElement.set(element, signature);
                }
            }
        }
        for (const [element, builtin] of semantic.builtinBindings) {
            byElement.set(element, builtin.signatures.map(signature => ({
                kind: 'builtin' as const, name: element.value, builtin, signature
            })));
        }
        const entries = new Map<CallStatementNode, readonly CallSignatureInformation[]>();
        for (const call of calls) {
            if (!call.target) continue;
            const signatures = byElement.get(call.target);
            if (signatures?.length) entries.set(call, signatures);
        }
        this.signatures = entries;
        this.signaturesByElement = byElement;
    }

    /** Display metadata for a bound identifier; no new scope lookup. */
    getForElement(element: SourceValue<string>): readonly CallSignatureInformation[] | undefined {
        return this.signaturesByElement.get(element);
    }

    get(call: CallStatementNode): readonly CallSignatureInformation[] | undefined {
        return this.signatures.get(call);
    }
}

