// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from './documentationProvider';
import { AstLookupResult } from '../ast/astLookupResult';
import { md } from './markdownUtils';
import { AlphicDationSystemDeclarationNode } from '../ast/alphicDationSystemDeclationNode';

export class AlphicDationDocumentationProvider
    extends DocumentationProvider<AlphicDationSystemDeclarationNode> {

    override getDocumentation(
        node: AlphicDationSystemDeclarationNode,
        lookup: AstLookupResult
    ): string | undefined {

        if (lookup.element===node.name) {
            return md`
# Dation name

The name of this system dation is **\`${node.name.value}\`**.

This identifier can be referenced by problem dations.
`;
        }

        if (lookup.element===node.systemName) {
            return md`
# System device

The referenced system device is **\`${node.systemName.value}\`**.
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

        if (lookup.element===node.tfu) {
            return md`
# TFU

The TFU parameter is set to **\`${node.tfu.value}\`**.

Its interpretation depends on the selected device.
`;
        }

        if (lookup.element===node.neFlag) {
            return md`
# NE

The **NE** option is **${node.neFlag.value ? "enabled" : "disabled"}**.
`;
        }

        if (lookup.element===node.mb) {
            return md`
# MB

The MB parameter is **\`${node.mb.value}\`**.

Its interpretation depends on the selected device.
`;
        }

        if (lookup.element===node.ai) {
            return md`
# AI

The AI parameter is **\`${node.ai.value}\`**.

Its interpretation depends on the selected device.
`;
        }

        return undefined;
    }

}
