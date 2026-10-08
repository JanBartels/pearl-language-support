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
    type BitConstantValue,
    type CharacterConstantValue,
    type ClockConstantValue,
    type DurationConstantValue,
    type FloatConstantValue,
    type SemanticConstantValue
} from './semanticConstantValue';
import type {
    ArrayType,
    BitType,
    CharacterType,
    FloatType,
    SemanticType
} from './semanticType';
import { SemanticTypeKind } from './semanticType';
import type { DataObjectSymbol } from './symbol';

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

    registerNamedConstant(symbol: DataObjectSymbol, value: SemanticConstantValue): void;

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
    constructor(
        private readonly context: InitializationResolverContext
    ) {}

    resolve(
        initialization: InitializationAttributeNode,
        type: SemanticType,
        identifierCount: number,
        environment: Environment
    ): DataObjectInitialization | undefined {
        if (type.kind === SemanticTypeKind.Array) {
            return this.resolveArrayInitialization(
                initialization,
                type,
                identifierCount,
                environment
            );
        }

        const underlyingType = this.context.resolveUnderlyingType(type);

        if (!underlyingType) {
            return undefined;
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

                if (
                    value !== undefined
                    && symbol.assignmentProtected
                    && valueResolver.namedConstantTarget
                ) {
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

        const elementCount = this.semanticElementCount(type) * BigInt(identifierCount);

        if (BigInt(initialization.elements.length) > elementCount) {
            this.context.reportTooManyInitializationElements(
                initialization.keyword,
                valueResolver.typeName,
                elementCount,
                initialization.elements.length
            );
            return undefined;
        }

        for (const element of initialization.elements) {
            valueResolver.evaluate(element, environment);
        }

        /*
         * Felder sind keine benannten Konstanten. Die explizit angegebenen
         * INIT-Werte wurden semantisch geprüft; die PEARL-Wiederholungsregel
         * für den letzten Wert verändert den Syntaxbaum nicht.
         */
        return undefined;
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
                    case 'characterString':
                        source = element.value.literal;
                        value = this.parseCharacterConstant(element.value.literal.value);
                        break;

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

    private parseCharacterConstant(literal: string): CharacterConstantValue | undefined {
        if (literal.length < 2 || literal[0] !== "'" || literal[literal.length - 1] !== "'") {
            return undefined;
        }

        const body = literal.substring(1, literal.length - 1);
        let value = '';

        for (let index = 0; index < body.length;) {
            const character = body[index];

            if (character === "'" && body[index + 1] === "'") {
                value += "'";
                index += 2;
                continue;
            }

            if (character === '\\') {
                const end = body.indexOf('\\', index + 1);

                if (end < 0) {
                    return undefined;
                }

                const hex = body.substring(index + 1, end);

                if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hex)) {
                    return undefined;
                }

                for (let hexIndex = 0; hexIndex < hex.length; hexIndex += 2) {
                    value += String.fromCharCode(Number.parseInt(hex.substring(hexIndex, hexIndex + 2), 16));
                }

                index = end + 1;
                continue;
            }

            value += character;
            index++;
        }

        return {
            kind: SemanticConstantKind.Character,
            value
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
