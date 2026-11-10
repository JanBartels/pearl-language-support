// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { BasicTransferStatementNode } from '../../../ast/problem/statements/basicTransferStatementNode';
import { DocumentationProvider } from '../../documentationProvider';

/** Documentation belongs to the statement AST, not to a separate LSP handler. */
export class BasicTransferDocumentationProvider extends DocumentationProvider<BasicTransferStatementNode> {
    override getDocumentation(node: BasicTransferStatementNode,
        lookup: AstLookupResult): string | undefined {
        const token = lookup.element === node.keyword ? node.keyword
            : lookup.element === node.directionKeyword ? node.directionKeyword
            : lookup.element === node.unsupportedBy ? node.unsupportedBy : undefined;
        if (!token) return undefined;
        switch (token.value) {
            case 'TAKE':
                return '# TAKE\n\nLiest Prozessdaten von einer BASIC-DATION. RTOS-UH akzeptiert eine leere oder mehrere Variablen umfassende Datenliste. Die Ziele müssen beschreibbar sein. Direkte Hardwarezugriffe können Nebenwirkungen haben.\n\nRTOS-UH: Abschnitt 6.2.';
            case 'SEND':
                return '# SEND\n\nÜberträgt Ausdrücke an eine BASIC-DATION. RTOS-UH akzeptiert eine leere oder mehrere Ausdrücke umfassende Datenliste. Die Übertragung kann unmittelbar auf die Peripherie zugreifen.\n\nRTOS-UH: Abschnitt 6.2.';
            case 'FROM':
                return '# FROM\n\nTAKE benötigt eine BASIC-DATION mit Richtung IN oder INOUT.';
            case 'TO':
                return '# TO\n\nSEND benötigt eine BASIC-DATION mit Richtung OUT oder INOUT.';
            case 'BY':
                return '# BY\n\nRTOS-UH unterstützt bei TAKE/SEND keine BY-Klausel. RST(...), S(...) und CONTROL(...) werden vom Originalcompiler mit einem Syntaxfehler abgewiesen.';
            default:
                return undefined;
        }
    }
}
