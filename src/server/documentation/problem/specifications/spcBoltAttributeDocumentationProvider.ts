// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { SpcBoltAttributeNode } from "../../../ast/problem/specifications/spcBoltAttributeNode";

export class SpcBoltAttributeDocumentationProvider
    extends DocumentationProvider<SpcBoltAttributeNode> {

    override getDocumentation(
        node: SpcBoltAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# BOLT

Specifies a bolt variable.
`;
    }
}
