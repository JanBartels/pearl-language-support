// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CompilerModeNode } from '../../ast/module/compilerModeNode';
import { AstLookupResult } from '../../ast/astLookupResult';
import { DocumentationProvider } from '../documentationProvider';

export class CompilerModeDocumentationProvider
    extends DocumentationProvider<CompilerModeNode> {

    override getDocumentation(
        node: CompilerModeNode,
        lookup: AstLookupResult
    ): string | undefined {
        if (lookup.element === node.keyword) {
            return '# MODE\n\nRTOS-UH-Compilermodus für das folgende Modul.';
        }

        if (lookup.element !== node.mode) {
            return undefined;
        }

        switch (node.mode.value) {
            case 'CLOCK50':
                return '# CLOCK50\n\n'
                    + '`MODE=CLOCK50;` verwendet für CLOCK und DURATION die RTOS-UH-Zeitauflösung '
                    + 'von 50 us anstelle der normalen 1 ms.';

            case 'FULLCC':
                return '# FULLCC\n\n'
                    + '`MODE=FULLCC;` aktiviert den vollständigen Vergleich unterschiedlich langer '
                    + 'CHAR-Werte. Der kürzere Wert wird dazu mit Leerzeichen auf die Länge des längeren '
                    + 'Wertes erweitert.';

            case 'NOLSTOP':
                return '# NOLSTOP\n\n'
                    + '`MODE=NOLSTOP;` verwendet bei eingeschalteter Markierungsoption `/*+M*/` die '
                    + 'schnellere RTOS-UH-Zeilenmarkierung. Dadurch sinkt der Laufzeitaufwand deutlich, '
                    + 'der Zeilenstop beim Tracen ist dann jedoch nicht möglich.';

            case 'PAD':
                return '# PAD\n\n'
                    + '`MODE=PAD;` aktiviert zusätzliches Padding innerhalb von STRUCT-Werten. '
                    + 'FLOAT- und STRUCT-Komponenten werden dabei auf durch 4 teilbare relative Ablagen '
                    + 'ausgerichtet.';

            case 'NOPAD':
                return '# NOPAD\n\n'
                    + '`MODE=NOPAD;` schaltet das zusätzliche Padding innerhalb von STRUCT-Werten aus. '
                    + 'Die allgemeine Ausrichtung von FLOAT- und STRUCT-Objekten auf durch 4 teilbare '
                    + 'Adressen bleibt davon unberührt.';

            default:
                return '# Unbekannter Compilermodus\n\n`MODE=' + node.mode.value + ';`';
        }
    }
}
