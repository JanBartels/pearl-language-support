// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { SignedConstantExpressionNode } from '../../../ast/problem/expressions/signedConstantExpressionNode';
import type { SemanticContext } from '../../../semantic/semanticContext';
import { DocumentationProvider } from '../../documentationProvider';
import { appendSemanticConstantValue } from '../../semanticConstantValueDocumentation';

export class SignedConstantExpressionDocumentationProvider
    extends DocumentationProvider<SignedConstantExpressionNode> {
    override getDocumentation(
        node: SignedConstantExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {
        if (lookup.element === node.sign) {
            return this.documentation(node, semanticContext);
        }

        switch (node.operand.kind) {
            case 'floatingPoint':
                return lookup.element === node.operand.literal
                    ? this.documentation(node, semanticContext)
                    : undefined;

            case 'duration':
                if (!node.operand.constant.components.some(
                    component => lookup.element === component.value || lookup.element === component.unit
                )) {
                    return undefined;
                }

                return this.documentation(node, semanticContext);
        }
    }

    private documentation(
        node: SignedConstantExpressionNode,
        semanticContext?: SemanticContext
    ): string {
        switch (node.operand.kind) {
            case 'floatingPoint':
                return `
# Signed FLOAT constant expression

Constant expression \`${node.sign.value}${node.operand.literal.value}\`.
`;

            case 'duration': {
                const duration = node.operand.constant.components
                    .map(component => `${component.value.value} ${component.unit.value}`)
                    .join(' ');

                const documentation = `
# Signed DURATION constant expression

Constant expression \`${node.sign.value}${duration}\`.

The sign belongs to the constant expression; the DURATION constant itself is unsigned syntax.
`;

                return appendSemanticConstantValue(
                    documentation,
                    semanticContext?.timeConstantValues.get(node)
                );
            }
        }
    }
}
