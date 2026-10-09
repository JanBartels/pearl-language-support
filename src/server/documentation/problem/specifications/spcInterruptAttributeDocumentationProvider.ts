// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { SpcInterruptAttributeNode } from '../../../ast/problem/specifications/spcInterruptAttributeNode';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class SpcInterruptAttributeDocumentationProvider extends DocumentationProvider<SpcInterruptAttributeNode> {
    override getDocumentation(node: SpcInterruptAttributeNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# INTERRUPT

Specifies an interrupt introduced in the SYSTEM part or an external global interrupt.
`;
    }
}
