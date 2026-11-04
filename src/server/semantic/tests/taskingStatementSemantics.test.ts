// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { TaskingStatementNode } from '../../ast/problem/statements/taskingStatementNode';
import { TaskingTimedStartNode } from '../../ast/problem/statements/taskingTimedStartNode';
import { TaskingInterruptStartNode } from '../../ast/problem/statements/taskingInterruptStartNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string, declarations = '') {
    const text = `P=MPC603; SC=2000; MODULE M; SYSTEM; Alarm: EV(00000001); PROBLEM;
        SPC Alarm INTERRUPT;
        DCL D DURATION, C CLOCK, F FIXED, T CHAR(4);
        ${declarations}
        Worker: TASK; END;
        Runner: TASK MAIN;
            ${body}
        END;
        MODEND;`;
    const source = new FileSource('file:///tasking-semantics.P', text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const statements: TaskingStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof TaskingStatementNode) statements.push(node);
        node.getChildren().forEach(visit);
    };
    visit(root);
    return { root, source, statements, semantic,
        syntax: problems.toArray().map(problem => problem.message),
        codes: semantic.diagnostics.map(d => d.code) };
}

test('all six operations resolve TASK names and allow the optional current task', () => {
    const r = analyze(`ACTIVATE Worker; TERMINATE Worker; TERMINATE;
        SUSPEND Worker; SUSPEND; CONTINUE Worker; CONTINUE;
        PREVENT Worker; PREVENT;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.statements.length, 9);
    for (const statement of r.statements) {
        if (!statement.task) continue;
        const name = statement.task.segments[0].identifier;
        assert.equal(r.semantic.bindings.get(name)?.kind, SymbolKind.Task);
    }
});

test('TIME, DURATION and interrupt clauses use the existing expression resolver', () => {
    const r = analyze(`AT C ALL D UNTIL C ACTIVATE Worker PRIO 12;
        AFTER D ALL D DURING D ACTIVATE Worker;
        WHEN Alarm ACTIVATE Worker;
        WHEN Alarm CONTINUE Worker;
        WHEN Alarm RESUME;
        AFTER D RESUME;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.statements.length, 6);
    const first = r.statements[0].startCondition as TaskingTimedStartNode;
    assert.equal(r.semantic.expressionTypes.get(first.initial!.expression!)?.kind, SemanticTypeKind.Clock);
    assert.equal(r.semantic.expressionTypes.get(first.frequency!.interval!)?.kind, SemanticTypeKind.Duration);
    assert.equal(r.semantic.expressionTypes.get(first.frequency!.limit!.expression!)?.kind, SemanticTypeKind.Clock);
    const interrupt = (r.statements[2].startCondition as TaskingInterruptStartNode).interrupt!;
    assert.equal(r.semantic.bindings.get(interrupt.segments[0].identifier)?.kind, SymbolKind.DataObject);
    assert.equal(r.semantic.expressionTypes.get(r.statements[0].priority!)?.kind, SemanticTypeKind.Fixed);
});

test('incorrect TASK operand and incorrect WHEN interrupt are independent errors', () => {
    const r = analyze('ACTIVATE F; TERMINATE D; WHEN Worker ACTIVATE Worker; WHEN F RESUME;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidTaskingTarget,
        SemanticDiagnosticCode.InvalidTaskingTarget,
        SemanticDiagnosticCode.InvalidTaskingInterrupt,
        SemanticDiagnosticCode.InvalidTaskingInterrupt
    ]);
});

test('unknown task and interrupt names report unknown identifiers once', () => {
    const r = analyze('ACTIVATE MissingTask; WHEN MissingInterrupt RESUME;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.UnknownIdentifier
    ]);
});

test('AT and UNTIL require CLOCK; AFTER, ALL, DURING require DURATION', () => {
    const r = analyze(`AT D ACTIVATE Worker;
        AFTER C ACTIVATE Worker;
        ALL C ACTIVATE Worker;
        ALL D UNTIL D ACTIVATE Worker;
        ALL D DURING C ACTIVATE Worker;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(5).fill(SemanticDiagnosticCode.InvalidTaskingTimeType));
});

test('zero AFTER, ALL and DURING durations denote the next timer tick and are valid', () => {
    const r = analyze(`AFTER 0 SEC RESUME;
        AFTER 0 SEC ACTIVATE Worker;
        ALL 0 SEC ACTIVATE Worker;
        ALL 1 SEC DURING 0 SEC ACTIVATE Worker;
        AFTER (1 SEC - 1 SEC) ACTIVATE Worker;
        ALL 1 SEC - 1 SEC ACTIVATE Worker;
        ALL 1 SEC DURING (1 SEC - 1 SEC) ACTIVATE Worker;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('known negative AFTER, ALL and DURING durations are errors', () => {
    const r = analyze(`AFTER -1 SEC RESUME;
        ALL 1 SEC - 2 SEC ACTIVATE Worker;
        ALL 1 SEC DURING -1 SEC ACTIVATE Worker;
        AFTER (1 SEC - 2 SEC) ACTIVATE Worker;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(4).fill(SemanticDiagnosticCode.NegativeTaskingDuration));
});

test('positive mixed clauses and valid real-time expressions stay clean', () => {
    const r = analyze(`AFTER 0.5 SEC ALL 2 SEC DURING 1 MIN ACTIVATE Worker;
        AT 12:00:00 ALL 1 SEC UNTIL 15:00:00 ACTIVATE Worker;
        AFTER D RESUME;
        ALL D DURING D ACTIVATE Worker;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('priority expression must be constant FIXED and within 1..32767', () => {
    const r = analyze(`ACTIVATE Worker PRIO T;
        ACTIVATE Worker PRIO 0;
        ACTIVATE Worker PRIO 32768;
        ACTIVATE Worker PRIORITY 1 + 2;
        ACTIVATE Worker PRIO F;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidTaskingPriorityType,
        SemanticDiagnosticCode.InvalidTaskPriority,
        SemanticDiagnosticCode.InvalidTaskPriority,
        SemanticDiagnosticCode.InvalidTaskPriority
    ]);
});

test('PRIO and PRIORITY accept INV FIXED constants but not mutable FIXED objects', () => {
    const r = analyze(`ACTIVATE Worker PRIO Constant;
        ACTIVATE Worker PRIORITY Constant + 1;
        ACTIVATE Worker PRIO Mutable;
        ACTIVATE Worker PRIORITY Mutable + 1;`,
        'DCL Constant INV FIXED INIT(25); DCL Mutable FIXED INIT(25);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.InvalidTaskPriority,
        SemanticDiagnosticCode.InvalidTaskPriority
    ]);
});

test('EVERY and WHEN RESUME are accepted RTOS-UH forms', () => {
    const r = analyze('EVERY 0 SEC ACTIVATE Worker; WHEN Alarm RESUME;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('TASK references can be used as task operands', () => {
    const r = analyze('ACTIVATE Ptr; SUSPEND Ptr;', 'DCL Ptr REF TASK;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    for (const st of r.statements) {
        assert.equal(r.semantic.bindings.get(st.task!.segments[0].identifier)?.kind,
            SymbolKind.DataObject);
    }
});

test('a syntax-recovered incomplete clause does not produce spurious type errors', () => {
    const r = analyze('AFTER ACTIVATE Worker; ACTIVATE Worker;');
    assert.ok(r.syntax.length > 0);
    assert.equal(r.statements.length, 2);
    assert.deepEqual(r.codes, []);
});

test('diagnostics point into the source, never at synthetic AST positions', () => {
    const r = analyze('AFTER -1 SEC ACTIVATE Worker; WHEN F RESUME; ACTIVATE F;');
    assert.equal(r.codes.length, 3);
    for (const diag of r.semantic.diagnostics) {
        assert.equal(diag.location.source.uri, r.source.uri);
        assert.ok(diag.location.span.end > diag.location.span.start);
    }
});

test('named zero INV DURATION is valid; named negative constants are rejected', () => {
    const r = analyze(`AFTER Zero RESUME;
        ALL Good DURING Zero ACTIVATE Worker;
        AFTER Negative RESUME;
        ALL Good DURING Negative ACTIVATE Worker;
        AFTER D ACTIVATE Worker;`,
        'DCL Zero INV DURATION INIT(0 SEC), Good INV DURATION INIT(1 SEC), Negative INV DURATION INIT(-1 SEC);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.NegativeTaskingDuration,
        SemanticDiagnosticCode.NegativeTaskingDuration
    ]);
});

test('external TASK specifications and referenced CLOCK/DURATION are typed and bound', () => {
    const r = analyze(`ACTIVATE External;
        AT ClockRef ACTIVATE Worker;
        AFTER DurationRef CONTINUE Worker;
        ALL DurationRef UNTIL ClockRef ACTIVATE External;`,
        'SPC External TASK GLOBAL; DCL ClockRef REF CLOCK, DurationRef REF DURATION;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.semantic.bindings.get(r.statements[0].task!.segments[0].identifier)?.kind,
        SymbolKind.Task);
    const condition = r.statements[1].startCondition as TaskingTimedStartNode;
    assert.equal(r.semantic.expressionTypes.get(condition.initial!.expression!)?.kind,
        SemanticTypeKind.Reference);
});

test('invalid task selectors still resolve nested arguments for editor navigation', () => {
    const r = analyze('ACTIVATE Missing(F); ACTIVATE Worker(F);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [
        SemanticDiagnosticCode.UnknownIdentifier,
        SemanticDiagnosticCode.InvalidTaskingTarget
    ]);
    for (const statement of r.statements) {
        const index = statement.task!.segments[0].suffix!.expressions[0]!;
        assert.equal(r.semantic.expressionTypes.get(index)?.kind, SemanticTypeKind.Fixed);
    }
});
