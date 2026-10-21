// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';
import { ShellCommandNode } from '../../ast/module/shellCommandNode';
import { AstLookupResult } from '../../ast/astLookupResult';
import type { SemanticContext } from '../../semantic/semanticContext';
import { lookupBoundSymbol } from '../../semantic/bindingIndex';
import { appendSemanticSymbolDocumentation } from '../semanticSymbolDocumentation';

export class ShellCommandDocumentationProvider
    extends DocumentationProvider<ShellCommandNode> {

    override getDocumentation(
        node: ShellCommandNode,
        lookup: AstLookupResult,
        semanticContext?: SemanticContext
    ): string | undefined {

        if (lookup.element === node.procedureName) {

            const documentation = md`
# Shell procedure

The PEARL procedure \`${node.procedureName.value}\` implements the shell command
\`${node.commandName.value}\`.

It must be defined in the same SHELLMODULE with the fixed RTOS-UH shell interface:

\`\`\`pearl
${node.procedureName.value}: PROC(
    (Stdin, Stdout, Stderr) DATION INOUT ALPHIC IDENT,
    Length FIXED,
    Text CHAR(255)
) RETURNS(BIT(1));
END;
\`\`\`
`;
            const symbol = semanticContext
                ? lookupBoundSymbol(semanticContext.bindings, node.procedureName)
                : undefined;
            return symbol && semanticContext
                ? appendSemanticSymbolDocumentation(documentation, symbol, semanticContext)
                : documentation;
        }

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
