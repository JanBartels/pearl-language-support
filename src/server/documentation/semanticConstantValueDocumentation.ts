// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { DecimalTimeValue } from '../semantic/decimalTimeValue';
import { decimalTimeScaleFactor } from '../semantic/decimalTimeValue';
import { SemanticConstantKind, SemanticConstantValue } from '../semantic/semanticConstantValue';

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
