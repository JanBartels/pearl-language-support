// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from './documentationProvider';
import { AstLookupResult } from '../ast/astLookupResult';
import { md } from './markdownUtils';
import { ModuleNode } from '../ast/moduleNode';

export class ModuleDocumentationProvider
    extends DocumentationProvider<ModuleNode> {

    override getDocumentation(
        node: ModuleNode,
        lookup: AstLookupResult
    ): string | undefined {

        const shellModule = node.isShellModule();

        if (lookup.element === node.keyword) {

            if (shellModule) {
                return md`
# SHELLMODULE

Declares a PEARL shell module.

A shell module behaves like a normal module but additionally
allows shell commands to be declared between the module header
and the **SYSTEM** or **PROBLEM** sections.

The module is terminated by \`MODEND\`.
`;
            }

            return md`
# MODULE

Declares a PEARL module.

A module is the top-level program unit of a PEARL program.
It contains the **SYSTEM** and **PROBLEM** sections and is
terminated by \`MODEND\`.
`;
        }

        if (lookup.element === node.name) {

            return md`
# ${shellModule ? "Shell module" : "Module"} name

The ${shellModule ? "shell module" : "module"} is named
\`${node.name.value}\`.

The name uniquely identifies the ${shellModule ? "shell module" : "module"}.
`;
        }

        if (lookup.element === node.modendKeyword) {

            return md`
# MODEND

Marks the end of the current module.
`;
        }

        if (lookup.element === node.debugKeyword) {

            return md`
# DEBUG

Requests generation of additional debug information
for the current module.
`;
        }

        return undefined;
    }

}
