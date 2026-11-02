// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { TryExpressionNode } from '../../../ast/problem/expressions/tryExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { appendExpressionTypeDocumentation } from './expressionTypeDocumentation';

export class TryExpressionDocumentationProvider extends DocumentationProvider<TryExpressionNode> {
    override getDocumentation(node: TryExpressionNode, lookup: AstLookupResult, semanticContext?: SemanticContext): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        return appendExpressionTypeDocumentation('# TRY\n\nVersucht, eine SEMA ohne Blockieren der Task anzufordern.\n\nSyntax: `TRY Name`\n\nErgebnis: `BIT(1)`.', node, semanticContext);
    }
}
