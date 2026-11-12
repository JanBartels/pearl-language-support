// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import { InitElementNode } from '../ast/problem/declarations/initElementNode';
import { InitializationAttributeNode } from '../ast/problem/declarations/initializationAttributeNode';
import { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import { ConstantFixedExpressionNode } from '../ast/problem/expressions/constantFixedExpressionNode';
import { DurationConstantNode } from '../ast/problem/expressions/durationConstantNode';
import { SignedConstantExpressionNode } from '../ast/problem/expressions/signedConstantExpressionNode';
import type { Environment } from './environment';
import {
    SemanticConstantKind,
    SemanticInitialValueKind,
    type BitConstantValue,
    type CharacterConstantValue,
    type ClockConstantValue,
    type DurationConstantValue,
    type FloatConstantValue,
    type SemanticConstantValue,
    type SemanticInitialValue
} from './semanticConstantValue';
import type {
    ArrayType,
    BitType,
    CharacterType,
    FloatType,
    StructType,
    SemanticType
} from './semanticType';
import { SemanticTypeKind } from './semanticType';
import type { DataObjectSymbol, ProcedureSymbol, TaskSymbol } from './symbol';
import { CharacterConstantEvaluator } from './characterConstantEvaluator';
import { isNilAssignableTo } from './semanticTypeComparison';

export interface InitializationResolverContext {
    resolveUnderlyingType(type: SemanticType): SemanticType | undefined;

    evaluateConstantFixedExpression(
        expression: ConstantFixedExpressionNode,
        environment: Environment
    ): bigint | undefined;

    evaluateClockConstant(
        constant: ClockConstantNode,
        environment: Environment
    ): ClockConstantValue | undefined;

    evaluateDurationConstant(
        constant: DurationConstantNode,
        environment: Environment
    ): DurationConstantValue | undefined;

    evaluateSignedDurationConstantExpression(
        expression: SignedConstantExpressionNode,
        environment: Environment
    ): DurationConstantValue | undefined;

    resolveConstantFixedIdentifier(
        identifier: SourceValue<string>,
        environment: Environment
    ): bigint | undefined;

    resolveNamedConstantIdentifier(
        identifier: SourceValue<string>,
        environment: Environment,
        expectedKind: SemanticConstantKind,
        expectedTypeName: string
    ): SemanticConstantValue | undefined;

    resolveReferenceInitializer(
        identifier: SourceValue<string>,
        expectedTargetType: SemanticType | undefined,
        targetInvariant: boolean,
        environment: Environment
    ): DataObjectSymbol | TaskSymbol | ProcedureSymbol | undefined;

    registerNamedConstant(symbol: DataObjectSymbol, value: SemanticConstantValue): void;

    registerInitialValues(symbol: DataObjectSymbol, value: SemanticInitialValue): void;

    reportInitializationElementCount(
        keyword: SourceValue<string>,
        typeName: string,
        expected: number,
        actual: number
    ): void;

    reportTooManyInitializationElements(
        keyword: SourceValue<string>,
        typeName: string,
        available: bigint,
        actual: number
    ): void;

    reportInvalidInitialization(keyword: SourceValue<string>, typeName: string): void;

    reportInitializationValueTooLong(
        source: SourceValue<string>,
        typeName: string,
        maximumLength: number,
        actualLength: number
    ): void;
}

export interface DataObjectInitialization {
    apply(
        symbol: DataObjectSymbol,
        identifierIndex: number,
        environment: Environment
    ): void;
}

/** A compact, type-driven layout; arrays never need to be expanded. */
interface AggregateInitializationLayout {
    readonly elementCount: bigint;
    typeAt(offset: bigint): SemanticType | undefined;
}

interface InitializationValueResolver {
    readonly typeName: string;
    readonly namedConstantTarget: boolean;

    accepts(element: InitElementNode): boolean;

    evaluate(
        element: InitElementNode,
        environment: Environment
    ): SemanticConstantValue | undefined;
}

export class InitializationResolver {
    private readonly characterConstantEvaluator = new CharacterConstantEvaluator();

    constructor(
        private readonly context: InitializationResolverContext
    ) {}

    resolve(
        initialization: InitializationAttributeNode,
        type: SemanticType,
        identifierCount: number,
        environment: Environment
    ): DataObjectInitialization | undefined {
        const underlyingType = this.context.resolveUnderlyingType(type);
        if (!underlyingType) return undefined;

        if (underlyingType.kind === SemanticTypeKind.Array) {
            return this.resolveArrayInitialization(
                initialization, underlyingType, identifierCount, environment
            );
        }

        if (underlyingType.kind === SemanticTypeKind.Reference && isNilAssignableTo(underlyingType)) {
            return this.resolveReferenceInitialization(
                initialization,
                underlyingType.target,
                underlyingType.targetInvariant,
                identifierCount
            );
        }

        if (underlyingType.kind === SemanticTypeKind.VoidReference) {
            return this.resolveReferenceInitialization(
                initialization,
                undefined,
                underlyingType.targetInvariant,
                identifierCount
            );
        }

        if (underlyingType.kind === SemanticTypeKind.Struct) {
            return this.resolveAggregateInitialization(
                initialization, underlyingType, identifierCount, false
            );
        }

        const valueResolver = this.createValueResolver(underlyingType);

        if (!valueResolver) {
            return undefined;
        }

        return this.resolveScalarInitialization(
            initialization,
            identifierCount,
            valueResolver
        );
    }

    /**
     * STRUCT initializers are a flat list of leaf-component values. Recursively
     * calculate their layout from the RESOLVED type (including named types and
     * arrays), rather than treating every immediate STRUCT child as one value.
     *
     * For an unambiguous STRUCT binding the flattened list must be complete.
     * An ARRAY of STRUCT may have an explicit prefix, as other PEARL arrays do;
     * implicit repetition introduces no new source references. Incomplete
     * mixed STRUCT/ARRAY layouts are left unresolved rather than guessed.
     *
     * This pass resolves names and checks supported initializer element types;
     * it does not yet manufacture a mixed Constant/Reference aggregate value.
     */
    private resolveAggregateInitialization(
        initialization: InitializationAttributeNode,
        type: SemanticType,
        identifierCount: number,
        isArray: boolean
    ): DataObjectInitialization | undefined {
        const layout = this.aggregateLayout(type);
        if (!layout || layout.elementCount === 0n) return undefined;

        const total = layout.elementCount * BigInt(identifierCount);
        const actual = BigInt(initialization.elements.length);
        if (isArray) {
            if (actual > total) {
                this.context.reportTooManyInitializationElements(
                    initialization.keyword, 'STRUCT', total, initialization.elements.length
                );
                return undefined;
            }
        } else if (actual !== total) {
            // Incomplete nested component arrays do not have an established
            // grouping rule in our AST. Do not guess which later component
            // owns a value (or introduce a new validity restriction here).
            return undefined;
        }

        // Check the complete explicitly written prefix before binding names.
        // Reject malformed slots once, at the INIT attribute, rather than
        // producing one diagnostic per declared object.
        for (let index = 0; index < initialization.elements.length; index++) {
            const elementType = layout.typeAt(BigInt(index) % layout.elementCount);
            if (!elementType || !this.acceptsAggregateElement(initialization.elements[index], elementType)) {
                this.context.reportInvalidInitialization(initialization.keyword, 'STRUCT');
                return undefined;
            }
        }

        return {
            apply: (_symbol, identifierIndex, environment) => {
                const start = layout.elementCount * BigInt(identifierIndex);
                const end = start + layout.elementCount;
                const stop = end < actual ? Number(end) : initialization.elements.length;
                for (let index = Number(start); index < stop; index++) {
                    const elementType = layout.typeAt(BigInt(index) - start);
                    if (elementType) {
                        this.resolveAggregateElement(initialization.elements[index], elementType, environment);
                    }
                }
            }
        };
    }

    /**
     * A type-at-offset lookup keeps even large multidimensional arrays compact.
     * A REF is always a leaf, so recursive reference types do not recurse here.
     * Guard by-value cycles and unresolvable named types against endless descent.
     */
    private aggregateLayout(
        type: SemanticType,
        active: Set<SemanticType> = new Set()
    ): AggregateInitializationLayout | undefined {
        const underlying = this.context.resolveUnderlyingType(type);
        if (!underlying) return undefined;

        if (underlying.kind === SemanticTypeKind.Struct) {
            if (active.has(underlying)) return undefined;
            active.add(underlying);
            const children: { start: bigint; layout: AggregateInitializationLayout }[] = [];
            let count = 0n;
            for (const component of underlying.components) {
                const layout = this.aggregateLayout(component.type, active);
                if (!layout) {
                    active.delete(underlying);
                    return undefined;
                }
                children.push({ start: count, layout });
                count += layout.elementCount;
            }
            active.delete(underlying);
            return {
                elementCount: count,
                typeAt: offset => {
                    if (offset < 0n || offset >= count) return undefined;
                    for (const child of children) {
                        if (offset < child.start + child.layout.elementCount) {
                            return child.layout.typeAt(offset - child.start);
                        }
                    }
                    return undefined;
                }
            };
        }

        if (underlying.kind === SemanticTypeKind.Array) {
            if (active.has(underlying)) return undefined;
            active.add(underlying);
            const element = this.aggregateLayout(underlying.elementType, active);
            active.delete(underlying);
            if (!element || element.elementCount === 0n) return undefined;
            const count = this.semanticElementCount(underlying) * element.elementCount;
            return {
                elementCount: count,
                typeAt: offset => offset >= 0n && offset < count
                    ? element.typeAt(offset % element.elementCount)
                    : undefined
            };
        }

        if (underlying.kind === SemanticTypeKind.VirtualArray) return undefined;
        return { elementCount: 1n, typeAt: offset => offset === 0n ? underlying : undefined };
    }

    private acceptsAggregateElement(element: InitElementNode, type: SemanticType): boolean {
        if (type.kind === SemanticTypeKind.Reference || type.kind === SemanticTypeKind.VoidReference) {
            return element.value.kind === 'identifier' || element.value.kind === 'nil';
        }
        const valueResolver = this.createValueResolver(type);
        return valueResolver ? valueResolver.accepts(element) : true;
    }

    private resolveAggregateElement(
        element: InitElementNode,
        type: SemanticType,
        environment: Environment
    ): void {
        if (type.kind === SemanticTypeKind.Reference || type.kind === SemanticTypeKind.VoidReference) {
            if (element.value.kind === 'nil') return;
            if (element.value.kind !== 'identifier') return;
            this.context.resolveReferenceInitializer(
                element.value.identifier,
                type.kind === SemanticTypeKind.Reference ? type.target : undefined,
                type.targetInvariant,
                environment
            );
            return;
        }

        const valueResolver = this.createValueResolver(type);
        if (valueResolver && valueResolver.accepts(element)) {
            valueResolver.evaluate(element, environment);
        }
    }

    private resolveScalarInitialization(
        initialization: InitializationAttributeNode,
        identifierCount: number,
        valueResolver: InitializationValueResolver
    ): DataObjectInitialization | undefined {
        if (initialization.elements.length !== identifierCount) {
            this.context.reportInitializationElementCount(
                initialization.keyword,
                valueResolver.typeName,
                identifierCount,
                initialization.elements.length
            );
            return undefined;
        }

        if (!initialization.elements.every(element => valueResolver.accepts(element))) {
            this.context.reportInvalidInitialization(
                initialization.keyword,
                valueResolver.typeName
            );
            return undefined;
        }

        return {
            apply: (symbol, identifierIndex, environment) => {
                const element = initialization.elements[identifierIndex];
                const value = valueResolver.evaluate(element, environment);

                if (value === undefined) {
                    return;
                }

                this.context.registerInitialValues(symbol, {
                    kind: SemanticInitialValueKind.Constant,
                    values: [value],
                    elementCount: BigInt(1)
                });

                if (symbol.assignmentProtected && valueResolver.namedConstantTarget) {
                    this.context.registerNamedConstant(symbol, value);
                }
            }
        };
    }

    private resolveArrayInitialization(
        initialization: InitializationAttributeNode,
        type: ArrayType,
        identifierCount: number,
        environment: Environment
    ): DataObjectInitialization | undefined {
        const elementType = this.context.resolveUnderlyingType(type.elementType);

        if (!elementType) {
            return undefined;
        }

        if (elementType.kind === SemanticTypeKind.Struct
            || elementType.kind === SemanticTypeKind.Array) {
            return this.resolveAggregateInitialization(
                initialization, type, identifierCount, true
            );
        }

        if (elementType.kind === SemanticTypeKind.Reference) {
            return this.resolveReferenceArrayInitialization(
                initialization,
                type,
                elementType.target,
                elementType.targetInvariant,
                identifierCount,
                environment
            );
        }

        if (elementType.kind === SemanticTypeKind.VoidReference) {
            return this.resolveReferenceArrayInitialization(
                initialization,
                type,
                undefined,
                elementType.targetInvariant,
                identifierCount,
                environment
            );
        }

        const valueResolver = this.createValueResolver(elementType);

        if (!valueResolver) {
            return undefined;
        }

        if (!initialization.elements.every(element => valueResolver.accepts(element))) {
            this.context.reportInvalidInitialization(
                initialization.keyword,
                valueResolver.typeName
            );
            return undefined;
        }

        const elementsPerSymbol = this.semanticElementCount(type);
        const elementCount = elementsPerSymbol * BigInt(identifierCount);

        if (BigInt(initialization.elements.length) > elementCount) {
            this.context.reportTooManyInitializationElements(
                initialization.keyword,
                valueResolver.typeName,
                elementCount,
                initialization.elements.length
            );
            return undefined;
        }

        const values: SemanticConstantValue[] = [];

        for (const element of initialization.elements) {
            const value = valueResolver.evaluate(element, environment);

            if (value === undefined) {
                return undefined;
            }

            values.push(value);
        }

        if (values.length === 0) {
            return undefined;
        }

        return {
            apply: (symbol, identifierIndex) => {
                this.context.registerInitialValues(symbol, {
                    kind: SemanticInitialValueKind.Constant,
                    ...this.arrayInitialValue(values, elementsPerSymbol, identifierIndex)
                });
            }
        };
    }


    private resolveReferenceInitialization(
        initialization: InitializationAttributeNode,
        expectedTargetType: SemanticType | undefined,
        targetInvariant: boolean,
        identifierCount: number
    ): DataObjectInitialization | undefined {
        if (initialization.elements.length !== identifierCount) {
            this.context.reportInitializationElementCount(
                initialization.keyword,
                'REF',
                identifierCount,
                initialization.elements.length
            );
            return undefined;
        }

        if (!initialization.elements.every(element => element.value.kind === 'identifier'
            || element.value.kind === 'nil')) {
            this.context.reportInvalidInitialization(initialization.keyword, 'REF');
            return undefined;
        }

        return {
            apply: (symbol, identifierIndex, environment) => {
                const element = initialization.elements[identifierIndex];

                if (element.value.kind === 'nil') {
                    this.context.registerInitialValues(symbol, {
                        kind: SemanticInitialValueKind.Reference,
                        values: [null],
                        elementCount: BigInt(1)
                    });
                    return;
                }
                if (element.value.kind !== 'identifier') return;

                const target = this.context.resolveReferenceInitializer(
                    element.value.identifier,
                    expectedTargetType,
                    targetInvariant,
                    environment
                );
                if (!target) return;

                this.context.registerInitialValues(symbol, {
                    kind: SemanticInitialValueKind.Reference,
                    values: [target],
                    elementCount: BigInt(1)
                });
            }
        };
    }

    private resolveReferenceArrayInitialization(
        initialization: InitializationAttributeNode,
        type: ArrayType,
        expectedTargetType: SemanticType | undefined,
        targetInvariant: boolean,
        identifierCount: number,
        environment: Environment
    ): DataObjectInitialization | undefined {
        if (!initialization.elements.every(element => element.value.kind === 'identifier'
            || element.value.kind === 'nil')) {
            this.context.reportInvalidInitialization(initialization.keyword, 'REF');
            return undefined;
        }

        const elementsPerSymbol = this.semanticElementCount(type);
        const elementCount = elementsPerSymbol * BigInt(identifierCount);

        if (BigInt(initialization.elements.length) > elementCount) {
            this.context.reportTooManyInitializationElements(
                initialization.keyword,
                'REF',
                elementCount,
                initialization.elements.length
            );
            return undefined;
        }

        const targets: (DataObjectSymbol | TaskSymbol | ProcedureSymbol | null)[] = [];

        for (const element of initialization.elements) {
            if (element.value.kind === 'nil') {
                targets.push(null);
                continue;
            }
            if (element.value.kind !== 'identifier') return undefined;

            const target = this.context.resolveReferenceInitializer(
                element.value.identifier,
                expectedTargetType,
                targetInvariant,
                environment
            );
            if (!target) return undefined;
            targets.push(target);
        }

        if (targets.length === 0) {
            return undefined;
        }

        return {
            apply: (symbol, identifierIndex) => {
                this.context.registerInitialValues(symbol, {
                    kind: SemanticInitialValueKind.Reference,
                    ...this.arrayInitialValue(targets, elementsPerSymbol, identifierIndex)
                });
            }
        };
    }


    private arrayInitialValue<T>(
        values: readonly T[],
        elementCount: bigint,
        identifierIndex: number
    ): { readonly values: readonly T[]; readonly elementCount: bigint } {
        const start = elementCount * BigInt(identifierIndex);
        const end = start + elementCount;
        const explicitCount = BigInt(values.length);
        let localValues: readonly T[];

        if (start >= explicitCount) {
            localValues = [values[values.length - 1]];
        } else {
            const startIndex = Number(start);
            const endIndex = end >= explicitCount ? values.length : Number(end);
            localValues = values.slice(startIndex, endIndex);
        }

        return {
            values: localValues,
            elementCount
        };
    }

    private createValueResolver(type: SemanticType): InitializationValueResolver | undefined {
        switch (type.kind) {
            case SemanticTypeKind.Fixed:
                return this.createFixedValueResolver();

            case SemanticTypeKind.Float:
                return this.createFloatValueResolver(type);

            case SemanticTypeKind.Bit:
                return this.createBitValueResolver(type);

            case SemanticTypeKind.Character:
                return this.createCharacterValueResolver(type);

            case SemanticTypeKind.Clock:
                return this.createClockValueResolver();

            case SemanticTypeKind.Duration:
                return this.createDurationValueResolver();

            default:
                return undefined;
        }
    }

    private createFixedValueResolver(): InitializationValueResolver {
        return {
            typeName: 'FIXED',
            namedConstantTarget: true,
            accepts: element =>
                element.value.kind === 'constantFixedExpression'
                || element.value.kind === 'identifier',
            evaluate: (element, environment) => {
                switch (element.value.kind) {
                    case 'constantFixedExpression': {
                        const value = this.context.evaluateConstantFixedExpression(
                            element.value.expression,
                            environment
                        );

                        return value === undefined
                            ? undefined
                            : { kind: SemanticConstantKind.Fixed, value };
                    }

                    case 'identifier': {
                        const value = this.context.resolveConstantFixedIdentifier(
                            element.value.identifier,
                            environment
                        );

                        return value === undefined
                            ? undefined
                            : { kind: SemanticConstantKind.Fixed, value };
                    }

                    default:
                        return undefined;
                }
            }
        };
    }

    private createFloatValueResolver(type: FloatType): InitializationValueResolver {
        void type;

        return {
            typeName: 'FLOAT',
            namedConstantTarget: false,
            accepts: element =>
                element.value.kind === 'floatingPoint'
                || element.value.kind === 'constantFixedExpression'
                || element.value.kind === 'identifier'
                || (
                    element.value.kind === 'signedConstantExpression'
                    && element.value.expression.operand.kind === 'floatingPoint'
                ),
            evaluate: (element, environment) => {
                switch (element.value.kind) {
                    case 'floatingPoint':
                        return {
                            kind: SemanticConstantKind.Float,
                            literal: element.value.literal.value
                        } satisfies FloatConstantValue;

                    case 'signedConstantExpression':
                        if (element.value.expression.operand.kind !== 'floatingPoint') {
                            return undefined;
                        }

                        return {
                            kind: SemanticConstantKind.Float,
                            literal: element.value.expression.sign.value
                                + element.value.expression.operand.literal.value
                        } satisfies FloatConstantValue;

                    case 'constantFixedExpression': {
                        const value = this.context.evaluateConstantFixedExpression(
                            element.value.expression,
                            environment
                        );

                        return value === undefined
                            ? undefined
                            : { kind: SemanticConstantKind.Fixed, value };
                    }

                    case 'identifier': {
                        /*
                         * FLOAT selbst ist nach dem PEARL-Sprachreport keine
                         * benannte Konstante. Zulässig ist hier aber eine
                         * benannte FIXED-Konstante, da FIXED nach FLOAT
                         * zugewiesen werden darf.
                         */
                        const value = this.context.resolveConstantFixedIdentifier(
                            element.value.identifier,
                            environment
                        );

                        return value === undefined
                            ? undefined
                            : { kind: SemanticConstantKind.Fixed, value };
                    }

                    default:
                        return undefined;
                }
            }
        };
    }

    private createBitValueResolver(type: BitType): InitializationValueResolver {
        return {
            typeName: 'BIT',
            namedConstantTarget: true,
            accepts: element =>
                element.value.kind === 'bitString'
                || element.value.kind === 'identifier',
            evaluate: (element, environment) => {
                let value: BitConstantValue | undefined;
                let source: SourceValue<string>;

                switch (element.value.kind) {
                    case 'bitString':
                        source = element.value.literal;
                        value = this.parseBitConstant(element.value.literal.value);
                        break;

                    case 'identifier': {
                        source = element.value.identifier;
                        const resolved = this.context.resolveNamedConstantIdentifier(
                            element.value.identifier,
                            environment,
                            SemanticConstantKind.Bit,
                            'BIT'
                        );
                        value = resolved?.kind === SemanticConstantKind.Bit
                            ? resolved
                            : undefined;
                        break;
                    }

                    default:
                        return undefined;
                }

                if (!value) {
                    return undefined;
                }

                return this.fitBitValue(value, source, type.length);
            }
        };
    }

    private createCharacterValueResolver(type: CharacterType): InitializationValueResolver {
        return {
            typeName: 'CHAR',
            /*
             * Ohne LENGTH-Vereinbarung ist CHAR gleich CHAR(1). Sobald LENGTH
             * semantisch ausgewertet wird, soll der SemanticTypeResolver hier
             * die effektive Länge liefern statt undefined zu belassen.
             */
            namedConstantTarget: type.length === undefined || type.length === 1,
            accepts: element =>
                element.value.kind === 'characterString'
                || element.value.kind === 'identifier',
            evaluate: (element, environment) => {
                let value: CharacterConstantValue | undefined;
                let source: SourceValue<string>;

                switch (element.value.kind) {
                    case 'characterString': {
                        const first = element.value.literals[0];
                        if (!first) return undefined;

                        source = first;
                        // Literal spelling is joined BEFORE decoding. Doubled
                        // apostrophes across a macro boundary must be decoded
                        // as part of the complete PEARL character constant.
                        value = this.characterConstantEvaluator.evaluate(
                            element.value.literals.map(part => part.value).join('')
                        );
                        break;
                    }

                    case 'identifier': {
                        source = element.value.identifier;
                        const resolved = this.context.resolveNamedConstantIdentifier(
                            element.value.identifier,
                            environment,
                            SemanticConstantKind.Character,
                            'CHAR(1)'
                        );
                        value = resolved?.kind === SemanticConstantKind.Character
                            ? resolved
                            : undefined;
                        break;
                    }

                    default:
                        return undefined;
                }

                if (!value) {
                    return undefined;
                }

                return this.fitCharacterValue(value, source, type.length);
            }
        };
    }

    private createClockValueResolver(): InitializationValueResolver {
        return {
            typeName: 'CLOCK',
            namedConstantTarget: true,
            accepts: element =>
                element.value.kind === 'clock'
                || element.value.kind === 'identifier',
            evaluate: (element, environment) => {
                switch (element.value.kind) {
                    case 'clock':
                        return this.context.evaluateClockConstant(
                            element.value.constant,
                            environment
                        );

                    case 'identifier': {
                        const resolved = this.context.resolveNamedConstantIdentifier(
                            element.value.identifier,
                            environment,
                            SemanticConstantKind.Clock,
                            'CLOCK'
                        );

                        return resolved?.kind === SemanticConstantKind.Clock
                            ? resolved
                            : undefined;
                    }

                    default:
                        return undefined;
                }
            }
        };
    }

    private createDurationValueResolver(): InitializationValueResolver {
        return {
            typeName: 'DURATION',
            namedConstantTarget: true,
            accepts: element =>
                element.value.kind === 'duration'
                || element.value.kind === 'identifier'
                || (
                    element.value.kind === 'signedConstantExpression'
                    && element.value.expression.operand.kind === 'duration'
                ),
            evaluate: (element, environment) => {
                switch (element.value.kind) {
                    case 'duration':
                        return this.context.evaluateDurationConstant(
                            element.value.constant,
                            environment
                        );

                    case 'signedConstantExpression':
                        if (element.value.expression.operand.kind !== 'duration') {
                            return undefined;
                        }

                        return this.context.evaluateSignedDurationConstantExpression(
                            element.value.expression,
                            environment
                        );

                    case 'identifier': {
                        const resolved = this.context.resolveNamedConstantIdentifier(
                            element.value.identifier,
                            environment,
                            SemanticConstantKind.Duration,
                            'DURATION'
                        );

                        return resolved?.kind === SemanticConstantKind.Duration
                            ? resolved
                            : undefined;
                    }

                    default:
                        return undefined;
                }
            }
        };
    }

    private fitBitValue(
        value: BitConstantValue,
        source: SourceValue<string>,
        targetLength: number | undefined
    ): BitConstantValue | undefined {
        if (targetLength === undefined) {
            return value;
        }

        if (value.bits.length > targetLength) {
            this.context.reportInitializationValueTooLong(
                source,
                'BIT',
                targetLength,
                value.bits.length
            );
            return undefined;
        }

        return {
            kind: SemanticConstantKind.Bit,
            bits: value.bits.padEnd(targetLength, '0')
        };
    }

    private fitCharacterValue(
        value: CharacterConstantValue,
        source: SourceValue<string>,
        targetLength: number | undefined
    ): CharacterConstantValue | undefined {
        if (targetLength === undefined) {
            return value;
        }

        if (value.value.length > targetLength) {
            this.context.reportInitializationValueTooLong(
                source,
                'CHAR',
                targetLength,
                value.value.length
            );
            return undefined;
        }

        return {
            kind: SemanticConstantKind.Character,
            value: value.value.padEnd(targetLength, ' ')
        };
    }

    private parseBitConstant(literal: string): BitConstantValue | undefined {
        const match = /^'([0-9A-Fa-f]+)'(B|B1|B2|B3|B4)$/.exec(literal);

        if (!match) {
            return undefined;
        }

        const digits = match[1];
        const suffix = match[2];
        const bitsPerDigit = suffix === 'B' || suffix === 'B1'
            ? 1
            : Number(suffix.substring(1));
        const maximumDigit = (1 << bitsPerDigit) - 1;
        let bits = '';

        for (const digit of digits) {
            const value = Number.parseInt(digit, 16);

            if (!Number.isInteger(value) || value > maximumDigit) {
                return undefined;
            }

            bits += value.toString(2).padStart(bitsPerDigit, '0');
        }

        return {
            kind: SemanticConstantKind.Bit,
            bits
        };
    }

    private semanticElementCount(type: ArrayType): bigint {
        let count = BigInt(1);

        for (const dimension of type.dimensions) {
            count *= dimension.upperBound - dimension.lowerBound + BigInt(1);
        }

        return count;
    }
}
