// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from './documentationProvider';
import { AstLookupResult } from '../ast/astLookupResult';
import { md } from './markdownUtils';
import { SystemPartNode } from '../ast/systemPartNode';

export class SystemPartDocumentationProvider
    extends DocumentationProvider<SystemPartNode> {

    override getDocumentation(
        node: SystemPartNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element===node.keyword) {
            return md`
# SYSTEM

Marks the beginning of the **SYSTEM** part of a PEARL module.

The SYSTEM part contains the definitions of DATIONs and INTERRUPTs.
`;
        }

        return undefined;
    }

}
