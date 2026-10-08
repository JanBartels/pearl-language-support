// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * Exact decimal value in seconds.
 *
 * The represented value is coefficient / 10^scale. The representation is
 * normalized by removing trailing decimal zeroes where possible.
 */
export interface DecimalTimeValue {
    readonly coefficient: bigint;
    readonly scale: number;
}

export function createDecimalTimeValue(
    coefficient: bigint,
    scale: number
): DecimalTimeValue {
    if (!Number.isSafeInteger(scale) || scale < 0) {
        throw new Error(`Invalid decimal scale ${scale}.`);
    }

    if (coefficient === BigInt(0)) {
        return { coefficient: BigInt(0), scale: 0 };
    }

    let normalizedCoefficient = coefficient;
    let normalizedScale = scale;

    while (
        normalizedScale > 0
        && normalizedCoefficient !== BigInt(0)
        && normalizedCoefficient % BigInt(10) === BigInt(0)
    ) {
        normalizedCoefficient /= BigInt(10);
        normalizedScale--;
    }

    return {
        coefficient: normalizedCoefficient,
        scale: normalizedScale
    };
}

export function parseDecimalTimeValue(
    literal: string
): DecimalTimeValue | undefined {
    const match = /^(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:E([+-]?\d+))?$/i.exec(literal);

    if (!match) {
        return undefined;
    }

    const integerPart = match[1] ?? '';
    const fractionalPart = match[2] ?? match[3] ?? '';
    const digits = `${integerPart}${fractionalPart}` || '0';

    let coefficient = BigInt(digits);
    let scale = fractionalPart.length;

    if (match[4]) {
        const exponent = Number(match[4]);

        if (!Number.isSafeInteger(exponent)) {
            return undefined;
        }

        scale -= exponent;
    }

    if (Math.abs(scale) > 10_000) {
        return undefined;
    }

    if (scale < 0) {
        coefficient *= pow10(-scale);
        scale = 0;
    }

    return createDecimalTimeValue(coefficient, scale);
}

export function addDecimalTimeValues(
    left: DecimalTimeValue,
    right: DecimalTimeValue
): DecimalTimeValue {
    const scale = Math.max(left.scale, right.scale);
    const leftCoefficient = left.coefficient * pow10(scale - left.scale);
    const rightCoefficient = right.coefficient * pow10(scale - right.scale);

    return createDecimalTimeValue(
        leftCoefficient + rightCoefficient,
        scale
    );
}

export function multiplyDecimalTimeValue(
    value: DecimalTimeValue,
    factor: bigint
): DecimalTimeValue {
    return createDecimalTimeValue(
        value.coefficient * factor,
        value.scale
    );
}

export function moduloDecimalTimeValue(
    value: DecimalTimeValue,
    wholeSeconds: bigint
): DecimalTimeValue {
    const modulus = wholeSeconds * pow10(value.scale);
    let coefficient = value.coefficient % modulus;

    if (coefficient < BigInt(0)) {
        coefficient += modulus;
    }

    return createDecimalTimeValue(coefficient, value.scale);
}

export function isDecimalTimeValueMultipleOf(
    value: DecimalTimeValue,
    resolutionNumerator: bigint,
    resolutionDenominator: bigint
): boolean {
    if (resolutionNumerator <= BigInt(0) || resolutionDenominator <= BigInt(0)) {
        throw new Error('Time resolution must be positive.');
    }

    const numerator = value.coefficient * resolutionDenominator;
    const denominator = pow10(value.scale) * resolutionNumerator;

    return numerator % denominator === BigInt(0);
}

export function compareDecimalTimeValueToInteger(
    value: DecimalTimeValue,
    integer: bigint
): number {
    const right = integer * pow10(value.scale);

    if (value.coefficient < right) {
        return -1;
    }

    if (value.coefficient > right) {
        return 1;
    }

    return 0;
}

export function formatDecimalTimeValue(
    value: DecimalTimeValue
): string {
    const negative = value.coefficient < BigInt(0);
    const coefficient = negative ? -value.coefficient : value.coefficient;

    if (value.scale === 0) {
        return `${negative ? '-' : ''}${coefficient.toString()}`;
    }

    const digits = coefficient.toString().padStart(value.scale + 1, '0');
    const split = digits.length - value.scale;
    const integerPart = digits.substring(0, split);
    const fractionalPart = digits.substring(split);

    return `${negative ? '-' : ''}${integerPart}.${fractionalPart}`;
}

export function decimalTimeScaleFactor(scale: number): bigint {
    return pow10(scale);
}

function pow10(exponent: number): bigint {
    if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > 10_000) {
        throw new Error(`Unsupported decimal exponent ${exponent}.`);
    }

    return BigInt(10) ** BigInt(exponent);
}
