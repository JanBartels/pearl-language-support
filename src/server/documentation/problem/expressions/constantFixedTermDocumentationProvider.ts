// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";
import type { SemanticContext } from "../../../semantic/semanticContext";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";

import { ConstantFixedTermNode } from "../../../ast/problem/expressions/constantFixedTermNode";

export class ConstantFixedTermDocumentationProvider
    extends DocumentationProvider<ConstantFixedTermNode> {

    override getDocumentation(
        node: ConstantFixedTermNode,
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

        switch (tail.operator.value.toUpperCase()) {

            case "*":
                documentation = md`
# Multiplication

Multiplication operator in a constant FIXED expression.
`;
                break;

            case "//":
                documentation = md`
# Integer division

Integer division operator in a constant FIXED expression.
`;
                break;

            case "REM":
                documentation = md`
# REM

Remainder operator in a constant FIXED expression.
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
