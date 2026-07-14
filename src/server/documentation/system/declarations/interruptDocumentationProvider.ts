// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import { AstLookupResult } from '../../../ast/astLookupResult';
import { md } from '../../markdownUtils';
import { InterruptSystemDeclarationNode } from '../ast/interruptSystemDeclarationNode';

export class InterruptDocumentationProvider
    extends DocumentationProvider<InterruptSystemDeclarationNode> {

    override getDocumentation(
        node: InterruptSystemDeclarationNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element===node.keyword) {
            return md`
# INTERRUPT

Declares an interrupt system object.
`;
        }

        if (lookup.element===node.name) {
            return md`
# Interrupt declaration

Declares the interrupt system object \`${node.name.value}\`.
`;
        }

        if (lookup.element===node.mask) {
            return md`
# Event mask

The event mask \`${node.mask.value}\` specifies which interrupt
source is associated with this declaration.
`;
        }

        return undefined;
    }

}
