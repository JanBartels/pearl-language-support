// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { ConstantFixedTermNode } from "../../../ast/problem/expressions/constantFixedTermNode";

export class ConstantFixedTermDocumentationProvider
    extends DocumentationProvider<ConstantFixedTermNode> {

    override getDocumentation(
        node: ConstantFixedTermNode,
        lookup: AstLookupResult
    ): string | undefined {

        const tail =
            node.tails.find(
                tail => lookup.element === tail.operator
            );

        if (!tail) {
            return undefined;
        }

        switch (tail.operator.value.toUpperCase()) {

            case "*":
                return md`
# Multiplication

Multiplication operator in a constant FIXED expression.
`;

            case "//":
                return md`
# Integer division

Integer division operator in a constant FIXED expression.
`;

            case "REM":
                return md`
# REM

Remainder operator in a constant FIXED expression.
`;

            default:
                return undefined;
        }
    }
}
