// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { DocumentationProvider } from '../../documentationProvider';
import type { AstLookupResult } from '../../../ast/astLookupResult';
import type { TaskingStatementNode } from '../../../ast/problem/statements/taskingStatementNode';
import type { TaskingInterruptStartNode } from '../../../ast/problem/statements/taskingInterruptStartNode';
import type { TaskingTimeClauseNode } from '../../../ast/problem/statements/taskingTimeClauseNode';
import type { TaskingFrequencyNode } from '../../../ast/problem/statements/taskingFrequencyNode';
import type { TaskingFrequencyLimitNode } from '../../../ast/problem/statements/taskingFrequencyLimitNode';

/** Documents exactly the SourceValue owned by each tasking AST node.
 * NameExpression children retain their usual symbol/type hover providers.
 */
const operations: Record<string, string> = {
    ACTIVATE: 'Aktiviert eine Task, sofort oder zu einer angegebenen Startbedingung. Ein Taskname ist erforderlich.',
    TERMINATE: 'Beendet die bezeichnete Task, ohne Tasknamen die aktuell laufende Task.',
    SUSPEND: 'Suspendiert die bezeichnete Task, ohne Tasknamen die aktuell laufende Task.',
    CONTINUE: 'Setzt eine Task fort; ohne Tasknamen die aktuelle Task. Eine einfache Startbedingung ist optional; eine PRIO-Angabe ist bei CONTINUE nicht zulässig.',
    RESUME: 'Suspendiert die aktuelle Task bis zur angegebenen AT-, AFTER- oder WHEN-Bedingung.',
    PREVENT: 'Hebt die Einplanung einer Task auf, ohne Tasknamen die der aktuellen Task.'
};

export class TaskingStatementDocumentationProvider extends DocumentationProvider<TaskingStatementNode> {
    override getDocumentation(node: TaskingStatementNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element === node.keyword) {
            const operation = node.keyword.value.toUpperCase();
            const description = operations[operation];
            return description ? `# ${operation}\n\n${description}` : undefined;
        }
        if (lookup.element === node.priorityKeyword) {
            return '# PRIO\n\nOptionale Priorität nur für ACTIVATE. Erwartet einen konstanten FIXED-Ausdruck (1 bis 32767), z. B. eine INV FIXED-Konstante.';
        }
        return undefined;
    }
}

export class TaskingInterruptStartDocumentationProvider extends DocumentationProvider<TaskingInterruptStartNode> {
    override getDocumentation(node: TaskingInterruptStartNode, lookup: AstLookupResult): string | undefined {
        return lookup.element === node.keyword
            ? '# WHEN\n\nInterruptgesteuerte Einplanung. Erwartet einen INTERRUPT-Namen; eine Kombination mit zeitlichen Startbedingungen ist in RTOS-UH nicht zulässig.'
            : undefined;
    }
}

export class TaskingTimeClauseDocumentationProvider extends DocumentationProvider<TaskingTimeClauseNode> {
    override getDocumentation(node: TaskingTimeClauseNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        return node.keyword.value.toUpperCase() === 'AT'
            ? '# AT\n\nZeitgesteuerte Einplanung zu einem CLOCK-Ausdruck.'
            : '# AFTER\n\nZeitgesteuerte Einplanung nach einem nichtnegativen DURATION-Ausdruck. 0 SEC bezeichnet den nächsten Timertick.';
    }
}

export class TaskingFrequencyDocumentationProvider extends DocumentationProvider<TaskingFrequencyNode> {
    override getDocumentation(node: TaskingFrequencyNode, lookup: AstLookupResult): string | undefined {
        return lookup.element === node.keyword
            ? `# ${node.keyword.value.toUpperCase()}\n\nZyklische Einplanung im Abstand eines nichtnegativen DURATION-Ausdrucks. Optional wird der Zyklus durch UNTIL oder DURING begrenzt.`
            : undefined;
    }
}

export class TaskingFrequencyLimitDocumentationProvider extends DocumentationProvider<TaskingFrequencyLimitNode> {
    override getDocumentation(node: TaskingFrequencyLimitNode, lookup: AstLookupResult): string | undefined {
        if (lookup.element !== node.keyword) return undefined;
        return node.keyword.value.toUpperCase() === 'UNTIL'
            ? '# UNTIL\n\nBegrenzt eine zyklische Einplanung bis zu einem CLOCK-Ausdruck. Nur zusammen mit ALL/EVERY.'
            : '# DURING\n\nBegrenzt eine zyklische Einplanung auf eine nichtnegative DURATION. Nur zusammen mit ALL/EVERY; 0 SEC ist zulässig.';
    }
}
