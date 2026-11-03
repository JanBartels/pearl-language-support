// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { TaskingStatementNode } from '../../../../ast/problem/statements/taskingStatementNode';
import { TaskingTimedStartNode } from '../../../../ast/problem/statements/taskingTimedStartNode';
import { TaskingInterruptStartNode } from '../../../../ast/problem/statements/taskingInterruptStartNode';
import { ReturnStatementNode } from '../../../../ast/problem/statements/returnStatementNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(body: string) {
    const text = `P=MPC603; SC=2000; MODULE M; PROBLEM;
        SPC Alarm INTERRUPT;
        Worker: TASK; END;
        Runner: TASK MAIN;
        ${body}
        END;
        MODEND;`;
    const source = new FileSource('file:///tasking85.P', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const nodes: AstNode[] = [];
    const visit = (node: AstNode) => {
        nodes.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    return {
        text, source, ast, nodes,
        statements: nodes.filter((node): node is TaskingStatementNode => node instanceof TaskingStatementNode),
        messages: problems.toArray().map(problem => problem.message)
    };
}

test('all six tasking verbs produce distinct statements with optional task names', () => {
    const result = parse(`
        ACTIVATE Worker;
        TERMINATE;
        TERMINATE Worker;
        SUSPEND;
        SUSPEND Worker;
        CONTINUE;
        CONTINUE Worker;
        PREVENT;
        PREVENT Worker;
    `);
    assert.deepEqual(result.messages, []);
    assert.deepEqual(result.statements.map(node => node.keyword.value), [
        'ACTIVATE', 'TERMINATE', 'TERMINATE', 'SUSPEND', 'SUSPEND',
        'CONTINUE', 'CONTINUE', 'PREVENT', 'PREVENT'
    ]);
    assert.deepEqual(result.statements.map(node => !!node.task), [
        true, false, true, false, true, false, true, false, true
    ]);
});

test('immediate and timed ACTIVATE retain task, PRIO and expressions', () => {
    const result = parse(`
        ACTIVATE Worker PRIO 10 + 2;
        AT 12:00:00 ACTIVATE Worker PRIO 3;
        AFTER 0.5 SEC ACTIVATE Worker;
    `);
    assert.deepEqual(result.messages, []);
    assert.equal(result.statements.length, 3);
    assert.ok(result.statements[0].priority);
    assert.equal(result.statements[0].priorityKeyword?.value, 'PRIO');
    for (const statement of result.statements.slice(1)) {
        assert.ok(statement.startCondition instanceof TaskingTimedStartNode);
        assert.ok(statement.startCondition.initial?.expression);
        assert.equal(statement.startCondition.frequency, undefined);
    }
    assert.equal((result.statements[1].startCondition as TaskingTimedStartNode).initial?.keyword.value, 'AT');
    assert.equal((result.statements[2].startCondition as TaskingTimedStartNode).initial?.keyword.value, 'AFTER');
});

test('ALL, UNTIL, DURING and combinations with AT/AFTER create structured subtrees', () => {
    const result = parse(`
        ALL 2 SEC ACTIVATE Worker;
        ALL 2 SEC UNTIL 15:00:00 ACTIVATE Worker;
        ALL 2 SEC DURING 1 MIN ACTIVATE Worker;
        AT 12:00:00 ALL 2 SEC UNTIL 15:00:00 ACTIVATE Worker;
        AFTER 5 SEC ALL 2 SEC DURING 1 MIN ACTIVATE Worker;
    `);
    assert.deepEqual(result.messages, []);
    assert.equal(result.statements.length, 5);
    const conditions = result.statements.map(node => node.startCondition as TaskingTimedStartNode);
    assert.ok(conditions.every(cond => cond instanceof TaskingTimedStartNode));
    assert.ok(conditions.every(cond => !!cond.frequency?.interval));
    assert.equal(conditions[0].frequency?.limit, undefined);
    assert.deepEqual(conditions.map(cond => cond.frequency?.limit?.keyword.value), [
        undefined, 'UNTIL', 'DURING', 'UNTIL', 'DURING'
    ]);
    assert.ok(conditions[3].initial?.expression);
    assert.ok(conditions[4].initial?.expression);
    assert.ok(conditions[3].frequency?.limit?.expression);
});

test('WHEN scheduling, including WHEN RESUME, remains separate from time scheduling', () => {
    const result = parse(`
        WHEN Alarm ACTIVATE Worker;
        WHEN Alarm CONTINUE Worker PRIO 5;
        WHEN Alarm RESUME;
    `);
    assert.deepEqual(result.messages, []);
    assert.deepEqual(result.statements.map(s => s.keyword.value), ['ACTIVATE', 'CONTINUE', 'RESUME']);
    assert.ok(result.statements.every(s => s.startCondition instanceof TaskingInterruptStartNode));
    assert.ok(result.statements.every(s => (s.startCondition as TaskingInterruptStartNode).interrupt));
    assert.equal(result.statements[2].task, undefined);
});

test('CONTINUE supports missing task name and simple AT/AFTER/WHEN conditions', () => {
    const result = parse(`
        CONTINUE PRIO 5;
        AT 12:00:00 CONTINUE;
        AFTER 2 SEC CONTINUE Worker;
        WHEN Alarm CONTINUE PRIO 4;
    `);
    assert.deepEqual(result.messages, []);
    assert.equal(result.statements.length, 4);
    assert.equal(result.statements[0].task, undefined);
    assert.ok(result.statements[0].priority);
    assert.equal(result.statements[1].task, undefined);
    assert.ok(result.statements[3].priority);
});

test('RESUME requires a simple AT, AFTER or WHEN condition', () => {
    const valid = parse(`AT 12:00:00 RESUME; AFTER 0.5 SEC RESUME; WHEN Alarm RESUME;`);
    assert.deepEqual(valid.messages, []);
    assert.equal(valid.statements.length, 3);
    const invalid = parse(`RESUME; CONTINUE Worker;`);
    assert.match(invalid.messages.join(' '), /RESUME requires/);
    assert.deepEqual(invalid.statements.map(s => s.keyword.value), ['RESUME', 'CONTINUE']);
});

test('invalid WHEN/AFTER mixing is diagnosed without swallowing the next statement', () => {
    const result = parse(`WHEN Alarm AFTER 1 SEC ACTIVATE Worker; CONTINUE Worker;`);
    assert.ok(result.messages.some(m => /does not allow combining WHEN/.test(m)));
    assert.deepEqual(result.statements.map(s => s.keyword.value), ['ACTIVATE', 'CONTINUE']);
});

test('cyclic CONTINUE/RESUME and both cycle limits are diagnosed', () => {
    const result = parse(`
        ALL 2 SEC CONTINUE Worker;
        ALL 2 SEC RESUME;
        ALL 2 SEC UNTIL 15:00:00 DURING 1 MIN ACTIVATE Worker;
        ACTIVATE Worker;
    `);
    assert.ok(result.messages.filter(m => /only allowed with ACTIVATE/.test(m)).length >= 2);
    assert.ok(result.messages.some(m => /Only one limit/.test(m)));
    assert.deepEqual(result.statements.map(s => s.keyword.value), [
        'CONTINUE', 'RESUME', 'ACTIVATE', 'ACTIVATE'
    ]);
});

test('missing ACTIVATE target and incomplete priority are recoverable', () => {
    const result = parse(`
        ACTIVATE;
        ACTIVATE Worker PRIO;
        AFTER 2 SEC ACTIVATE Worker;
    `);
    assert.ok(result.messages.some(m => /ACTIVATE requires/.test(m)));
    assert.ok(result.messages.some(m => /Expected expression.*task priority/.test(m)));
    assert.equal(result.statements.length, 3);
    assert.ok(result.statements[2].startCondition instanceof TaskingTimedStartNode);
});

test('tasking expressions retain SourceValue identity for source lookup', () => {
    const result = parse(`AT 12:00:00 ALL 2 SEC UNTIL 15:00:00 ACTIVATE Worker PRIO 10+2;`);
    assert.deepEqual(result.messages, []);
    const statement = result.statements[0];
    const condition = statement.startCondition as TaskingTimedStartNode;
    const values = [
        condition.initial?.keyword,
        condition.frequency?.keyword,
        condition.frequency?.limit?.keyword,
        statement.keyword, statement.priorityKeyword
    ];
    for (const value of values) {
        assert.ok(value?.location);
        const location = value.location;
        assert.equal(result.ast.lookupSourceValue({
            uri: location.source.uri, offset: location.span.start
        })?.element, value);
    }
    for (const node of [condition.initial, condition.frequency, condition.frequency?.limit, statement.task]) {
        assert.equal(node?.parent instanceof AstNode, true);
    }
});

test('tasking parses correctly inside IF, BEGIN and the task body', () => {
    const result = parse(`
        IF 1 == 1 THEN ACTIVATE Worker; FIN;
        BEGIN AFTER 1 SEC RESUME; END;
        RETURN;
    `);
    assert.deepEqual(result.messages, []);
    assert.deepEqual(result.statements.map(s => s.keyword.value), ['ACTIVATE', 'RESUME']);
    assert.equal(result.nodes.filter(n => n instanceof ReturnStatementNode).length, 1);
});

test('PRIORITY and EVERY report aliases are retained as written pending RTOS-UH verification', () => {
    const result = parse(`EVERY 2 SEC ACTIVATE Worker PRIORITY 9;`);
    assert.deepEqual(result.messages, []);
    assert.equal((result.statements[0].startCondition as TaskingTimedStartNode).frequency?.keyword.value, 'EVERY');
    assert.equal(result.statements[0].priorityKeyword?.value, 'PRIORITY');
});


test('UNTIL and DURING without ALL are diagnosed and the tasking verb remains parseable', () => {
    const result = parse(`
        UNTIL 12:00:00 ACTIVATE Worker;
        DURING 1 SEC ACTIVATE Worker;
        ACTIVATE Worker;
    `);
    assert.equal(result.messages.filter(m => /requires a preceding ALL/.test(m)).length, 2);
    assert.deepEqual(result.statements.map(s => s.keyword.value), [
        'ACTIVATE', 'ACTIVATE', 'ACTIVATE'
    ]);
});

test('a malformed start condition does not consume a following RETURN statement', () => {
    const result = parse(`AT 12:00:00 RETURN; ACTIVATE Worker;`);
    assert.ok(result.messages.some(m => /Expected ACTIVATE, CONTINUE or RESUME/.test(m)));
    assert.equal(result.nodes.filter(n => n instanceof ReturnStatementNode).length, 1);
    assert.deepEqual(result.statements.map(s => s.keyword.value), ['ACTIVATE']);
});

test('macros in timed conditions remain regular expressions in the AST', () => {
    const result = parse(`#define PERIOD "2 SEC"
        AFTER PERIOD ALL PERIOD DURING 1 MIN ACTIVATE Worker;`);
    assert.deepEqual(result.messages, []);
    const start = result.statements[0].startCondition as TaskingTimedStartNode;
    assert.ok(start.initial?.expression);
    assert.ok(start.frequency?.interval);
    assert.ok(start.frequency?.limit?.expression);
});


test('WHEN after a timed condition is rejected and later statements survive', () => {
    const result = parse(`AFTER 2 SEC WHEN Alarm ACTIVATE Worker; ACTIVATE Worker;`);
    assert.ok(result.messages.some(m => /does not allow combining WHEN/.test(m)));
    assert.deepEqual(result.statements.map(s => s.keyword.value), ['ACTIVATE', 'ACTIVATE']);
});

test('AT/AFTER with both supported cycle limits form the four expected AST combinations', () => {
    const result = parse(`
        AT 10:00:00 ALL 1 SEC UNTIL 11:00:00 ACTIVATE Worker;
        AT 10:00:00 ALL 1 SEC DURING 1 MIN ACTIVATE Worker;
        AFTER 1 SEC ALL 1 SEC UNTIL 11:00:00 ACTIVATE Worker;
        AFTER 1 SEC ALL 1 SEC DURING 1 MIN ACTIVATE Worker;
    `);
    assert.deepEqual(result.messages, []);
    assert.deepEqual(result.statements.map(s => {
        const condition = s.startCondition as TaskingTimedStartNode;
        return [condition.initial?.keyword.value, condition.frequency?.limit?.keyword.value];
    }), [['AT', 'UNTIL'], ['AT', 'DURING'], ['AFTER', 'UNTIL'], ['AFTER', 'DURING']]);
});
