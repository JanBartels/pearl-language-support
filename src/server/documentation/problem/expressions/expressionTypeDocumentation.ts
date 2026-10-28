// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { ExpressionNode } from '../../../ast/problem/expressions/expressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { formatSemanticType } from '../../semanticTypeDocumentation';

/** Display an already inferred type. Hover never performs semantic analysis. */
export function appendExpressionTypeDocumentation(
    documentation: string,
    expression: ExpressionNode,
    semanticContext?: SemanticContext
): string {
    const type = semanticContext?.expressionTypes.get(expression);
    return type
        ? `${documentation}\n\n**Expression type:** \`${formatSemanticType(type)}\``
        : documentation;
}
