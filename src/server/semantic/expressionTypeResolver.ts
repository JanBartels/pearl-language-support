// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import { AstKind } from '../ast/astKind';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import { DurationConstantNode } from '../ast/problem/expressions/durationConstantNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import type { NameSegmentNode } from '../ast/problem/expressions/nameSegmentNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import { MonadicExpressionNode } from '../ast/problem/expressions/monadicExpressionNode';
import { DyadicExpressionNode } from '../ast/problem/expressions/dyadicExpressionNode';
import type { Environment } from './environment';
import type { ClockConstantValue, DurationConstantValue } from './semanticConstantValue';
import { resolveSymbol } from './symbolResolver';
import { SymbolKind } from './symbolKind';
import type { SemanticSymbol } from './symbol';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType, ProcedureType, ArrayType, VirtualArrayType } from './semanticType';
import { classifyObjectExpression, expressionSource } from './expressionObject';
import { validateProcedureActualParameters, validateBuiltinIdentificationParameters } from './procedureActualParameterValidator';
import { lookupBuiltin } from './builtins/builtinCatalog';
import type { BuiltinDefinition } from './builtins/builtinSignature';
import { matchBuiltinSignature, builtinExpectedArity, acceptsBuiltinArity } from './builtins/builtinSignature';

/** The expression resolver is a semantic phase, never a dependency of the parser/AST. */
export interface ExpressionTypeResolverContext {
    bind(source: SourceValue<string>, symbol: SemanticSymbol): void;
    bindBuiltin(source: SourceValue<string>, builtin: BuiltinDefinition): void;
    reportInvalidBuiltinCallArity(source: SourceValue<string>, expected: string, actual: number): void;
    reportInvalidBuiltinArgumentType(source: SourceValue<string>, builtinName: string): void;
    reportUnknownIdentifier(source: SourceValue<string>): void;
    reportInvalidExpressionOperands(source: SourceValue<string>): void;
    reportUnsupportedContExpression(source: SourceValue<string>): void;
    reportUnsupportedBitConcatenation(source: SourceValue<string>): void;
    reportInvalidCallArity(source: SourceValue<string>, expected: number, actual: number): void;
    reportInvalidIdentificationArgument(source: SourceValue<string>, target: SourceValue<string>,
        position: number, formalName?: string, reason?: 'protected'): void;
    reportInvalidFunctionArgumentType(
        source: SourceValue<string>, functionName: SourceValue<string>, position: number,
        expected: SemanticType, actual: SemanticType
    ): void;
    reportInvalidArrayIndexCount(source: SourceValue<string>, expected: number, actual: number): void;
    reportInvalidArrayIndexType(source: SourceValue<string>): void;
    reportInvalidArrayBoundDimension(
        source: SourceValue<string>, operator: SourceValue<string>, dimension: bigint, rank: number
    ): void;
    reportConstantIndexOutOfBounds(
        source: SourceValue<string>, owner: SourceValue<string>, dimension: number | undefined,
        index: bigint, lower: bigint, upper: bigint | undefined
    ): void;
    reportInvalidStringSelectorIndexType(source: SourceValue<string>): void;
    reportInvalidStringSelectorIndexCount(source: SourceValue<string>, actual: number): void;
    tryEvaluateFixedExpression(expression: ExpressionNode, environment: Environment): bigint | undefined;
    reportInvalidNameSuffix(source: SourceValue<string>): void;
    reportInvalidStructureSelection(source: SourceValue<string>): void;
    reportUnknownStructureComponent(source: SourceValue<string>): void;
    reportInvalidFunctionExpression(source: SourceValue<string>): void;
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;
    recordExpressionType(expression: ExpressionNode, type: SemanticType): void;
    evaluateClockConstant(constant: ClockConstantNode, environment: Environment): ClockConstantValue | undefined;
    evaluateDurationConstant(constant: DurationConstantNode, environment: Environment): DurationConstantValue | undefined;
}

/**
 * First semantic slice: scalar literals and names, arithmetic and simple
 * Boolean/comparison operators. Unsupported syntactic forms intentionally
 * have no inferred type until their full semantics is implemented.
 */
export class ExpressionTypeResolver {
    constructor(private readonly context: ExpressionTypeResolverContext) {}

    resolve(node: ExpressionNode | undefined, environment: Environment): SemanticType | undefined {
        if (!node) return undefined;
        let type: SemanticType | undefined;
        switch (node.kind) {
            case AstKind.LiteralExpression:
                type = this.literal(node as LiteralExpressionNode);
                break;
            case AstKind.ClockConstant:
                if (this.context.evaluateClockConstant(node as ClockConstantNode, environment)) {
                    type = { kind: SemanticTypeKind.Clock };
                }
                break;
            case AstKind.DurationConstant:
                if (this.context.evaluateDurationConstant(node as DurationConstantNode, environment)) {
                    type = { kind: SemanticTypeKind.Duration };
                }
                break;
            case AstKind.NameExpression:
                type = this.name(node as NameExpressionNode, environment);
                break;
            case AstKind.ParenthesizedExpression:
                type = this.resolve((node as ParenthesizedExpressionNode).expression, environment);
                break;
            case AstKind.MonadicExpression:
                type = this.monadic(node as MonadicExpressionNode, environment);
                break;
            case AstKind.DyadicExpression:
                type = this.dyadic(node as DyadicExpressionNode, environment);
                break;
        }
        if (type) this.context.recordExpressionType(node, type);
        return type;
    }

    private literal(node: LiteralExpressionNode): SemanticType | undefined {
        const value = node.literal.value;
        if (/^\d+$/.test(value)) {
            return { kind: SemanticTypeKind.Fixed,
                precision: this.precision(node, 15) };
        }
        if (/^(?:\d+\.\d*|\.\d+)(?:[Ee][+-]?\d+)?$/.test(value)
            || /^\d+[Ee][+-]?\d+$/.test(value)) {
            return { kind: SemanticTypeKind.Float,
                precision: this.precision(node, 23) };
        }
        // Lexer has already identified these as string/bit literals.
        // Only straightforward literal content is sized in this first slice.
        const bit = /^'([01]+)'B1?$/i.exec(value);
        if (bit) return { kind: SemanticTypeKind.Bit, length: bit[1].length };
        const binary = /^'([0-3]+)'B2$/i.exec(value);
        if (binary) return { kind: SemanticTypeKind.Bit, length: binary[1].length * 2 };
        const hex = /^'([0-9a-f]+)'B4$/i.exec(value);
        if (hex) return { kind: SemanticTypeKind.Bit, length: hex[1].length * 4 };
        const oct = /^'([0-7]+)'B3$/i.exec(value);
        if (oct) return { kind: SemanticTypeKind.Bit, length: oct[1].length * 3 };
        if (/^'(?:[^'\\]|'')*'$/.test(value)) {
            return { kind: SemanticTypeKind.Character,
                length: value.slice(1, -1).replace(/''/g, "'").length };
        }
        return undefined;
    }

    private precision(node: LiteralExpressionNode, defaultPrecision: number): number | undefined {
        if (!node.precision) return defaultPrecision;
        const value = Number(node.precision.value);
        return Number.isSafeInteger(value) && value > 0 ? value : undefined;
    }

    private name(node: NameExpressionNode, environment: Environment): SemanticType | undefined {
        const first = node.segments[0];
        if (!first) return undefined;
        const symbol = resolveSymbol(environment, first.identifier.value);
        const builtin = symbol ? undefined : lookupBuiltin(first.identifier.value);
        if (symbol) this.context.bind(first.identifier, symbol);
        else if (builtin) this.context.bindBuiltin(first.identifier, builtin);
        else this.context.reportUnknownIdentifier(first.identifier);

        // Every parenthesized slot remains a syntactic expression, regardless
        // of whether the enclosing name denotes an array or a function.
        // Check nested identifiers even when a prefix of the chain is invalid.
        const argumentTypes = node.segments.map(segment =>
            (segment.suffix?.expressions ?? []).map(argument => this.resolve(argument, environment)));
        if (!symbol) {
            return builtin ? this.builtinResult(node, builtin, argumentTypes, environment) : undefined;
        }

        let type: SemanticType | undefined;
        switch (symbol.kind) {
            case SymbolKind.DataObject:
            case SymbolKind.Parameter:
            case SymbolKind.Identification:
            case SymbolKind.LoopControlVariable:
                type = symbol.type;
                break;
            case SymbolKind.Procedure:
                type = symbol.signature;
                break;
            default:
                return undefined;
        }

        for (let index = 0; index < node.segments.length; index++) {
            const segment = node.segments[index];
            if (index > 0) {
                // A dot selects a component of the preceding type, not a new
                // symbol from the current lexical environment. BIT/CHAR is a
                // standard selector (not a STRUCT component).
                const preceding = type && this.context.resolveUnderlyingType(type);
                const selected = preceding?.kind === SemanticTypeKind.Reference
                    ? this.context.resolveUnderlyingType(preceding.target) : preceding;
                if (selected && this.isStringSelector(selected, segment.identifier.value)) {
                    if (!segment.suffix?.closeParenthesis
                        || segment.suffix.expressions.some(arg => !arg)) return undefined;
                    type = this.stringElement(segment.identifier, selected,
                        segment.suffix.expressions, argumentTypes[index], environment);
                    if (!type) return undefined;
                    continue;
                }
                type = type && this.structureComponent(segment, type);
                if (!type) return undefined;
            }

            if (segment.suffix) {
                // Incomplete syntax belongs to parser recovery, not semantics.
                if (!segment.suffix.closeParenthesis
                    || segment.suffix.expressions.some(arg => !arg)) return undefined;

                const resolved = type && this.context.resolveUnderlyingType(type);
                if (!resolved) return undefined;
                // A selector following a REF dereferences the reference for
                // array/function lookup, just as it does for dot selection.
                const selected = resolved.kind === SemanticTypeKind.Reference
                    ? this.context.resolveUnderlyingType(resolved.target) : resolved;
                if (!selected) return undefined;
                if (selected.kind === SemanticTypeKind.Array || selected.kind === SemanticTypeKind.VirtualArray) {
                    type = this.arrayElement(segment.identifier, selected,
                        segment.suffix.expressions, argumentTypes[index], environment);
                } else if (selected.kind === SemanticTypeKind.Procedure) {
                    type = this.functionResult(segment.identifier, selected,
                        segment.suffix.expressions, argumentTypes[index], environment);
                } else if (resolved.kind === SemanticTypeKind.Reference
                    || resolved.kind === SemanticTypeKind.VoidReference) {
                    // Context-dependent reference operations are deferred.
                    return undefined;
                } else {
                    this.context.reportInvalidNameSuffix(segment.identifier);
                    return undefined;
                }
                if (!type) return undefined;
            } else if (index === 0 && symbol.kind === SymbolKind.Procedure) {
                // The report also permits parameterless function calls without ().
                if (!symbol.signature?.hasResult || symbol.signature.parameters.length !== 0)
                    return undefined;
                type = symbol.signature.resultType;
            }
        }
        return type;
    }

    /** Intrinsics are not lexical symbols; their signatures already live in
     * the compiler builtin catalog and are shared with CALL and Hover. */
    private builtinResult(
        node: NameExpressionNode, builtin: BuiltinDefinition,
        argumentTypes: readonly (readonly (SemanticType | undefined)[])[],
        environment: Environment
    ): SemanticType | undefined {
        const first = node.segments[0];
        if (!first || node.segments.length !== 1) return undefined;
        const args = first.suffix?.expressions ?? [];
        if (first.suffix && (!first.suffix.closeParenthesis || args.some(arg => !arg))) return undefined;
        const types = argumentTypes[0] ?? [];
        if (builtin.category === 'procedure') {
            this.context.reportInvalidFunctionExpression(first.identifier);
            return undefined;
        }
        if (!builtin.signatures.some(signature => acceptsBuiltinArity(signature, args.length))) {
            this.context.reportInvalidBuiltinCallArity(first.identifier,
                builtinExpectedArity(builtin), args.length);
            return undefined;
        }
        // An argument with an earlier diagnostic has no known type. Do not
        // manufacture an additional builtin error in that case.
        if (types.some(type => !type)) return undefined;
        const match = matchBuiltinSignature(builtin, types as readonly SemanticType[]);
        if (!match) {
            this.context.reportInvalidBuiltinArgumentType(first.identifier, builtin.name);
            return undefined;
        }
        return validateBuiltinIdentificationParameters(first.identifier, match.signature,
            args, environment, this.context) ? match.resultType : undefined;
    }

    /** Resolve one lexical component against the preceding STRUCT value. */
    private structureComponent(segment: NameSegmentNode, preceding: SemanticType): SemanticType | undefined {
        let type = this.context.resolveUnderlyingType(preceding);
        if (!type) return undefined;
        if (type.kind === SemanticTypeKind.Reference) {
            // In RTOS-UH, a reference immediately followed by a selector is
            // dereferenced. This may happen again at the next dot in a chain.
            type = this.context.resolveUnderlyingType(type.target);
        }
        if (!type || type.kind === SemanticTypeKind.VoidReference) return undefined;
        if (type.kind !== SemanticTypeKind.Struct) {
            // BIT/CHAR selection is a separate grammar/semantics step. Do not
            // misdiagnose e.g. Byte.BIT(i) as a missing STRUCT component.
            if ((type.kind === SemanticTypeKind.Bit
                    && segment.identifier.value === 'BIT')
                || (type.kind === SemanticTypeKind.Character
                    && (segment.identifier.value === 'CHAR' || segment.identifier.value === 'CHARACTER'))) {
                return undefined;
            }
            this.context.reportInvalidStructureSelection(segment.identifier);
            return undefined;
        }
        const component = type.components.find(entry => entry.name.value === segment.identifier.value);
        if (!component) {
            this.context.reportUnknownStructureComponent(segment.identifier);
            return undefined;
        }
        // The component identity comes from its declaration SourceValue.
        // It is NOT inserted into the lexical scope: identically named
        // components in different STRUCT types remain independent.
        this.context.bind(segment.identifier, {
            kind: SymbolKind.StructComponent,
            name: component.name,
            type: component.type,
            containingType: preceding.kind === SemanticTypeKind.Reference
                ? preceding.target : preceding
        });
        return component.type;
    }

    private arrayElement(
        name: SourceValue<string>,
        array: ArrayType | VirtualArrayType,
        indexExpressions: readonly (ExpressionNode | undefined)[],
        indices: readonly (SemanticType | undefined)[],
        environment: Environment
    ): SemanticType | undefined {
        const rank = array.kind === SemanticTypeKind.Array
            ? array.dimensions.length : array.rank;
        if (indices.length !== rank) {
            this.context.reportInvalidArrayIndexCount(name, rank, indices.length);
            return undefined;
        }
        let valid = true;
        indices.forEach((original, position) => {
            if (!original) { valid = false; return; }
            const type = this.context.resolveUnderlyingType(original);
            if (!type) { valid = false; return; }
            if (type.kind === SemanticTypeKind.Reference
                || type.kind === SemanticTypeKind.VoidReference) {
                valid = false; // contextual implicit dereferencing follows later
                return;
            }
            if (type.kind !== SemanticTypeKind.Fixed) {
                this.context.reportInvalidArrayIndexType(name);
                valid = false;
                return;
            }
            if (array.kind !== SemanticTypeKind.Array) return;
            const expression = indexExpressions[position];
            const value = expression && this.context.tryEvaluateFixedExpression(expression, environment);
            const dimension = array.dimensions[position];
            if (value !== undefined && dimension &&
                (value < dimension.lowerBound || value > dimension.upperBound)) {
                this.context.reportConstantIndexOutOfBounds(
                    this.argumentDiagnosticSource(expression!) ?? name, name, position + 1,
                    value, dimension.lowerBound, dimension.upperBound);
                // Preserve the element type to avoid cascading RETURN errors.
            }
        });
        return valid ? array.elementType : undefined;
    }

    private isStringSelector(type: SemanticType, selector: string): boolean {
        return type.kind === SemanticTypeKind.Bit && selector === 'BIT'
            || type.kind === SemanticTypeKind.Character
            && (selector === 'CHAR' || selector === 'CHARACTER');
    }

    private stringElement(
        name: SourceValue<string>, type: SemanticType,
        argumentsNodes: readonly (ExpressionNode | undefined)[],
        argumentTypes: readonly (SemanticType | undefined)[],
        environment: Environment
    ): SemanticType | undefined {
        if (argumentTypes.length !== 1) {
            this.context.reportInvalidStringSelectorIndexCount(name, argumentTypes.length);
            return undefined;
        }
        const original = argumentTypes[0];
        const resolved = original && this.context.resolveUnderlyingType(original);
        if (!resolved) return undefined;
        if (resolved.kind !== SemanticTypeKind.Fixed) {
            // Automatic REF dereferencing will be treated separately.
            if (resolved.kind !== SemanticTypeKind.Reference
                && resolved.kind !== SemanticTypeKind.VoidReference)
                this.context.reportInvalidStringSelectorIndexType(name);
            return undefined;
        }
        const expression = argumentsNodes[0];
        const value = expression && this.context.tryEvaluateFixedExpression(expression, environment);
        // Explicit length is known. An absent length may be changed by LENGTH,
        // so do not assume the RTOS-UH default here.
        const upper = type.kind === SemanticTypeKind.Bit || type.kind === SemanticTypeKind.Character
            ? type.length === undefined ? undefined : BigInt(type.length) : undefined;
        if (value !== undefined && (value < BigInt(1) || upper !== undefined && value > upper)) {
            this.context.reportConstantIndexOutOfBounds(
                this.argumentDiagnosticSource(expression!) ?? name, name, undefined,
                value, BigInt(1), upper);
        }
        return type.kind === SemanticTypeKind.Bit
            ? { kind: SemanticTypeKind.Bit, length: 1 }
            : { kind: SemanticTypeKind.Character, length: 1 };
    }

    private functionResult(
        name: SourceValue<string>,
        signature: ProcedureType | undefined,
        argumentsNodes: readonly (ExpressionNode | undefined)[],
        argumentsTypes: readonly (SemanticType | undefined)[],
        environment: Environment
    ): SemanticType | undefined {
        if (!signature) return undefined;
        if (signature.parameters.length !== argumentsTypes.length) {
            this.context.reportInvalidCallArity(name, signature.parameters.length, argumentsTypes.length);
            return undefined;
        }
        if (!signature.hasResult) {
            this.context.reportInvalidFunctionExpression(name);
            return undefined;
        }
        const valid = validateProcedureActualParameters(name, signature, argumentsNodes,
            argumentsTypes, environment, this.context);
        // Do not cascade into outer expressions after an erroneous call.
        return valid ? signature.resultType : undefined;
    }

    /** Diagnostics refer to actual source values, never to a synthetic AST location. */
    private argumentDiagnosticSource(node: ExpressionNode): SourceValue<string> | undefined {
        return expressionSource(node);
    }

    private monadic(node: MonadicExpressionNode, environment: Environment): SemanticType | undefined {
        // RTOS-UH implements CONT only as an assignment destination operator.
        // The operand must still be resolved for name bindings and hover.
        if (node.operator.value === 'CONT') {
            this.resolve(node.operand, environment);
            this.context.reportUnsupportedContExpression(node.operator);
            return undefined;
        }
        const original = this.resolve(node.operand, environment);
        const operand = original && this.context.resolveUnderlyingType(original);
        if (!operand || !node.operand) return undefined;
        // RTOS-UH may automatically dereference REF values depending on use.
        // Defer this case until contextual dereference is modeled.
        if (this.reference(operand)) return undefined;
        switch (node.operator.value) {
            case '+':
            case '-':
            case 'ABS':
                if (this.numeric(operand) || operand.kind === SemanticTypeKind.Duration) return operand;
                break;
            case 'NOT':
                if (operand.kind === SemanticTypeKind.Bit) return operand;
                break;
            case 'SIGN':
                if (this.numeric(operand) || operand.kind === SemanticTypeKind.Duration) {
                    return { kind: SemanticTypeKind.Fixed, precision: 1 };
                }
                break;
            case 'TOFIXED':
                // RTOS-UH differs from PEARL 90 Table 6.2:
                // BIT(lg) -> FIXED(lg - 1), accounting for the sign bit.
                // CHAR(1) -> FIXED(7) remains unchanged.
                // An unspecified CHAR length may depend on LENGTH; do not
                // invent a fixed default length here.
                if (operand.kind === SemanticTypeKind.Bit) {
                    // FIXED(0) is not a valid RTOS-UH type. An unspecified
                    // length remains unspecified until LENGTH is considered.
                    if (operand.length !== undefined && operand.length < 2) {
                        this.context.reportInvalidExpressionOperands(node.operator);
                        return undefined;
                    }
                    return { kind: SemanticTypeKind.Fixed,
                        precision: operand.length === undefined ? undefined : operand.length - 1 };
                }
                if (operand.kind === SemanticTypeKind.Character
                    && (operand.length === undefined || operand.length === 1)) {
                    return { kind: SemanticTypeKind.Fixed, precision: 7 };
                }
                break;
            case 'TOFLOAT':
                if (operand.kind === SemanticTypeKind.Fixed) {
                    return { kind: SemanticTypeKind.Float, precision: operand.precision };
                }
                break;
            case 'TOBIT':
                if (operand.kind === SemanticTypeKind.Fixed) {
                    // RTOS-UH: FIXED(g) -> BIT(g + 1), including the sign bit.
                    return { kind: SemanticTypeKind.Bit,
                        length: operand.precision === undefined ? undefined : operand.precision + 1 };
                }
                break;
            case 'TOCHAR':
                if (operand.kind === SemanticTypeKind.Fixed) {
                    return { kind: SemanticTypeKind.Character, length: 1 };
                }
                break;
            case 'ENTIER':
            case 'ROUND':
                if (operand.kind === SemanticTypeKind.Float) {
                    return { kind: SemanticTypeKind.Fixed, precision: operand.precision };
                }
                break;
            case 'LWB':
            case 'UPB':
                if (this.arrayType(operand)) {
                    return { kind: SemanticTypeKind.Fixed, precision: 31 };
                }
                // PEARL 90 also permits monadic UPB on a character string.
                // Its result precision is FIXED(15), unlike array bounds.
                if (node.operator.value === 'UPB' && operand.kind === SemanticTypeKind.Character) {
                    return { kind: SemanticTypeKind.Fixed, precision: 15 };
                }
                break;
            default:
                // Other PEARL monadic operators need dedicated rules.
                return undefined;
        }
        this.context.reportInvalidExpressionOperands(node.operator);
        return undefined;
    }

    private dyadic(node: DyadicExpressionNode, environment: Environment): SemanticType | undefined {
        const originalLeft = this.resolve(node.left, environment);
        const originalRight = this.resolve(node.right, environment);
        const left = originalLeft && this.context.resolveUnderlyingType(originalLeft);
        const right = originalRight && this.context.resolveUnderlyingType(originalRight);
        if (!node.right) return undefined;

        const op = node.operator.value;
        const leftIsNil = this.isNilLiteral(node.left);
        const rightIsNil = this.isNilLiteral(node.right);
        if (leftIsNil || rightIsNil) {
            // NIL has no standalone type. In RTOS-UH it can be compared with
            // IS/ISNT only when the other operand is a reference. Ordinary
            // equality (==, /=, EQ, NE) and arithmetic with NIL are invalid.
            if ((op === 'IS' || op === 'ISNT') && leftIsNil !== rightIsNil) {
                const other = leftIsNil ? right : left;
                if (!other) return undefined; // The other operand already failed.
                if (this.reference(other)) {
                    return { kind: SemanticTypeKind.Bit, length: 1 };
                }
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        if (!left || !right) return undefined;
        if (op === 'IS' || op === 'ISNT') {
            // UH-PEARL 5.6.2.2: at least one operand must be a pointer;
            // the other must denote an addressable object or be a pointer.
            // NIL is handled separately above because it has no SemanticType.
            if ((this.reference(left) || this.reference(right))
                && (this.reference(left) || classifyObjectExpression(node.left, environment,
                    type => this.context.resolveUnderlyingType(type)) === 'object')
                && (this.reference(right) || classifyObjectExpression(node.right, environment,
                    type => this.context.resolveUnderlyingType(type)) === 'object')) {
                return { kind: SemanticTypeKind.Bit, length: 1 };
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        // Value comparisons are distinct from IS/ISNT reference comparisons.
        // In a value context, a typed REF denotes the value of its target
        // object. Only resolve that implicit dereference for comparisons here;
        // other operators await the shared contextual-REF analysis.
        if (['<', '>', '<=', '>=', 'LT', 'GT', 'LE', 'GE',
            '==', '/=', 'EQ', 'NE'].includes(op)) {
            const valueLeft = this.comparisonValueOperand(left);
            const valueRight = this.comparisonValueOperand(right);
            // Unknown/unsupported dereferencing must not trigger speculative
            // secondary diagnostics (e.g. an unresolved or VOID reference).
            if (!valueLeft || !valueRight) return undefined;
            const ordered = !['==', '/=', 'EQ', 'NE'].includes(op);
            if (this.numeric(valueLeft) && this.numeric(valueRight)
                || valueLeft.kind === SemanticTypeKind.Clock && valueRight.kind === SemanticTypeKind.Clock
                || valueLeft.kind === SemanticTypeKind.Duration && valueRight.kind === SemanticTypeKind.Duration
                || valueLeft.kind === SemanticTypeKind.Character && valueRight.kind === SemanticTypeKind.Character
                || !ordered && valueLeft.kind === SemanticTypeKind.Bit && valueRight.kind === SemanticTypeKind.Bit) {
                return { kind: SemanticTypeKind.Bit, length: 1 };
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        // The other operators do not yet have full contextual REF rules.
        if (this.reference(left) || this.reference(right)) return undefined;

        if (op === 'FIT') {
            // FIT changes the precision to that of the right operand. Both
            // operands must belong to the same numeric type (Table 6.5).
            // Preserve an unspecified precision for later LENGTH resolution.
            if (left.kind === SemanticTypeKind.Fixed && right.kind === SemanticTypeKind.Fixed) {
                return { kind: SemanticTypeKind.Fixed, precision: right.precision };
            }
            if (left.kind === SemanticTypeKind.Float && right.kind === SemanticTypeKind.Float) {
                return { kind: SemanticTypeKind.Float, precision: right.precision };
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        if (op === 'LWB' || op === 'UPB') {
            if (left.kind !== SemanticTypeKind.Fixed || !this.arrayType(right)) {
                this.context.reportInvalidExpressionOperands(node.operator);
                return undefined;
            }
            const rank = right.kind === SemanticTypeKind.Array
                ? right.dimensions.length : right.rank;
            // A dynamic dimension is valid; only known, invalid dimension
            // numbers can be rejected statically. Virtual arrays still have
            // a known rank even though their element bounds are unknown.
            const dimension = this.context.tryEvaluateFixedExpression(node.left, environment);
            if (dimension !== undefined && (dimension < BigInt(1) || dimension > BigInt(rank))) {
                this.context.reportInvalidArrayBoundDimension(
                    this.argumentDiagnosticSource(node.left) ?? node.operator,
                    node.operator, dimension, rank);
                return undefined;
            }
            return { kind: SemanticTypeKind.Fixed, precision: 31 };
        }
        if (['+', '-', '*', '/', '//', 'REM', '**'].includes(op)) {
            const result = this.arithmetic(op, left, right);
            if (result) return result;
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        if (['AND', 'OR', 'EXOR'].includes(op)) {
            if (left.kind === SemanticTypeKind.Bit && right.kind === SemanticTypeKind.Bit) {
                return { kind: SemanticTypeKind.Bit,
                    length: left.length === undefined || right.length === undefined
                        ? undefined : Math.max(left.length, right.length) };
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        if (op === 'SHIFT' || op === 'CSHIFT' || op === '<>') {
            // RTOS-UH: both logical and cyclic shifts require BIT shifted
            // by FIXED. The number of positions does not change BIT length.
            if (left.kind === SemanticTypeKind.Bit && right.kind === SemanticTypeKind.Fixed) {
                return { kind: SemanticTypeKind.Bit, length: left.length };
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        if (op === 'CAT' || op === '><') {
            // In the language report BIT strings can also be concatenated.
            // RTOS-UH expressly does not implement BIT concatenation (5.1.2).
            if (left.kind === SemanticTypeKind.Character
                && right.kind === SemanticTypeKind.Character) {
                // Preserve unspecified lengths until the effective LENGTH
                // settings are available in the semantic environment.
                return { kind: SemanticTypeKind.Character,
                    length: left.length === undefined || right.length === undefined
                        ? undefined : left.length + right.length };
            }
            if (left.kind === SemanticTypeKind.Bit && right.kind === SemanticTypeKind.Bit) {
                this.context.reportUnsupportedBitConcatenation(node.operator);
                return undefined;
            }
            this.context.reportInvalidExpressionOperands(node.operator);
            return undefined;
        }
        // Operator forms not covered by the first slice remain untyped.
        return undefined;
    }

    /** A typed REF is automatically dereferenced in a value comparison.
     * Do not guess the value type of VOID REF, a nested REF, or a procedure
     * reference until their contextual semantics are implemented.
     */
    private comparisonValueOperand(type: SemanticType): SemanticType | undefined {
        if (type.kind === SemanticTypeKind.VoidReference) return undefined;
        if (type.kind !== SemanticTypeKind.Reference) return type;
        const target = this.context.resolveUnderlyingType(type.target);
        if (!target || this.reference(target) || target.kind === SemanticTypeKind.Procedure) {
            return undefined;
        }
        return target;
    }

    /** Parentheses do not change the context-dependent NIL literal. */
    private isNilLiteral(expression: ExpressionNode): boolean {
        let current: ExpressionNode | undefined = expression;
        while (current?.kind === AstKind.ParenthesizedExpression) {
            current = (current as ParenthesizedExpressionNode).expression;
        }
        return current?.kind === AstKind.LiteralExpression
            && (current as LiteralExpressionNode).literal.value === 'NIL';
    }

    private arrayType(type: SemanticType): type is ArrayType | VirtualArrayType {
        return type.kind === SemanticTypeKind.Array || type.kind === SemanticTypeKind.VirtualArray;
    }

    private reference(type: SemanticType): boolean {
        return type.kind === SemanticTypeKind.Reference || type.kind === SemanticTypeKind.VoidReference;
    }

    private numeric(type: SemanticType): type is Extract<SemanticType,
        { kind: SemanticTypeKind.Fixed | SemanticTypeKind.Float }> {
        return type.kind === SemanticTypeKind.Fixed || type.kind === SemanticTypeKind.Float;
    }

    private arithmetic(op: string, left: SemanticType, right: SemanticType): SemanticType | undefined {
        if (this.numeric(left) && this.numeric(right)) {
            if (op === '//' || op === 'REM') {
                if (left.kind !== SemanticTypeKind.Fixed || right.kind !== SemanticTypeKind.Fixed) return undefined;
            }
            if (op === '**' && right.kind !== SemanticTypeKind.Fixed) return undefined;
            const precision = Math.max(left.precision ?? (left.kind === SemanticTypeKind.Fixed ? 15 : 23),
                right.precision ?? (right.kind === SemanticTypeKind.Fixed ? 15 : 23));
            if (op === '**') return left.kind === SemanticTypeKind.Fixed
                ? { kind: SemanticTypeKind.Fixed, precision: left.precision }
                : { kind: SemanticTypeKind.Float, precision: left.precision };
            if (op === '/') return { kind: SemanticTypeKind.Float, precision };
            return left.kind === SemanticTypeKind.Float || right.kind === SemanticTypeKind.Float
                ? { kind: SemanticTypeKind.Float, precision }
                : { kind: SemanticTypeKind.Fixed, precision };
        }
        // PEARL temporal arithmetic (table 6.5) has its own result rules.
        if (op === '+' || op === '-') {
            if (left.kind === SemanticTypeKind.Duration && right.kind === SemanticTypeKind.Duration)
                return { kind: SemanticTypeKind.Duration };
            if (op === '+' && (left.kind === SemanticTypeKind.Duration && right.kind === SemanticTypeKind.Clock
                || right.kind === SemanticTypeKind.Duration && left.kind === SemanticTypeKind.Clock)
                || op === '-' && left.kind === SemanticTypeKind.Clock && right.kind === SemanticTypeKind.Duration)
                return { kind: SemanticTypeKind.Clock };
            if (op === '-' && left.kind === SemanticTypeKind.Clock && right.kind === SemanticTypeKind.Clock)
                return { kind: SemanticTypeKind.Duration };
        }
        if ((op === '*' || op === '/') && left.kind === SemanticTypeKind.Duration && this.numeric(right))
            return { kind: SemanticTypeKind.Duration };
        if (op === '*' && right.kind === SemanticTypeKind.Duration && this.numeric(left))
            return { kind: SemanticTypeKind.Duration };
        if (op === '/' && left.kind === SemanticTypeKind.Duration && right.kind === SemanticTypeKind.Duration)
            return { kind: SemanticTypeKind.Float, precision: 31 };
        return undefined;
    }
}
