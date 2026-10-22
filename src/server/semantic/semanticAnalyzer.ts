// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import type { SourceValue } from '../core/sourceValue';
import type { ModuleNode } from '../ast/module/moduleNode';
import type { ShellCommandNode } from '../ast/module/shellCommandNode';
import { AlphicDationSystemDeclarationNode } from '../ast/system/declarations/alphicDationSystemDeclationNode';
import { BasicDationSystemDeclarationNode } from '../ast/system/declarations/basicDationSystemDeclarationNode';
import { InterruptSystemDeclarationNode } from '../ast/system/declarations/interruptSystemDeclarationNode';
import { TypeDeclarationNode } from '../ast/problem/declarations/typeDeclarationNode';
import { DclDeclarationNode } from '../ast/problem/declarations/dclDeclarationNode';
import { DclDeclarationSentenceNode } from '../ast/problem/declarations/dclDeclarationSentenceNode';
import { TaskDeclarationNode } from '../ast/problem/declarations/taskDeclarationNode';
import { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
import { SpcProcedureAttributeNode } from '../ast/problem/specifications/spcProcedureAttributeNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import { RepetitionNode } from '../ast/problem/statements/repetitionNode';
import { ProblemDataAttributeNode } from '../ast/problem/declarations/problemDataAttributeNode';
import { SemaAttributeNode } from '../ast/problem/declarations/semaAttributeNode';
import { BoltAttributeNode } from '../ast/problem/declarations/boltAttributeNode';
import type { GlobalAttributeNode } from '../ast/problem/declarations/globalAttributeNode';
import { SpcTaskAttributeNode } from "../ast/problem/specifications/spcTaskAttributeNode";
import { SpcDeclarationNode } from '../ast/problem/specifications/spcDeclarationNode';
import { SpcDeclarationSentenceNode } from '../ast/problem/specifications/spcDeclarationSentenceNode';
import { SpcProblemDataAttributeNode } from '../ast/problem/specifications/spcProblemDataAttributeNode';
import { SpcSemaAttributeNode } from '../ast/problem/specifications/spcSemaAttributeNode';
import { SpcBoltAttributeNode } from '../ast/problem/specifications/spcBoltAttributeNode';
import { SpcDationAttributeNode } from '../ast/problem/specifications/spcDationAttributeNode';
import { SpcInterruptAttributeNode } from '../ast/problem/specifications/spcInterruptAttributeNode';
import type { OneIdentifierOrListNode } from '../ast/problem/identifiers/oneIdentifierOrListNode';
import type { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import type { DurationConstantNode } from '../ast/problem/expressions/durationConstantNode';
import type { SignedConstantExpressionNode } from '../ast/problem/expressions/signedConstantExpressionNode';
import { DimensionAttributeNode } from '../ast/problem/dimensions/dimensionAttributeNode';
import type { VirtualDimensionListNode } from '../ast/problem/dimensions/virtualDimensionListNode';
import { DimensionBoundariesNode } from '../ast/problem/dimensions/dimensionBoundariesNode';
import type { Environment } from './environment';
import { SemanticContext } from './semanticContext';
import { validateShellProcedures } from './shellProcedureValidator';
import { DEFAULT_TIME_RESOLUTION } from './moduleConfiguration';
import { resolveModuleControls } from './moduleControlResolver';
import type { ModuleConfiguration, TimeResolution } from './moduleConfiguration';
import { SemanticConstantKind } from './semanticConstantValue';
import type {
    ClockConstantValue,
    DurationConstantValue,
    FixedConstantValue,
    SemanticConstantValue,
    SemanticInitialValue,
    TimeConstantValue
} from './semanticConstantValue';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import {
    SemanticDiagnosticCode,
    SemanticDiagnosticSeverity
} from './semanticDiagnostic';
import {
    DationClass,
    DationDirection,
    SemanticType,
    ProcedureType,
    SemanticTypeKind
} from './semanticType';
import {
    DataObjectSymbol,
    GlobalSymbolAttribute,
    LoopControlVariableSymbol,
    ParameterSymbol,
    ProcedureSymbol,
    SemanticSymbol,
    TaskSymbol,
    TypeSymbol
} from './symbol';
import { SymbolKind } from './symbolKind';
import { resolveSymbol } from './symbolResolver';
import { lookupBuiltin } from './builtins/builtinCatalog';
import { semanticTypeEquals, procedureSignaturesEqual, isProcedureSignatureResolved } from './semanticTypeComparison';
import type { BuiltinDefinition } from './builtins/builtinSignature';
import { acceptsBuiltinArity, builtinExpectedArity } from './builtins/builtinSignature';
import {
    Scope,
    ScopeKind
} from './scope';
import { DeclarationIndex, IndexedDeclaration } from './declarationIndex';
import type { LocalSpecificationRelation } from './localSpecificationRelation';
import { TypeIndex } from './typeIndex';
import { SystemObjectDeclaration, SystemObjectIndex } from './systemObjectIndex';
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
    readonly builtinBindings = new Map<SourceValue<string>, BuiltinDefinition>();
    readonly diagnostics: SemanticDiagnostic[] = [];
    readonly constantFixedExpressionValues = new Map<ConstantFixedExpressionNode, FixedConstantValue>();
    readonly constantFixedValues = new Map<AstNode, FixedConstantValue>();
    readonly namedConstantValues = new Map<DataObjectSymbol, SemanticConstantValue>();
    readonly initialValues = new Map<DataObjectSymbol, SemanticInitialValue>();
    readonly timeConstantValues = new Map<AstNode, TimeConstantValue>();
    readonly semaPresetValues = new Map<DataObjectSymbol, readonly FixedConstantValue[]>();
    readonly moduleConfigurations = new Map<ModuleNode, ModuleConfiguration>();
    readonly shellCommandsByProcedure = new Map<ProcedureDeclarationNode, ShellCommandNode>();
    readonly moduleConfigurationsByScope = new Map<Scope, ModuleConfiguration>();
    readonly declarationIndex = new DeclarationIndex();
    readonly typeIndex = new TypeIndex();
    readonly systemObjectIndex = new SystemObjectIndex();
    readonly scopes = new Map<AstNode, Scope>();
    readonly typeSymbols = new Map<TypeDeclarationNode, TypeSymbol>();
    readonly taskSymbols = new Map<TaskDeclarationNode, TaskSymbol>();
    readonly procedureSymbols = new Map<ProcedureDeclarationNode, ProcedureSymbol>();
    readonly localSpecificationRelations = new Map<SourceValue<string>, LocalSpecificationRelation>();
    readonly parameterSymbols = new Map<SourceValue<string>, ParameterSymbol>();
    readonly loopControlSymbols = new Map<RepetitionNode, LoopControlVariableSymbol>();
    readonly loopControlScopes = new Map<SourceValue<string>, Scope>();
    readonly rejectedLoopControlVariables = new Set<SourceValue<string>>();
    readonly dataDeclarationScopes = new Map<SourceValue<string>, Scope>();
    readonly rejectedDataDeclarations = new Set<SourceValue<string>>();
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
            this.initialValues,
            this.constantFixedValues,
            this.timeConstantValues,
            this.semaPresetValues,
            this.moduleConfigurations,
            this.shellCommandsByProcedure,
            this.builtinBindings,
            this.localSpecificationRelations
        );
    }

    bind(source: SourceValue<string>, symbol: SemanticSymbol): void {
        this.bindings.set(source, symbol);
    }

    linkLocalSpecification(
        kind: 'PROC' | 'TASK',
        specification: SourceValue<string>,
        definition: SourceValue<string>
    ): void {
        const relation: LocalSpecificationRelation = { kind, specification, definition };
        this.localSpecificationRelations.set(specification, relation);
        this.localSpecificationRelations.set(definition, relation);
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

    resolveVirtualDimensionedType(
        elementType: SemanticType,
        dimensions: VirtualDimensionListNode
    ): SemanticType {
        return {
            kind: SemanticTypeKind.VirtualArray,
            elementType,
            rank: dimensions.rank
        };
    }

    registerNamedConstant(symbol: DataObjectSymbol, value: SemanticConstantValue): void {
        this.namedConstantValues.set(symbol, value);
    }

    registerInitialValues(symbol: DataObjectSymbol, value: SemanticInitialValue): void {
        this.initialValues.set(symbol, value);
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

    resolveReferenceInitializer(
        identifier: SourceValue<string>,
        expectedTargetType: SemanticType | undefined,
        environment: Environment
    ): DataObjectSymbol | TaskSymbol | ProcedureSymbol | undefined {
        const symbol = resolveSymbol(environment, identifier.value);

        if (!symbol) {
            this.reportUnknownIdentifier(identifier);
            return undefined;
        }

        this.bind(identifier, symbol);

        // A TASK is a referenceable object, but not a data object.
        if (symbol.kind === SymbolKind.Task) {
            if (expectedTargetType?.kind !== SemanticTypeKind.Task) {
                this.reportInvalidInitialization(identifier, 'REF');
                return undefined;
            }

            return symbol;
        }

        if (symbol.kind === SymbolKind.Procedure) {
            if (expectedTargetType?.kind !== SemanticTypeKind.Procedure
                || !symbol.signature || !semanticTypeEquals(expectedTargetType, symbol.signature)) {
                this.reportInvalidInitialization(identifier, 'REF PROC');
                return undefined;
            }
            return symbol;
        }

        if (symbol.kind !== SymbolKind.DataObject) {
            this.reportInvalidInitialization(identifier, 'REF');
            return undefined;
        }

        if (expectedTargetType && !semanticTypeEquals(expectedTargetType, symbol.type)) {
            this.reportInvalidInitialization(identifier, 'REF');
            return undefined;
        }

        return symbol;
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

    replaceSymbolBindings(previous: SemanticSymbol, replacement: SemanticSymbol): void {
        for (const [source, symbol] of this.bindings) {
            if (symbol === previous) {
                this.bindings.set(source, replacement);
            }
        }
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

    reportSecondModuleInTranslationUnit(keyword: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.MultipleModulesInTranslationUnit,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: 'RTOS-UH erlaubt nur ein MODULE pro Übersetzungseinheit.'
        });
    }

    reportDeclarationAfterProcedureOrTask(keyword: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DeclarationAfterProcedureOrTask,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: 'Eine DCL-Deklaration auf Modulebene muss vor der ersten PROC- oder TASK-Definition stehen.'
        });
    }

    reportDuplicateDeclaration(name: SourceValue<string>, existing: IndexedDeclaration): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DuplicateDeclaration,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Der Bezeichner '${name.value}' ist in diesem Gültigkeitsbereich bereits vereinbart.`,
            relatedLocations: [{
                location: existing.name.location,
                message: 'Die erste Deklaration befindet sich hier.'
            }]
        });
    }

    reportMissingLocalDefinition(name: SourceValue<string>, kind: 'PROC' | 'TASK'): void {
        this.diagnostics.push({
            code: kind === 'PROC'
                ? SemanticDiagnosticCode.MissingLocalProcedureDefinition
                : SemanticDiagnosticCode.MissingLocalTaskDefinition,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Die lokale SPC-Spezifikation '${name.value}' erwartet eine ${kind}-Definition `
                + 'im selben Modul (MISSING PROC/TASK).'
        });
    }

    reportLocalProcedureSpecificationMismatch(
        definition: SourceValue<string>,
        specification: SourceValue<string>
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.LocalProcedureSpecificationMismatch,
            severity: SemanticDiagnosticSeverity.Error,
            location: definition.location,
            message: `Die Signatur von PROC '${definition.value}' stimmt nicht mit der `
                + 'vorherigen SPC-Spezifikation überein.',
            relatedLocations: [{
                location: specification.location,
                message: 'Die vorherige SPC-Spezifikation befindet sich hier.'
            }]
        });
    }

    procedureSignaturesConflict(specification: ProcedureType, definition: ProcedureType): boolean {
        if (!isProcedureSignatureResolved(specification)
            || !isProcedureSignatureResolved(definition)) {
            return false;
        }
        return !procedureSignaturesEqual(specification, definition);
    }

    reportInvalidCallTarget(name: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidCallTarget,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `'${name.value}' ist keine aufrufbare Prozedur.`
        });
    }

    reportInvalidBuiltinCallArity(name: SourceValue<string>, expected: string, actual: number): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidCallArity,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Einbaufunktion '${name.value}' erwartet ${expected} Aktualparameter, erhalten: ${actual}.`
        });
    }

    reportInvalidCallArity(name: SourceValue<string>, expected: number, actual: number): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidCallArity,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Prozedur '${name.value}' erwartet ${expected} Aktualparameter, erhalten: ${actual}.`
        });
    }

    reportDataSpecificationRequiresGlobal(name: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.DataSpecificationRequiresGlobal,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Die SPC-Spezifikation '${name.value}' für ein Datenobjekt benötigt in RTOS-UH GLOBAL.`
        });
    }

    reportMissingDeclarationForSpecification(name: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.MissingDeclarationForSpecification,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Für die lokale SPC-Spezifikation '${name.value}' fehlt eine DCL-Deklaration `
                + 'im selben Modul.'
        });
    }

    reportSystemSpecificationMismatch(
        name: SourceValue<string>,
        systemDeclaration: SystemObjectDeclaration
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.SystemSpecificationMismatch,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Die SPC-Spezifikation '${name.value}' stimmt nicht mit der SYSTEM-Vereinbarung überein.`,
            relatedLocations: [{
                location: systemDeclaration.name.location,
                message: 'Die zugehörige SYSTEM-Vereinbarung befindet sich hier.'
            }]
        });
    }

    reportMissingSystemDeclarationForSpecification(name: SourceValue<string>, typeName: string): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.MissingSystemDeclarationForSpecification,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Für die lokale ${typeName}-Spezifikation '${name.value}' fehlt eine Vereinbarung im SYSTEM-Teil.`
        });
    }

    reportInvalidDeclarationScope(keyword: SourceValue<string>, typeName: string): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidDeclarationScope,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `${typeName}-Variablen dürfen nur auf Modulebene vereinbart werden.`
        });
    }

    reportGlobalDeclarationOutsideModule(keyword: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.GlobalDeclarationOutsideModule,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: 'Das GLOBAL-Attribut ist nur für Vereinbarungen auf Modulebene zulässig.'
        });
    }

    reportInvalidTaskPriority(
        source: SourceValue<string>,
        value: bigint
    ): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvalidTaskPriority,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Die Task-Priorität ${value} liegt außerhalb des zulässigen Bereichs 1..32767.`
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

    reportInvariantWithoutInitialization(identifier: SourceValue<string>): void {
        this.diagnostics.push({
            code: SemanticDiagnosticCode.InvariantWithoutInitialization,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `Das INV-Objekt '${identifier.value}' benötigt ein INIT; nach der Deklaration kann ihm `
                + 'kein Wert mehr zugewiesen werden.'
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
        this.validateDataDeclarationShadowing(state);
        this.validateLoopControlVariables(state);
        this.collectModuleConfigurations(root, state);
        this.validateModuleDeclarationOrder(root, state);
        this.validateSingleModulePerTranslationUnit(root, state);
        this.analyzeNode(root, undefined, state);
        this.validateShellModules(root, state);
        state.finalize();

        return state.createContext();
    }

    /** The parser retains all modules for recovery; RTOS-UH compiles one per source file. */
    private validateSingleModulePerTranslationUnit(root: AstNode, state: SemanticAnalysisState): void {
        if (root.kind !== AstKind.TranslationUnit) return;

        let seenModule = false;
        for (const node of root.getChildren()) {
            if (node.kind !== AstKind.Module) continue;
            if (seenModule) {
                state.reportSecondModuleInTranslationUnit((node as ModuleNode).keyword);
            }
            seenModule = true;
        }
    }

    /**
     * Check the RTOS-UH module-level declaration order independently of parsing
     * and indexing. Keeping all nodes in the AST allows further diagnostics and
     * stable editor navigation even after an out-of-order DCL.
     */
    private validateModuleDeclarationOrder(root: AstNode, state: SemanticAnalysisState): void {
        const modules = root.kind === AstKind.Module
            ? [root as ModuleNode]
            : root.kind === AstKind.TranslationUnit
                ? root.getChildren().filter((child): child is ModuleNode => child.kind === AstKind.Module)
                : [];

        for (const module of modules) {
            const problemPart = module.getChildren().find(child => child.kind === AstKind.ProblemPart);
            if (!problemPart) continue;

            let definitionsStarted = false;
            for (const child of problemPart.getChildren()) {
                if (child.kind === AstKind.ProcedureDeclaration || child.kind === AstKind.TaskDeclaration) {
                    definitionsStarted = true;
                } else if (definitionsStarted && child.kind === AstKind.DclDeclaration) {
                    state.reportDeclarationAfterProcedureOrTask((child as DclDeclarationNode).keyword);
                }
            }
        }
    }

    private validateShellModules(root: AstNode, state: SemanticAnalysisState): void {
        const modules = root.kind === AstKind.Module
            ? [root as ModuleNode]
            : root.getChildren().filter((child): child is ModuleNode => child.kind === AstKind.Module);

        for (const module of modules) {
            const scope = state.scopes.get(module);
            const acceptedProcedures = new Map<ProcedureDeclarationNode, ProcedureSymbol>();
            if (scope) {
                for (const [node, symbol] of state.procedureSymbols) {
                    if (state.declarationIndex.lookupInScope(scope, node.name.value)?.name === node.name) {
                        acceptedProcedures.set(node, symbol);
                    }
                }
            }
            const result = validateShellProcedures(module, acceptedProcedures);
            state.diagnostics.push(...result.diagnostics);
            for (const [source, symbol] of result.bindings) {
                state.bind(source, symbol);
            }
            for (const [procedure, command] of result.commandsByProcedure) {
                state.shellCommandsByProcedure.set(procedure, command);
            }
        }
    }

    private collectModuleConfigurations(root: AstNode, state: SemanticAnalysisState): void {
        const resolved = resolveModuleControls(root);
        state.diagnostics.push(...resolved.diagnostics);

        for (const [module, configuration] of resolved.configurations) {
            state.moduleConfigurations.set(module, configuration);
            const scope = state.scopes.get(module);
            if (scope) state.moduleConfigurationsByScope.set(scope, configuration);
        }
    }

    private indexNode(node: AstNode, parentScope: Scope | undefined, state: SemanticAnalysisState): void {
        if (node.kind === AstKind.ProcedureDeclaration) {
            if (!parentScope) {
                throw new Error('PROC declaration outside semantic scope.');
            }
            this.indexProcedureDeclaration(node as ProcedureDeclarationNode, parentScope, state);
        }

        if (node.kind === AstKind.TaskDeclaration) {
            if (!parentScope) {
                throw new Error('TASK declaration outside semantic scope.');
            }

            this.indexTaskDeclaration(
                node as TaskDeclarationNode,
                parentScope,
                state
            );
        }

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

        if (node.kind === AstKind.ProcedureDeclaration && scope) {
            this.indexFormalParameters(node as ProcedureDeclarationNode, scope, state);
        }

        if (node.kind === AstKind.Repetition) {
            if (!scope) {
                throw new Error('REPEAT declaration outside semantic scope.');
            }

            this.indexLoopControlVariable(node as RepetitionNode, scope, state);
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

        if (node.kind === AstKind.AlphicDationSystemDeclaration
            || node.kind === AstKind.BasicDationSystemDeclaration
            || node.kind === AstKind.InterruptSystemDeclaration) {
            if (!scope) {
                throw new Error('SYSTEM declaration outside semantic scope.');
            }

            this.indexSystemObject(node, scope, state);
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
            name: node.name,
            definition: node.name
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
            throw new Error(
                `TYPE '${node.name.value}' was accepted by the declaration index but already exists in the type index.`
            );
        }

        (scope as MutableScope).symbols.push(symbol);
    }

    private indexDclDeclaration(node: DclDeclarationNode, scope: Scope, state: SemanticAnalysisState): void {
        for (const sentence of node.declarations) {
            for (const identifier of sentence.identifiers.identifiers) {
                const declaration: IndexedDeclaration = { kind: SymbolKind.DataObject, name: identifier };
                const existing = state.declarationIndex.index(scope, declaration);

                if (existing) {
                    state.reportDuplicateDeclaration(identifier, existing);
                    continue;
                }

                state.dataDeclarationScopes.set(identifier, scope);
            }
        }
    }

    private indexTaskDeclaration(
        node: TaskDeclarationNode,
        scope: Scope,
        state: SemanticAnalysisState
    ): void {
        const declaration: IndexedDeclaration = {
            kind: SymbolKind.Task,
            name: node.name
        };

        const existing = state.declarationIndex.index(scope, declaration);

        const symbol: TaskSymbol = {
            kind: SymbolKind.Task,
            name: node.name,
            definition: node.name,
            global: this.globalSymbolAttribute(node.global)
        };

        state.taskSymbols.set(node, symbol);

        if (existing) {
            state.reportDuplicateDeclaration(node.name, existing);
            return;
        }

        (scope as MutableScope).symbols.push(symbol);
    }

    private indexProcedureDeclaration(
        node: ProcedureDeclarationNode,
        scope: Scope,
        state: SemanticAnalysisState
    ): void {
        const declaration: IndexedDeclaration = { kind: SymbolKind.Procedure, name: node.name };
        const existing = state.declarationIndex.index(scope, declaration);
        const symbol: ProcedureSymbol = {
            kind: SymbolKind.Procedure,
            name: node.name,
            definition: node.name,
            global: this.globalSymbolAttribute(node.global)
        };
        state.procedureSymbols.set(node, symbol);
        if (existing) {
            state.reportDuplicateDeclaration(node.name, existing);
        } else {
            (scope as MutableScope).symbols.push(symbol);
        }
    }

    private indexFormalParameters(
        node: ProcedureDeclarationNode,
        scope: Scope,
        state: SemanticAnalysisState
    ): void {
        for (const parameter of node.parameters) {
            for (const name of parameter.identifiers.identifiers) {
                const kind = parameter.identKeyword
                    ? SymbolKind.Identification : SymbolKind.Parameter;
                const existing = state.declarationIndex.index(scope, { kind, name });
                if (existing) {
                    state.reportDuplicateDeclaration(name, existing);
                    continue;
                }
                const symbol: ParameterSymbol = {
                    kind, name, definition: name,
                    byIdentification: !!parameter.identKeyword,
                    assignmentProtected: !!parameter.invKeyword
                };
                state.parameterSymbols.set(name, symbol);
                (scope as MutableScope).symbols.push(symbol);
            }
        }
    }

    private indexLoopControlVariable(
        node: RepetitionNode,
        scope: Scope,
        state: SemanticAnalysisState
    ): void {
        const identifier = node.forClause?.variable;
        if (!identifier) {
            return;
        }

        const declaration: IndexedDeclaration = {
            kind: SymbolKind.LoopControlVariable,
            name: identifier
        };
        const existing = state.declarationIndex.index(scope, declaration);
        if (existing) {
            state.reportDuplicateDeclaration(identifier, existing);
            return;
        }

        const symbol: LoopControlVariableSymbol = {
            kind: SymbolKind.LoopControlVariable,
            name: identifier,
            definition: identifier,
            type: { kind: SemanticTypeKind.Fixed, precision: undefined }
        };

        state.loopControlSymbols.set(node, symbol);
        state.loopControlScopes.set(identifier, scope);
        (scope as MutableScope).symbols.push(symbol);
    }

    private validateLoopControlVariables(state: SemanticAnalysisState): void {
        // A FOR variable is implicitly declared in the repetition scope. It must not
        // redeclare a name from an enclosing scope, just like an ordinary local DCL.
        for (const [identifier, scope] of state.loopControlScopes) {
            const outer = state.declarationIndex.lookupInOuterScopes(scope, identifier.value);
            if (!outer) {
                continue;
            }

            state.reportDuplicateDeclaration(identifier, outer);
            state.rejectedLoopControlVariables.add(identifier);
        }
    }

    private validateDataDeclarationShadowing(state: SemanticAnalysisState): void {
        /*
         * RTOS-UH rejects ordinary DCL shadowing across scope boundaries.
         * Keep this rule on DCL declarations instead of making DeclarationIndex
         * globally shadowing-free: procedure parameters may later shadow outer
         * names, while a DCL in the same or a nested scope must still conflict
         * with that parameter. Labels use a separate namespace.
         */
        for (const [identifier, scope] of state.dataDeclarationScopes) {
            const outer = state.declarationIndex.lookupInOuterScopes(
                scope,
                identifier.value
            );

            if (!outer) {
                continue;
            }

            state.reportDuplicateDeclaration(identifier, outer);
            state.rejectedDataDeclarations.add(identifier);
        }
    }

    private indexSystemObject(node: AstNode, scope: Scope, state: SemanticAnalysisState): void {
        let declaration: SystemObjectDeclaration;

        switch (node.kind) {
            case AstKind.AlphicDationSystemDeclaration: {
                const dation = node as AlphicDationSystemDeclarationNode;
                declaration = {
                    name: dation.name,
                    type: {
                        kind: SemanticTypeKind.Dation,
                        direction: this.systemDationDirection(dation.direction.value),
                        dationClass: 'ALPHIC'
                    }
                };
                break;
            }

            case AstKind.BasicDationSystemDeclaration: {
                const dation = node as BasicDationSystemDeclarationNode;
                declaration = {
                    name: dation.name,
                    type: {
                        kind: SemanticTypeKind.Dation,
                        direction: this.systemDationDirection(dation.direction.value),
                        dationClass: 'BASIC'
                    }
                };
                break;
            }

            case AstKind.InterruptSystemDeclaration: {
                const interrupt = node as InterruptSystemDeclarationNode;
                declaration = {
                    name: interrupt.name,
                    type: { kind: SemanticTypeKind.Interrupt }
                };
                break;
            }

            default:
                throw new Error(`Unexpected SYSTEM object AST kind: ${node.kind}`);
        }

        const existing = state.systemObjectIndex.index(scope, declaration);
        if (existing) {
            state.reportDuplicateDeclaration(declaration.name, { kind: SymbolKind.DataObject, name: existing.name });
        }
    }

    private systemDationDirection(direction: string): DationDirection {
        switch (direction) {
            case '<-':
                return 'IN';
            case '->':
                return 'OUT';
            default:
                return 'INOUT';
        }
    }

    private analyzeNode(
        node: AstNode,
        environment: Environment | undefined,
        state: SemanticAnalysisState
    ): Environment | undefined {
        if (node.kind === AstKind.ProcedureDeclaration) {
            if (!environment) {
                throw new Error('PROC declaration without semantic environment.');
            }
            return this.analyzeProcedureDeclaration(
                node as ProcedureDeclarationNode, environment, state
            );
        }

        if (node.kind === AstKind.TaskDeclaration) {
            if (!environment) {
                throw new Error('TASK declaration without semantic environment.');
            }

            return this.analyzeTaskDeclaration(
                node as TaskDeclarationNode,
                environment,
                state
            );
        }

        if (node.kind === AstKind.CallStatement) {
            if (!environment) throw new Error('CALL without semantic environment.');
            return this.analyzeCallStatement(node as CallStatementNode, environment, state);
        }

        if (node.kind === AstKind.Repetition) {
            if (!environment) {
                throw new Error('REPEAT statement without semantic environment.');
            }

            return this.analyzeRepetition(node as RepetitionNode, environment, state);
        }

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

            case AstKind.SpcDeclaration:
                if (!environment) {
                    throw new Error('SPC specification without semantic environment.');
                }

                return this.analyzeSpcDeclaration(node as SpcDeclarationNode, environment, state);

            default:
                return this.analyzeChildren(node, environment, state);
        }
    }

    private analyzeTaskDeclaration(
        node: TaskDeclarationNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        const taskScope = state.scopes.get(node);
        if (!taskScope) {
            throw new Error(`TASK '${node.name.value}' has no semantic scope.`);
        }

        const symbol = state.taskSymbols.get(node);
        if (!symbol) {
            throw new Error(`TASK '${node.name.value}' was not indexed.`);
        }

        state.bind(node.name, symbol);

        if (node.priority) {
            const priority = state.evaluateConstantFixedExpression(
                node.priority,
                environment
            );

            if (priority !== undefined
                && (priority < BigInt(1) || priority > BigInt(32767))) {
                state.reportInvalidTaskPriority(
                    node.priorityKeyword ?? node.taskKeyword,
                    priority
                );
            }
        }

        const indexed = state.declarationIndex.lookupInScope(
            environment.scope,
            node.name.value
        );

        const accepted = indexed?.kind === SymbolKind.Task
            && indexed.name === node.name;

        const previous = this.resolveSymbolInCurrentScope(environment, node.name.value);
        let outerEnvironment = environment;

        if (accepted) {
            if (previous?.kind === SymbolKind.Task && previous.definition === node.name) {
                state.replaceSymbolBindings(previous, symbol);
                this.replaceScopeSymbol(environment.scope, previous, symbol);
            } else if (previous) {
                state.reportDuplicateDeclaration(node.name, { kind: previous.kind, name: previous.name });
            }
            outerEnvironment = this.introduceSymbol(environment, symbol);
        }

        const taskEnvironment = this.createEnvironment(
            taskScope,
            outerEnvironment
        );

        this.analyzeChildren(node, taskEnvironment, state);

        return outerEnvironment;
    }

    private analyzeProcedureDeclaration(
        node: ProcedureDeclarationNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        const scope = state.scopes.get(node);
        if (!scope) throw new Error(`PROC '${node.name.value}' has no semantic scope.`);
        let symbol = state.procedureSymbols.get(node);
        if (!symbol) throw new Error(`PROC '${node.name.value}' was not indexed.`);

        const accepted = state.declarationIndex.lookupInScope(
            environment.scope, node.name.value
        )?.name === node.name;

        // Parameter and result types resolve in the enclosing scope, before the
        // parameter names become visible in the procedure environment.
        const resultType = node.resultType
            ? state.typeResolver.resolve(node.resultType, environment)
            : undefined;
        const parameterTypes = new Map(node.parameters.map(parameter => {
            let type = state.typeResolver.resolveProcedureParameterType(parameter.type, environment);
            if (type && parameter.dimension) {
                type = { kind: SemanticTypeKind.VirtualArray as const,
                    elementType: type, rank: parameter.dimension.rank };
            }
            return [parameter, type] as const;
        }));
        const signature: ProcedureType = {
            kind: SemanticTypeKind.Procedure,
            parameters: node.parameters.flatMap(parameter =>
                parameter.identifiers.identifiers.map(() => ({
                    type: parameterTypes.get(parameter),
                    byIdentification: parameter.identKeyword !== undefined
                }))
            ),
            hasResult: node.returnsKeyword !== undefined,
            resultType,
            callingConvention: 'PEARL'
        };
        const resolved: ProcedureSymbol = { ...symbol, resultType, signature };
        state.replaceSymbolBindings(symbol, resolved);
        this.replaceScopeSymbol(environment.scope, symbol, resolved);
        symbol = resolved;
        state.procedureSymbols.set(node, resolved);
        state.bind(node.name, symbol);

        let outerEnvironment = environment;
        if (accepted) {
            const previous = this.resolveSymbolInCurrentScope(environment, node.name.value);
            if (previous?.kind === SymbolKind.Procedure && previous.definition === node.name) {
                // A preceding SPC (local or GLOBAL for a GLOBAL PROC) is not
                // a second declaration. Its signature must match the definition.
                if (previous.name !== node.name && previous.signature
                    && state.procedureSignaturesConflict(previous.signature, signature)) {
                    state.reportLocalProcedureSpecificationMismatch(node.name, previous.name);
                }
                state.replaceSymbolBindings(previous, symbol);
                // The indexed PROC symbol was already replaced with `resolved` above.
                // Do not add a second copy to scope.symbols for the SPC placeholder.
                const symbols = (environment.scope as MutableScope).symbols;
                const placeholderIndex = symbols.indexOf(previous);
                if (placeholderIndex >= 0) {
                    symbols.splice(placeholderIndex, 1);
                }
            } else if (previous) {
                state.reportDuplicateDeclaration(node.name, {
                    kind: previous.kind, name: previous.name
                });
            }
            outerEnvironment = this.introduceSymbol(environment, symbol);
        }

        let procedureEnvironment = this.createEnvironment(scope, outerEnvironment);
        for (const parameter of node.parameters) {
            const type = parameterTypes.get(parameter);
            for (const name of parameter.identifiers.identifiers) {
                const indexed = state.declarationIndex.lookupInScope(scope, name.value);
                if (indexed?.name !== name) continue;
                const original = state.parameterSymbols.get(name);
                if (!original) continue;
                const resolved: ParameterSymbol = { ...original, type };
                state.parameterSymbols.set(name, resolved);
                this.replaceScopeSymbol(scope, original, resolved);
                state.bind(name, resolved);
                procedureEnvironment = this.introduceSymbol(procedureEnvironment, resolved);
            }
        }
        let current: Environment | undefined = procedureEnvironment;
        for (const child of node.body) {
            current = this.analyzeNode(child, current, state);
        }
        return outerEnvironment;
    }

    private analyzeCallStatement(
        node: CallStatementNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (!node.target) return environment;
        const symbol = resolveSymbol(environment, node.target.value);
        if (!symbol) {
            const builtin = lookupBuiltin(node.target.value);
            if (builtin) {
                state.builtinBindings.set(node.target, builtin);
                if (builtin.category !== 'procedure') {
                    state.reportInvalidCallTarget(node.target);
                } else if (!builtin.signatures.some(signature =>
                    acceptsBuiltinArity(signature, node.argumentsList?.length ?? 0))) {
                    state.reportInvalidBuiltinCallArity(
                        node.target, builtinExpectedArity(builtin), node.argumentsList?.length ?? 0
                    );
                }
                return environment;
            }
            // Forward references and general expression names will be resolved later.
            return environment;
        }
        state.bind(node.target, symbol);
        let signature: ProcedureType | undefined;
        if (symbol.kind === SymbolKind.Procedure) {
            signature = symbol.signature;
        } else if (symbol.kind === SymbolKind.DataObject
            && symbol.type.kind === SemanticTypeKind.Reference
            && symbol.type.target.kind === SemanticTypeKind.Procedure) {
            signature = symbol.type.target;
        } else {
            state.reportInvalidCallTarget(node.target);
            return environment;
        }
        const actualCount = node.argumentsList?.length ?? 0;
        if (signature && signature.parameters.length !== actualCount) {
            state.reportInvalidCallArity(node.target, signature.parameters.length, actualCount);
        }
        return environment;
    }

    private analyzeRepetition(
        node: RepetitionNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        const scope = state.scopes.get(node);
        if (!scope) {
            throw new Error('REPEAT statement has no semantic scope.');
        }

        const innerEnvironment = this.createEnvironment(scope, environment);
        const symbol = state.loopControlSymbols.get(node);
        const identifier = node.forClause?.variable;
        const accepted = symbol && identifier
            && !state.rejectedLoopControlVariables.has(identifier);

        if (accepted) {
            state.bind(identifier, symbol);
        }

        const bodyEnvironment = accepted
            ? this.introduceSymbol(innerEnvironment, symbol)
            : innerEnvironment;

        // FROM, BY and TO are evaluated before the control variable is available;
        // WHILE may refer to it. Expression ASTs will be analyzed here later.
        for (const clause of [node.forClause, node.fromClause, node.byClause, node.toClause]) {
            if (clause) {
                this.analyzeNode(clause, environment, state);
            }
        }
        if (node.whileClause) {
            this.analyzeNode(node.whileClause, bodyEnvironment, state);
        }

        let current: Environment | undefined = bodyEnvironment;
        for (const child of node.body) {
            current = this.analyzeNode(child, current, state);
        }

        // Declarations from a repetition must never escape to the enclosing scope.
        return environment;
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

        if (attribute.global && environment.scope.kind !== ScopeKind.Module) {
            state.reportGlobalDeclarationOutsideModule(attribute.global.keyword);
        }

        if (attribute.inv && !attribute.initialization) {
            for (const identifier of node.identifiers.identifiers) {
                state.reportInvariantWithoutInitialization(identifier);
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

        return this.introduceDeclaredDataObjects(
            node.identifiers,
            type,
            attribute.inv !== undefined,
            this.globalSymbolAttribute(attribute.global),
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

        return this.introduceDeclaredDataObjects(
            node.identifiers,
            type,
            false,
            this.globalSymbolAttribute(attribute.global),
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

    private analyzeSpcDeclaration(
        node: SpcDeclarationNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        let current = environment;

        for (const sentence of node.specifications) {
            current = this.analyzeSpcDeclarationSentence(sentence, current, state);
        }

        return current;
    }

    private analyzeSpcDeclarationSentence(
        node: SpcDeclarationSentenceNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (!node.attribute) {
            return environment;
        }

        switch (node.attribute.kind) {
            case AstKind.SpcProcedureAttribute:
                return this.analyzeProcedureSpecification(
                    node, node.attribute as SpcProcedureAttributeNode, environment, state
                );

            case AstKind.SpcTaskAttribute:
                return this.analyzeTaskSpecification(
                    node, node.attribute as SpcTaskAttributeNode, environment, state
                );

            case AstKind.SpcProblemDataAttribute:
                return this.analyzeProblemDataSpecification(
                    node,
                    node.attribute as SpcProblemDataAttributeNode,
                    environment,
                    state
                );

            case AstKind.SpcSemaAttribute:
                return this.analyzeSynchronizationSpecification(
                    node,
                    node.attribute as SpcSemaAttributeNode,
                    { kind: SemanticTypeKind.Sema },
                    'SEMA',
                    environment,
                    state
                );

            case AstKind.SpcBoltAttribute:
                return this.analyzeSynchronizationSpecification(
                    node,
                    node.attribute as SpcBoltAttributeNode,
                    { kind: SemanticTypeKind.Bolt },
                    'BOLT',
                    environment,
                    state
                );

            case AstKind.SpcDationAttribute:
                return this.analyzeDationSpecification(
                    node,
                    node.attribute as SpcDationAttributeNode,
                    environment,
                    state
                );

            case AstKind.SpcInterruptAttribute:
                return this.analyzeInterruptSpecification(
                    node,
                    node.attribute as SpcInterruptAttributeNode,
                    environment,
                    state
                );

            default:
                return environment;
        }
    }

    private analyzeProcedureSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcProcedureAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.signature.keyword, 'PROC/ENTRY');
        }
        const signature = state.typeResolver.resolveProcedureSignature(attribute.signature, environment);
        let current = environment;
        for (const identifier of node.identifiers.identifiers) {
            const previous = this.resolveSymbolInCurrentScope(current, identifier.value);
            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);
            const localSpecification = !attribute.global;
            // An SPC with GLOBAL can also precede a GLOBAL PROC defined in this
            // very module (confirmed by RTOS-UH compiler probe C08). The index
            // contains definitions from the entire module, not SPC placeholders.
            // A GLOBAL SPC without such a definition remains an external symbol.
            const indexedProcedure = indexed?.kind === SymbolKind.Procedure
                ? [...state.procedureSymbols.values()].find(symbol => symbol.name === indexed.name)
                : undefined;
            const forwardDefinition = indexedProcedure &&
                (localSpecification || (attribute.global?.moduleName === undefined
                    && indexedProcedure.global !== undefined))
                    ? indexedProcedure.name : undefined;

            if (previous || (indexed && !forwardDefinition)) {
                state.reportDuplicateDeclaration(identifier, previous
                    ? { kind: previous.kind, name: previous.name } : indexed!);
                continue;
            }

            if (localSpecification && !forwardDefinition) {
                state.reportMissingLocalDefinition(identifier, 'PROC');
            }

            // Record a same-module SPC/PROC relation, including GLOBAL/GLOBAL.
            // The relation must survive a later signature mismatch.
            if (forwardDefinition) {
                state.linkLocalSpecification('PROC', identifier, forwardDefinition);
            }

            const symbol: ProcedureSymbol = {
                kind: SymbolKind.Procedure,
                name: identifier,
                definition: forwardDefinition ?? identifier,
                global: this.globalSymbolAttribute(attribute.global),
                resultType: signature.resultType,
                signature
            };
            state.bind(identifier, symbol);
            (environment.scope as MutableScope).symbols.push(symbol);
            current = this.introduceSymbol(current, symbol);
        }
        return current;
    }

    private analyzeTaskSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcTaskAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.keyword, "TASK");
        }

        let current = environment;
        for (const identifier of node.identifiers.identifiers) {
            const existing = this.resolveSymbolInCurrentScope(current, identifier.value);
            if (existing) {
                state.reportDuplicateDeclaration(identifier, { kind: existing.kind, name: existing.name });
                continue;
            }

            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);
            if (indexed && indexed.kind !== SymbolKind.Task) {
                state.reportDuplicateDeclaration(identifier, indexed);
                continue;
            }

            if (!indexed && !attribute.global) {
                state.reportMissingLocalDefinition(identifier, 'TASK');
            }

            // For TASK, retain the same-module relation. An explicit GLOBAL
            // specification is paired only with a GLOBAL definition; a GLOBAL
            // SPC without a definition is external, as before.
            if (indexed?.kind === SymbolKind.Task) {
                const indexedTask = [...state.taskSymbols.values()]
                    .find(symbol => symbol.name === indexed.name);
                if (indexedTask && (!attribute.global ||
                    (attribute.global.moduleName === undefined && indexedTask.global !== undefined))) {
                    state.linkLocalSpecification('TASK', identifier, indexed.name);
                }
            }

            const definition = indexed?.kind === SymbolKind.Task ? indexed.name : identifier;
            const symbol: TaskSymbol = {
                kind: SymbolKind.Task,
                name: identifier,
                definition,
                global: this.globalSymbolAttribute(attribute.global)
            };

            state.bind(identifier, symbol);
            (environment.scope as MutableScope).symbols.push(symbol);
            current = this.introduceSymbol(current, symbol);
        }

        return current;
    }

    private analyzeProblemDataSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcProblemDataAttributeNode,
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

        if (node.virtualDimensions) {
            type = state.resolveVirtualDimensionedType(type, node.virtualDimensions);
        }

        if (attribute.global && environment.scope.kind !== ScopeKind.Module) {
            state.reportGlobalDeclarationOutsideModule(attribute.global.keyword);
        }

        return this.introduceSpecifiedDataObjects(
            node.identifiers,
            type,
            attribute.inv !== undefined,
            this.globalSymbolAttribute(attribute.global),
            true,
            environment,
            state
        );
    }

    private analyzeSynchronizationSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcSemaAttributeNode | SpcBoltAttributeNode,
        baseType: SemanticType,
        typeName: 'SEMA' | 'BOLT',
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.keyword, typeName);
        }

        let type = baseType;

        if (node.virtualDimensions) {
            type = state.resolveVirtualDimensionedType(type, node.virtualDimensions);
        }

        return this.introduceSpecifiedDataObjects(
            node.identifiers,
            type,
            false,
            this.globalSymbolAttribute(attribute.global),
            false,
            environment,
            state
        );
    }

    private analyzeDationSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcDationAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.keyword, 'DATION');
        }

        if (!attribute.direction || !attribute.dationClass) {
            return environment;
        }

        const direction = this.dationDirection(attribute.direction.value);
        const dationClass = this.dationClass(attribute.dationClass.value);

        if (!direction || !dationClass) {
            return environment;
        }

        return this.introduceSpecifiedSystemObjects(
            node.identifiers,
            { kind: SemanticTypeKind.Dation, direction, dationClass },
            this.globalSymbolAttribute(attribute.global),
            'DATION',
            environment,
            state
        );
    }

    private analyzeInterruptSpecification(
        node: SpcDeclarationSentenceNode,
        attribute: SpcInterruptAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (environment.scope.kind !== ScopeKind.Module) {
            state.reportInvalidDeclarationScope(attribute.keyword, 'INTERRUPT');
        }

        return this.introduceSpecifiedSystemObjects(
            node.identifiers,
            { kind: SemanticTypeKind.Interrupt },
            this.globalSymbolAttribute(attribute.global),
            'INTERRUPT',
            environment,
            state
        );
    }

    private dationDirection(value: string): DationDirection | undefined {
        return value === 'IN' || value === 'OUT' || value === 'INOUT' ? value : undefined;
    }

    private dationClass(value: string): DationClass | undefined {
        return value === 'ALPHIC' || value === 'BASIC' || value === 'ALL' ? value : undefined;
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

    private introduceDeclaredDataObjects(
        identifiers: OneIdentifierOrListNode,
        type: SemanticType,
        assignmentProtected: boolean,
        global: GlobalSymbolAttribute | undefined,
        environment: Environment,
        state: SemanticAnalysisState,
        beforeIntroduce?: (symbol: DataObjectSymbol, index: number, current: Environment) => void
    ): Environment {
        let current = environment;

        for (let index = 0; index < identifiers.identifiers.length; index++) {
            const identifier = identifiers.identifiers[index];

            if (state.rejectedDataDeclarations.has(identifier)) {
                continue;
            }

            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);

            if (!indexed || indexed.name !== identifier || indexed.kind !== SymbolKind.DataObject) {
                continue;
            }

            const existing = this.resolveSymbolInCurrentScope(current, identifier.value);

            // RTOS-UH does not complete a data-object SPC with a later DCL.
            // A same-name symbol is a duplicate, independent of its reference target type.
            if (existing) {
                state.reportDuplicateDeclaration(identifier, { kind: existing.kind, name: existing.name });
                continue;
            }

            const symbol: DataObjectSymbol = {
                kind: SymbolKind.DataObject,
                name: identifier,
                definition: identifier,
                type,
                assignmentProtected,
                global
            };

            (environment.scope as MutableScope).symbols.push(symbol);

            state.bind(identifier, symbol);
            beforeIntroduce?.(symbol, index, current);
            current = this.introduceSymbol(current, symbol);
        }

        return current;
    }

    private introduceSpecifiedDataObjects(
        identifiers: OneIdentifierOrListNode,
        type: SemanticType,
        assignmentProtected: boolean,
        global: GlobalSymbolAttribute | undefined,
        requireGlobal: boolean,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        let current = environment;

        for (const identifier of identifiers.identifiers) {
            const existing = this.resolveSymbolInCurrentScope(current, identifier.value);

            if (existing) {
                state.reportDuplicateDeclaration(identifier, { kind: existing.kind, name: existing.name });
                continue;
            }

            if (requireGlobal && global === undefined) {
                state.reportDataSpecificationRequiresGlobal(identifier);
                continue;
            }

            if (requireGlobal) {
                const symbol: DataObjectSymbol = {
                    kind: SymbolKind.DataObject,
                    name: identifier,
                    definition: identifier,
                    type,
                    assignmentProtected,
                    global
                };

                state.bind(identifier, symbol);
                (environment.scope as MutableScope).symbols.push(symbol);
                current = this.introduceSymbol(current, symbol);
                continue;
            }

            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);
            const localSpecification = global === undefined;

            if (indexed?.kind === SymbolKind.Type || (!localSpecification && indexed?.kind === SymbolKind.DataObject)) {
                state.reportDuplicateDeclaration(identifier, indexed);
                continue;
            }

            if (localSpecification && (!indexed || indexed.kind !== SymbolKind.DataObject)) {
                state.reportMissingDeclarationForSpecification(identifier);
            }

            const symbol: DataObjectSymbol = {
                kind: SymbolKind.DataObject,
                name: identifier,
                definition: identifier,
                type,
                assignmentProtected,
                global
            };

            state.bind(identifier, symbol);
            (environment.scope as MutableScope).symbols.push(symbol);

            current = this.introduceSymbol(current, symbol);
        }

        return current;
    }

    private introduceSpecifiedSystemObjects(
        identifiers: OneIdentifierOrListNode,
        type: SemanticType,
        global: GlobalSymbolAttribute | undefined,
        typeName: 'DATION' | 'INTERRUPT',
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        let current = environment;

        for (const identifier of identifiers.identifiers) {
            const existing = this.resolveSymbolInCurrentScope(current, identifier.value);
            if (existing) {
                state.reportDuplicateDeclaration(identifier, { kind: existing.kind, name: existing.name });
                continue;
            }

            const indexed = state.declarationIndex.lookupInScope(environment.scope, identifier.value);
            if (indexed) {
                state.reportDuplicateDeclaration(identifier, indexed);
                continue;
            }

            const systemDeclaration = state.systemObjectIndex.lookupInScope(environment.scope, identifier.value);
            if (systemDeclaration) {
                if (!this.systemSpecificationMatchesDeclaration(type, systemDeclaration.type)) {
                    state.reportSystemSpecificationMismatch(identifier, systemDeclaration);
                }
            } else if (!global) {
                state.reportMissingSystemDeclarationForSpecification(identifier, typeName);
            }

            const symbol: DataObjectSymbol = {
                kind: SymbolKind.DataObject,
                name: identifier,
                definition: systemDeclaration?.name ?? identifier,
                type,
                assignmentProtected: false,
                global: systemDeclaration ? (global ?? { moduleName: undefined }) : global
            };

            state.bind(identifier, symbol);
            if (systemDeclaration) {
                state.bind(systemDeclaration.name, symbol);
            }

            (environment.scope as MutableScope).symbols.push(symbol);
            current = this.introduceSymbol(current, symbol);
        }

        return current;
    }

    private systemSpecificationMatchesDeclaration(
        specification: SemanticType,
        declaration: SemanticType
    ): boolean {
        if (specification.kind !== declaration.kind) {
            return false;
        }

        if (specification.kind === SemanticTypeKind.Interrupt) {
            return true;
        }

        if (specification.kind !== SemanticTypeKind.Dation || declaration.kind !== SemanticTypeKind.Dation) {
            return false;
        }

        const directionMatches = declaration.direction === 'INOUT' || declaration.direction === specification.direction;
        return directionMatches && declaration.dationClass === specification.dationClass;
    }

    private resolveSymbolInCurrentScope(environment: Environment, name: string): SemanticSymbol | undefined {
        let current: Environment | undefined = environment;

        while (current) {
            for (const symbol of current.introducedSymbols) {
                if (symbol.name.value === name) {
                    return symbol;
                }
            }

            current = current.previous;
        }

        return undefined;
    }

    private replaceScopeSymbol(scope: Scope, previous: SemanticSymbol, replacement: SemanticSymbol): void {
        const symbols = (scope as MutableScope).symbols;
        const index = symbols.indexOf(previous);

        if (index >= 0) {
            symbols[index] = replacement;
        } else {
            symbols.push(replacement);
        }
    }

    private globalSymbolAttribute(
        attribute: GlobalAttributeNode | undefined
    ): GlobalSymbolAttribute | undefined {
        if (!attribute) {
            return undefined;
        }

        return {
            moduleName: attribute.moduleName
        };
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

            case AstKind.Repetition:
                return ScopeKind.Repetition;

            default:
                return undefined;
        }
    }
}
