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

        if (lookup.element===node.keyword) {
            return md`
# MODULE

Declares a PEARL module.

A module is the top-level program unit. It contains the
**SYSTEM** and **PROBLEM** sections and is terminated by
\`MODEND\`.
`;
        }

        if (lookup.element===node.name) {
            return md`
# Module name

The module name is **\`${node.name.value}\`**.

The name uniquely identifies this module.
`;
        }

        if (lookup.element===node.modendKeyword) {
            return md`
# MODEND

Marks the end of the current module.
`;
        }

        if (lookup.element===node.debugKeyword) {
            return md`
# DEBUG

The optional **DEBUG** keyword enables generation of
additional debug information for the module.
`;
        }

        return undefined;
    }

}
