// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { FormatItemNode } from '../../../ast/problem/statements/formatItemNode';
import { DocumentationProvider } from '../../documentationProvider';
import { formattedIoHelp } from './formattedIoHelp';

export class FormatItemDocumentationProvider extends DocumentationProvider<FormatItemNode> {
    override getDocumentation(node: FormatItemNode, lookup: AstLookupResult): string | undefined {
        return node.keyword && lookup.element === node.keyword
            ? formattedIoHelp(node.keyword.value) : undefined;
    }
}
