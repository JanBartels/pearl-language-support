// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { DationClass, DationType } from './semanticType';

/** Whether a DATION permits an individual transfer direction. */
export function dationSupportsDirection(dation: DationType, direction: 'IN' | 'OUT'): boolean {
    return dation.direction === undefined
        || dation.direction === 'INOUT'
        || dation.direction === direction;
}

/**
 * DATION transfer classes describe different I/O mechanisms:
 * ALPHIC = formatted GET/PUT, BASIC = process TAKE/SEND,
 * ALL = a class for internal data representations. RTOS-UH also supports
 * READ/WRITE on ALPHIC DATIONs (manual section 5.7.5).
 * In particular, ALL is not a superclass of ALPHIC or BASIC.
 */
export function dationHasClass(dation: DationType, dationClass: DationClass): boolean {
    return dation.dationClass === dationClass;
}

/**
 * A user DATION may narrow the direction of its system DATION, but it
 * cannot change its I/O class or require an unavailable direction.
 */
export function dationCreationCompatible(user: DationType, system: DationType): boolean {
    const direction = user.direction;
    const directionMatches = direction === undefined
        || (direction === 'INOUT'
            ? dationSupportsDirection(system, 'IN') && dationSupportsDirection(system, 'OUT')
            : dationSupportsDirection(system, direction));

    return directionMatches && dationHasClass(system, user.dationClass);
}
