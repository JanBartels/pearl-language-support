// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { SynchronizationStatementNode } from '../../../ast/problem/statements/synchronizationStatementNode';

const descriptions: Record<string, string> = {
    REQUEST: 'Fordert eine oder mehrere SEMA-Variablen an. Falls die Anforderung nicht sofort erfüllbar ist, wartet die Task.',
    RELEASE: 'Gibt eine oder mehrere SEMA-Variablen frei.',
    ENTER: 'Betritt einen durch BOLT geschützten Bereich mit gemeinsamer Nutzung.',
    LEAVE: 'Verlässt einen zuvor betretenen BOLT-Bereich.',
    RESERVE: 'Reserviert einen oder mehrere BOLT-Bereiche für exklusiven Zugriff.',
    FREE: 'Gibt zuvor reservierte BOLT-Bereiche wieder frei.'
};

export class SynchronizationStatementDocumentationProvider extends DocumentationProvider<SynchronizationStatementNode> {
    override getDocumentation(node: SynchronizationStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        const operation = node.keyword.value;
        const description = descriptions[operation];
        if (!description) return undefined;
        return `# ${operation}\n\n${description}\n\nErwartet ${operation === 'REQUEST' || operation === 'RELEASE' ? 'SEMA' : 'BOLT'}-Objekte als Operanden.`;
    }
}
