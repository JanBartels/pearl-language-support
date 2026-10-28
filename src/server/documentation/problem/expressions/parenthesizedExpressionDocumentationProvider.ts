// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { ParenthesizedExpressionNode } from '../../../ast/problem/expressions/parenthesizedExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class ParenthesizedExpressionDocumentationProvider extends DocumentationProvider<ParenthesizedExpressionNode> {
    override getDocumentation(
        node: ParenthesizedExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element !== node.openParenthesis && lookup.element !== node.closeParenthesis) {
            return undefined;
        }
        return appendExpressionTypeDocumentation(
            '# Parenthesized expression\n\nParentheses group an expression and determine evaluation order.',
            node,
            semanticContext
        );
    }
}
