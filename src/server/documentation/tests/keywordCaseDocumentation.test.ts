// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SourceValue } from '../../core/sourceValue';
import { TaskingStatementNode } from '../../ast/problem/statements/taskingStatementNode';
import { TaskingTimeClauseNode } from '../../ast/problem/statements/taskingTimeClauseNode';
import { TaskingFrequencyNode } from '../../ast/problem/statements/taskingFrequencyNode';
import { TaskingFrequencyLimitNode } from '../../ast/problem/statements/taskingFrequencyLimitNode';
import { InterruptStatementNode } from '../../ast/problem/statements/interruptStatementNode';
import { SynchronizationStatementNode } from '../../ast/problem/statements/synchronizationStatementNode';
import { SynchronizationTypeNode } from '../../ast/problem/types/synchronizationTypeNode';
import { ConstantFixedTermNode } from '../../ast/problem/expressions/constantFixedTermNode';
import { ConstantFixedFactorNode } from '../../ast/problem/expressions/constantFixedFactorNode';

type KeywordNode = TaskingStatementNode | TaskingTimeClauseNode | TaskingFrequencyNode
    | TaskingFrequencyLimitNode | InterruptStatementNode | SynchronizationStatementNode
    | SynchronizationTypeNode;

function hover(node: KeywordNode): string | undefined {
    return node.documentationProvider().getDocumentation(node as never, { node, element: node.keyword });
}

function tasking(value: string) {
    return new TaskingStatementNode(SourceValue.synthetic(value), undefined, undefined,
        undefined, [], undefined, undefined);
}
function interrupt(value: string) {
    return new InterruptStatementNode(SourceValue.synthetic(value), undefined, undefined);
}
function sync(value: string) {
    return new SynchronizationStatementNode(SourceValue.synthetic(value), [], []);
}
function time(value: string) {
    return new TaskingTimeClauseNode(SourceValue.synthetic(value), [], undefined);
}
function frequency(value: string) {
    return new TaskingFrequencyNode(SourceValue.synthetic(value), [], undefined, undefined);
}
function limit(value: string) {
    return new TaskingFrequencyLimitNode(SourceValue.synthetic(value), [], undefined);
}

/** The lexer/parser require uppercase PEARL keywords. Hover must not repair
 * the spelling of an invalid AST keyword after the fact.
 */
test('keyword hovers use the exact, validated SourceValue spelling', () => {
    const entries = [
        [tasking('ACTIVATE'), tasking('activate')],
        [interrupt('ENABLE'), interrupt('enable')],
        [sync('REQUEST'), sync('request')],
        [new SynchronizationTypeNode(SourceValue.synthetic('SEMA')),
            new SynchronizationTypeNode(SourceValue.synthetic('sema'))],
        [time('AFTER'), time('after')],
        [time('AT'), time('at')],
        [frequency('ALL'), frequency('all')],
        [frequency('EVERY'), frequency('every')],
        [limit('UNTIL'), limit('until')],
        [limit('DURING'), limit('during')]
    ] as const;
    for (const [valid, invalid] of entries) {
        assert.match(hover(valid) ?? '', /^# /, `Missing hover for ${valid.keyword.value}`);
        assert.equal(hover(invalid), undefined, `Unexpected hover for ${invalid.keyword.value}`);
    }
});

test('constant FIXED REM hover does not silently accept lowercase rem', () => {
    function term(op: string) {
        const factor = new ConstantFixedFactorNode(undefined,
            { kind: 'integer', literal: SourceValue.synthetic('1'), precision: undefined }, undefined);
        const operator = SourceValue.synthetic(op);
        const node = new ConstantFixedTermNode(factor, [{ operator, factor: new ConstantFixedFactorNode(
            undefined, { kind: 'integer', literal: SourceValue.synthetic('2'), precision: undefined }, undefined) }]);
        return node.documentationProvider().getDocumentation(node, { node, element: operator });
    }
    assert.match(term('REM') ?? '', /Remainder operator/);
    assert.equal(term('rem'), undefined);
});
