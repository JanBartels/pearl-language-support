// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { GlobalAttributeNode } from '../../../ast/problem/declarations/globalAttributeNode';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class GlobalAttributeDocumentationProvider
    extends DocumentationProvider<GlobalAttributeNode> {

    override getDocumentation(node: GlobalAttributeNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        return md`
# GLOBAL

Marks a module-level object as accessible to other modules through a matching
\`SPC ... GLOBAL\`. RTOS-UH accepts only \`GLOBAL\`, without a module name.
The loader establishes connections between modules.
`;
    }
}
