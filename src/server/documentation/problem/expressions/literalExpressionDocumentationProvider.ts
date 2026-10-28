// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { LiteralExpressionNode } from '../../../ast/problem/expressions/literalExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class LiteralExpressionDocumentationProvider extends DocumentationProvider<LiteralExpressionNode> {
    override getDocumentation(
        node: LiteralExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        let documentation: string;
        if (lookup.element === node.literal) {
            documentation = md`# Literal

Literal \`${node.literal.value}\` in an expression.`;
        } else if (lookup.element === node.precision) {
            documentation = md`# Literal precision

Explicit precision \`${node.precision?.value}\` of the literal.`;
        } else {
            return undefined;
        }
        return appendExpressionTypeDocumentation(documentation, node, semanticContext);
    }
}
