// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { DationControlStatementNode } from '../../../ast/problem/statements/dationControlStatementNode';
import type { DationControlOptionNode } from '../../../ast/problem/statements/dationControlOptionNode';
import { DocumentationProvider } from '../../documentationProvider';

const help: Readonly<Record<string, string>> = {
    OPEN: 'Öffnet eine DATION. Mit BY können Dateiname, Existenzbedingungen, exklusiver Zugriff und Fehlerstatus angegeben werden.',
    CLOSE: 'Schließt eine DATION. BY PRM erhält, BY CAN löscht die zugehörige Datei.',
    BY: 'Leitet die Optionen der OPEN- oder CLOSE-Anweisung ein.',
    IDF: 'IDF(CHARACTER-Ausdruck) legt den Dateinamen beziehungsweise die Pathlist der DATION fest.',
    NEW: 'Die zu öffnende Datei darf noch nicht existieren.',
    OLD: 'Die zu öffnende Datei muss bereits existieren.',
    ANY: 'Die Datei wird geöffnet oder neu angelegt.',
    EXCLUSIVE: 'Öffnet die Datei für exklusiven Zugriff der aufrufenden Task (nach NEW, OLD oder ANY).',
    CAN: 'Schließt die DATION und löscht die zugehörige Datei.',
    PRM: 'Schließt die DATION unter Erhaltung der Datei.',
    RST: 'RST(FIXED-Variable) stellt den Fehlerstatus der I/O-Operation bereit.'
};

/** Shared keyword documentation; referenced operands use their existing symbol hover. */
export class DationControlDocumentationProvider extends DocumentationProvider<
    DationControlStatementNode | DationControlOptionNode
> {
    override getDocumentation(
        node: DationControlStatementNode | DationControlOptionNode,
        lookup: AstLookupResult
    ): string | undefined {
        const token = lookup.element === node.keyword
            ? node.keyword
            : 'byKeyword' in node && lookup.element === node.byKeyword
                ? node.byKeyword : undefined;
        if (!token) return undefined;
        const description = help[token.value];
        return description ? `# ${token.value}\n\n${description}` : undefined;
    }
}
