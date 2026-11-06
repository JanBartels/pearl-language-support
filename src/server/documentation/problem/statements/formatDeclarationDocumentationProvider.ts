// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { FormatDeclarationNode } from '../../../ast/problem/declarations/formatDeclarationNode';
import { DocumentationProvider } from '../../documentationProvider';
import { formattedIoHelp } from './formattedIoHelp';

export class FormatDeclarationDocumentationProvider extends DocumentationProvider<FormatDeclarationNode> {
    override getDocumentation(node: FormatDeclarationNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.name) {
            return `# ${node.name.value}\n\nFORMAT-Deklaration mit wiederverwendbarer Formatliste.`;
        }
        return lookup.element === node.keyword ? formattedIoHelp('FORMAT') : undefined;
    }
}
