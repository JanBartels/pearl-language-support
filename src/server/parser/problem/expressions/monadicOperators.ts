// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/** Word-form monadic operators recognized by the PEARL expression grammar.
 * Some names can also denote user-defined procedures.  A parenthesized form
 * is therefore parsed as a syntax-neutral name and resolved by semantics.
 */
export const MONADIC_WORD_OPERATORS: readonly string[] = [
    'NOT', 'ABS', 'SIGN', 'LWB', 'UPB', 'SIZEOF', 'CONT',
    'TOFIXED', 'TOFLOAT', 'TOBIT', 'TOCHAR', 'ENTIER', 'ROUND'
];

export function isMonadicWordOperator(name: string): boolean {
    return MONADIC_WORD_OPERATORS.includes(name);
}
