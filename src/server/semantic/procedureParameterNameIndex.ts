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
import type { ProblemDataTypeNode } from '../ast/problem/types/problemDataTypeNode';
import { ProcedureReferenceTargetNode } from '../ast/problem/types/procedureReferenceTargetNode';
import { RefTypeNode } from '../ast/problem/types/refTypeNode';
import type { SourceValue } from '../core/sourceValue';
import type { CommentToken } from '../lexer/token';
import type { LocalSpecificationRelation } from './localSpecificationRelation';
import { ProcedureParameterDocumentationCollector } from './procedureParameterDocumentationCollector';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType } from './semanticType';
import type { SemanticSymbol, TypeSymbol } from './symbol';
import { SymbolKind } from './symbolKind';

/** Optional *presentation* metadata. Never part of ProcedureType or type equality. */
export interface FormalParameterName {
    readonly name: SourceValue<string>;
    readonly origin: 'explicit' | 'comment';
}

type Names = readonly (FormalParameterName | undefined)[];

/** Only the semantic information needed to follow SPC relations and type aliases. */
export interface FormalParameterNameContext {
    readonly typeDefinitions: ReadonlyMap<TypeSymbol, SemanticType>;
    readonly localSpecificationRelations: ReadonlyMap<SourceValue<string>, LocalSpecificationRelation>;
}

function explicit(name: SourceValue<string> | undefined): FormalParameterName | undefined {
    return name ? { name, origin: 'explicit' } : undefined;
}

/**
 * Indexes the syntactic parameter names of PROC, SPC ENTRY and REF PROC.
 * This is shared by diagnostic reporting and CallSignatureIndex (Hover/Signature Help).
 * No semantic type or AST node is altered.
 */
export class ProcedureParameterNameIndex {
    private readonly declarationNames = new Map<SourceValue<string>, Names>();
    private readonly specificationNames = new Map<SourceValue<string>, Names>();
    private readonly directReferenceNames = new Map<SourceValue<string>, Names>();
    private readonly typeReferenceNames = new Map<SourceValue<string>, Names>();

    constructor(root: AstNode, comments: readonly CommentToken[] = []) {
        const documentation = new ProcedureParameterDocumentationCollector(comments);
        const visit = (node: AstNode): void => {
            switch (node.kind) {
                case AstKind.ProcedureDeclaration: {
                    const procedure = node as ProcedureDeclarationNode;
                    const names: (FormalParameterName | undefined)[] = [];
                    for (const parameter of procedure.parameters) {
                        const identifiers = parameter.identifiers?.identifiers;
                        if (identifiers?.length) names.push(...identifiers.map(explicit));
                        else names.push(undefined);
                    }
                    this.declarationNames.set(procedure.name, names);
                    break;
                }
                case AstKind.SpcDeclarationSentence: {
                    const sentence = node as SpcDeclarationSentenceNode;
                    if (sentence.attribute instanceof SpcProcedureAttributeNode) {
                        const names = namesOfSignature(sentence.attribute.signature, documentation);
                        for (const name of sentence.identifiers.identifiers) {
                            this.specificationNames.set(name, names);
                        }
                    }
                    break;
                }
                case AstKind.DclDeclarationSentence: {
                    const sentence = node as DclDeclarationSentenceNode;
                    if (sentence.attribute instanceof ProblemDataAttributeNode) {
                        const names = namesOfRefProc(sentence.attribute.type, documentation);
                        if (names) {
                            for (const identifier of sentence.identifiers.identifiers) {
                                this.directReferenceNames.set(identifier, names);
                            }
                        }
                    }
                    break;
                }
                case AstKind.TypeDeclaration: {
                    const declaration = node as TypeDeclarationNode;
                    const names = namesOfRefProc(declaration.type, documentation);
                    if (names) this.typeReferenceNames.set(declaration.name, names);
                    break;
                }
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);
    }

    namesForSymbol(symbol: SemanticSymbol, context: FormalParameterNameContext): Names | undefined {
        if (symbol.kind === SymbolKind.Procedure) {
            const definition = symbol.definition ?? symbol.name;
            const declared = this.declarationNames.get(definition);
            const relation = context.localSpecificationRelations.get(definition)
                ?? context.localSpecificationRelations.get(symbol.name);
            const specified = this.specificationNames.get(symbol.name)
                ?? this.specificationNames.get(definition)
                ?? (relation ? this.specificationNames.get(relation.specification) : undefined);
            const rank = symbol.signature?.parameters.length;
            const names = rank !== undefined && declared?.length === rank
                ? declared.map((entry, index) => entry
                    ?? (specified?.length === rank ? specified[index] : undefined))
                : specified;
            return names?.length === rank ? names : undefined;
        }
        if (symbol.kind === SymbolKind.DataObject) {
            return this.directReferenceNames.get(symbol.name)
                ?? this.namesOfType(symbol.type, context);
        }
        if (symbol.kind === SymbolKind.Type) {
            return this.namesOfType({ kind: SemanticTypeKind.Named, symbol }, context);
        }
        return undefined;
    }

    nameForSymbol(
        symbol: SemanticSymbol, position: number, context: FormalParameterNameContext
    ): FormalParameterName | undefined {
        return this.namesForSymbol(symbol, context)?.[position];
    }

    private namesOfType(
        type: SemanticType, context: FormalParameterNameContext,
        visited = new Set<TypeSymbol>()
    ): Names | undefined {
        if (type.kind === SemanticTypeKind.Reference) {
            return this.namesOfType(type.target, context, visited);
        }
        if (type.kind !== SemanticTypeKind.Named || visited.has(type.symbol)) return undefined;
        visited.add(type.symbol);
        const names = this.typeReferenceNames.get(type.symbol.name);
        if (names) return names;
        const definition = context.typeDefinitions.get(type.symbol);
        return definition ? this.namesOfType(definition, context, visited) : undefined;
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
