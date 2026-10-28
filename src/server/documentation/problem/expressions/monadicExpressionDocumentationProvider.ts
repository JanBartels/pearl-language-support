// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { MonadicExpressionNode } from '../../../ast/problem/expressions/monadicExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class MonadicExpressionDocumentationProvider extends DocumentationProvider<MonadicExpressionNode> {
    override getDocumentation(
        node: MonadicExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element !== node.operator) return undefined;
        return appendExpressionTypeDocumentation(
            md`# Monadic operator

Operator \`${node.operator.value}\` acts on one operand.`,
            node,
            semanticContext
        );
    }
}
