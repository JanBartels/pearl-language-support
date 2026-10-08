// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';
import type { CompilerModeNode } from '../ast/module/compilerModeNode';
import type { ModuleNode } from '../ast/module/moduleNode';
import { TypeDeclarationNode } from '../ast/problem/declarations/typeDeclarationNode';
import { DclDeclarationNode } from '../ast/problem/declarations/dclDeclarationNode';
import { DclDeclarationSentenceNode } from '../ast/problem/declarations/dclDeclarationSentenceNode';
import { ProblemDataAttributeNode } from '../ast/problem/declarations/problemDataAttributeNode';
import { SemaAttributeNode } from '../ast/problem/declarations/semaAttributeNode';
import { BoltAttributeNode } from '../ast/problem/declarations/boltAttributeNode';
import type { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import type { DurationConstantNode } from '../ast/problem/expressions/durationConstantNode';
import type { SignedConstantExpressionNode } from '../ast/problem/expressions/signedConstantExpressionNode';
import { DimensionAttributeNode } from '../ast/problem/dimensions/dimensionAttributeNode';
import { DimensionBoundariesNode } from '../ast/problem/dimensions/dimensionBoundariesNode';
import type { Environment } from './environment';
import { SemanticContext } from './semanticContext';
import { createModuleConfiguration, DEFAULT_TIME_RESOLUTION, isKnownCompilerMode } from './moduleConfiguration';
import type { ModuleConfiguration, TimeResolution } from './moduleConfiguration';
import { SemanticConstantKind } from './semanticConstantValue';
import type {
    ClockConstantValue,
    DurationConstantValue,
    FixedConstantValue,
    SemanticConstantValue,
    TimeConstantValue
} from './semanticConstantValue';
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
    DataObjectSymbol,
    SemanticSymbol,
    TypeSymbol
} from './symbol';
import { SymbolKind } from './symbolKind';
import { resolveSymbol } from './symbolResolver';
import {
    Scope,
    ScopeKind
} from './scope';
import { DeclarationIndex, IndexedDeclaration } from './declarationIndex';
import { TypeIndex } from './typeIndex';
import {
    SemanticTypeResolver,
    SemanticTypeResolverContext
} from './semanticTypeResolver';
import {
    ConstantFixedExpressionEvaluator,
    ConstantFixedExpressionEvaluatorContext
} from './constantFixedExpressionEvaluator';
import {
    InitializationResolver,
    InitializationResolverContext
} from './initializationResolver';
import {
    TimeConstantEvaluator,
    TimeConstantEvaluatorContext
} from './timeConstantEvaluator';

interface MutableScope {
    readonly kind: ScopeKind;
    readonly parent: Scope | undefined;
    readonly symbols: SemanticSymbol[];
}

class SemanticAnalysisState implements
    SemanticTypeResolverContext,
    ConstantFixedExpressionEvaluatorContext,
    InitializationResolverContext,
    TimeConstantEvaluatorContext {
    readonly typeDefinitions = new Map<TypeSymbol, SemanticType>();
    readonly bindings = new Map<SourceValue<string>, SemanticSymbol>();
    readonly diagnostics: SemanticDiagnostic[] = [];
    readonly constantFixedExpressionValues = new Map<ConstantFixedExpressionNode, FixedConstantValue>();
    readonly constantFixedValues = new Map<AstNode, FixedConstantValue>();
    readonly namedConstantValues = new Map<DataObjectSymbol, SemanticConstantValue>();
    readonly timeConstantValues = new Map<AstNode, TimeConstantValue>();
    readonly semaPresetValues = new Map<DataObjectSymbol, readonly FixedConstantValue[]>();
    readonly moduleConfigurations = new Map<ModuleNode, ModuleConfiguration>();
    readonly moduleConfigurationsByScope = new Map<Scope, ModuleConfiguration>();
    readonly declarationIndex = new DeclarationIndex();
    readonly typeIndex = new TypeIndex();
    readonly scopes = new Map<AstNode, Scope>();
    readonly typeSymbols = new Map<TypeDeclarationNode, TypeSymbol>();
    readonly unresolvedReferenceTargets = new Map<Scope, Map<string, TypeSymbol>>();
    readonly forwardReferences = new Map<TypeSymbol, SourceValue<string>[]>();
    readonly typeResolver = new SemanticTypeResolver(this);
    readonly constantFixedExpressionEvaluator = new ConstantFixedExpressionEvaluator(this);
    readonly initializationResolver = new InitializationResolver(this);
    readonly timeConstantEvaluator = new TimeConstantEvaluator(this);

    createContext(): SemanticContext {
        return new SemanticContext(
            this.typeDefinitions,
            this.bindings,
            this.diagnostics,
            this.constantFixedExpressionValues,
            this.namedConstantValues,
            this.constantFixedValues,
            this.timeConstantValues,
            this.semaPresetValues,
            this.moduleConfigurations
        );
    }

    bind(source: SourceValue<string>, symbol: SemanticSymbol): void {
        this.bindings.set(source, symbol);
    }

    evaluateConstantFixedExpression(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): bigint | undefined {
        return this.constantFixedExpressionEvaluator.evaluate(expression, environment);
    }

    evaluateClockConstant(
        constant: ClockConstantNode,
        environment: Environment
    ): ClockConstantValue | undefined {
        return this.timeConstantEvaluator.evaluateClock(constant, environment);
    }

    evaluateDurationConstant(
        constant: DurationConstantNode,
        environment: Environment
    ): DurationConstantValue | undefined {
        return this.timeConstantEvaluator.evaluateDuration(constant, environment);
    }

    evaluateSignedDurationConstantExpression(
        expression: SignedConstantExpressionNode,
        environment: Environment
    ): DurationConstantValue | undefined {
        return this.timeConstantEvaluator.evaluateSignedDurationConstantExpression(
            expression,
            environment
        );
    }

    recordConstantFixedValue(
        node: AstNode,
        value: bigint
    ): void {
        const constantValue: FixedConstantValue = {
            kind: SemanticConstantKind.Fixed,
            value
        };

        this.constantFixedValues.set(node, constantValue);

        if (node.kind === AstKind.ConstantFixedExpression) {
            this.constantFixedExpressionValues.set(
                node as ConstantFixedExpressionNode,
                constantValue
            );
        }
    }

    resolveConstantFixedIdentifier(
        identifier: SourceValue<string>,
        environment: Environment
    ): bigint | undefined {
        const symbol = resolveSymbol(environment, identifier.value);

        if (!symbol) {
            this.reportUnknownIdentifier(identifier);
            return undefined;
        }

        this.bind(identifier, symbol);

        if (symbol.kind !== SymbolKind.DataObject) {
            this.reportExpectedNamedFixedConstant(identifier);
            return undefined;
        }

        const value = this.namedConstantValues.get(symbol as DataObjectSymbol);

        if (!value || value.kind !== SemanticConstantKind.Fixed) {
            this.reportExpectedNamedFixedConstant(identifier);
            return undefined;
        }

        return value.value;
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
                : BigInt(1);
            const upper = this.evaluateConstantFixedExpression(boundaries.upperBoundary, environment);

            if (lower === undefined || upper === undefined) {
                return undefined;
            }

            if (upper < lower) {
                return undefined;
            }

            dimensions.push({
                lowerBound: lower,
                upperBound: upper
            });
        }

        return {
            kind: SemanticTypeKind.Array,
            elementType,
            dimensions
        };
    }

    registerNamedConstant(symbol: DataObjectSymbol, value: SemanticConstantValue): void {
        this.namedConstantValues.set(symbol, value);
    }

    timeResolution(environment: Environment): TimeResolution {
        let scope: Scope | undefined = environment.scope;

        while (scope) {
            const configuration = this.moduleConfigurationsByScope.get(scope);

            if (configuration) {
                return configuration.timeResolution;
            }

            scope = scope.parent;
        }

        return DEFAULT_TIME_RESOLUTION;
    }

    recordTimeConstantValue(
        node: AstNode,
        value: TimeConstantValue
    ): void {
        this.timeConstantValues.set(node, value);
    }

    resolveUnderlyingType(type: SemanticType, visited: Set<TypeSymbol> = new Set()): SemanticType | undefined {
        if (type.kind !== SemanticTypeKind.Named) {
            return type;
        }

        if (visited.has(type.symbol)) {
            return undefined;
        }

        visited.add(type.symbol);

        const definition = this.typeDefinitions.get(type.symbol);
        return definition === undefined
            ? undefined
            : this.resolveUnderlyingType(definition, visited);
    }

    resolveNamedConstantIdentifier(
        identifier: SourceValue<string>,
        environment: Environment,
        expectedKind: SemanticConstantKind,
        expectedTypeName: string
    ): SemanticConstantValue | undefined {
        const symbol = resolveSymbol(environment, identifier.value);

        if (!symbol) {
            this.reportUnknownIdentifier(identifier);
            return undefined;
        }

        this.bind(identifier, symbol);

        if (symbol.kind !== SymbolKind.DataObject) {
            this.reportExpectedNamedConstant(identifier, expectedTypeName);
            return undefined;
        }

        const value = this.namedConstantValues.get(symbol as DataObjectSymbol);

        if (!value || value.kind !== expectedKind) {
            this.reportExpectedNamedConstant(identifier, expectedTypeName);
            return undefined;
        }

        return value;
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

    reportDuplicateType(name: SourceValue<string>, existing: IndexedDeclaration): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DuplicateType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Der Typ '${name.value}' ist in diesem Gültigkeitsbereich bereits definiert.`,
            relatedLocations: [{
                location: existing.name.location,
                message: 'Die erste Definition befindet sich hier.'
            }]
        });
    }

    reportDuplicateDeclaration(name: SourceValue<string>, existing: IndexedDeclaration): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DuplicateDeclaration,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Der Bezeichner '${name.value}' ist in diesem Gültigkeitsbereich bereits deklariert.`,
            relatedLocations: [{
                location: existing.name.location,
                message: 'Die erste Deklaration befindet sich hier.'
            }]
        });
    }

    reportInvalidDeclarationScope(keyword: SourceValue<string>, typeName: string): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidDeclarationScope,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `${typeName}-Variablen dürfen nur auf Modulebene deklariert werden.`
        });
    }

    reportConstantExpressionNotEvaluable(keyword: SourceValue<string>, contextName: string): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.ConstantExpressionNotEvaluable,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `${contextName} erwartet einen auswertbaren konstanten FIXED-Ausdruck.`
        });
    }

    reportUnknownIdentifier(identifier: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.UnknownIdentifier,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `Unbekannter Bezeichner '${identifier.value}'.`
        });
    }

    reportExpectedNamedFixedConstant(identifier: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.ExpectedNamedFixedConstant,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `'${identifier.value}' ist keine benannte FIXED-Konstante.`
        });
    }

    reportInvalidSemaPresetValue(keyword: SourceValue<string>, value: bigint): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidSemaPresetValue,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `SEMA-PRESET-Werte dürfen nicht negativ sein (Wert ${value}).`
        });
    }

    reportSemaPresetElementCount(keyword: SourceValue<string>, expected: bigint, actual: number): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.SemaPresetElementCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `PRESET enthält ${actual} Werte, für die deklarierten SEMA-Variablen `
                + `werden ${expected} Werte benötigt.`
        });
    }

    reportExpectedNamedConstant(identifier: SourceValue<string>, expectedTypeName: string): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.ExpectedNamedConstant,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `'${identifier.value}' ist keine benannte ${expectedTypeName}-Konstante.`
        });
    }

    reportInitializationElementCount(
        keyword: SourceValue<string>,
        typeName: string,
        expected: number,
        actual: number
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InitializationElementCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `INIT enthält ${actual} Werte, für die deklarierten ${typeName}-Objekte `
                + `werden ${expected} Werte benötigt.`
        });
    }

    reportTooManyInitializationElements(
        keyword: SourceValue<string>,
        typeName: string,
        available: bigint,
        actual: number
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InitializationElementCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `INIT enthält ${actual} Werte, für die deklarierten ${typeName}-Felder stehen nur `
                + `${available} Feldelemente zur Verfügung.`
        });
    }

    reportInvalidInitialization(keyword: SourceValue<string>, typeName: string): void {
        const message = typeName === 'FIXED'
            ? 'FIXED-Objekte müssen mit konstanten FIXED-Ausdrücken initialisiert werden.'
            : `${typeName}-Objekte enthalten einen nicht kompatiblen INIT-Wert.`;

        this.diagnostics.push({
            code: typeName === 'FIXED'
                ? SemanticDiagnosticCode.InvalidFixedInitialization
                : SemanticDiagnosticCode.InvalidInitialization,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message
        });
    }

    reportInitializationValueTooLong(
        source: SourceValue<string>,
        typeName: string,
        maximumLength: number,
        actualLength: number
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InitializationValueTooLong,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `${typeName}-Initialwert hat Länge ${actualLength}; der Zieltyp erlaubt höchstens `
                + `${maximumLength}.`
        });
    }

    reportInvalidClockConstant(
        source: SourceValue<string>,
        message: string
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidClockConstant,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message
        });
    }

    reportTimeResolutionLoss(
        source: SourceValue<string>,
        typeName: 'CLOCK' | 'DURATION',
        resolution: TimeResolution
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.TimeResolutionLoss,
            severity: SemanticDiagnosticSeverity.Warning,
            location: source.location,
            message: `${typeName}-Wert ist mit der Modul-Zeitauflösung ${this.formatTimeResolution(resolution)} `
                + 'nicht exakt darstellbar.'
        });
    }

    private formatTimeResolution(resolution: TimeResolution): string {
        if (resolution.numerator === BigInt(1) && resolution.denominator === BigInt(1000)) {
            return '1 ms';
        }

        if (resolution.numerator === BigInt(1) && resolution.denominator === BigInt(20_000)) {
            return '50 us';
        }

        return `${resolution.numerator}/${resolution.denominator} s`;
    }

    reportUnknownCompilerMode(mode: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.UnknownCompilerMode,
            severity: SemanticDiagnosticSeverity.Error,
            location: mode.location,
            message: `Unbekannter Compiler-MODE '${mode.value}'.`
        });
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
        this.collectModuleConfigurations(root, state);
        this.analyzeNode(root, undefined, state);
        state.finalize();

        return state.createContext();
    }

    private collectModuleConfigurations(root: AstNode, state: SemanticAnalysisState): void {
        if (root.kind === AstKind.Module) {
            const module = root as ModuleNode;
            const configuration = createModuleConfiguration([]);

            state.moduleConfigurations.set(module, configuration);

            const scope = state.scopes.get(module);
            if (scope) {
                state.moduleConfigurationsByScope.set(scope, configuration);
            }
            return;
        }

        if (root.kind !== AstKind.TranslationUnit) {
            return;
        }

        const modes: SourceValue<string>[] = [];

        for (const child of root.getChildren()) {
            switch (child.kind) {
                case AstKind.CompilerMode: {
                    const mode = (child as CompilerModeNode).mode;
                    modes.push(mode);

                    if (!isKnownCompilerMode(mode.value)) {
                        state.reportUnknownCompilerMode(mode);
                    }
                    break;
                }

                case AstKind.Module: {
                    const module = child as ModuleNode;
                    const configuration = createModuleConfiguration(modes);

                    state.moduleConfigurations.set(module, configuration);

                    const scope = state.scopes.get(module);
                    if (scope) {
                        state.moduleConfigurationsByScope.set(scope, configuration);
                    }

                    modes.length = 0;
                    break;
                }
            }
        }
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

        if (node.kind === AstKind.DclDeclaration) {
            if (!scope) {
                throw new Error('DCL declaration outside semantic scope.');
            }

            this.indexDclDeclaration(node as DclDeclarationNode, scope, state);
        }

        for (const child of node.getChildren()) {
            this.indexNode(child, scope, state);
        }
    }

    private indexTypeDeclaration(node: TypeDeclarationNode, scope: Scope, state: SemanticAnalysisState): void {
        const declaration: IndexedDeclaration = {
            kind: SymbolKind.Type,
            name: node.name
        };

        const existingDeclaration = state.declarationIndex.index(scope, declaration);

        const symbol: TypeSymbol = {
            kind: SymbolKind.Type,
            name: node.name
        };

        state.typeSymbols.set(node, symbol);

        if (existingDeclaration) {
            if (existingDeclaration.kind === SymbolKind.Type) {
                state.reportDuplicateType(node.name, existingDeclaration);
            } else {
                state.reportDuplicateDeclaration(node.name, existingDeclaration);
            }

            return;
        }

        const existingType = state.typeIndex.index(scope, symbol);

        if (existingType) {
            throw new Error(`TYPE '${node.name.value}' was accepted by the declaration index but already exists in the type index.`);
        }

        (scope as MutableScope).symbols.push(symbol);
    }

    private indexDclDeclaration(node: DclDeclarationNode, scope: Scope, state: SemanticAnalysisState): void {
        for (const sentence of node.declarations) {
            for (const identifier of sentence.identifiers.identifiers) {
                const declaration: IndexedDeclaration = {
                    kind: SymbolKind.DataObject,
                    name: identifier
                };

                const existing = state.declarationIndex.index(scope, declaration);

                if (existing) {
                    state.reportDuplicateDeclaration(identifier, existing);
                }
            }
        }
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

            case AstKind.DclDeclaration:
                if (!environment) {
                    throw new Error('DCL declaration without semantic environment.');
                }

                return this.analyzeDclDeclaration(node as DclDeclarationNode, environment, state);

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

    private analyzeDclDeclaration(
        node: DclDeclarationNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        let current = environment;

        for (const sentence of node.declarations) {
            current = this.analyzeDclDeclarationSentence(sentence, current, state);
        }

        return current;
    }

    private analyzeDclDeclarationSentence(
        node: DclDeclarationSentenceNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (!node.attribute) {
            return environment;
        }

        switch (node.attribute.kind) {
            case AstKind.ProblemDataAttribute:
                return this.analyzeProblemDataDeclaration(
                    node,
                    node.attribute as ProblemDataAttributeNode,
                    environment,
                    state
                );

            case AstKind.SemaAttribute:
                return this.analyzeSynchronizationDeclaration(
                    node,
                    node.attribute as SemaAttributeNode,
                    { kind: SemanticTypeKind.Sema },
                    'SEMA',
                    environment,
                    state
                );

            case AstKind.BoltAttribute:
                return this.analyzeSynchronizationDeclaration(
                    node,
                    node.attribute as BoltAttributeNode,
                    { kind: SemanticTypeKind.Bolt },
                    'BOLT',
                    environment,
                    state
                );

            default:
                return environment;
        }
    }

    private analyzeProblemDataDeclaration(
        node: DclDeclarationSentenceNode,
        attribute: ProblemDataAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (!attribute.type) {
            return environment;
        }

        let type = state.typeResolver.resolve(attribute.type, environment);

        if (!type) {
            return environment;
        }

        if (node.dimension) {
            type = state.resolveDimensionedType(type, node.dimension, environment);

            if (!type) {
                return environment;
            }
        }

        const initialization = attribute.initialization;
        const resolvedInitialization = initialization
            ? state.initializationResolver.resolve(
                initialization,
                type,
                node.identifiers.identifiers.length,
                environment
            )
            : undefined;

        return this.introduceDataObjects(
            node,
            type,
            attribute.inv !== undefined,
            environment,
            state,
            (symbol, index, current) => {
                resolvedInitialization?.apply(symbol, index, current);
            }
        );
    }

    private analyzeSynchronizationDeclaration(
        node: DclDeclarationSentenceNode,
        attribute: SemaAttributeNode | BoltAttributeNode,
        baseType: SemanticType,
        typeName: 'SEMA' | 'BOLT',
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.keyword, typeName);
        }

        let type = baseType;

        if (node.dimension) {
            const dimensionedType = state.resolveDimensionedType(type, node.dimension, environment);

            if (!dimensionedType) {
                return environment;
            }

            type = dimensionedType;
        }

        let semaPresetValues: readonly FixedConstantValue[] | undefined;
        let semaValuesPerSymbol: number | undefined;

        if (attribute.kind === AstKind.SemaAttribute) {
            const semaAttribute = attribute as SemaAttributeNode;

            if (semaAttribute.presetKeyword) {
                semaPresetValues = this.evaluateSemaPresetValues(
                    semaAttribute,
                    environment,
                    state
                );

                const elementsPerSymbol = this.semanticElementCount(type);
                const expectedValues = elementsPerSymbol * BigInt(node.identifiers.identifiers.length);

                if (BigInt(semaAttribute.presetValues.length) !== expectedValues) {
                    state.reportSemaPresetElementCount(
                        semaAttribute.presetKeyword,
                        expectedValues,
                        semaAttribute.presetValues.length
                    );
                    semaPresetValues = undefined;
                } else {
                    semaValuesPerSymbol = Number(elementsPerSymbol);
                }
            }
        }

        return this.introduceDataObjects(
            node,
            type,
            false,
            environment,
            state,
            (symbol, index) => {
                if (semaPresetValues && semaValuesPerSymbol !== undefined) {
                    const start = index * semaValuesPerSymbol;
                    state.semaPresetValues.set(
                        symbol,
                        semaPresetValues.slice(start, start + semaValuesPerSymbol)
                    );
                }
            }
        );
    }

    private evaluateSemaPresetValues(
        attribute: SemaAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): readonly FixedConstantValue[] | undefined {
        if (!attribute.presetKeyword) {
            return undefined;
        }

        const values: FixedConstantValue[] = [];
        let valid = true;

        for (const expression of attribute.presetValues) {
            const value = state.evaluateConstantFixedExpression(expression, environment);

            if (value === undefined) {
                state.reportConstantExpressionNotEvaluable(attribute.presetKeyword, 'PRESET');
                valid = false;
                continue;
            }

            if (value < BigInt(0)) {
                state.reportInvalidSemaPresetValue(attribute.presetKeyword, value);
                valid = false;
                continue;
            }

            values.push({
                kind: SemanticConstantKind.Fixed,
                value
            });
        }

        return valid ? values : undefined;
    }

    private semanticElementCount(type: SemanticType): bigint {
        if (type.kind !== SemanticTypeKind.Array) {
            return BigInt(1);
        }

        let count = BigInt(1);

        for (const dimension of type.dimensions) {
            count *= dimension.upperBound - dimension.lowerBound + BigInt(1);
        }

        return count;
    }

    private introduceDataObjects(
        node: DclDeclarationSentenceNode,
        type: SemanticType,
        assignmentProtected: boolean,
        environment: Environment,
        state: SemanticAnalysisState,
        beforeIntroduce?: (symbol: DataObjectSymbol, index: number, current: Environment) => void
    ): Environment {
        let current = environment;

        for (let index = 0; index < node.identifiers.identifiers.length; index++) {
            const identifier = node.identifiers.identifiers[index];
            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);

            if (!indexed || indexed.name !== identifier || indexed.kind !== SymbolKind.DataObject) {
                continue;
            }

            const symbol: DataObjectSymbol = {
                kind: SymbolKind.DataObject,
                name: identifier,
                type,
                assignmentProtected
            };

            state.bind(identifier, symbol);
            beforeIntroduce?.(symbol, index, current);

            (environment.scope as MutableScope).symbols.push(symbol);
            current = this.introduceSymbol(current, symbol);
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
