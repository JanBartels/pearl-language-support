// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TaskingStatementNode } from '../../../ast/problem/statements/taskingStatementNode';
import type { TaskingStartConditionNode } from '../../../ast/problem/statements/taskingStatementNode';
import { TaskingTimedStartNode } from '../../../ast/problem/statements/taskingTimedStartNode';
import { ParserBase } from '../../parserBase';
import { NameExpressionParser } from '../expressions/nameExpressionParser';
import { StatementExpressionParser } from '../expressions/statementExpressionParser';
import { TaskingStartConditionParser } from './taskingStartConditionParser';

const OPERATIONS = [
    'ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE', 'RESUME', 'PREVENT'
] as const;
const START_KEYWORDS = ['AT', 'AFTER', 'WHEN', 'ALL', 'EVERY', 'UNTIL', 'DURING'] as const;
const RECOVERY = [
    ';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT',
    'BEGIN', 'IF', 'CASE', 'FOR', 'FROM', 'BY', 'TO', 'WHILE', 'REPEAT',
    'RETURN', 'CALL', 'GOTO', 'REQUEST', 'RELEASE', 'ENTER', 'LEAVE',
    'RESERVE', 'FREE', 'SEMASET', ...OPERATIONS, ...START_KEYWORDS
] as const;

/** Parse all six task control statements through a single grammar entry point. */
export class TaskingStatementParser extends ParserBase {
    override parse(): TaskingStatementNode | undefined {
        this.skipTrivia();
        const startCondition = this.isKeyword(START_KEYWORDS)
            ? new TaskingStartConditionParser(this.context).parse()
            : undefined;
        this.skipTrivia();

        const verb = this.acceptKeyword(OPERATIONS);
        if (!verb) {
            if (startCondition) {
                this.problems.error(this.location(),
                    'Expected ACTIVATE, CONTINUE or RESUME after task start condition.');
                this.recoverStatement();
            }
            return undefined;
        }
        const operation = this.tokenText(verb);
        if (startCondition && !['ACTIVATE', 'CONTINUE', 'RESUME'].includes(operation)) {
            this.problems.error(this.location(verb),
                `Start conditions are not allowed with '${operation}'.`);
        }
        if (startCondition instanceof TaskingTimedStartNode
            && startCondition.frequency && operation !== 'ACTIVATE') {
            this.problems.error(this.location(verb),
                'Cyclic start conditions (ALL/EVERY) are only allowed with ACTIVATE.');
        }
        if (!startCondition && operation === 'RESUME') {
            this.problems.error(this.location(verb),
                'RESUME requires an AT, AFTER or WHEN start condition.');
        }

        const task = ['ACTIVATE', 'TERMINATE', 'SUSPEND', 'CONTINUE', 'PREVENT']
            .includes(operation)
            ? new NameExpressionParser(this.context).parse()
            : undefined;
        if (operation === 'ACTIVATE' && !task) {
            this.problems.error(this.location(), 'ACTIVATE requires a task name.');
        }

        this.skipTrivia();
        const priorityKeyword = ['ACTIVATE', 'CONTINUE'].includes(operation)
            ? this.acceptKeyword(['PRIO', 'PRIORITY'])
            : undefined;
        if (priorityKeyword && operation === 'CONTINUE') {
            // Consume the clause for recovery, but report RTOS-UH's actual
            // grammar restriction at the keyword rather than at ';'.
            this.problems.error(this.location(priorityKeyword),
                'CONTINUE does not allow PRIO or PRIORITY.');
        }
        const parsedPriority = priorityKeyword
            ? new StatementExpressionParser(this.context).parseUntil(
                RECOVERY, `${this.tokenText(priorityKeyword)} task priority`)
            : undefined;

        this.skipTrivia();
        const semicolon = this.acceptOperator(';');
        if (!semicolon) {
            this.problems.error(this.location(),
                `Expected ';' after ${operation} statement.`);
            this.recoverStatement();
        }
        return new TaskingStatementNode(
            this.tokenValue(verb), startCondition, task,
            priorityKeyword ? this.tokenValue(priorityKeyword) : undefined,
            parsedPriority?.values ?? [], parsedPriority?.expression,
            semicolon ? this.tokenValue(semicolon) : undefined
        );
    }

    private recoverStatement(): void {
        this.synchronize(RECOVERY);
        this.acceptOperator(';');
    }
}
