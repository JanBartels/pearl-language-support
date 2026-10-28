// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { DyadicExpressionNode } from '../../../ast/problem/expressions/dyadicExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class DyadicExpressionDocumentationProvider extends DocumentationProvider<DyadicExpressionNode> {
    override getDocumentation(
        node: DyadicExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element !== node.operator) return undefined;
        return appendExpressionTypeDocumentation(
            md`# Dyadic operator

Operator \`${node.operator.value}\` combines two operands.`,
            node,
            semanticContext
        );
    }
}
