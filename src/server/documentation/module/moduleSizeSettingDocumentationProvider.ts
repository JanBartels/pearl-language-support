// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../ast/astLookupResult';
import { ModuleSizeSettingNode } from '../../ast/module/moduleSizeSettingNode';
import { DocumentationProvider } from '../documentationProvider';
import { md } from '../markdownUtils';

const OPTIONS = md`
**Zulässige Formen** (RTOS-UH 5.3.2):

\`\`\`pearl
S=$6500;
S=6500;
SC=$6500;
SC=6500;
S=$6500,CODE=$100000,VAR=$200000;
SC=$6500,CODE=$100000,VAR=$200000;
\`\`\`

Alle Größen und Adressen sind **hexadezimal**, auch ohne \`$\`.
\`6500\` und \`$6500\` bedeuten also denselben Wert (25856 dezimal).
Fehlt \`S\`/\`SC\`, verwendet RTOS-UH den Ersatzwert \`$2000\`.

\`CODE\` und \`VAR\` müssen **gemeinsam** in dieser Reihenfolge stehen.
Sie legen für ROM-Code die EPROM-Adresse und die RAM-Adresse der Modulvariablen fest.
`;

export class ModuleSizeSettingDocumentationProvider extends DocumentationProvider<ModuleSizeSettingNode> {
    override getDocumentation(node: ModuleSizeSettingNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            return md`# ${node.keyword.value} — reservierte Modulgröße

\`S\` übergibt dem RTOS-UH-Lader die reservierte Modulgröße.
\`SC\` lässt den zugehörigen Speicher beim Laden zusätzlich auf Null setzen,
**nicht vor jedem Start** des Programms.

` + '\n\n' + OPTIONS;
        }
        if (lookup.element === node.size) {
            return md`# Modulgröße (Hexzahl)

Geschrieben: \`${node.size.value}\`.

Die Größe ist eine Hexzahl; ein vorangestelltes \`$\` ist optional.
Sie begrenzt beim RTOS-UH-Compiler die Modulbilanz.

` + '\n\n' + OPTIONS;
        }
        if (lookup.element === node.codeKeyword || lookup.element === node.codeAddress) {
            return md`# CODE — ROM-Codeadresse

\`CODE\` gibt die Startadresse des Codes im EPROM an.
Nur zusammen mit \`VAR\` in einer \`S\`- oder \`SC\`-Anweisung verwendbar.

` + '\n\n' + OPTIONS;
        }
        if (lookup.element === node.varKeyword || lookup.element === node.varAddress) {
            return md`# VAR — RAM-Variablenadresse

\`VAR\` gibt die Startadresse der Modulvariablen im RAM an.
Nur gemeinsam mit \`CODE\` zu verwenden.

` + '\n\n' + OPTIONS;
        }
        return undefined;
    }
}
