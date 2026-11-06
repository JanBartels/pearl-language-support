// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { FormattedIoStatementNode } from '../../../ast/problem/statements/formattedIoStatementNode';
import { DocumentationProvider } from '../../documentationProvider';
import { formattedIoHelp } from './formattedIoHelp';

export class FormattedIoStatementDocumentationProvider extends DocumentationProvider<FormattedIoStatementNode> {
    override getDocumentation(node: FormattedIoStatementNode, lookup: AstLookupResult): string | undefined {
        const token = lookup.element === node.keyword ? node.keyword :
            lookup.element === node.directionKeyword ? node.directionKeyword :
            lookup.element === node.byKeyword ? node.byKeyword : undefined;
        return token && formattedIoHelp(token.value);
    }
}
