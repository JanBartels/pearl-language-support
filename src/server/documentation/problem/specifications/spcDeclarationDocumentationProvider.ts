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

Beschreibt ein Objekt beziehungsweise eine Prozedur für die Übersetzung.

- \`SPC Name ENTRY(...) RETURNS(...) GLOBAL;\` beschreibt eine extern aufrufbare Prozedur.
- \`SPC Name PROC(...) GLOBAL;\` beschreibt ebenfalls eine Prozedursignatur.
- \`SPC Name REF PROC(...) GLOBAL;\` beschreibt einen externen Prozedurzeiger.

In RTOS-UH benötigen gewöhnliche Daten- und Prozedurspezifikationen \`GLOBAL\`.
\`SPC Name TASK;\` ist ein eigener Sonderfall und kann ohne \`GLOBAL\` verwendet werden.

Beispiel:

\`\`\`pearl
SPC Output ENTRY(FIXED, FLOAT IDENT) GLOBAL;
SPC ProcPointer REF PROC(FIXED) GLOBAL;
\`\`\`
`;
    }
}
