// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../ast/astLookupResult';
import { MaxErrorSettingNode } from '../../ast/module/maxErrorSettingNode';
import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';

export class MaxErrorSettingDocumentationProvider extends DocumentationProvider<MaxErrorSettingNode> {
    override getDocumentation(node: MaxErrorSettingNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword && lookup.element !== node.maximum) return undefined;
        return md`# MAXERR — maximale Compilerfehler

Modulglobale RTOS-UH-Einstellung vor \`MODULE\` (Handbuch 5.3.1).

\`\`\`pearl
MAXERR=10; ! RTOS-UH bricht beim elften Compilerfehler ab
MAXERR=0;  ! RTOS-UH bricht beim ersten Compilerfehler ab
\`\`\`

Aktueller Wert: \`${node.maximum.value}\`.

Unser Analysecompiler erfasst diese Option, begrenzt damit aber **nicht** die
fortlaufende Diagnostik des LSP.`;
    }
}
