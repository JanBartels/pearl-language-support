// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { InitElementNode } from "../../../ast/problem/declarations/initElementNode";

export class InitElementDocumentationProvider
    extends DocumentationProvider<InitElementNode> {

    override getDocumentation(
        node: InitElementNode,
        lookup: AstLookupResult
    ): string | undefined {

        switch (node.value.kind) {

            case "constantFixedExpression":
                return undefined;

            case "floatingPoint":

                if (lookup.element === node.value.literal) {
                    return md`
# FLOAT initialization value

Floating-point constant \`${node.value.literal.value}\` in an initialization list.
`;
                }

                break;

            case "characterString":

                if (lookup.element === node.value.literal) {
                    return md`
# Character initialization value

Character string constant in an initialization list.
`;
                }

                break;

            case "bitString":

                if (lookup.element === node.value.literal) {
                    return md`
# BIT initialization value

Bit string constant \`${node.value.literal.value}\` in an initialization list.
`;
                }

                break;
        }

        return undefined;
    }
}
