// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { InterruptStatementNode } from '../../../ast/problem/statements/interruptStatementNode';

const descriptions: Record<string, string> = {
    ENABLE: 'Gibt den bezeichneten Interrupt frei, sodass zugehörige WHEN-Einplanungen bei seinem Auftreten wirksam werden.',
    DISABLE: 'Sperrt den bezeichneten Interrupt, bis er durch ENABLE wieder freigegeben wird.',
    TRIGGER: 'Löst den bezeichneten Interrupt zu Test- oder Simulationszwecken softwareseitig aus.'
};

export class InterruptStatementDocumentationProvider extends DocumentationProvider<InterruptStatementNode> {
    override getDocumentation(node: InterruptStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        const operation = node.keyword.value;
        const description = descriptions[operation];
        return description ? `# ${operation}\n\n${description}\n\nErwartet einen INTERRUPT-Namen.` : undefined;
    }
}
