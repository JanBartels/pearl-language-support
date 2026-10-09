// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from "../../documentationProvider";
import { AstLookupResult } from "../../../ast/astLookupResult";
import { md } from "../../markdownUtils";

import { SpcSemaAttributeNode } from "../../../ast/problem/specifications/spcSemaAttributeNode";

export class SpcSemaAttributeDocumentationProvider
    extends DocumentationProvider<SpcSemaAttributeNode> {

    override getDocumentation(
        node: SpcSemaAttributeNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# SEMA

Specifies a semaphore variable.

Unlike a declaration, a specification has no \`PRESET\` attribute.
`;
    }
}
