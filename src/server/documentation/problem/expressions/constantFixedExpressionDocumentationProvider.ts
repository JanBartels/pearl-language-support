// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";
import type { SemanticContext } from "../../../semantic/semanticContext";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";

import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";

export class ConstantFixedExpressionDocumentationProvider
    extends DocumentationProvider<ConstantFixedExpressionNode> {

    override getDocumentation(
        node: ConstantFixedExpressionNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {

        const tail =
            node.tails.find(
                tail => lookup.element === tail.operator
            );

        if (!tail) {
            return undefined;
        }

        let documentation: string;

        switch (tail.operator.value) {

            case "+":
                documentation = md`
# Addition

Addition operator in a constant FIXED expression.
`;
                break;

            case "-":
                documentation = md`
# Subtraction

Subtraction operator in a constant FIXED expression.
`;
                break;

            default:
                return undefined;
        }

        return appendSemanticConstantValue(
            documentation,
            semanticContext?.constantFixedValues.get(node)
        );
    }

}
