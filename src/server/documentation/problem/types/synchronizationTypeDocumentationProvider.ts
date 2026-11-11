// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { SynchronizationTypeNode } from '../../../ast/problem/types/synchronizationTypeNode';

export class SynchronizationTypeDocumentationProvider extends DocumentationProvider<SynchronizationTypeNode> {
    override getDocumentation(node: SynchronizationTypeNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        const kind = node.keyword.value;
        if (kind === 'SEMA') return '# SEMA\n\nSynchronisationsobjekt zur Koordination von Tasks. Kann auch als Strukturkomponententyp verwendet werden.';
        if (kind === 'BOLT') return '# BOLT\n\nSynchronisationsobjekt zur gemeinsamen oder exklusiven Nutzung durch Tasks. Kann auch als Strukturkomponententyp verwendet werden.';
        return undefined;
    }
}
