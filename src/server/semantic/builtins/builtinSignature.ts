// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SemanticType, SemanticTypeKind } from '../semanticType';
import { semanticTypeEquals } from '../semanticTypeComparison';

/**
 * A constraint on an intrinsic's argument, not an ordinary PEARL data type.
 * It deliberately lives outside SemanticType: a FLOAT type variable or an
 * arbitrarily long CHAR argument cannot be represented by a concrete type.
 */
export type BuiltinTypePattern =
    | { readonly kind: 'exact'; readonly type: SemanticType }
    | { readonly kind: 'float'; readonly precisions: readonly number[]; readonly variable?: string }
    | { readonly kind: 'fixed'; readonly precisions: readonly number[] }
    | { readonly kind: 'character'; readonly length?: number }
    | { readonly kind: 'dation' }
    | { readonly kind: 'reference' }
    | { readonly kind: 'any' };

export interface BuiltinParameter {
    readonly name: string;
    readonly type: BuiltinTypePattern;
    readonly byIdentification?: boolean;
}

export type BuiltinResult =
    | { readonly kind: 'type'; readonly type: BuiltinTypePattern }
    | { readonly kind: 'argument'; readonly index: number };

export interface BuiltinSignature {
    readonly parameters: readonly BuiltinParameter[];
    /** For READ/WRITE: the last parameter can repeat. */
    readonly repeatedParameter?: BuiltinParameter;
    readonly result?: BuiltinResult;
}

export interface BuiltinDefinition {
    readonly name: string;
    readonly category: 'function' | 'procedure' | 'value';
    readonly availability: 'standard' | 'fpu' | 'optional';
    readonly signatures: readonly BuiltinSignature[];
    readonly description: string;
    /** RTOS-UH manual section, not a generated code location. */
    readonly source: string;
}

export interface BuiltinSignatureMatch {
    readonly signature: BuiltinSignature;
    readonly resultType: SemanticType | undefined;
}

/**
 * Resolves a fully typed argument list against a declarative builtin signature.
 * The expression analyzer will call this later. Never infer argument types from
 * CALL's token sequences here.
 */
export function matchBuiltinSignature(
    builtin: BuiltinDefinition,
    argumentTypes: readonly SemanticType[],
    isIdentification?: readonly boolean[]
): BuiltinSignatureMatch | undefined {
    for (const signature of builtin.signatures) {
        if (!acceptsBuiltinArity(signature, argumentTypes.length)) continue;
        const typeVariables = new Map<string, number>();
        let matches = true;
        for (let i = 0; i < argumentTypes.length; i++) {
            const parameter = signature.parameters[i] ?? signature.repeatedParameter;
            if (!parameter || (parameter.byIdentification && isIdentification && !isIdentification[i])
                || !matchType(parameter.type, argumentTypes[i], typeVariables)) {
                matches = false;
                break;
            }
        }
        if (!matches) continue;
        return { signature, resultType: resolveResult(signature.result, argumentTypes) };
    }
    return undefined;
}

export function acceptsBuiltinArity(signature: BuiltinSignature, count: number): boolean {
    return signature.repeatedParameter !== undefined
        ? count >= signature.parameters.length
        : count === signature.parameters.length;
}

export function builtinExpectedArity(builtin: BuiltinDefinition): string {
    const forms = builtin.signatures.map(signature => signature.repeatedParameter
        ? `${signature.parameters.length} oder mehr`
        : `${signature.parameters.length}`);
    return [...new Set(forms)].join(' oder ');
}

function matchType(
    pattern: BuiltinTypePattern,
    type: SemanticType,
    variables: Map<string, number>
): boolean {
    switch (pattern.kind) {
        case 'any': return true;
        case 'reference': return type.kind === SemanticTypeKind.Reference
            || type.kind === SemanticTypeKind.VoidReference;
        case 'dation': return type.kind === SemanticTypeKind.Dation;
        case 'character': return type.kind === SemanticTypeKind.Character
            && (pattern.length === undefined || pattern.length === (type.length ?? 1));
        case 'fixed': return type.kind === SemanticTypeKind.Fixed
            && pattern.precisions.includes(type.precision ?? 15);
        case 'float': {
            if (type.kind !== SemanticTypeKind.Float) return false;
            const precision = type.precision ?? 23;
            if (!pattern.precisions.includes(precision)) return false;
            if (!pattern.variable) return true;
            const previous = variables.get(pattern.variable);
            if (previous !== undefined && previous !== precision) return false;
            variables.set(pattern.variable, precision);
            return true;
        }
        case 'exact': return semanticTypeEquals(pattern.type, type);
    }
}

function resolveResult(
    result: BuiltinResult | undefined,
    args: readonly SemanticType[]
): SemanticType | undefined {
    if (!result) return undefined;
    if (result.kind === 'argument') return args[result.index];
    switch (result.type.kind) {
        case 'exact': return result.type.type;
        case 'fixed': return result.type.precisions.length === 1
            ? { kind: SemanticTypeKind.Fixed, precision: result.type.precisions[0] }
            : undefined;
        case 'character': return { kind: SemanticTypeKind.Character, length: result.type.length };
        default: return undefined; // A polymorphic result is resolved by the expression analyzer later.
    }
}

export function formatBuiltinSignature(builtin: BuiltinDefinition, signature: BuiltinSignature): string {
    if (builtin.category === 'value') {
        return `${builtin.name}: ${formatBuiltinPattern(signature.result?.kind === 'type'
            ? signature.result.type : { kind: 'any' })}`;
    }
    const parameters = signature.parameters.map(formatParameter);
    if (signature.repeatedParameter) parameters.push(`${formatParameter(signature.repeatedParameter)}...`);
    const returns = signature.result ? ` RETURNS(${signature.result.kind === 'argument'
        ? `Typ von ${signature.parameters[signature.result.index]?.name ?? 'Argument'}`
        : formatBuiltinPattern(signature.result.type)})` : '';
    return `${builtin.name}(${parameters.join(', ')})${returns}`;
}

function formatParameter(parameter: BuiltinParameter): string {
    return `${parameter.name} ${formatBuiltinPattern(parameter.type)}`
        + (parameter.byIdentification ? ' IDENT' : '');
}

export function formatBuiltinPattern(pattern: BuiltinTypePattern): string {
    switch (pattern.kind) {
        case 'any': return 'ANY';
        case 'reference': return 'REF (beliebiger Typ)';
        case 'dation': return 'DATION';
        case 'character': return pattern.length === undefined ? 'CHAR(*)' : `CHAR(${pattern.length})`;
        case 'fixed': return `FIXED(${pattern.precisions.join('|')})`;
        case 'float': return `FLOAT(${pattern.precisions.join('|')})`;
        case 'exact': {
            const type = pattern.type;
            switch (type.kind) {
                case SemanticTypeKind.Clock: return 'CLOCK';
                case SemanticTypeKind.Bit: return `BIT(${type.length ?? 1})`;
                case SemanticTypeKind.Fixed: return `FIXED(${type.precision ?? 15})`;
                default: return SemanticTypeKind[type.kind];
            }
        }
    }
}
