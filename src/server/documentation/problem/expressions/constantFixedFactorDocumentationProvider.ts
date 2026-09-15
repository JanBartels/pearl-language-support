// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { ConstantFixedFactorNode } from "../../../ast/problem/expressions/constantFixedFactorNode";

export class ConstantFixedFactorDocumentationProvider
    extends DocumentationProvider<ConstantFixedFactorNode> {

    override getDocumentation(
        node: ConstantFixedFactorNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element === node.sign) {

            return md`
# Sign

Unary sign \`${node.sign?.value}\` of a constant FIXED factor.
`;
        }

        switch (node.operand.kind) {

            case "integer":

                if (lookup.element === node.operand.literal) {

                    return md`
# FIXED literal

Integer literal \`${node.operand.literal.value}\` used in a constant FIXED expression.
`;
                }

                if (
                    node.operand.precision &&
                    lookup.element === node.operand.precision
                ) {

                    return md`
# FIXED precision

Explicit precision \`${node.operand.precision.value}\` of the FIXED constant.
`;
                }

                break;

            case "identifier":

                if (lookup.element === node.operand.identifier) {

                    return md`
# Named constant

Identifier \`${node.operand.identifier.value}\` used as an operand of a constant FIXED expression.

Whether the identifier denotes a permitted named constant is checked semantically.
`;
                }

                break;

            case "parenthesized":
                break;

            case "toFixedCharacter":

                if (lookup.element === node.operand.keyword) {

                    return md`
# TOFIXED

Converts a character string constant to a FIXED value.
`;
                }

                if (lookup.element === node.operand.literal) {

                    return md`
# Character string constant

Character string operand of \`TOFIXED\`.
`;
                }

                break;

            case "toFixedBit":

                if (lookup.element === node.operand.keyword) {

                    return md`
# TOFIXED

Converts a bit string constant to a FIXED value.
`;
                }

                if (lookup.element === node.operand.literal) {

                    return md`
# Bit string constant

Bit string operand of \`TOFIXED\`.
`;
                }

                break;
        }

        if (
            node.fit &&
            lookup.element === node.fit.keyword
        ) {

            return md`
# FIT

\`FIT\` changes the precision of the left FIXED operand to the precision of the right operand.
`;
        }

        return undefined;
    }

}
