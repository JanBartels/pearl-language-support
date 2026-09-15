// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { InitializationAttributeNode } from "../../../ast/problem/declarations/initializationAttributeNode";

export class InitializationAttributeDocumentationProvider
    extends DocumentationProvider<InitializationAttributeNode> {

    override getDocumentation(
        node: InitializationAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# ${node.keyword.value}

Initialization attribute of a declaration.

The values in the initialization list are assigned when the declared object is initialized.
`;
    }
}
