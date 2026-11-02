// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SemanticTypeKind } from '../semanticType';
import type { BuiltinDefinition, BuiltinParameter, BuiltinTypePattern } from './builtinSignature';

const f23f55: BuiltinTypePattern = { kind: 'float', precisions: [23, 55], variable: 'F' };
const fixed15: BuiltinTypePattern = { kind: 'fixed', precisions: [15] };
const fixed31: BuiltinTypePattern = { kind: 'fixed', precisions: [31] };
const fixedEither: BuiltinTypePattern = { kind: 'fixed', precisions: [15, 31] };
const charAny: BuiltinTypePattern = { kind: 'character' };
const dation: BuiltinTypePattern = { kind: 'dation' };
const any: BuiltinTypePattern = { kind: 'any' };
const clock: BuiltinTypePattern = { kind: 'exact', type: { kind: SemanticTypeKind.Clock } };
const p = (name: string, type: BuiltinTypePattern, byIdentification = false): BuiltinParameter =>
    ({ name, type, byIdentification });
const returns = (type: BuiltinTypePattern) => ({ kind: 'type' as const, type });
const sameArg = (index: number) => ({ kind: 'argument' as const, index });
const function1 = (name: string, description: string, source: string,
    availability: BuiltinDefinition['availability'] = 'standard'): BuiltinDefinition => ({
    name, description, source, category: 'function', availability,
    signatures: [{ parameters: [p('Wert', f23f55)], result: sameArg(0) }]
});
const procedure = (name: string, description: string, source: string,
    parameters: readonly BuiltinParameter[], repeatedParameter?: BuiltinParameter): BuiltinDefinition => ({
    name, description, source, category: 'procedure', availability: 'standard',
    signatures: [{ parameters, ...(repeatedParameter !== undefined ? { repeatedParameter } : {}) }]
});
const stringFunction = (name: string, description: string,
    parameters: readonly BuiltinParameter[], result: BuiltinTypePattern): BuiltinDefinition => ({
    name, description, category: 'function', availability: 'optional', source: 'RTOS-UH 5.7.17',
    signatures: [{ parameters, result: returns(result) }]
});

/**
 * Only routines known *implicitly* to the RTOS-UH PEARL90 compiler belong here.
 * Explicitly specified library ENTRYs (e.g. DATE, ASSIGN, RANF) do not.
 * The availability flag describes system dependencies, not PEARL syntax.
 * See RTOS-UH manual, sections 5.7.1-5.7.17.
 */
export const RTOS_UH_BUILTINS: readonly BuiltinDefinition[] = [
    ...['ACOS', 'ASIN', 'ATAN', 'COS', 'EXP', 'LD', 'LG', 'LN', 'PI', 'SIN', 'SQRT', 'TAN']
        .map(name => function1(name, 'Mathematische Funktion; FLOAT-Präzision wird übernommen.', 'RTOS-UH 5.7.1')),
    ...['ATANH', 'COSH', 'EXPM1', 'INT', 'INTRZ', 'LNP1', 'NEG', 'SINH', 'TANH', 'TENTOX', 'TWOTOX']
        .map(name => function1(name, 'FPU-Funktion (FPU-Modus erforderlich).', 'RTOS-UH 5.7.1', 'fpu')),
    {
        name: 'ST', category: 'function', availability: 'standard',
        source: 'RTOS-UH 5.7.2', description: 'Status einer Datenstation.',
        signatures: [{ parameters: [p('Station', dation)], result: returns(fixed15) }]
    },
    ...['SETPIX', 'GETPIX'].map(name => procedure(name, 'Basisgrafik-Pixeloperation.', 'RTOS-UH 5.7.3',
        [p('X', fixed15), p('Y', fixed15), p('Farbe', fixed15, name === 'GETPIX')])),
    procedure('LINE', 'Basisgrafik-Linie.', 'RTOS-UH 5.7.3',
        [p('X1', fixed15), p('Y1', fixed15), p('X2', fixed15), p('Y2', fixed15), p('Farbe', fixed15)]),
    ...['REWIND', 'SYNC', 'APPEND'].map(name => procedure(name, 'Dateistation-Operation.',
        'RTOS-UH 5.7.4', [p('Station', dation)])),
    procedure('SEEK', 'Dateiposition setzen.', 'RTOS-UH 5.7.4',
        [p('Station', dation), p('Position', fixed31)]),
    procedure('SAVEP', 'Aktuelle Dateiposition speichern.', 'RTOS-UH 5.7.4',
        [p('Station', dation), p('Position', fixed31, true)]),
    procedure('READ', 'Kompatibilitätsaufruf für binäre Eingabe.', 'RTOS-UH 5.7.5',
        [p('Station', dation), p('Objekt', any, true)], p('Objekt', any, true)),
    procedure('WRITE', 'Kompatibilitätsaufruf für binäre Ausgabe.', 'RTOS-UH 5.7.5',
        [p('Station', dation), p('Objekt', any)], p('Objekt', any)),
    {
        name: 'NOW', category: 'value', availability: 'standard',
        source: 'RTOS-UH 5.7.7', description: 'Aktuelle Zeit ohne Funktionsaufruf.',
        signatures: [{ parameters: [], result: returns(clock) }]
    },
    procedure('REFADD', 'Zeigerarithmetik, keine gewöhnliche Prozedur.', 'RTOS-UH 5.7.9',
        [p('Zeiger', { kind: 'reference' }, true), p('Versatz', fixedEither)]),
    // Virtual, implementation-oriented type signatures for the PEARL90 compiler.
    // These are NOT valid SPC declarations for PEARL90: the runtime library uses
    // a special calling convention (RTOS-UH 5.7.17, cf. 8.4 and 8.6).
    // The IDENT annotations in the handbook's informational PEARL80 signatures
    // do not describe the actual PEARL90 argument acceptance.
    stringFunction('BEG', 'Erste Nicht-Leerstelle im String.', [p('string', charAny)], fixed15),
    stringFunction('INSTR', 'Teilstringsuche.', [
        p('string1', charAny), p('anf1', fixed15), p('end1', fixed15),
        p('string2', charAny), p('anf2', fixed15), p('end2', fixed15)
    ], fixed15),
    stringFunction('LEN', 'Letzte Nicht-Leerstelle im String.', [p('string', charAny)], fixed15),
    stringFunction('MID', 'Teilstring extrahieren.',
        [p('string', charAny), p('anf', fixed15), p('end', fixed15)], charAny),
    stringFunction('KON', 'Teilstrings verbinden.', [
        p('string1', charAny), p('anf1', fixed15), p('end1', fixed15),
        p('string2', charAny), p('anf2', fixed15), p('end2', fixed15)
    ], charAny),
    stringFunction('INSER', 'Teilstring einfügen.', [
        p('string1', charAny), p('anf1', fixed15), p('end1', fixed15),
        p('string2', charAny), p('anf2', fixed15), p('end2', fixed15)
    ], charAny),
    stringFunction('CMPW', 'Strings mit Wildcards vergleichen.', [
        p('string1', charAny), p('anf1', fixed15), p('end1', fixed15),
        p('string2', charAny), p('anf2', fixed15), p('end2', fixed15)
    ], fixed15),
];

const catalog = new Map(RTOS_UH_BUILTINS.map(definition => [definition.name, definition]));

/** Lookup never fabricates a SourceValue: intrinsic names have no declaration site. */
export function lookupBuiltin(name: string): BuiltinDefinition | undefined {
    return catalog.get(name.toUpperCase());
}

export function getBuiltinCatalog(): ReadonlyMap<string, BuiltinDefinition> {
    return catalog;
}
