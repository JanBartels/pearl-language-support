// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { BoltAttributeNode } from "../../../ast/problem/declarations/boltAttributeNode";

export class BoltAttributeDocumentationProvider
    extends DocumentationProvider<BoltAttributeNode> {

    override getDocumentation(
        node: BoltAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# BOLT

Declares a bolt variable.

Bolt variables are used for synchronization and coordinated access between tasks.

Example:

\`\`\`pearl
DCL MyBolt BOLT;
\`\`\`
`;
    }
}
