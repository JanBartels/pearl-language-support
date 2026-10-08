// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../core/sourceValue";

import { AstKind } from "../ast/astKind";

import { ConstantFixedExpressionNode } from "../ast/problem/expressions/constantFixedExpressionNode";
import { DimensionAttributeNode } from "../ast/problem/dimensions/dimensionAttributeNode";

import { ProblemDataTypeNode } from "../ast/problem/types/problemDataTypeNode";
import { SimpleTypeNode } from "../ast/problem/types/simpleTypeNode";
import { NamedTypeNode } from "../ast/problem/types/namedTypeNode";
import { StructTypeNode } from "../ast/problem/types/structTypeNode";
import {
    RefTargetTypeNode,
    RefTypeNode
} from "../ast/problem/types/refTypeNode";

import { Environment } from "./environment";
import {
    CharacterType,
    BitType,
    FixedType,
    FloatType,
    NamedType,
    ReferenceType,
    SemanticType,
    SemanticTypeKind,
    StructComponentType,
    StructType,
    VoidReferenceType
} from "./semanticType";

import {
    SemanticSymbol,
    TypeSymbol
} from "./symbol";

import { SymbolKind } from "./symbolKind";
import { resolveSymbol } from "./symbolResolver";


export interface SemanticTypeResolverContext {

    bind( source: SourceValue<string>, symbol: SemanticSymbol ): void;

    evaluateConstantFixedExpression(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): bigint | undefined;

    resolveDimensionedType(
        elementType: SemanticType,
        dimension: DimensionAttributeNode,
        environment: Environment
    ): SemanticType | undefined;

    lookupForwardType(name: string, environment: Environment): TypeSymbol | undefined;

    getOrCreateUnresolvedReferenceTarget( name: SourceValue<string>, environment: Environment ): TypeSymbol;

    markForwardReference( symbol: TypeSymbol, source: SourceValue<string> ): void;

    reportUnknownType( name: SourceValue<string> ): void;

    reportExpectedType( name: SourceValue<string>, symbol: SemanticSymbol ): void;
}


export class SemanticTypeResolver {

    constructor( private readonly context: SemanticTypeResolverContext ) {
    }

    resolve( node: ProblemDataTypeNode, environment: Environment ): SemanticType | undefined {

        switch (node.kind) {

            case AstKind.SimpleType:
                return this.resolveSimpleType( node as SimpleTypeNode, environment );

            case AstKind.NamedType:
                return this.resolveNamedType( node as NamedTypeNode, environment );

            case AstKind.StructType:
                return this.resolveStructType( node as StructTypeNode, environment );

            case AstKind.RefType:
                return this.resolveRefType( node as RefTypeNode, environment );

            default:
                throw new Error( `Unsupported problem data type AST kind: ${node.kind}` );
        }
    }


    private resolveSimpleType( node: SimpleTypeNode, environment: Environment ): SemanticType | undefined {

        const value = this.resolvePrecisionOrLength( node, environment );

        if (   node.precisionOrLength !== undefined
            && value === undefined
        ) {
            return undefined;
        }

        switch (node.keyword.value) {

            case "FIXED":
                return { kind: SemanticTypeKind.Fixed, precision: value } satisfies FixedType;

            case "FLOAT":
                return { kind: SemanticTypeKind.Float, precision: value } satisfies FloatType;

            case "BIT":
                return { kind: SemanticTypeKind.Bit, length: value } satisfies BitType;

            case "CHAR":
            case "CHARACTER":
                return { kind: SemanticTypeKind.Character, length: value } satisfies CharacterType;

            case "CLOCK":
                return { kind: SemanticTypeKind.Clock };

            case "DUR":
            case "DURATION":
                return { kind: SemanticTypeKind.Duration };

            default:
                throw new Error( `Unsupported simple type '${node.keyword.value}'.` );
        }
    }


    private resolvePrecisionOrLength( node: SimpleTypeNode, environment: Environment ): number | undefined {

        if (!node.precisionOrLength) {
            return undefined;
        }

        const value = this.context.evaluateConstantFixedExpression( node.precisionOrLength, environment );

        if (value === undefined) {
            return undefined;
        }

        const numericValue = Number(value);

        return Number.isSafeInteger(numericValue)
            ? numericValue
            : undefined;
    }


    private resolveNamedType( node: NamedTypeNode, environment: Environment ): NamedType | undefined {

        const symbol = resolveSymbol( environment, node.name.value );

        if (!symbol) {
            this.context.reportUnknownType( node.name );
            return undefined;
        }

        if (symbol.kind !== SymbolKind.Type) {
            this.context.reportExpectedType( node.name, symbol );
            return undefined;
        }

        const typeSymbol = symbol as TypeSymbol;

        this.context.bind( node.name, typeSymbol );

        return {
            kind: SemanticTypeKind.Named,
            symbol: typeSymbol
        };
    }


    private resolveStructType( node: StructTypeNode, environment: Environment ): StructType | undefined {

        const components: StructComponentType[] = [];

        for (const component of node.components) {

            let componentType = this.resolve( component.type, environment );

            if (!componentType) {
                continue;
            }

            if (component.dimension) {

                const dimensionedType = this.context.resolveDimensionedType( componentType, component.dimension, environment );

                if (!dimensionedType) {
                    continue;
                }

                componentType =  dimensionedType;
            }

            for ( const identifier of component.identifiers.identifiers ) {

                components.push({
                    name: identifier,
                    type: componentType
                });
            }
        }

        return {
            kind: SemanticTypeKind.Struct,
            components
        };
    }


    private resolveRefType( node: RefTypeNode, environment: Environment ): ReferenceType | VoidReferenceType | undefined {

        if (    node.target.kind === AstKind.StructType
            && (node.target as StructTypeNode).components.length === 0
        ) {
            return {
                kind: SemanticTypeKind.VoidReference
            };
        }

        const target = this.resolveReferenceTarget( node.target, environment );

        if (!target) {
            return undefined;
        }

        return {
            kind: SemanticTypeKind.Reference,
            target
        };
    }


    private resolveReferenceTarget( node: RefTargetTypeNode, environment: Environment ): SemanticType | undefined {

        switch (node.kind) {

            case AstKind.SimpleType:
                return this.resolveSimpleType( node as SimpleTypeNode, environment );

            case AstKind.StructType:
                return this.resolveStructType( node as StructTypeNode, environment );

            case AstKind.NamedType:
                return this.resolveReferenceNamedType( node as NamedTypeNode, environment );

            default:
                throw new Error( `Unsupported REF target AST kind: ${node.kind}` );
        }
    }


    private resolveReferenceNamedType( node: NamedTypeNode, environment: Environment ): NamedType | undefined {

        const visible = resolveSymbol( environment, node.name.value );

        if (visible) {

            if (visible.kind !== SymbolKind.Type) {
                this.context.reportExpectedType( node.name, visible );
                return undefined;
            }

            const typeSymbol = visible as TypeSymbol;

            this.context.bind( node.name, typeSymbol );

            return {
                kind: SemanticTypeKind.Named,
                symbol: typeSymbol
            };
        }

        /*
         * RTOS-UH permits an unknown type identifier
         * as target of REF.
         *
         * A pre-indexed later TYPE declaration takes
         * precedence over a permanently unresolved
         * reference target.
         */
        const forward = this.context.lookupForwardType( node.name.value, environment );

        if (forward) {

            this.context.bind( node.name, forward );

            this.context.markForwardReference( forward, node.name );

            return {
                kind: SemanticTypeKind.Named,
                symbol: forward
            };
        }

        const unresolved = this.context.getOrCreateUnresolvedReferenceTarget( node.name, environment );

        this.context.bind( node.name, unresolved );

        this.context.markForwardReference( unresolved, node.name );

        return {
            kind: SemanticTypeKind.Named,
            symbol: unresolved
        };
    }

}
