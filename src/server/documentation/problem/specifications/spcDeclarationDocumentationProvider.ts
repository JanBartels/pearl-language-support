// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { SpcDeclarationNode } from '../../../ast/problem/specifications/spcDeclarationNode';
import { DocumentationProvider } from '../../documentationProvider';
import { md } from '../../markdownUtils';

export class SpcDeclarationDocumentationProvider extends DocumentationProvider<SpcDeclarationNode> {
    override getDocumentation(node: SpcDeclarationNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) {
            return undefined;
        }

        return md`
# ${node.keyword.value}

Specifies an object before its definition is available.

Without \`GLOBAL\` the specification is a forward specification for a later \`DCL\` in the same module.
With \`GLOBAL\` it specifies an object supplied by another module.

Array specifications use virtual dimensions. They state only the number of dimensions, not their bounds.

Examples:

\`\`\`pearl
SPC localValue FIXED;
SPC localArray() FLOAT;
SPC externalValue FIXED GLOBAL;

DCL localValue FIXED;
DCL localArray(20) FLOAT;
\`\`\`
`;
    }
}
