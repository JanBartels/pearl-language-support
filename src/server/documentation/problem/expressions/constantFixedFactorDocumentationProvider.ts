// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";
import type { SemanticContext } from "../../../semantic/semanticContext";
import { appendSemanticConstantValue } from "../../semanticConstantValueDocumentation";

import { ConstantFixedFactorNode } from "../../../ast/problem/expressions/constantFixedFactorNode";

export class ConstantFixedFactorDocumentationProvider
    extends DocumentationProvider<ConstantFixedFactorNode> {

    override getDocumentation(
        node: ConstantFixedFactorNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {

        let documentation: string | undefined;

        if (lookup.element === node.sign) {
            documentation = md`
# Sign

Unary sign \`${node.sign?.value}\` of a constant FIXED factor.
`;
        } else {
            documentation = this.getOperandDocumentation(node, lookup);
        }

        if (!documentation && node.fit && lookup.element === node.fit.keyword) {
            documentation = md`
# FIT

\`FIT\` changes the precision of the left FIXED operand to the precision of the right operand.
`;
        }

        if (!documentation) {
            return undefined;
        }

        return appendSemanticConstantValue(
            documentation,
            semanticContext?.constantFixedValues.get(node)
        );
    }


    private getOperandDocumentation(
        node: ConstantFixedFactorNode,
        lookup: AstLookupResult
    ): string | undefined {

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

                return undefined;

            case "identifier":

                if (lookup.element === node.operand.identifier) {
                    return md`
# Named constant

Identifier \`${node.operand.identifier.value}\` used as an operand of a constant FIXED expression.

Whether the identifier denotes a permitted named constant is checked semantically.
`;
                }

                return undefined;

            case "parenthesized":
                return undefined;

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

                return undefined;

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

                return undefined;
        }
    }

}
