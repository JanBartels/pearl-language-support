// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';

/** Exact rational duration in seconds. */
export interface TimeResolution {
    readonly numerator: bigint;
    readonly denominator: bigint;
}

/** RTOS-UH default: CLOCK and DURATION use 1 ms units. */
export const DEFAULT_TIME_RESOLUTION: TimeResolution = {
    numerator: BigInt(1),
    denominator: BigInt(1000)
};

/** Default module reservation used by RTOS-UH if S/SC is absent. */
export const DEFAULT_MODULE_SIZE = BigInt(0x2000);

/** RTOS-UH MODE=CLOCK50: CLOCK and DURATION use the 50 us system clock. */
export const CLOCK50_TIME_RESOLUTION: TimeResolution = {
    numerator: BigInt(1),
    denominator: BigInt(20_000)
};

/**
 * Semantic configuration which applies to one PEARL module.
 *
 * `modes` preserves the source-order MODE statements. The remaining properties
 * expose their semantic effect to later compiler phases without forcing those
 * phases to interpret MODE strings themselves.
 */
export interface ProcessorConfiguration {
    readonly name: string;
    readonly fpuRegisters?: number;
    readonly explicitFpu: boolean;
}

export interface ModuleSizeConfiguration {
    readonly size: bigint;
    readonly clearOnLoad: boolean;
    readonly codeAddress?: bigint;
    readonly varAddress?: bigint;
}

export interface SetLineConfiguration {
    readonly firstLine: number;
    readonly moduleId?: number;
}

export interface ModuleConfiguration {
    readonly modes: readonly SourceValue<string>[];
    readonly timeResolution: TimeResolution;
    readonly fullCharacterComparison: boolean;
    readonly noLineStop: boolean;
    readonly padding: boolean;
    readonly debugInformation: boolean;
    readonly processor?: ProcessorConfiguration;
    readonly moduleSize?: ModuleSizeConfiguration;
    readonly setLine?: SetLineConfiguration;
    /** RTOS-UH MAXERR value; does not limit LSP diagnostics. */
    readonly maxErrors?: number;
}

export function isKnownCompilerMode(mode: string): boolean {
    switch (mode) {
        case 'CLOCK50':
        case 'DEBUG':
        case 'FULLCC':
        case 'NOLSTOP':
        case 'PAD':
        case 'NOPAD':
            return true;

        default:
            return false;
    }
}

export function createModuleConfiguration(
    modes: readonly SourceValue<string>[],
    settings: Partial<Pick<ModuleConfiguration, 'processor' | 'moduleSize' | 'setLine' | 'maxErrors'>> = {}
): ModuleConfiguration {
    let timeResolution = DEFAULT_TIME_RESOLUTION;
    let fullCharacterComparison = false;
    let noLineStop = false;
    let padding = false;
    let debugInformation = false;

    for (const mode of modes) {
        switch (mode.value) {
            case 'DEBUG':
                debugInformation = true;
                break;

            case 'CLOCK50':
                timeResolution = CLOCK50_TIME_RESOLUTION;
                break;

            case 'FULLCC':
                fullCharacterComparison = true;
                break;

            case 'NOLSTOP':
                noLineStop = true;
                break;

            case 'PAD':
                padding = true;
                break;

            case 'NOPAD':
                padding = false;
                break;
        }
    }

    return {
        modes: [...modes],
        timeResolution: {
            numerator: timeResolution.numerator,
            denominator: timeResolution.denominator
        },
        fullCharacterComparison,
        noLineStop,
        padding,
        debugInformation,
        ...(settings.processor !== undefined ? { processor: settings.processor } : {}),
        ...(settings.moduleSize !== undefined ? { moduleSize: settings.moduleSize } : {}),
        ...(settings.setLine !== undefined ? { setLine: settings.setLine } : {}),
        ...(settings.maxErrors !== undefined ? { maxErrors: settings.maxErrors } : {})
    };
}
