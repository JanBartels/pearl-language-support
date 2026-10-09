// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from "../../../ast/astLookupResult";
import { GlobalAttributeNode } from "../../../ast/problem/declarations/globalAttributeNode";

import { DocumentationProvider } from "../../documentationProvider";
import { md } from "../../markdownUtils";

export class GlobalAttributeDocumentationProvider
    extends DocumentationProvider<GlobalAttributeNode> {

    override getDocumentation(
        node: GlobalAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element === node.keyword) {
            return md`
# GLOBAL

Makes a module-level declaration available for specification from other modules.

The optional module identifier in \`GLOBAL(ModuleName)\` is documentary only.
`;
        }

        if (lookup.element === node.moduleName) {
            return md`
# GLOBAL module identifier

Module identifier \`${node.moduleName?.value ?? ""}\` in a \`GLOBAL\` attribute.

The PEARL language report defines this identifier as documentary information; it does not change name resolution.
`;
        }

        return undefined;
    }
}
