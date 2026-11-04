// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { BinaryTransferStatementNode } from '../../../ast/problem/statements/binaryTransferStatementNode';
import type { BinaryTransferSFormatNode } from '../../../ast/problem/statements/binaryTransferSFormatNode';
import { DocumentationProvider } from '../../documentationProvider';

const help: Readonly<Record<string, string>> = {
    READ: 'Liest die Objekte der Liste in ihrer internen (binären) Darstellung von einer DATION. Das Lesen erfolgt mit WAIT. Ein Fehlerstatus kann anschließend über ST(DATION) abgefragt werden.',
    WRITE: 'Schreibt die Werte der Liste in ihrer internen (binären) Darstellung auf eine DATION. Das Schreiben erfolgt mit WAIT. Ein Fehlerstatus kann anschließend über ST(DATION) abgefragt werden.',
    FROM: 'Bezeichnet die DATION, aus der READ seine Daten liest.',
    TO: 'Bezeichnet die DATION, auf die WRITE seine Daten schreibt.',
    BY: 'Leitet die optionalen S-Formate für die Längensteuerung der einzelnen Listenobjekte ein.',
    S: 'S(FIXED(31)-Variable) begrenzt anhand des aktuellen Variablenwerts die Anzahl der zu übertragenden Bytes und schreibt anschließend die tatsächliche Anzahl zurück. Die S-Formate werden den Datenobjekten der Reihe nach zugeordnet; fehlende S-Formate bedeuten ungesteuerte Übertragung.'
};

export class BinaryTransferDocumentationProvider extends DocumentationProvider<
    BinaryTransferStatementNode | BinaryTransferSFormatNode
> {
    override getDocumentation(
        node: BinaryTransferStatementNode | BinaryTransferSFormatNode,
        lookup: AstLookupResult
    ): string | undefined {
        const token = lookup.element === node.keyword
            ? node.keyword
            : 'directionKeyword' in node && lookup.element === node.directionKeyword
                ? node.directionKeyword
                : 'byKeyword' in node && lookup.element === node.byKeyword
                    ? node.byKeyword : undefined;
        if (!token) return undefined;
        const description = help[token.value];
        return description ? `# ${token.value}\n\n${description}` : undefined;
    }
}
