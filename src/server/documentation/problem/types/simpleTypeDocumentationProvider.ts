// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { SimpleTypeNode } from "../../../ast/problem/types/simpleTypeNode";

export class SimpleTypeDocumentationProvider
    extends DocumentationProvider<SimpleTypeNode> {

    override getDocumentation(
        node: SimpleTypeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        switch (node.keyword.value) {

            case "FIXED":
                return md`
# FIXED

Integer data type.

An optional precision may be specified:

\`\`\`pearl
FIXED
FIXED(31)
\`\`\`
`;

            case "FLOAT":
                return md`
# FLOAT

Floating-point data type.

An optional precision may be specified:

\`\`\`pearl
FLOAT
FLOAT(55)
\`\`\`
`;

            case "BIT":
                return md`
# BIT

Bit string data type.

An optional length may be specified:

\`\`\`pearl
BIT
BIT(16)
\`\`\`
`;

            case "CHAR":
            case "CHARACTER":
                return md`
# ${node.keyword.value}

Character string data type.

An optional length may be specified:

\`\`\`pearl
CHAR
CHAR(80)
\`\`\`
`;

            case "CLOCK":
                return md`
# CLOCK

Time-of-day data type.
`;

            case "DUR":
            case "DURATION":
                return md`
# ${node.keyword.value}

Duration data type.
`;
        }

        return undefined;
    }
}
