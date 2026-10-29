// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstLookupResult } from '../../../ast/astLookupResult';
import { AssignmentNode } from '../../../ast/problem/statements/assignmentNode';
import { DocumentationProvider } from '../../documentationProvider';

/** Documentation for the assignment operator, not for its operands. */
export class AssignmentDocumentationProvider extends DocumentationProvider<AssignmentNode> {
    override getDocumentation(node: AssignmentNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.contOperator) {
            return '# CONT-Zuweisung\n\nDas referenzierte Objekt wird beschrieben, nicht die Referenzvariable selbst.';
        }
        return lookup.element === node.operator
            ? '# Zuweisung\n\nDer Ausdruck rechts wird dem Ziel links zugewiesen. Typkompatibilität und Beschreibbarkeit werden semantisch geprüft.'
            : undefined;
    }
}
