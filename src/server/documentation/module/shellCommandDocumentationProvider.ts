// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';
import { ShellCommandNode } from '../../ast/module/shellCommandNode';
import { AstLookupResult } from '../../ast/astLookupResult';

export class ShellCommandDocumentationProvider
    extends DocumentationProvider<ShellCommandNode> {

    override getDocumentation(
        node: ShellCommandNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element === node.procedureName) {

            return md`
# Shell procedure

The referenced PEARL procedure \`${node.procedureName.value}\`implements the shell command
\`${node.commandName.value}\`.

It must have the following interface:

\`\`\`pearl
SPC ${node.procedureName.value} PROC(
    (Stdin, Stdout, Stderr) DATION INOUT ALPHIC IDENT,
    Length FIXED,
    Text CHAR(255)
) RETURNS(BIT(1));
\`\`\`
`;        }

        if (lookup.element === node.commandName) {

            return md`
# Shell command

The shell command

\`\`\`text
${node.commandName.value}
\`\`\`

invokes the PEARL procedure
\`${node.procedureName.value}\`.
`;
        }

        return undefined;
    }

}
