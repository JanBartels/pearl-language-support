// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { DecimalTimeValue } from '../semantic/decimalTimeValue';
import { decimalTimeScaleFactor } from '../semantic/decimalTimeValue';
import {
    SemanticConstantKind,
    SemanticConstantValue,
    SemanticInitialValue,
    SemanticInitialValueKind
} from '../semantic/semanticConstantValue';

export function appendSemanticConstantValue(
    documentation: string,
    value: SemanticConstantValue | undefined
): string {
    if (!value) {
        return documentation;
    }

    return `${documentation.trimEnd()}

**Evaluated value:** \`${formatSemanticConstantValue(value)}\`
`;
}

export function appendSemanticInitialValue(
    documentation: string,
    value: SemanticInitialValue | undefined
): string {
    if (!value || value.values.length === 0) {
        return documentation;
    }

    const formatted = value.kind === SemanticInitialValueKind.Constant
        ? formatRepeatedValues(value.values, value.elementCount)
        : formatRepeatedReferenceValues(value.values, value.elementCount);

    if (value.elementCount === BigInt(1)) {
        return `${documentation.trimEnd()}

**Initial value:** \`${formatted}\`
`;
    }

    return `${documentation.trimEnd()}

**Initial values:** \`${formatted}\`
`;
}

export function appendSemanticPresetValues(
    documentation: string,
    values: readonly SemanticConstantValue[] | undefined
): string {
    if (!values || values.length === 0) {
        return documentation;
    }

    if (values.length === 1) {
        return `${documentation.trimEnd()}

**PRESET value:** \`${formatSemanticConstantValue(values[0])}\`
`;
    }

    return `${documentation.trimEnd()}

**PRESET values:** \`${formatValues(values)}\`
`;
}

function formatRepeatedValues(
    values: readonly SemanticConstantValue[],
    elementCount: bigint
): string {
    return formatRepeatedSequence(values, elementCount, formatSemanticConstantValue);
}

function formatRepeatedReferenceValues(
    values: readonly { readonly name: { readonly value: string } }[],
    elementCount: bigint
): string {
    return formatRepeatedSequence(values, elementCount, value => value.name.value);
}

function formatRepeatedSequence<T>(
    values: readonly T[],
    elementCount: bigint,
    formatValue: (value: T) => string
): string {
    const maximumExpandedValues = 16;

    if (elementCount <= BigInt(maximumExpandedValues)) {
        const count = Number(elementCount);
        const last = values[values.length - 1];
        const expanded = Array.from(
            { length: count },
            (_, index) => values[index] ?? last
        );

        return expanded.map(formatValue).join(', ');
    }

    if (values.length === 1) {
        return `${formatValue(values[0])} (repeated ${elementCount} times)`;
    }

    const displayed = values.slice(0, maximumExpandedValues).map(formatValue).join(', ');
    const prefix = values.length > maximumExpandedValues ? `${displayed}, ...` : displayed;
    const explicitCount = BigInt(values.length);

    if (explicitCount < elementCount) {
        const remaining = elementCount - explicitCount;
        const valueWord = values.length === 1 ? 'value' : 'values';
        const elementWord = remaining === BigInt(1) ? 'element' : 'elements';

        return `${prefix} (${values.length} explicit ${valueWord}; last value repeated for remaining `
            + `${remaining} ${elementWord})`;
    }

    if (explicitCount === elementCount) {
        return `${prefix} (${elementCount} explicitly initialized elements)`;
    }

    return `${prefix} (${values.length} explicit values for ${elementCount} elements)`;
}

function formatValues(values: readonly SemanticConstantValue[]): string {
    const maximumValues = 16;
    const displayed = values.slice(0, maximumValues).map(formatSemanticConstantValue);

    return values.length <= maximumValues
        ? displayed.join(', ')
        : `${displayed.join(', ')}, ... (${values.length} values)`;
}

function formatSemanticConstantValue(
    value: SemanticConstantValue
): string {
    switch (value.kind) {
        case SemanticConstantKind.Fixed:
            return value.value.toString();

        case SemanticConstantKind.Float:
            return value.literal;

        case SemanticConstantKind.Bit:
            return `'${value.bits}'B`;

        case SemanticConstantKind.Character:
            return formatCharacterConstant(value.value);

        case SemanticConstantKind.Clock:
            return formatClockConstant(value.secondsSinceMidnight);

        case SemanticConstantKind.Duration:
            return formatDurationConstant(value.seconds);
    }
}

function formatCharacterConstant(value: string): string {
    let result = "'";

    for (const character of value) {
        const code = character.charCodeAt(0);

        if (character === "'") {
            result += "''";
        } else if (code >= 0x20 && code <= 0x7e) {
            result += character;
        } else {
            result += `\\${code.toString(16).toUpperCase().padStart(2, '0')}\\`;
        }
    }

    return result + "'";
}

function formatClockConstant(value: DecimalTimeValue): string {
    const factor = decimalTimeScaleFactor(value.scale);
    const hourFactor = BigInt(3600) * factor;
    const minuteFactor = BigInt(60) * factor;

    let remainder = value.coefficient;
    const hours = remainder / hourFactor;
    remainder %= hourFactor;
    const minutes = remainder / minuteFactor;
    const seconds = remainder % minuteFactor;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        + `:${formatScaledSeconds(seconds, value.scale)}`;
}

function formatDurationConstant(value: DecimalTimeValue): string {
    const negative = value.coefficient < BigInt(0);
    const factor = decimalTimeScaleFactor(value.scale);
    const hourFactor = BigInt(3600) * factor;
    const minuteFactor = BigInt(60) * factor;

    let remainder = negative ? -value.coefficient : value.coefficient;
    const hours = remainder / hourFactor;
    remainder %= hourFactor;
    const minutes = remainder / minuteFactor;
    const seconds = remainder % minuteFactor;

    const parts: string[] = [];

    if (hours !== BigInt(0)) {
        parts.push(`${hours} HRS`);
    }

    if (minutes !== BigInt(0)) {
        parts.push(`${minutes} MIN`);
    }

    if (seconds !== BigInt(0) || parts.length === 0) {
        parts.push(`${formatScaledSeconds(seconds, value.scale, false)} SEC`);
    }

    return `${negative ? '-' : ''}${parts.join(' ')}`;
}

function formatScaledSeconds(
    coefficient: bigint,
    scale: number,
    padInteger: boolean = true
): string {
    const factor = decimalTimeScaleFactor(scale);
    const integer = coefficient / factor;
    const fraction = coefficient % factor;
    const integerText = padInteger
        ? integer.toString().padStart(2, '0')
        : integer.toString();

    if (scale === 0 || fraction === BigInt(0)) {
        return integerText;
    }

    const fractionText = fraction
        .toString()
        .padStart(scale, '0')
        .replace(/0+$/, '');

    return `${integerText}.${fractionText}`;
}
