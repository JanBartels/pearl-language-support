// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { ConstantFixedExpressionNode } from "../../../ast/problem/expressions/constantFixedExpressionNode";

export class ConstantFixedExpressionDocumentationProvider
    extends DocumentationProvider<ConstantFixedExpressionNode> {

    override getDocumentation(
        node: ConstantFixedExpressionNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.literal) {
            return undefined;
        }

        return md`
# FIXED literal

Constant FIXED literal \`${node.literal.value}\`.

This literal is used as a compile-time constant FIXED expression.
`;
    }

}
