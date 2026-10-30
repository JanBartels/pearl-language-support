// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { SourceValue } from '../core/sourceValue';
import type { Location } from '../core/location';
import type { CommentToken } from '../lexer/token';
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
import { ReturnStatementNode } from '../ast/problem/statements/returnStatementNode';
import { AssignmentNode } from '../ast/problem/statements/assignmentNode';
import { IfStatementNode } from '../ast/problem/statements/ifStatementNode';
import { CaseStatementNode } from '../ast/problem/statements/caseStatementNode';
import { CaseIndexRangeNode } from '../ast/problem/statements/caseIndexRangeNode';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { ExpressionTypeResolver, ExpressionTypeResolverContext } from './expressionTypeResolver';
import { classifyObjectExpressionInfo, expressionSource } from './expressionObject';
import { validateProcedureActualParameters, validateBuiltinIdentificationParameters } from './procedureActualParameterValidator';
import type { CharacterTransferDiagnosticContext } from './procedureActualParameterValidator';
import { matchBuiltinSignature } from './builtins/builtinSignature';
import { ProcedureParameterNameIndex } from './procedureParameterNameIndex';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import { RepetitionNode } from '../ast/problem/statements/repetitionNode';
import { RepetitionExpressionClauseNode } from '../ast/problem/statements/repetitionExpressionClauseNode';
import { ProblemDataAttributeNode } from '../ast/problem/declarations/problemDataAttributeNode';
import { DclDationAttributeNode } from '../ast/problem/declarations/dclDationAttributeNode';
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
import { resolveLabels } from './labelResolver';
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
import {
    semanticTypeEquals, procedureSignaturesEqual, isProcedureSignatureResolved,
    isValueTransferCompatible, isAssignmentValueCompatible, characterTruncationForValueTransfer,
    isNilAssignableTo, isReferenceTransferCompatible,
    resolveReferenceTransferType
} from './semanticTypeComparison';
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

export interface SemanticAnalysisOptions {
    /** Enabled by default. Warn only when a CHAR value is copied to a shorter target. */
    readonly warnOnCharTruncation?: boolean;
}

interface MutableScope {
    readonly kind: ScopeKind;
    readonly parent: Scope | undefined;
    readonly symbols: SemanticSymbol[];
}

class SemanticAnalysisState implements
    SemanticTypeResolverContext,
    ConstantFixedExpressionEvaluatorContext,
    InitializationResolverContext,
    TimeConstantEvaluatorContext,
    ExpressionTypeResolverContext {
    readonly parameterNames: ProcedureParameterNameIndex;

    constructor(root: AstNode, comments: readonly CommentToken[],
        options: SemanticAnalysisOptions) {
        this.parameterNames = new ProcedureParameterNameIndex(root, comments);
        this.warnOnCharTruncation = options.warnOnCharTruncation !== false;
    }

    readonly warnOnCharTruncation: boolean;

    readonly typeDefinitions = new Map<TypeSymbol, SemanticType>();
    readonly expressionTypes = new Map<ExpressionNode, SemanticType>();
    readonly procedureReturnTypeStack: (SemanticType | undefined)[] = [];
    readonly bindings = new Map<SourceValue<string>, SemanticSymbol>();
    readonly builtinBindings = new Map<SourceValue<string>, BuiltinDefinition>();
    readonly diagnostics: SemanticDiagnostic[] = [];

    /** SourceValue may be synthetic (not backed by source text). Such values
     * cannot produce an LSP diagnostic. Keep SemanticDiagnostic.location
     * required and include secondary locations only when they exist. */
    private addDiagnostic(diagnostic: {
        readonly code: SemanticDiagnosticCode;
        readonly severity: SemanticDiagnosticSeverity;
        readonly location: Location | undefined;
        readonly message: string;
        readonly relatedLocations?: readonly {
            readonly location: Location | undefined;
            readonly message: string;
        }[] | undefined;
    }): void {
        if (!diagnostic.location) return;
        const relatedLocations = diagnostic.relatedLocations?.filter(
            (entry): entry is { readonly location: Location; readonly message: string } =>
                entry.location !== undefined
        );
        this.diagnostics.push({
            code: diagnostic.code,
            severity: diagnostic.severity,
            location: diagnostic.location,
            message: diagnostic.message,
            ...(relatedLocations?.length ? { relatedLocations } : {})
        });
    }

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
    readonly expressionTypeResolver = new ExpressionTypeResolver(this);

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
            this.localSpecificationRelations,
            this.expressionTypes
        );
    }

    tryEvaluateFixedExpression(expression: ExpressionNode, environment: Environment): bigint | undefined {
        return this.constantFixedExpressionEvaluator.tryEvaluateExpression(expression, environment);
    }

    tryResolveConstantFixedIdentifier(
        identifier: SourceValue<string>, environment: Environment
    ): bigint | undefined {
        const symbol = resolveSymbol(environment, identifier.value);
        if (!symbol || symbol.kind !== SymbolKind.DataObject) return undefined;
        const value = this.namedConstantValues.get(symbol);
        return value?.kind === SemanticConstantKind.Fixed ? value.value : undefined;
    }

    recordExpressionType(expression: ExpressionNode, type: SemanticType): void {
        this.expressionTypes.set(expression, type);
    }

    reportInvalidExpressionOperands(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidExpressionOperands,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Unzulässige Operandentypen für Operator '${source.value}'.`
        });
    }

    reportUnsupportedContExpression(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.UnsupportedContExpression,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'CONT ist in RTOS-UH nur links in einer Zuweisung zulässig.'
        });
    }

    reportUnsupportedBitConcatenation(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.UnsupportedBitConcatenation,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `BIT-Verkettung mit '${source.value}' ist in RTOS-UH nicht implementiert.`
        });
    }

    reportInvalidFunctionArgumentType(
        source: SourceValue<string>, functionName: SourceValue<string>, position: number,
        expected: SemanticType, actual: SemanticType
    ): void {
        if (!source.location) return;
        const symbol = this.bindings.get(functionName);
        const formalName = symbol
            ? this.parameterNames.nameForSymbol(symbol, position - 1, this)?.name.value
            : undefined;
        const label = `Aktualparameter ${position}`
            + (formalName ? ` ('${formalName}')` : '');
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidCallArgumentType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `${label} von '${functionName.value}': `
                + `erwartet ${this.diagnosticTypeName(expected)}, `
                + `erhalten ${this.diagnosticTypeName(actual)}.`
        });
    }

    reportInvalidIdentificationArgument(
        source: SourceValue<string>, target: SourceValue<string>,
        position: number, formalName?: string, reason?: 'protected'
    ): void {
        if (!source.location) return;
        const symbol = this.bindings.get(target);
        const name = formalName ?? (symbol
            ? this.parameterNames.nameForSymbol(symbol, position - 1, this)?.name.value
            : undefined);
        const label = `Aktualparameter ${position}` + (name ? ` ('${name}')` : '');
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidIdentificationArgument,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: reason === 'protected'
                ? `${label} von '${target.value}' ist INV-geschützt und darf nicht an einen veränderbaren IDENT-Formalparameter übergeben werden.`
                : `${label} von '${target.value}' muss ein identifizierbares Objekt (IDENT) sein.`
        });
    }

    reportCharacterTruncation(
        source: SourceValue<string>, targetLength: number, sourceLength: number,
        context: CharacterTransferDiagnosticContext
    ): void {
        if (!this.warnOnCharTruncation) return;
        let label: string;
        switch (context.kind) {
            case 'assignment': label = 'Zuweisung'; break;
            case 'return': label = 'RETURN'; break;
            case 'argument': {
                const symbol = this.bindings.get(context.target);
                const formalName = symbol
                    ? this.parameterNames.nameForSymbol(symbol, context.position - 1, this)?.name.value
                    : undefined;
                label = `Aktualparameter ${context.position}`
                    + (formalName ? ` ('${formalName}')` : '')
                    + ` von '${context.target.value}'`;
                break;
            }
        }
        this.addDiagnostic({
            code: SemanticDiagnosticCode.PossibleCharacterTruncation,
            severity: SemanticDiagnosticSeverity.Warning,
            location: source.location,
            message: `${label}: CHAR(${sourceLength}) wird auf CHAR(${targetLength}) `
                + 'gek\u00fcrzt (m\u00f6glicher Zeichenverlust).'
        });
    }

    private diagnosticTypeName(type: SemanticType): string {
        switch (type.kind) {
            case SemanticTypeKind.Fixed:
            case SemanticTypeKind.Float:
                return `${SemanticTypeKind[type.kind].toUpperCase()}`
                    + (type.precision === undefined ? '' : `(${type.precision})`);
            case SemanticTypeKind.Bit:
            case SemanticTypeKind.Character:
                return `${type.kind === SemanticTypeKind.Bit ? 'BIT' : 'CHAR'}`
                    + (type.length === undefined ? '' : `(${type.length})`);
            case SemanticTypeKind.Reference:
                return `REF ${type.targetInvariant ? 'INV ' : ''}`
                    + this.diagnosticTypeName(type.target);
            case SemanticTypeKind.VoidReference:
                return `REF ${type.targetInvariant ? 'INV ' : ''}STRUCT[]`;
            case SemanticTypeKind.Struct:
                // An anonymous STRUCT has no TYPE name. Show its components
                // instead of displaying two indistinguishable STRUCT[...] labels.
                return `STRUCT[${type.components.map(component =>
                    `${component.name.value} ${this.diagnosticTypeName(component.type)}`
                ).join(', ')}]`;
            case SemanticTypeKind.Array:
                return `ARRAY(${type.dimensions.map(dimension =>
                    `${dimension.lowerBound}:${dimension.upperBound}`).join(', ')}) OF `
                    + this.diagnosticTypeName(type.elementType);
            case SemanticTypeKind.VirtualArray:
                return `VIRTUAL ARRAY(rank ${type.rank}) OF `
                    + this.diagnosticTypeName(type.elementType);
            case SemanticTypeKind.Dation:
                return `DATION${type.direction ? ` ${type.direction}` : ''} ${type.dationClass}`;
            case SemanticTypeKind.Named: {
                // Keep the declared name of composite types (notably STRUCT).
                // For aliases of scalar types retain the previous diagnostic
                // spelling, e.g. TYPE MyInt FIXED is reported as FIXED.
                const resolved = this.resolveUnderlyingType(type);
                if (!resolved || resolved.kind === SemanticTypeKind.Struct
                    || resolved.kind === SemanticTypeKind.Array
                    || resolved.kind === SemanticTypeKind.VirtualArray
                    || resolved.kind === SemanticTypeKind.Reference
                    || resolved.kind === SemanticTypeKind.VoidReference) {
                    return type.symbol.name.value;
                }
                return this.diagnosticTypeName(resolved);
            }
            default:
                return SemanticTypeKind[type.kind].toUpperCase();
        }
    }

    reportInvalidAssignmentTarget(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidAssignmentTarget,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Zuweisungsziel '${source.value}' bezeichnet kein beschreibbares Objekt.`
        });
    }

    reportAssignmentToInvariant(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.AssignmentToInvariant,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Zuweisungsziel '${source.value}' ist INV-geschützt.`
        });
    }

    reportInvalidAssignmentValueType(
        source: SourceValue<string>, target: SemanticType, actual: SemanticType
    ): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidAssignmentValueType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Zuweisung: erwartet ${this.diagnosticTypeName(target)}, `
                + `erhalten ${this.diagnosticTypeName(actual)}.`
        });
    }

    reportInvalidNilAssignment(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidAssignmentValueType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'NIL darf nur einem REF-Zuweisungsziel zugewiesen werden.'
        });
    }

    reportInvalidContAssignmentTarget(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidContAssignmentTarget,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'CONT erwartet links ein Zuweisungsziel vom Typ REF.'
        });
    }

    reportInvalidArrayAssignment(source: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidArrayAssignment,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'Die Zuweisung eines gesamten Feldes ist in RTOS-UH nicht zulässig.'
        });
    }

    reportInvalidArrayIndexCount(source: SourceValue<string>, expected: number, actual: number): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidArrayIndexCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Feld '${source.value}' erwartet ${expected} Indizes, erhalten: ${actual}.`
        });
    }

    reportConstantIndexOutOfBounds(
        source: SourceValue<string>, owner: SourceValue<string>, dimension: number | undefined,
        index: bigint, lower: bigint, upper: bigint | undefined
    ): void {
        if (!source.location) return;
        const description = dimension === undefined
            ? `Selektor '.${owner.value}'` : `Feld '${owner.value}', Dimension ${dimension}`;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.ConstantIndexOutOfBounds,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Konstanter Index ${index} für ${description} liegt außerhalb der Grenzen `
                + `${lower}:${upper === undefined ? '?' : upper}.`
        });
    }

    reportInvalidStringSelectorIndexType(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidStringSelectorIndexType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Index für '.${source.value}' muss vom Typ FIXED sein.`
        });
    }

    reportInvalidStringSelectorIndexCount(source: SourceValue<string>, actual: number): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidStringSelectorIndexCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Selektor '.${source.value}' erwartet genau einen Index, erhalten: ${actual}.`
        });
    }

    reportInvalidArrayBoundDimension(
        source: SourceValue<string>, operator: SourceValue<string>, dimension: bigint, rank: number
    ): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidArrayBoundDimension,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Dimension ${dimension} bei '${operator.value}' liegt außerhalb des Feldrangs 1:${rank}.`
        });
    }

    reportInvalidArrayIndexType(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidArrayIndexType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Feldindizes für '${source.value}' müssen vom Typ FIXED sein.`
        });
    }

    reportInvalidNameSuffix(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidNameSuffix,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `'${source.value}' bezeichnet weder ein Feld noch eine aufrufbare Prozedur.`
        });
    }

    reportInvalidStructureSelection(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidStructureSelection,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Strukturselektion '.${source.value}' erfordert einen STRUCT-Typ.`
        });
    }

    reportUnknownStructureComponent(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.UnknownStructureComponent,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Strukturkomponente '${source.value}' ist nicht deklariert.`
        });
    }

    reportInvalidFunctionExpression(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidFunctionExpression,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Prozedur '${source.value}' liefert keinen Wert für einen Ausdruck.`
        });
    }

    reportCaseProblem(
        code: SemanticDiagnosticCode, source: SourceValue<string>, message: string
    ): void {
        if (!source.location) return;
        this.addDiagnostic({ code, severity: SemanticDiagnosticSeverity.Error,
            location: source.location, message });
    }

    reportOverlappingCaseAlternative(
        source: SourceValue<string>, previous: SourceValue<string>, message: string
    ): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.OverlappingCaseAlternative,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message,
            relatedLocations: previous.location ? [{
                location: previous.location,
                message: 'Dieser Auswahlwert ist bereits hier abgedeckt.'
            }] : undefined
        });
    }

    /** Only named invariant objects, not mutable variables with INIT, are constants. */
    tryEvaluateCaseCharacter(expression: ExpressionNode, environment: Environment): string | undefined {
        if (expression.kind === AstKind.ParenthesizedExpression) {
            const inner = (expression as ParenthesizedExpressionNode).expression;
            return inner ? this.tryEvaluateCaseCharacter(inner, environment) : undefined;
        }
        if (expression.kind === AstKind.LiteralExpression) {
            const spelling = (expression as LiteralExpressionNode).literal.value;
            return /^'(?:[^']|'')*'$/.test(spelling)
                ? spelling.slice(1, -1).replace(/''/g, "'") : undefined;
        }
        if (expression.kind === AstKind.NameExpression) {
            const name = expression as NameExpressionNode;
            if (name.segments.length !== 1 || name.segments[0].suffix) return undefined;
            const symbol = resolveSymbol(environment, name.segments[0].identifier.value);
            if (symbol?.kind !== SymbolKind.DataObject) return undefined;
            const value = this.namedConstantValues.get(symbol);
            return value?.kind === SemanticConstantKind.Character ? value.value : undefined;
        }
        return undefined;
    }

    reportInvalidIfCondition(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidIfCondition,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'Die IF-Bedingung muss den Typ BIT(1) besitzen.'
        });
    }

    reportInvalidWhileCondition(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidWhileCondition,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'Die WHILE-Bedingung muss den Typ BIT(1) besitzen.'
        });
    }

    reportInvalidRepetitionFixedExpression(source: SourceValue<string>, clause: 'FROM' | 'BY' | 'TO'): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidRepetitionFixedExpression,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Die ${clause}-Angabe muss vom Typ FIXED sein.`
        });
    }

    reportInvalidBuiltinArgumentType(source: SourceValue<string>, builtinName: string): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidBuiltinArgumentType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Die Aktualparameter von '${builtinName}' entsprechen keiner zulässigen Einbaufunktionssignatur.`
        });
    }

    reportInvalidReturnType(source: SourceValue<string>): void {
        if (!source.location) return;
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidReturnType,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: 'Der Ausdruckstyp ist mit dem Rückgabetyp der Prozedur nicht kompatibel.'
        });
    }

    bind(source: SourceValue<string>, symbol: SemanticSymbol): void {
        this.bindings.set(source, symbol);
    }

    bindBuiltin(source: SourceValue<string>, builtin: BuiltinDefinition): void {
        this.builtinBindings.set(source, builtin);
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
        targetInvariant: boolean,
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

        // An INV object must not be writable through an ordinary REF.
        // REF INV may also refer to an ordinary (writable) object.
        if (symbol.assignmentProtected && !targetInvariant) {
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
        this.addDiagnostic({
            code: SemanticDiagnosticCode.UnknownType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Unbekannter Typ '${name.value}'.`
        });
    }

    reportExpectedType(name: SourceValue<string>, symbol: SemanticSymbol): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.ExpectedType,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `'${name.value}' bezeichnet keinen Typ.`
        });

        void symbol;
    }

    reportDuplicateType(name: SourceValue<string>, existing: IndexedDeclaration): void {
        this.addDiagnostic({
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
        this.addDiagnostic({
            code: SemanticDiagnosticCode.MultipleModulesInTranslationUnit,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: 'RTOS-UH erlaubt nur ein MODULE pro Übersetzungseinheit.'
        });
    }

    reportDeclarationAfterProcedureOrTask(keyword: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.DeclarationAfterProcedureOrTask,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: 'Eine DCL-Deklaration auf Modulebene muss vor der ersten PROC- oder TASK-Definition stehen.'
        });
    }

    reportDuplicateDeclaration(name: SourceValue<string>, existing: IndexedDeclaration): void {
        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidCallTarget,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `'${name.value}' ist keine aufrufbare Prozedur.`
        });
    }

    reportInvalidBuiltinCallArity(name: SourceValue<string>, expected: string, actual: number): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidCallArity,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Einbaufunktion '${name.value}' erwartet ${expected} Aktualparameter, erhalten: ${actual}.`
        });
    }

    reportInvalidCallArity(name: SourceValue<string>, expected: number, actual: number): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidCallArity,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Prozedur '${name.value}' erwartet ${expected} Aktualparameter, erhalten: ${actual}.`
        });
    }

    reportDataSpecificationRequiresGlobal(name: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.DataSpecificationRequiresGlobal,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Die SPC-Spezifikation '${name.value}' für ein Datenobjekt benötigt in RTOS-UH GLOBAL.`
        });
    }

    reportMissingDeclarationForSpecification(name: SourceValue<string>): void {
        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
            code: SemanticDiagnosticCode.MissingSystemDeclarationForSpecification,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `Für die lokale ${typeName}-Spezifikation '${name.value}' fehlt eine Vereinbarung im SYSTEM-Teil.`
        });
    }

    reportInvalidDeclarationScope(keyword: SourceValue<string>, typeName: string): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidDeclarationScope,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `${typeName}-Variablen dürfen nur auf Modulebene vereinbart werden.`
        });
    }

    reportGlobalDeclarationOutsideModule(keyword: SourceValue<string>): void {
        this.addDiagnostic({
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
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidTaskPriority,
            severity: SemanticDiagnosticSeverity.Error,
            location: source.location,
            message: `Die Task-Priorität ${value} liegt außerhalb des zulässigen Bereichs 1..32767.`
        });
    }

    reportConstantExpressionNotEvaluable(keyword: SourceValue<string>, contextName: string): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.ConstantExpressionNotEvaluable,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `${contextName} erwartet einen auswertbaren konstanten FIXED-Ausdruck.`
        });
    }

    reportInvalidDationCreationSource(name: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidDationCreationSource,
            severity: SemanticDiagnosticSeverity.Error,
            location: name.location,
            message: `CREATED(${name.value}) erwartet eine spezifizierte System-DATION.`
        });
    }

    reportUnknownIdentifier(identifier: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.UnknownIdentifier,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `Unbekannter Bezeichner '${identifier.value}'.`
        });
    }

    reportExpectedNamedFixedConstant(identifier: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.ExpectedNamedFixedConstant,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `'${identifier.value}' ist keine benannte FIXED-Konstante.`
        });
    }

    reportInvariantWithoutInitialization(identifier: SourceValue<string>): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvariantWithoutInitialization,
            severity: SemanticDiagnosticSeverity.Error,
            location: identifier.location,
            message: `Das INV-Objekt '${identifier.value}' benötigt ein INIT; nach der Deklaration kann ihm `
                + 'kein Wert mehr zugewiesen werden.'
        });
    }

    reportInvalidSemaPresetValue(keyword: SourceValue<string>, value: bigint): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.InvalidSemaPresetValue,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `SEMA-PRESET-Werte dürfen nicht negativ sein (Wert ${value}).`
        });
    }

    reportSemaPresetElementCount(keyword: SourceValue<string>, expected: bigint, actual: number): void {
        this.addDiagnostic({
            code: SemanticDiagnosticCode.SemaPresetElementCount,
            severity: SemanticDiagnosticSeverity.Error,
            location: keyword.location,
            message: `PRESET enthält ${actual} Werte, für die deklarierten SEMA-Variablen `
                + `werden ${expected} Werte benötigt.`
        });
    }

    reportExpectedNamedConstant(identifier: SourceValue<string>, expectedTypeName: string): void {
        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
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

        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
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
        this.addDiagnostic({
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
    analyze(root: AstNode, comments: readonly CommentToken[] = [],
        options: SemanticAnalysisOptions = {}): SemanticContext {
        const state = new SemanticAnalysisState(root, comments, options);

        this.indexNode(root, undefined, state);
        this.validateDataDeclarationShadowing(state);
        this.validateLoopControlVariables(state);
        // Labels share the DeclarationIndex with other names, but their GOTO
        // references are resolved after indexing to permit forward jumps.
        const labels = resolveLabels(root, state.scopes, state.declarationIndex);
        state.diagnostics.push(...labels.diagnostics);
        for (const [source, symbol] of labels.bindings) state.bind(source, symbol);
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
            for (const name of parameter.identifiers?.identifiers ?? []) {
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

        if (node.kind === AstKind.CaseStatement) {
            if (!environment) return environment;
            this.analyzeCaseStatement(node as CaseStatementNode, environment, state);
            return this.analyzeChildren(node, environment, state);
        }

        if (node.kind === AstKind.IfStatement) {
            if (!environment) return environment;
            const statement = node as IfStatementNode;
            if (statement.condition) {
                this.analyzeBitCondition(
                    statement.condition, statement.conditionTokens[0] ?? statement.ifKeyword,
                    'IF', environment, state
                );
            }
            return this.analyzeChildren(node, environment, state);
        }

        if (node.kind === AstKind.Assignment) {
            if (!environment) throw new Error('Assignment without semantic environment.');
            this.analyzeAssignment(node as AssignmentNode, environment, state);
            return environment;
        }

        if (node.kind === AstKind.ReturnStatement) {
            if (!environment) return environment;
            const expected = state.procedureReturnTypeStack[state.procedureReturnTypeStack.length - 1];
            this.analyzeReturnStatement(node as ReturnStatementNode, environment, expected, state);
            return environment;
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

    /** IF and REPEAT/WHILE share the same condition typing rules.
     * REF dereferencing and context-dependent LENGTH are not fully modeled;
     * do not infer errors for those unresolved cases.
     */
    private analyzeBitCondition(
        expression: ExpressionNode,
        source: SourceValue<string>,
        clause: 'IF' | 'WHILE',
        environment: Environment,
        state: SemanticAnalysisState
    ): void {
        const type = state.expressionTypeResolver.resolve(expression, environment);
        const effective = type && state.resolveUnderlyingType(type);
        if (effective && effective.kind !== SemanticTypeKind.Reference
            && effective.kind !== SemanticTypeKind.VoidReference
            && (effective.kind !== SemanticTypeKind.Bit
                || (effective.length !== undefined && effective.length !== 1))) {
            if (clause === 'IF') state.reportInvalidIfCondition(source);
            else state.reportInvalidWhileCondition(source);
        }
    }

    /** FROM, BY and TO are FIXED expressions. Undefined types (e.g. from an
     * unsupported construct or contextual REF conversion) are left undecided;
     * their own expression diagnostics remain authoritative.
     */
    private analyzeRepetitionFixedExpression(
        clause: RepetitionExpressionClauseNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): void {
        if (!clause.expression) return;
        const type = state.expressionTypeResolver.resolve(clause.expression, environment);
        const effective = type && state.resolveUnderlyingType(type);
        if (effective && effective.kind !== SemanticTypeKind.Reference
            && effective.kind !== SemanticTypeKind.VoidReference
            && effective.kind !== SemanticTypeKind.Fixed) {
            state.reportInvalidRepetitionFixedExpression(
                clause.expressionTokens[0] ?? clause.keyword,
                clause.keyword.value as 'FROM' | 'BY' | 'TO'
            );
        }
    }

    /** CASE expressions are always read with the shared expression grammar.
     * Positional ALT requires FIXED; indexed ALT accepts FIXED or CHAR(1).
     * Explicit ALT bounds must be compile-time constants of the selector type.
     */
    private analyzeCaseStatement(
        statement: CaseStatementNode, environment: Environment, state: SemanticAnalysisState
    ): void {
        const type = state.expressionTypeResolver.resolve(statement.selector, environment);
        const effective = type && state.resolveUnderlyingType(type);
        const indexed = statement.alternatives.some(alt => alt.caseListTokens !== undefined);
        // RTOS-UH restricts CASE to FIXED(15) (not FIXED(31)) or,
        // for indexed CASE, CHAR(1). Resolve the effective precision here
        // without changing the type representation of a declaration.
        const valid = effective?.kind === SemanticTypeKind.Fixed
                && (effective.precision ?? 15) === 15
            || (indexed && effective?.kind === SemanticTypeKind.Character
                && (effective.length === 1 || effective.length === undefined));
        if (effective && effective.kind !== SemanticTypeKind.Reference
            && effective.kind !== SemanticTypeKind.VoidReference && !valid) {
            state.reportCaseProblem(SemanticDiagnosticCode.InvalidCaseSelector,
                statement.selectorTokens[0] ?? statement.caseKeyword,
                indexed ? 'CASE-Selektor muss FIXED(15) oder CHAR(1) sein.'
                    : 'Positionaler CASE-Selektor muss vom Typ FIXED(15) sein.');
        }

        // One index interval per valid ALT range. Do not enumerate FIXED values:
        // even FIXED(31) ranges can cover many millions of integers.
        // This collection belongs to this CASE statement only (not its nested CASEs).
        const occupied: Array<{
            lower: bigint | string;
            upper: bigint | string;
            source: SourceValue<string>;
        }> = [];
        for (const alternative of statement.alternatives) {
            for (const range of alternative.ranges) {
                const lower = this.analyzeCaseBound(range.lower, effective, environment, state);
                const explicitUpper = this.analyzeCaseBound(range.upper, effective, environment, state);
                const upper = range.colon ? explicitUpper : lower;
                // Nonconstant/ill-typed/incomplete ranges have their own diagnostics.
                // Never claim that their unknown values overlap another ALT.
                if (lower === undefined || upper === undefined
                    || typeof lower !== typeof upper) continue;
                if (lower > upper) {
                    if (range.colon) {
                        state.reportCaseProblem(SemanticDiagnosticCode.InvalidCaseRange, range.colon,
                            'Die untere Grenze des ALT-Bereichs ist größer als die obere.');
                    }
                    continue;
                }
                if (!range.lower) continue;
                const source = this.caseBoundSource(range.lower);
                const previous = occupied.find(other =>
                    typeof lower === typeof other.lower
                    && lower <= other.upper && other.lower <= upper);
                if (previous) {
                    const display = (value: bigint | string): string =>
                        typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value.toString();
                    const label = range.colon
                        ? `ALT-Bereich ${display(lower)}:${display(upper)}`
                        : `ALT-Auswahlwert ${display(lower)}`;
                    state.reportOverlappingCaseAlternative(source, previous.source,
                        `${label} überschneidet sich mit einer vorherigen ALT-Angabe.`);
                }
                // Keep overlapping intervals too, for future diagnostics: the next
                // interval must be compared against every earlier declaration.
                occupied.push({ lower, upper, source });
            }
        }
    }

    private analyzeCaseBound(
        expression: ExpressionNode | undefined, selector: SemanticType | undefined,
        environment: Environment, state: SemanticAnalysisState
    ): bigint | string | undefined {
        if (!expression) return undefined;
        const type = state.expressionTypeResolver.resolve(expression, environment);
        const effective = type && state.resolveUnderlyingType(type);
        if (!effective) return undefined;
        const isFixed = effective.kind === SemanticTypeKind.Fixed;
        const isChar = effective.kind === SemanticTypeKind.Character
            && (effective.length === undefined || effective.length === 1);
        const matchesSelector = !selector
            || selector.kind === SemanticTypeKind.Fixed && isFixed
            || selector.kind === SemanticTypeKind.Character && isChar;
        const source = this.caseBoundSource(expression);
        if (!matchesSelector || (!isFixed && !isChar)) {
            state.reportCaseProblem(SemanticDiagnosticCode.InvalidCaseAlternativeType, source,
                'ALT-Konstante muss zum Typ des CASE-Selektors passen (FIXED oder CHAR(1)).');
            return undefined;
        }
        const value = isFixed ? state.tryEvaluateFixedExpression(expression, environment)
            : state.tryEvaluateCaseCharacter(expression, environment);
        if (value === undefined) {
            state.reportCaseProblem(SemanticDiagnosticCode.NonConstantCaseAlternative, source,
                'ALT-Auswahlwert muss eine Konstante sein.');
        }
        return value;
    }

    private caseBoundSource(expression: ExpressionNode): SourceValue<string> {
        // All expression forms, including CLOCK/DURATION constants, must
        // provide a real diagnostic location. A synthetic SourceValue is
        // deliberately ignored by the diagnostic reporter.
        // Keep the location on the inner operand for redundant parentheses,
        // as for the previous CASE-bound source lookup.
        if (expression.kind === AstKind.ParenthesizedExpression) {
            const inner = (expression as ParenthesizedExpressionNode).expression;
            if (inner) return this.caseBoundSource(inner);
        }
        return expressionSource(expression) ?? SourceValue.synthetic('ALT');
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
                Array.from({ length: parameter.identifiers?.identifiers.length ?? 1 }, () => ({
                    type: parameterTypes.get(parameter),
                    byIdentification: parameter.identKeyword !== undefined,
                    assignmentProtected: parameter.invKeyword !== undefined
                }))
            ),
            hasResult: node.returnsKeyword !== undefined,
            resultType,
            callingConvention: 'PEARL'
        };
        const { resultType: _oldResultType, ...procedureWithoutResult } = symbol;
        const resolved: ProcedureSymbol = {
            ...procedureWithoutResult,
            ...(resultType !== undefined ? { resultType } : {}),
            signature
        };
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
            for (const name of parameter.identifiers?.identifiers ?? []) {
                const indexed = state.declarationIndex.lookupInScope(scope, name.value);
                if (indexed?.name !== name) continue;
                const original = state.parameterSymbols.get(name);
                if (!original) continue;
                const { type: _oldType, ...parameterWithoutType } = original;
                const resolved: ParameterSymbol = {
                    ...parameterWithoutType,
                    ...(type !== undefined ? { type } : {})
                };
                state.parameterSymbols.set(name, resolved);
                this.replaceScopeSymbol(scope, original, resolved);
                state.bind(name, resolved);
                procedureEnvironment = this.introduceSymbol(procedureEnvironment, resolved);
            }
        }
        state.procedureReturnTypeStack.push(resultType);
        try {
            let current: Environment | undefined = procedureEnvironment;
            for (const child of node.body) {
                current = this.analyzeNode(child, current, state);
            }
        } finally {
            state.procedureReturnTypeStack.pop();
        }
        return outerEnvironment;
    }

    /**
     * RTOS-UH assignment context: without CONT a REF destination receives an
     * address/reference; with CONT the referenced value is assigned. Both
     * cases share the transfer checks used by parameter and RETURN semantics.
     */
    private analyzeAssignment(
        node: AssignmentNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): void {
        const targetType = state.expressionTypeResolver.resolve(node.target, environment);
        const expressionType = node.expression
            ? state.expressionTypeResolver.resolve(node.expression, environment)
            : undefined;

        // Always resolve the entire RHS even after a target error, for hover,
        // bindings and independent operand diagnostics.
        if (!targetType) return;
        const object = classifyObjectExpressionInfo(node.target, environment,
            type => state.resolveUnderlyingType(type));
        const source = node.target.segments[node.target.segments.length - 1]?.identifier;
        if (!source) return;
        if (object.category === 'value') {
            state.reportInvalidAssignmentTarget(source);
            return;
        }
        if (object.category !== 'object') return;

        const declaredTarget = resolveReferenceTransferType(targetType,
            type => state.resolveUnderlyingType(type));
        if (!declaredTarget) return;

        let target: SemanticType = declaredTarget;
        if (node.contOperator) {
            if (declaredTarget.kind !== SemanticTypeKind.Reference
                && declaredTarget.kind !== SemanticTypeKind.VoidReference) {
                state.reportInvalidContAssignmentTarget(node.contOperator);
                return;
            }
            // CONT changes the assignment destination: the pointer's own
            // INV flag is irrelevant, but REF INV protects the target.
            if (declaredTarget.targetInvariant) {
                state.reportAssignmentToInvariant(source);
                return;
            }
            if (declaredTarget.kind === SemanticTypeKind.VoidReference) {
                // An untyped referenced object has no known value-transfer type.
                return;
            }
            const referenced = state.resolveUnderlyingType(declaredTarget.target);
            if (!referenced) return;
            target = referenced;
        } else if (object.assignmentProtected === true) {
            state.reportAssignmentToInvariant(source);
            return;
        }
        if (!node.contOperator && object.assignmentProtected === undefined) return;

        // Whole arrays cannot be copied with the scalar/STRUCT assignment.
        if (target.kind === SemanticTypeKind.Array
            || target.kind === SemanticTypeKind.VirtualArray) {
            state.reportInvalidArrayAssignment(source);
            return;
        }

        // NIL is typeless and can only be assigned in a reference context.
        // Parentheses around NIL don't change that contextual rule.
        let right: ExpressionNode | undefined = node.expression;
        while (right?.kind === AstKind.ParenthesizedExpression) {
            right = (right as ParenthesizedExpressionNode).expression;
        }
        if (right?.kind === AstKind.LiteralExpression
            && (right as LiteralExpressionNode).literal.value === 'NIL') {
            if (!isNilAssignableTo(target)) {
                state.reportInvalidNilAssignment((right as LiteralExpressionNode).literal);
            }
            return;
        }

        if (!expressionType || !node.expression) return;
        const actual = resolveReferenceTransferType(expressionType,
            type => state.resolveUnderlyingType(type));
        if (!actual) return;
        const rightSource = expressionSource(node.expression) ?? node.operator;
        if (target.kind === SemanticTypeKind.Reference
            || target.kind === SemanticTypeKind.VoidReference) {
            const actualObject = classifyObjectExpressionInfo(node.expression, environment,
                type => state.resolveUnderlyingType(type));
            if (isReferenceTransferCompatible(target, actual, actualObject) === false) {
                state.reportInvalidAssignmentValueType(rightSource, targetType, expressionType);
            }
            return;
        }
        const compatibility = isAssignmentValueCompatible(target, actual);
        if (compatibility === false) {
            // CONT changes the effective target from REF T to T.
            state.reportInvalidAssignmentValueType(
                rightSource, node.contOperator ? target : targetType, expressionType
            );
        } else if (compatibility === true) {
            const truncation = characterTruncationForValueTransfer(target, actual);
            if (truncation) state.reportCharacterTruncation(rightSource,
                truncation.targetLength, truncation.sourceLength, { kind: 'assignment' });
        }
    }

    private analyzeReturnStatement(
        node: ReturnStatementNode,
        environment: Environment,
        resultType: SemanticType | undefined,
        state: SemanticAnalysisState
    ): void {
        if (!node.expression) return;
        // NIL has no standalone SemanticType: its validity depends on the
        // destination type. Keep it as a literal in the syntax tree and check
        // compatibility with the declared RETURNS type, as for REF INIT(NIL).
        // Extra parentheses must not affect this contextual rule.
        let returnValue: ExpressionNode | undefined = node.expression;
        while (returnValue?.kind === AstKind.ParenthesizedExpression) {
            returnValue = (returnValue as ParenthesizedExpressionNode).expression;
        }
        if (returnValue?.kind === AstKind.LiteralExpression
            && (returnValue as LiteralExpressionNode).literal.value === 'NIL') {
            const target = resultType && state.resolveUnderlyingType(resultType);
            if (target && !isNilAssignableTo(target)) {
                state.reportInvalidReturnType((returnValue as LiteralExpressionNode).literal);
            }
            return;
        }
        const expressionType = state.expressionTypeResolver.resolve(node.expression, environment);
        // Errors already reported in an operand must not cause a second return error.
        if (!resultType || !expressionType) return;
        // Resolve aliases only at the REF boundary; preserve named component
        // types and do not flatten recursive structures in the semantic model.
        const target = resolveReferenceTransferType(resultType,
            type => state.resolveUnderlyingType(type));
        const source = resolveReferenceTransferType(expressionType,
            type => state.resolveUnderlyingType(type));
        if (!target || !source) return;
        if (target.kind === SemanticTypeKind.Reference
            || target.kind === SemanticTypeKind.VoidReference) {
            // A REF return transfers a reference value or the address of a
            // suitable object. There is NO implicit dereference here.
            // The same rule is used by REF value parameters.
            const object = classifyObjectExpressionInfo(node.expression, environment,
                type => state.resolveUnderlyingType(type));
            if (isReferenceTransferCompatible(target, source, object) === false) {
                state.reportInvalidReturnType(expressionSource(node.expression) ?? node.keyword);
            }
            return;
        }
        const compatibility = isValueTransferCompatible(target, source);
        if (compatibility === false) {
            state.reportInvalidReturnType(node.keyword);
        } else if (compatibility === true) {
            const truncation = characterTruncationForValueTransfer(target, source);
            if (truncation) state.reportCharacterTruncation(
                expressionSource(node.expression) ?? node.keyword,
                truncation.targetLength, truncation.sourceLength, { kind: 'return' });
        }
    }

    private analyzeCallStatement(
        node: CallStatementNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        // CALL actuals are syntactic expressions, even while IDENT/value
        // compatibility is still deferred to the shared parameter checker.
        // This also supplies identifier bindings and types for hover/navigation.
        const actualParameters = node.actualParameters?.parameters ?? [];
        const actualExpressions = actualParameters.map(parameter => parameter.expression);
        const actualTypes = actualExpressions.map(expression => {
            if (!expression) return undefined;
            // Full CALL argument checks, especially IDENT, are still pending.
            // In particular, do not newly reject unresolved external device
            // designators (e.g. A1 in ASSIGN(A1, ...)) while migrating the AST.
            // Bind and document all names that are already known to semantics.
            if (expression instanceof NameExpressionNode) {
                const first = expression.segments[0]?.identifier;
                if (first && !resolveSymbol(environment, first.value) && !lookupBuiltin(first.value)) {
                    return undefined;
                }
            }
            return state.expressionTypeResolver.resolve(expression, environment);
        });
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
                } else if (actualTypes.every(type => type !== undefined)) {
                    const match = matchBuiltinSignature(builtin, actualTypes as SemanticType[]);
                    if (!match) {
                        state.reportInvalidBuiltinArgumentType(node.target, builtin.name);
                    } else {
                        validateBuiltinIdentificationParameters(node.target,
                            match.signature, actualExpressions, environment, state);
                    }
                }
                return environment;
            }
            // The statement is syntactically a CALL, even when its target is
            // unknown. Report this at the semantic lookup site rather than
            // manufacturing a binding or a diagnostic in the reference index.
            state.reportUnknownIdentifier(node.target);
            return environment;
        }
        state.bind(node.target, symbol);
        let signature: ProcedureType | undefined;
        if (symbol.kind === SymbolKind.Procedure) {
            signature = symbol.signature;
        } else if (symbol.kind === SymbolKind.DataObject) {
            // TYPE aliases retain their identity on the symbol. Unwrap only
            // for the question whether the referenced object is callable.
            // Both the reference itself and its target may be named types.
            const type = state.resolveUnderlyingType(symbol.type);
            if (!type) return environment; // already invalid/unresolved TYPE
            if (type.kind === SemanticTypeKind.Reference) {
                const target = state.resolveUnderlyingType(type.target);
                if (!target) return environment;
                if (target.kind === SemanticTypeKind.Procedure) signature = target;
            }
            if (!signature) {
                state.reportInvalidCallTarget(node.target);
                return environment;
            }
        } else {
            state.reportInvalidCallTarget(node.target);
            return environment;
        }
        const actualCount = node.argumentsList?.length ?? 0;
        if (signature && signature.parameters.length !== actualCount) {
            state.reportInvalidCallArity(node.target, signature.parameters.length, actualCount);
        } else if (signature) {
            validateProcedureActualParameters(node.target, signature,
                actualExpressions, actualTypes, environment, state);
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

        // FROM, BY and TO are evaluated in the enclosing environment, before
        // the implicit FOR variable becomes visible. WHILE and the body use
        // bodyEnvironment. Do not introduce the variable into these clauses.
        if (node.forClause) this.analyzeNode(node.forClause, environment, state);
        for (const clause of [node.fromClause, node.byClause, node.toClause]) {
            if (!clause) continue;
            this.analyzeRepetitionFixedExpression(clause, environment, state);
            this.analyzeNode(clause, environment, state);
        }
        if (node.whileClause) {
            if (node.whileClause.expression) {
                this.analyzeBitCondition(
                    node.whileClause.expression,
                    node.whileClause.expressionTokens[0] ?? node.whileClause.keyword,
                    'WHILE', bodyEnvironment, state
                );
            }
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
            case AstKind.DclDationAttribute:
                return this.analyzeDationDeclaration(
                    node,
                    node.attribute as DclDationAttributeNode,
                    environment,
                    state
                );

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

    private analyzeDationDeclaration(
        node: DclDeclarationSentenceNode,
        attribute: DclDationAttributeNode,
        environment: Environment,
        state: SemanticAnalysisState
    ): Environment {
        if (attribute.global && environment.scope.kind !== ScopeKind.Module) {
            state.reportGlobalDeclarationOutsideModule(attribute.global.keyword);
        }

        // CREATED denotes a system-dation name in the existing semantic scope.
        // Its binding is shared with Hover, Definition and Find References.
        if (attribute.systemDation) {
            const source = resolveSymbol(environment, attribute.systemDation.value);
            if (!source) {
                state.reportUnknownIdentifier(attribute.systemDation);
            } else {
                state.bind(attribute.systemDation, source);
                if (source.kind !== SymbolKind.DataObject
                    || source.type.kind !== SemanticTypeKind.Dation) {
                    state.reportInvalidDationCreationSource(attribute.systemDation);
                }
            }
        }

        if (!attribute.direction || !attribute.dationClass) {
            return environment;
        }
        const direction = this.dationDirection(attribute.direction.value);
        const dationClass = this.dationClass(attribute.dationClass.value);
        if (!direction || !dationClass) return environment;

        return this.introduceDeclaredDataObjects(
            node.identifiers,
            { kind: SemanticTypeKind.Dation, direction, dationClass },
            false,
            this.globalSymbolAttribute(attribute.global),
            environment,
            state
        );
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
                (localSpecification || indexedProcedure.global !== undefined)
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
                ...(signature.resultType !== undefined ? { resultType: signature.resultType } : {}),
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
            let definition = identifier;
            if (indexed?.kind === SymbolKind.Task) {
                const indexedTask = [...state.taskSymbols.values()]
                    .find(symbol => symbol.name === indexed.name);
                if (indexedTask && (!attribute.global || indexedTask.global !== undefined)) {
                    definition = indexed.name;
                    state.linkLocalSpecification('TASK', identifier, definition);
                }
            }
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
                declarationScope: environment.scope.kind,
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
                    declarationScope: environment.scope.kind,
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
                declarationScope: environment.scope.kind,
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
                declarationScope: environment.scope.kind,
                name: identifier,
                definition: systemDeclaration?.name ?? identifier,
                type,
                assignmentProtected: false,
                global: systemDeclaration ? (global ?? { kind: 'global' }) : global
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

        return { kind: 'global' };
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
