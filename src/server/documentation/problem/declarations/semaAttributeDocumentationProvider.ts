// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { SemaAttributeNode } from "../../../ast/problem/declarations/semaAttributeNode";

export class SemaAttributeDocumentationProvider
    extends DocumentationProvider<SemaAttributeNode> {

    override getDocumentation(
        node: SemaAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element === node.keyword) {
            return md`
# SEMA

Declares a semaphore variable.

Semaphore variables are used for synchronization between tasks.

Example:

\`\`\`pearl
DCL MySema SEMA;
\`\`\`
`;
        }

        if (lookup.element === node.presetKeyword) {
            return md`
# PRESET

Defines the initial values of the declared SEMA variables.

The values must be non-negative constant FIXED expressions.

Example:

\`\`\`pearl
DCL (S1, S2) SEMA PRESET(3, 5);
\`\`\`
`;
        }

        return undefined;
    }
}
