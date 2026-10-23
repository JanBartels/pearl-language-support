// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../ast/astLookupResult';
import { ProcessorSettingNode } from '../../ast/module/processorSettingNode';
import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';

const OPTIONS = md`
**RTOS-UH-Zielprozessoren** (Handbuch 5.1.1):

| Schreibweise | Bedeutung |
| --- | --- |
| \`P=68000;\` | 68000-kompatibler Code; RTOS-UH-Floatformat |
| \`P=68020;\` | MC68020; RTOS-UH-Floatformat |
| \`P=68040;\`, \`P=68040(n);\` | MC68040; n = 3 bis 8 FPU-Register |
| \`P=68060;\`, \`P=68060(n);\` | MC68060; n = 3 bis 8 FPU-Register |
| \`P=68881;\`, \`P=68881(n);\` | MC68881/2; n = 1 bis 8, Standard 1 |
| \`P=MPC603;\`, \`P=MPC604;\` | PowerPC 603/604 ohne FPU |
| \`P=MPC603+(n);\`, \`P=MPC604+(n);\` | PowerPC mit FPU; n = 0 bis 32 |
| \`P=MPC603+FPU(n);\`, \`P=MPC604+FPU(n);\` | PowerPC mit FPU; n = 0 bis 32 |
| \`P=MPC405;\` | IBM PowerPC 405; mit Prozessor-Workaround |

Die Prozessorwahl beeinflusst insbesondere den Befehlssatz, das Gleitkommaformat
und den bei Taskwechseln gesicherten FPU-Kontext. RTOS-UH warnt davor,
Module mit verschiedenen \`P\`-Einstellungen zusammenzulinken.

Unser Analysecompiler erzeugt keinen Maschinencode; die Einstellung wird für
Dokumentation und semantische Prüfungen erfasst.
`;

export class ProcessorSettingDocumentationProvider extends DocumentationProvider<ProcessorSettingNode> {
    override getDocumentation(node: ProcessorSettingNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            return md`# P — Zielprozessor

Die globale Compilersteueranweisung \`P=...;\` steht vor \`MODULE\`.

` + '\n\n' + OPTIONS;
        }
        if (lookup.element === node.processor) {
            const processor = node.processor.value;
            const descriptions: Record<string, string> = {
                '68000': '68000-kompatibler Modus mit RTOS-UH-Gleitkommaformat.',
                '68020': 'MC68020-Befehlssatz; RTOS-UH-Gleitkommaformat.',
                '68040': 'MC68040 mit nativen FPU-Operationen und angepassten mathematischen Routinen.',
                '68060': 'MC68060; vermeidet dort nicht vorhandene emulierte Befehle.',
                '68881': 'MC68881/2-FPU; standardmäßig wird ein FPU-Register gesichert.',
                'MPC603': 'PowerPC 603; ohne FPU-Parameter keine Nutzung der FPU.',
                'MPC604': 'PowerPC 603/604; ohne FPU-Parameter keine Nutzung der FPU.', 
                'MPC405': 'PowerPC 405 mit Umgehung des lwarx/stwarx-Prozessorfehlers.'
            };
            return md`# Zielprozessor ${processor}

${descriptions[processor] ?? 'Dieser Zielprozessor ist in RTOS-UH 5.1.1 nicht aufgeführt.'}

` + '\n\n' + OPTIONS;
        }
        if (lookup.element === node.plusOperator || lookup.element === node.fpuKeyword
            || lookup.element === node.registerCount) {
            const processor = node.processor.value;
            const range = (processor === 'MPC603' || processor === 'MPC604')
                ? '0 bis 32 (0 deaktiviert die FPU; der Compiler kann die Zahl bei Bedarf erhöhen)'
                : processor === '68881'
                    ? '1 bis 8 (ohne Angabe wird 1 verwendet)'
                    : '3 bis 8 für 68040 und 68060';
            return md`# FPU-Register / Taskkontext

\`n\` bestimmt die beim Taskwechsel zu berücksichtigenden FPU-Register.

Für ${processor} gilt: **${range}**.

` + '\n\n' + OPTIONS;
        }
        return undefined;
    }
}
