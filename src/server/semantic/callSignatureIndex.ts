// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { DclDeclarationSentenceNode } from '../ast/problem/declarations/dclDeclarationSentenceNode';
import { ProblemDataAttributeNode } from '../ast/problem/declarations/problemDataAttributeNode';
import { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
import { TypeDeclarationNode } from '../ast/problem/declarations/typeDeclarationNode';
import { ProcedureSignatureNode } from '../ast/problem/procedures/procedureSignatureNode';
import { SpcDeclarationSentenceNode } from '../ast/problem/specifications/spcDeclarationSentenceNode';
import { SpcProcedureAttributeNode } from '../ast/problem/specifications/spcProcedureAttributeNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import type { ProblemDataTypeNode } from '../ast/problem/types/problemDataTypeNode';
import { ProcedureReferenceTargetNode } from '../ast/problem/types/procedureReferenceTargetNode';
import { RefTypeNode } from '../ast/problem/types/refTypeNode';
import type { SourceValue } from '../core/sourceValue';
import type { CommentToken } from '../lexer/token';
import { ProcedureParameterDocumentationCollector } from './procedureParameterDocumentationCollector';
import type { CallSignatureInformation } from './callSignatureInformation';
import type { SemanticContext } from './semanticContext';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType, ProcedureType } from './semanticType';
import type { SemanticSymbol, TypeSymbol } from './symbol';
import { SymbolKind } from './symbolKind';

type DisplayName = {
    readonly name: SourceValue<string>;
    readonly origin: 'explicit' | 'comment';
};
type Names = readonly (DisplayName | undefined)[];

function explicit(name: SourceValue<string> | undefined): DisplayName | undefined {
    return name ? { name, origin: 'explicit' } : undefined;
}

/**
 * Compiler-side index for signature help. Its only inputs are the AST and
 * completed semantic bindings. It performs no scope lookup and reports no errors.
 * Keys are AST node identities, never editor offsets or mapped file locations.
 */
export class CallSignatureIndex {
    private readonly signatures: ReadonlyMap<CallStatementNode, readonly CallSignatureInformation[]>;
    private readonly signaturesByElement: ReadonlyMap<SourceValue<string>, readonly CallSignatureInformation[]>;

    constructor(
        root: AstNode,
        semantic: SemanticContext,
        documentationComments: readonly CommentToken[] = []
    ) {
        const documentation = new ProcedureParameterDocumentationCollector(documentationComments);
        const declarationNames = new Map<SourceValue<string>, Names>();
        const specificationNames = new Map<SourceValue<string>, Names>();
        const directReferenceNames = new Map<SourceValue<string>, Names>();
        const typeReferenceNames = new Map<TypeSymbol, Names>();
        const typeSymbolsByName = new Map(
            [...semantic.typeDefinitions.keys()].map(symbol => [symbol.name, symbol] as const)
        );
        const calls: CallStatementNode[] = [];

        const visit = (node: AstNode): void => {
            switch (node.kind) {
                case AstKind.ProcedureDeclaration: {
                    const procedure = node as ProcedureDeclarationNode;
                    const names: (DisplayName | undefined)[] = [];
                    for (const parameter of procedure.parameters) {
                        const identifiers = parameter.identifiers?.identifiers;
                        if (identifiers?.length) names.push(...identifiers.map(explicit));
                        else names.push(undefined);
                    }
                    declarationNames.set(procedure.name, names);
                    break;
                }
                case AstKind.SpcDeclarationSentence: {
                    const sentence = node as SpcDeclarationSentenceNode;
                    if (sentence.attribute instanceof SpcProcedureAttributeNode) {
                        const names = namesOfSignature(sentence.attribute.signature, documentation);
                        for (const name of sentence.identifiers.identifiers) {
                            specificationNames.set(name, names);
                        }
                    }
                    break;
                }
                case AstKind.DclDeclarationSentence: {
                    const sentence = node as DclDeclarationSentenceNode;
                    const attribute = sentence.attribute;
                    if (attribute instanceof ProblemDataAttributeNode) {
                        const names = namesOfRefProc(attribute.type, documentation);
                        if (names) {
                            for (const identifier of sentence.identifiers.identifiers) {
                                directReferenceNames.set(identifier, names);
                            }
                        }
                    }
                    break;
                }
                case AstKind.TypeDeclaration: {
                    const declaration = node as TypeDeclarationNode;
                    const names = namesOfRefProc(declaration.type, documentation);
                    const symbol = typeSymbolsByName.get(declaration.name);
                    if (names && symbol) typeReferenceNames.set(symbol, names);
                    break;
                }
                case AstKind.CallStatement:
                    calls.push(node as CallStatementNode);
                    break;
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);

        const underlying = (type: SemanticType, visited = new Set<TypeSymbol>()): SemanticType | undefined => {
            if (type.kind !== SemanticTypeKind.Named) return type;
            if (visited.has(type.symbol)) return undefined;
            visited.add(type.symbol);
            const definition = semantic.typeDefinitions.get(type.symbol);
            return definition ? underlying(definition, visited) : undefined;
        };

        // Metadata follows a named REF PROC through aliases, without modifying
        // the semantic type. Cycles and unresolved aliases simply have no names.
        const namesOfType = (type: SemanticType, visited = new Set<TypeSymbol>()): Names | undefined => {
            if (type.kind === SemanticTypeKind.Reference) {
                return namesOfType(type.target, visited);
            }
            if (type.kind !== SemanticTypeKind.Named) return undefined;
            if (visited.has(type.symbol)) return undefined;
            visited.add(type.symbol);
            const names = typeReferenceNames.get(type.symbol);
            if (names) return names;
            const definition = semantic.typeDefinitions.get(type.symbol);
            return definition ? namesOfType(definition, visited) : undefined;
        };

        // Reuse one semantic signature for both Hover and Signature Help,
        // including declarations not referenced by a CALL statement.
        const byElement = new Map<SourceValue<string>, readonly CallSignatureInformation[]>();
        const signatureForSymbol = (
            symbol: SemanticSymbol, name: string
        ): readonly CallSignatureInformation[] | undefined => {
            let procedureType: ProcedureType | undefined;
            let names: Names | undefined;
            if (symbol.kind === SymbolKind.Procedure) {
                procedureType = symbol.signature;
                const definition = symbol.definition ?? symbol.name;
                const declared = declarationNames.get(definition);
                const relation = semantic.localSpecificationRelations.get(definition)
                    ?? semantic.localSpecificationRelations.get(symbol.name);
                const specified = specificationNames.get(symbol.name)
                    ?? specificationNames.get(definition)
                    ?? (relation ? specificationNames.get(relation.specification) : undefined);
                if (procedureType && declared?.length === procedureType.parameters.length) {
                    names = declared.map((entry, index) => entry
                        ?? (specified?.length === declared.length ? specified[index] : undefined));
                } else {
                    names = specified;
                }
            } else if (symbol.kind === SymbolKind.DataObject) {
                const reference = underlying(symbol.type);
                if (reference?.kind !== SemanticTypeKind.Reference) return undefined;
                const target = underlying(reference.target);
                if (target?.kind !== SemanticTypeKind.Procedure) return undefined;
                procedureType = target;
                names = directReferenceNames.get(symbol.name) ?? namesOfType(symbol.type);
            } else if (symbol.kind === SymbolKind.Type) {
                const definition = semantic.typeDefinitions.get(symbol);
                if (!definition) return undefined;
                const reference = underlying(definition);
                if (reference?.kind !== SemanticTypeKind.Reference) return undefined;
                const target = underlying(reference.target);
                if (target?.kind !== SemanticTypeKind.Procedure) return undefined;
                procedureType = target;
                names = namesOfType({ kind: SemanticTypeKind.Named, symbol });
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
            if (builtin.category === 'procedure') {
                byElement.set(element, builtin.signatures.map(signature => ({
                    kind: 'builtin' as const, name: element.value, builtin, signature
                })));
            }
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

function namesOfSignature(
    signature: ProcedureSignatureNode,
    documentation: ProcedureParameterDocumentationCollector
): Names {
    return signature.parameters.map(parameter =>
        explicit(parameter.name) ?? documentation.nameFor(parameter));
}

function namesOfRefProc(
    type: ProblemDataTypeNode | undefined,
    documentation: ProcedureParameterDocumentationCollector
): Names | undefined {
    if (!(type instanceof RefTypeNode)) return undefined;
    if (!(type.target instanceof ProcedureReferenceTargetNode)) return undefined;
    return namesOfSignature(type.target.signature, documentation);
}
