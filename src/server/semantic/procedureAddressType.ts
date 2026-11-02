// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { ExpressionNode } from '../ast/problem/expressions/expressionNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../ast/problem/expressions/parenthesizedExpressionNode';
import type { Environment } from './environment';
import { resolveSymbol } from './symbolResolver';
import { SymbolKind } from './symbolKind';
import { SemanticTypeKind } from './semanticType';
import type { SemanticType } from './semanticType';

/**
 * A bare procedure name denotes its address only in a REF PROC transfer
 * context. In an ordinary expression a parameterless RETURNS procedure
 * retains its existing implicit-call semantics.
 *
 * This is deliberately separate from expression type resolution: using a
 * procedure identifier as an actual parameter does not invoke the procedure.
 */
export function procedureAddressType(
    expression: ExpressionNode,
    environment: Environment
): SemanticType | undefined {
    let current: ExpressionNode | undefined = expression;
    while (current?.kind === AstKind.ParenthesizedExpression) {
        current = (current as ParenthesizedExpressionNode).expression;
    }
    if (current?.kind !== AstKind.NameExpression) return undefined;
    const segments = (current as NameExpressionNode).segments;
    if (segments.length !== 1 || segments[0].suffix) return undefined;
    const symbol = resolveSymbol(environment, segments[0].identifier.value);
    if (symbol?.kind !== SymbolKind.Procedure || !symbol.signature) return undefined;
    return {
        kind: SemanticTypeKind.Reference,
        target: symbol.signature,
        targetInvariant: false
    };
}
