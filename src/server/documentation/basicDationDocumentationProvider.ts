// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from './documentationProvider';
import { AstLookupResult } from '../ast/astLookupResult';
import { md } from './markdownUtils';
import { BasicDationSystemDeclarationNode } from '../ast/basicDationSystemDeclarationNode';
                                                         

export class BasicDationDocumentationProvider
    extends DocumentationProvider<BasicDationSystemDeclarationNode> {

    override getDocumentation(
        node: BasicDationSystemDeclarationNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element===node.keyword) {
            return md`
# Basic Dation

Declares a BASIC system dation.

A BASIC dation represents a hardware device or interface
which can be associated with a problem dation.
`;
        }

        if (lookup.element===node.name) {
            return md`
# Dation name

The name of this system dation is **\`${node.name.value}\`**.

This identifier can be referenced by problem dations.
`;
        }

        if (lookup.element===node.address) {
            return md`
# Device address

The device address is **\`${node.address.value}\`**.

Its interpretation depends on the target platform and
the selected device driver.
`;
        }

        if (lookup.element===node.accessCode) {
            return md`
# Access code

The optional access code is **\`${node.accessCode.value}\`**.

Its meaning depends on the addressed hardware device.
`;
        }

        if (lookup.element===node.direction) {
            return md`
# Transfer direction

The transfer direction is **\`${node.direction.value}\`**.

Allowed values are:

- \`->\`  output
- \`<-\`  input
- \`<->\` bidirectional
`;
        }

        return undefined;
    }

}
