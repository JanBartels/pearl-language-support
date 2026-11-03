// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { TaskingTimedStartNode } from '../../../ast/problem/statements/taskingTimedStartNode';
import { TaskingTimeClauseNode } from '../../../ast/problem/statements/taskingTimeClauseNode';
import { TaskingFrequencyNode } from '../../../ast/problem/statements/taskingFrequencyNode';
import { TaskingFrequencyLimitNode } from '../../../ast/problem/statements/taskingFrequencyLimitNode';
import { TaskingInterruptStartNode } from '../../../ast/problem/statements/taskingInterruptStartNode';
import type { TaskingStartConditionNode } from '../../../ast/problem/statements/taskingStatementNode';
import { ParserBase } from '../../parserBase';
import type { Token } from '../../../lexer/token';
import { NameExpressionParser } from '../expressions/nameExpressionParser';
import { StatementExpressionParser } from '../expressions/statementExpressionParser';

const OPERATIONS = ['ACTIVATE', 'CONTINUE', 'RESUME'] as const;
const NEXT_STATEMENTS = [
    'RETURN', 'CALL', 'GOTO', 'IF', 'CASE', 'BEGIN', 'FOR', 'FROM', 'BY',
    'TO', 'WHILE', 'REPEAT', 'REQUEST', 'RELEASE', 'ENTER', 'LEAVE',
    'RESERVE', 'FREE', 'SEMASET', 'TERMINATE', 'SUSPEND', 'PREVENT'
] as const;
const CLAUSE_BOUNDARIES = [
    ...OPERATIONS, 'ALL', 'EVERY', 'AT', 'AFTER', 'WHEN',
    'UNTIL', 'DURING', 'PRIO', 'PRIORITY', ...NEXT_STATEMENTS
] as const;
const RECOVERY_BOUNDARIES = [
    ...OPERATIONS, ...NEXT_STATEMENTS, ';', 'END', 'MODEND', 'FIN', 'ELSE', 'ALT', 'OUT'
] as const;

/**
 * RTOS-UH separates WHEN scheduling from timed scheduling. Unlike the
 * general PEARL report, WHEN cannot be combined with AFTER/ALL.
 *
 *   WHEN Interrupt
 *   (AT Clock | AFTER Duration) [ALL Duration [UNTIL Clock | DURING Duration]]
 *   ALL Duration [UNTIL Clock | DURING Duration]
 *
 * PRIORITY and EVERY are retained as report spellings; their actual RTOS-UH
 * acceptance is pending a compiler probe.
 */
export class TaskingStartConditionParser extends ParserBase {
    override parse(): TaskingStartConditionNode | undefined {
        this.skipTrivia();
        const danglingLimit = this.acceptKeyword(['UNTIL', 'DURING']);
        if (danglingLimit) {
            this.problems.error(this.location(danglingLimit),
                `${this.tokenText(danglingLimit)} requires a preceding ALL frequency.`);
            this.synchronize(RECOVERY_BOUNDARIES);
            return undefined;
        }
        const when = this.acceptKeyword('WHEN');
        if (when) return this.parseInterruptStart(when);

        const initial = this.isKeyword(['AT', 'AFTER'])
            ? this.parseTimeClause()
            : undefined;
        this.skipTrivia();
        const frequency = this.isKeyword(['ALL', 'EVERY'])
            ? this.parseFrequency()
            : undefined;
        if (initial || frequency) {
            this.rejectAdditionalSchedulingClauses();
            return new TaskingTimedStartNode(initial, frequency);
        }
        return undefined;
    }

    private parseInterruptStart(keyword: Token): TaskingInterruptStartNode {
        const interrupt = new NameExpressionParser(this.context).parse();
        if (!interrupt) this.problems.error(this.location(), "Expected interrupt name after 'WHEN'.");
        this.skipTrivia();
        if (this.isKeyword(['AT', 'AFTER', 'ALL', 'EVERY', 'UNTIL', 'DURING', 'WHEN'])) {
            this.problems.error(this.location(),
                'RTOS-UH does not allow combining WHEN with timed or cyclic scheduling.');
            this.synchronize(RECOVERY_BOUNDARIES);
        }
        return new TaskingInterruptStartNode(this.tokenValue(keyword), interrupt);
    }

    private parseTimeClause(): TaskingTimeClauseNode {
        const keyword = this.acceptKeyword(['AT', 'AFTER'])!;
        const parsed = new StatementExpressionParser(this.context).parseUntil(
            CLAUSE_BOUNDARIES, `${this.tokenText(keyword)} start condition`);
        return new TaskingTimeClauseNode(
            this.tokenValue(keyword), parsed.values, parsed.expression);
    }

    private parseFrequency(): TaskingFrequencyNode {
        const keyword = this.acceptKeyword(['ALL', 'EVERY'])!;
        const interval = new StatementExpressionParser(this.context).parseUntil(
            CLAUSE_BOUNDARIES, `${this.tokenText(keyword)} frequency`);
        this.skipTrivia();
        const limit = this.isKeyword(['UNTIL', 'DURING'])
            ? this.parseLimit()
            : undefined;
        return new TaskingFrequencyNode(
            this.tokenValue(keyword), interval.values, interval.expression, limit);
    }

    private parseLimit(): TaskingFrequencyLimitNode {
        const keyword = this.acceptKeyword(['UNTIL', 'DURING'])!;
        const parsed = new StatementExpressionParser(this.context).parseUntil(
            CLAUSE_BOUNDARIES, `${this.tokenText(keyword)} frequency limit`);
        return new TaskingFrequencyLimitNode(
            this.tokenValue(keyword), parsed.values, parsed.expression);
    }

    private rejectAdditionalSchedulingClauses(): void {
        this.skipTrivia();
        if (!this.isKeyword(['AT', 'AFTER', 'WHEN', 'ALL', 'EVERY', 'UNTIL', 'DURING'])) return;
        const unexpected = this.tokenText();
        const message = unexpected === 'WHEN'
            ? 'RTOS-UH does not allow combining WHEN with timed or cyclic scheduling.'
            : unexpected === 'UNTIL' || unexpected === 'DURING'
                ? 'Only one limit (UNTIL or DURING) is allowed after ALL.'
                : `Unexpected additional scheduling clause '${unexpected}'.`;
        this.problems.error(this.location(), message);
        this.synchronize(RECOVERY_BOUNDARIES);
    }
}
