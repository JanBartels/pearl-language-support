// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { SpcDationAttributeNode } from '../../../ast/problem/specifications/spcDationAttributeNode';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class SpcDationAttributeDocumentationProvider extends DocumentationProvider<SpcDationAttributeNode> {
    override getDocumentation(node: SpcDationAttributeNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            return md`
# DATION

Specifies a system dation for use in the PROBLEM part.
`;
        }

        if (lookup.element === node.direction) {
            return md`
# ${node.direction?.value}

Transfer direction of the dation.
`;
        }

        if (lookup.element === node.dationClass) {
            return md`
# ${node.dationClass?.value}

Transfer class of the dation.
`;
        }

        if (lookup.element === node.controlKeyword || lookup.element === node.controlAll) {
            return md`
# CONTROL(ALL)

Compatibility attribute for dations.
`;
        }

        return undefined;
    }
}
