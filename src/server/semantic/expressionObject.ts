// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import { LiteralExpressionNode } from '../ast/problem/expressions/literalExpressionNode';
import { MonadicExpressionNode } from '../ast/problem/expressions/monadicExpressionNode';
import { DyadicExpressionNode } from '../ast/problem/expressions/dyadicExpressionNode';
import { ClockConstantNode } from '../ast/problem/expressions/clockConstantNode';
import { DurationConstantNode } from '../ast/problem/expressions/durationConstantNode';
import type { SourceValue } from '../core/sourceValue';
import type { Environment } from './environment';
import { resolveSymbol } from './symbolResolver';
import { SymbolKind } from './symbolKind';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType } from './semanticType';
import type { SemanticSymbol } from './symbol';

/** Object/value classification is shared by IDENT, reference arguments and IS/ISNT.
 * In addition to addressability, reference passing needs to know whether an
 * object can be reached through a writable reference. This is separate from
 * INV on a reference *variable* (which protects the pointer, not its target).
 */
export type ObjectExpressionClass = 'object' | 'value' | 'unknown';

export interface ObjectExpressionInfo {
    readonly category: ObjectExpressionClass;
    /** Whether the selected object is protected against assignment.
     * Undefined means that its protection cannot be established yet. */
    readonly assignmentProtected: boolean | undefined;
}

export function classifyObjectExpression(
    expression: ExpressionNode,
    environment: Environment,
    resolveType: (type: SemanticType) => SemanticType | undefined
): ObjectExpressionClass {
    return classifyObjectExpressionInfo(expression, environment, resolveType).category;
}

/** One component's effective protection before a possible subsequent dereference.
 * For REF INV, the reference variable can remain writable while the selected
 * target becomes protected. These are different storage objects.
 */
export interface NameAccessSegmentInfo {
    readonly identifier: SourceValue<string>;
    readonly assignmentProtected: boolean;
}

export interface NameAccessInfo extends ObjectExpressionInfo {
    readonly segments: readonly NameAccessSegmentInfo[];
    /** The selected value type, needed for an explicit CONT destination. */
    readonly selectedType?: SemanticType;
}

/** Reuse the same access semantics for assignment validation and compiler-side
 * highlighting. A caller supplies the already resolved lexical symbol; this
 * function never performs scope lookup or mutates bindings.
 */
export function classifyBoundNameExpressionInfo(
    name: NameExpressionNode,
    symbol: SemanticSymbol,
    resolveType: (type: SemanticType) => SemanticType | undefined
): NameAccessInfo {
    const accesses: NameAccessSegmentInfo[] = [];
    const unknown = (): NameAccessInfo => ({
        category: 'unknown', assignmentProtected: undefined, segments: accesses
    });
    const value = (): NameAccessInfo => ({
        category: 'value', assignmentProtected: undefined, segments: accesses
    });
    let type: SemanticType | undefined;
    let protectedObject = false;
    switch (symbol.kind) {
        case SymbolKind.DataObject:
        case SymbolKind.Parameter:
        case SymbolKind.Identification:
            type = symbol.type;
            protectedObject = symbol.assignmentProtected;
            break;
        case SymbolKind.LoopControlVariable:
            type = symbol.type;
            break;
        case SymbolKind.Procedure:
            return value();
        default:
            return unknown();
    }
    for (let index = 0; index < name.segments.length; index++) {
        const segment = name.segments[index];
        if (index > 0) {
            let owner = type && resolveType(type);
            if (owner?.kind === SemanticTypeKind.Reference) {
                // A selector dereferences the pointer before selecting a
                // component. Its own INV does not protect the target.
                protectedObject = owner.targetInvariant;
                owner = resolveType(owner.target);
            }
            if (!owner) return unknown();
            if (owner.kind === SemanticTypeKind.Bit || owner.kind === SemanticTypeKind.Character) {
                const selector = segment.identifier.value;
                const matches = owner.kind === SemanticTypeKind.Bit
                    ? selector === 'BIT'
                    : selector === 'CHAR' || selector === 'CHARACTER';
                if (!matches || !segment.suffix
                    || !segment.suffix.closeParenthesis
                    || segment.suffix.expressions.length !== 1
                    || !segment.suffix.expressions[0]) return unknown();
                type = owner.kind === SemanticTypeKind.Bit
                    ? { kind: SemanticTypeKind.Bit, length: 1 }
                    : { kind: SemanticTypeKind.Character, length: 1 };
                accesses.push({ identifier: segment.identifier, assignmentProtected: protectedObject });
                continue;
            }
            if (owner.kind !== SemanticTypeKind.Struct) return value();
            type = owner.components.find(component => component.name.value === segment.identifier.value)?.type;
        }
        if (!type) return unknown();
        if (segment.suffix) {
            let selected = resolveType(type);
            if (selected?.kind === SemanticTypeKind.Reference) {
                protectedObject = selected.targetInvariant;
                selected = resolveType(selected.target);
            }
            if (!selected) return unknown();
            if (selected.kind !== SemanticTypeKind.Array
                && selected.kind !== SemanticTypeKind.VirtualArray) return value();
            type = selected.elementType;
        }
        accesses.push({ identifier: segment.identifier, assignmentProtected: protectedObject });
    }
    return { category: 'object', assignmentProtected: protectedObject,
        segments: accesses, selectedType: type };
}

export function classifyObjectExpressionInfo(
    expression: ExpressionNode,
    environment: Environment,
    resolveType: (type: SemanticType) => SemanticType | undefined
): ObjectExpressionInfo {
    const unknown: ObjectExpressionInfo = { category: 'unknown', assignmentProtected: undefined };
    const value: ObjectExpressionInfo = { category: 'value', assignmentProtected: undefined };
    let current: ExpressionNode | undefined = expression;
    while (current?.kind === AstKind.ParenthesizedExpression) {
        current = (current as ParenthesizedExpressionNode).expression;
    }
    if (!current) return unknown;
    if (current.kind !== AstKind.NameExpression) return value;
    const name = current as NameExpressionNode;
    const first = name.segments[0];
    if (!first) return unknown;
    const symbol = resolveSymbol(environment, first.identifier.value);
    if (!symbol) return unknown;
    const access = classifyBoundNameExpressionInfo(name, symbol, resolveType);
    return { category: access.category, assignmentProtected: access.assignmentProtected };
}

/** Common argument diagnostic anchor; never synthesize source locations. */
export function expressionSource(expression: ExpressionNode): SourceValue<string> | undefined {
    switch (expression.kind) {
        case AstKind.NameExpression:
            return (expression as NameExpressionNode).segments[0]?.identifier;
        case AstKind.LiteralExpression:
            return (expression as LiteralExpressionNode).literal;
        case AstKind.ClockConstant:
            return (expression as ClockConstantNode).hours;
        case AstKind.DurationConstant:
            return (expression as DurationConstantNode).components[0]?.value;
        case AstKind.ParenthesizedExpression:
            return (expression as ParenthesizedExpressionNode).openParenthesis;
        case AstKind.MonadicExpression:
            return (expression as MonadicExpressionNode).operator;
        case AstKind.DyadicExpression:
            return expressionSource((expression as DyadicExpressionNode).left);
        default:
            return undefined;
    }
}
