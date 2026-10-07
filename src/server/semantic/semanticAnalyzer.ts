// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';
import { TypeDeclarationNode } from '../ast/problem/declarations/typeDeclarationNode';
import { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import { DimensionAttributeNode } from '../ast/problem/dimensions/dimensionAttributeNode';
import { DimensionBoundariesNode } from '../ast/problem/dimensions/dimensionBoundariesNode';
import type { Environment } from './environment';
import { SemanticContext } from './semanticContext';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import {
    SemanticDiagnosticCode,
    SemanticDiagnosticSeverity
} from './semanticDiagnostic';
import {
    SemanticType,
    SemanticTypeKind
} from './semanticType';
import {
    SemanticSymbol,
    TypeSymbol
} from './symbol';
import { SymbolKind } from './symbolKind';
import {
    Scope,
    ScopeKind
} from './scope';
import { TypeIndex } from './typeIndex';
import {
    SemanticTypeResolver,
    SemanticTypeResolverContext
} from './semanticTypeResolver';

interface MutableScope {
    readonly kind: ScopeKind;
    readonly parent: Scope | undefined;
    readonly symbols: SemanticSymbol[];
}

class SemanticAnalysisState implements SemanticTypeResolverContext {
    readonly typeDefinitions = new Map<TypeSymbol, SemanticType>();
    readonly bindings = new Map<SourceValue<string>, SemanticSymbol>();
    readonly diagnostics: SemanticDiagnostic[] = [];
    readonly typeIndex = new TypeIndex();
    readonly scopes = new Map<AstNode, Scope>();
    readonly typeSymbols = new Map<TypeDeclarationNode, TypeSymbol>();
    readonly unresolvedReferenceTargets = new Map<Scope, Map<string, TypeSymbol>>();
    readonly forwardReferences = new Map<TypeSymbol, SourceValue<string>[]>();
    readonly typeResolver = new SemanticTypeResolver(this);

    createContext(): SemanticContext {
        return new SemanticContext(this.typeDefinitions, this.bindings, this.diagnostics);
    }

    bind(source: SourceValue<string>, symbol: SemanticSymbol): void {
        this.bindings.set(source, symbol);
    }

    evaluateConstantFixedExpression(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): number | undefined {
        void environment;

        const value = Number(expression.literal.value);

        if (!Number.isSafeInteger(value)) {
            return undefined;
        }

        return value;
    }

    resolveDimensionedType(
        elementType: SemanticType,
        dimension: DimensionAttributeNode,
        environment: Environment
    ): SemanticType | undefined {
        const dimensions: {
            lowerBound: bigint;
            upperBound: bigint;
        }[] = [];

        for (const child of dimension.getChildren()) {
            if (child.kind !== AstKind.DimensionBoundaries) {
                throw new Error(`Unexpected AST kind in dimension attribute: ${child.kind}`);
            }

            const boundaries = child as DimensionBoundariesNode;
            const lower = boundaries.lowerBoundary
                ? this.evaluateConstantFixedExpression(boundaries.lowerBoundary, environment)
                : 1;
            const upper = this.evaluateConstantFixedExpression(boundaries.upperBoundary, environment);

            if (lower === undefined || upper === undefined) {
                return undefined;
            }

            if (upper < lower) {
                return undefined;
            }

            dimensions.push({
                lowerBound: BigInt(lower),
                upperBound: BigInt(upper)
            });
        }

        return {
            kind: SemanticTypeKind.Array,
            elementType,
            dimensions
        };
    }

    lookupForwardType(name: string, environment: Environment): TypeSymbol | undefined {
        /*
         * resolveSymbol() has already searched all symbols which are currently visible, including outer
         * environments. A forward lookup must therefore only inspect the complete declaration set of the
         * current scope. Searching parent scopes here would make declarations visible before their source
         * position.
         */
        return this.typeIndex.lookupInScope(environment.scope, name);
    }

    getOrCreateUnresolvedReferenceTarget(name: SourceValue<string>, environment: Environment): TypeSymbol {
        let targets = this.unresolvedReferenceTargets.get(environment.scope);

        if (!targets) {
            targets = new Map<string, TypeSymbol>();
            this.unresolvedReferenceTargets.set(environment.scope, targets);
        }

        const existing = targets.get(name.value);

        if (existing) {
            return existing;
        }

        const symbol: TypeSymbol = {
            kind: SymbolKind.Type,
            name
        };

        targets.set(name.value, symbol);

        return symbol;
    }

    markForwardReference(symbol: TypeSymbol, source: SourceValue<string>): void {
        let references = this.forwardReferences.get(symbol);

        if (!references) {
            references = [];
            this.forwardReferences.set(symbol, references);
        }

        references.push(source);
    }

    reportUnknownType(name: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.UnknownType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Unbekannter Typ '${name.value}'.`
        });
    }

    reportExpectedType(name: SourceValue<string>, symbol: SemanticSymbol): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.ExpectedType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `'${name.value}' bezeichnet keinen Typ.`
        });

        void symbol;
    }

    reportDuplicateType(name: SourceValue<string>, existing: TypeSymbol): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DuplicateType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Der Typ '${name.value}' ist in diesem Gültigkeitsbereich bereits definiert.`
        });

        void existing;
    }

    finalize(): void {
        for (const targets of this.unresolvedReferenceTargets.values()) {
            for (const symbol of targets.values()) {
                const references = this.forwardReferences.get(symbol);

                if (!references) {
                    this.reportUnknownType(symbol.name);
                    continue;
                }

                for (const reference of references) {
                    this.reportUnknownType(reference);
                }
            }
        }
    }
}

export class SemanticAnalyzer {
    analyze(root: AstNode): SemanticContext {
        const state = new SemanticAnalysisState();

        this.indexNode(root, undefined, state);
        this.analyzeNode(root, undefined, state);
        state.finalize();

        return state.createContext();
    }

    private indexNode(node: AstNode, parentScope: Scope | undefined, state: SemanticAnalysisState): void {
        let scope = parentScope;
        const scopeKind = this.scopeKindFor(node);

        if (scopeKind !== undefined) {
            scope = {
                kind: scopeKind,
                parent: parentScope,
                symbols: []
            };

            state.scopes.set(node, scope);
        }

        if (node.kind === AstKind.TypeDeclaration) {
            if (!scope) {
                throw new Error('TYPE declaration outside semantic scope.');
            }

            this.indexTypeDeclaration(node as TypeDeclarationNode, scope, state);
        }

        for (const child of node.getChildren()) {
            this.indexNode(child, scope, state);
        }
    }

    private indexTypeDeclaration(node: TypeDeclarationNode, scope: Scope, state: SemanticAnalysisState): void {
        const symbol: TypeSymbol = {
            kind: SymbolKind.Type,
            name: node.name
        };

        state.typeSymbols.set(node, symbol);

        const existing = state.typeIndex.index(scope, symbol);

        if (existing) {
            state.reportDuplicateType(node.name, existing);
            return;
        }

        (scope as MutableScope).symbols.push(symbol);
    }

    private analyzeNode(
        node: AstNode,
        environment: Environment | undefined,
        state: SemanticAnalysisState
    ): Environment | undefined {
        const scope = state.scopes.get(node);

        if (scope) {
            const innerEnvironment = this.createEnvironment(scope, environment);
            this.analyzeChildren(node, innerEnvironment, state);

            /*
             * Deklarationen eines inneren Scopes dürfen nach dessen Verlassen nicht in den äußeren
             * Environment-Zustand gelangen.
             */
            return environment;
        }

        switch (node.kind) {
            case AstKind.TypeDeclaration:
                if (!environment) {
                    throw new Error('TYPE declaration without semantic environment.');
                }

                return this.analyzeTypeDeclaration(node as TypeDeclarationNode, environment, state);

            default:
                return this.analyzeChildren(node, environment, state);
        }
    }

    private analyzeChildren(
        node: AstNode,
        environment: Environment | undefined,
        state: SemanticAnalysisState
    ): Environment | undefined {
        let current = environment;

        for (const child of node.getChildren()) {
            current = this.analyzeNode(child, current, state);
        }

        return current;
    }

    private analyzeTypeDeclaration(
        node: TypeDeclarationNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        const symbol = state.typeSymbols.get(node);

        if (!symbol) {
            throw new Error(`TYPE '${node.name.value}' was not indexed.`);
        }

        state.bind(node.name, symbol);

        const indexed = state.typeIndex.lookupInScope(environment.scope, node.name.value);

        if (indexed !== symbol) {
            /*
             * Doppelte Definition im selben Scope. Sie wurde bereits beim Indexieren erkannt und wird nicht
             * in das Environment eingeführt.
             */
            return environment;
        }

        let type: SemanticType | undefined;

        if (node.type) {
            type = state.typeResolver.resolve(node.type, environment);

            if (type && node.dimension) {
                type = state.resolveDimensionedType(type, node.dimension, environment);
            }

            if (type) {
                state.typeDefinitions.set(symbol, type);
            }
        }

        /*
         * Erst NACH der Auflösung der Definition sichtbar machen. Dadurch ist TYPE A B; mit einem erst später
         * definierten B weiterhin ungültig. REF darf dagegen über den TYPE-Index auf das vorindexierte Symbol
         * zugreifen. Damit funktioniert insbesondere TYPE Node STRUCT[ Next REF Node ];.
         */
        return this.introduceSymbol(environment, symbol);
    }

    private introduceSymbol(environment: Environment, symbol: SemanticSymbol): Environment {
        return {
            scope: environment.scope,
            previous: environment,
            outer: environment.outer,
            introducedSymbols: [symbol]
        };
    }

    private createEnvironment(scope: Scope, outer: Environment | undefined): Environment {
        return {
            scope,
            previous: undefined,
            outer,
            introducedSymbols: []
        };
    }

    private scopeKindFor(node: AstNode): ScopeKind | undefined {
        switch (node.kind) {
            case AstKind.Module:
                return ScopeKind.Module;

            case AstKind.TaskDeclaration:
                return ScopeKind.Task;

            case AstKind.ProcedureDeclaration:
                return ScopeKind.Procedure;

            case AstKind.Block:
                return ScopeKind.Block;

            default:
                return undefined;
        }
    }
}
