// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../ast/astLookupResult';
import { SetLineSettingNode } from '../../ast/module/setLineSettingNode';
import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';

export class SetLineSettingDocumentationProvider extends DocumentationProvider<SetLineSettingNode> {
    override getDocumentation(node: SetLineSettingNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            return md`# SETLINE — Zeilennummer und Modul-ID

Globale RTOS-UH-Compilersteueranweisung vor \`MODULE\` (Handbuch 5.3.1).

\`\`\`pearl
SETLINE=1000;  ! Compilerprotokoll startet bei Zeile 1000
SETLINE=1,453; ! Compilerprotokoll startet bei 1; Modul-ID ist 453
\`\`\`

Zeilenmarker sind nur bis ungefähr 32000 vorgesehen; Modul-IDs oberhalb
29999 sind laut RTOS-UH für bestimmte Softwarepakete reserviert.

Diese Werte verändern **nicht** die tatsächlichen LSP-Quelltextpositionen.`;
        }
        if (lookup.element === node.firstLine) {
            return md`# SETLINE — Anfangszeile

\`${node.firstLine.value}\` ist die Startnummer der Zeilenzählung im
RTOS-UH-Compilerprotokoll bzw. des Linemarkers (ungefähre Grenze: 32000).

Die Positionen im Editor bleiben unverändert.`;
        }
        if (lookup.element === node.moduleId) {
            return md`# SETLINE — Modul-ID

Modul-ID \`${node.moduleId.value}\`. RTOS-UH benutzt sie bei
aktivierter Markierungsoption für die Laufzeitdiagnose.

IDs über 29999 sind laut Handbuch reserviert; ihre Verwendung wird nicht empfohlen.`;
        }
        return undefined;
    }
}
