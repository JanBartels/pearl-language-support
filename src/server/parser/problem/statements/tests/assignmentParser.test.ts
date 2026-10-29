// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { AstDumper } from '../../../../ast/astDumper';
import { AssignmentNode } from '../../../../ast/problem/statements/assignmentNode';
import { CallStatementNode } from '../../../../ast/problem/statements/callStatementNode';
import { LabeledStatementNode } from '../../../../ast/problem/statements/labeledStatementNode';
import { DyadicExpressionNode } from '../../../../ast/problem/expressions/dyadicExpressionNode';
import { NameExpressionNode } from '../../../../ast/problem/expressions/nameExpressionNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(body: string) {
    const source = new FileSource('file:///assignment-test.pearl',
        `MODULE AssignmentTest; PROBLEM;\nRunner: TASK;\n${body}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const preprocessor = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, preprocessor, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const assignments: AssignmentNode[] = [];
    const calls: CallStatementNode[] = [];
    const labels: LabeledStatementNode[] = [];
    function visit(node: AstNode): void {
        if (node instanceof AssignmentNode) assignments.push(node);
        if (node instanceof CallStatementNode) calls.push(node);
        if (node instanceof LabeledStatementNode) labels.push(node);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return { ast, assignments, calls, labels, errors: problems.toArray().map(p => p.message) };
}

test('both assignment operators produce an Assignment AST, with shared expression nodes', () => {
    const result = parse('A := B + 2*3; C = F(1); P(7);');
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.assignments.map(a => a.operator.value), [':=', '=']);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['P']);
    assert.ok(result.assignments[0].expression instanceof DyadicExpressionNode);
    assert.equal(result.assignments[0].target.segments[0].identifier.value, 'A');
    assert.ok(result.assignments[1].expression instanceof NameExpressionNode);
    assert.match(AstDumper.dump(result.ast), /Assignment\(:=\)\n\s+NameExpression/);
});

test('array and structure selections share NameExpressionParser on both sides', () => {
    const result = parse(`Records(I).Meta.Count := Records(I + 1).Value + 2;
        MyChar.CHAR(7) = '2';
        MyBits.BIT(3) := '1'B;
        MyArray(1, 2) := 4;
        RealCall(7);`);
    assert.deepEqual(result.errors, []);
    assert.equal(result.assignments.length, 4);
    assert.deepEqual(result.assignments[0].target.segments.map(s => s.identifier.value),
        ['Records', 'Meta', 'Count']);
    assert.equal(result.assignments[0].target.segments[0].suffix?.expressions.length, 1);
    assert.equal(result.assignments[1].target.segments[1].identifier.value, 'CHAR');
    assert.equal(result.assignments[2].target.segments[1].identifier.value, 'BIT');
    assert.equal(result.assignments[3].target.segments[0].suffix?.expressions.length, 2);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['RealCall']);
});

test('source lookup reaches the same LHS and RHS AST SourceValues', () => {
    const result = parse('A(I).Value := F(I + 1);');
    assert.deepEqual(result.errors, []);
    const assignment = result.assignments[0];
    const parts = [assignment.target.segments[0].identifier, assignment.operator,
        assignment.target.segments[1].identifier];
    for (const value of parts) {
        const location = value.location!;
        assert.equal(result.ast.lookupSourceValue({
            uri: location.source.uri, offset: location.span.start
        })?.element, value);
    }
    assert.ok(assignment.expression);
    const rhs = assignment.expression as NameExpressionNode;
    const rhsValue = rhs.segments[0].identifier;
    const loc = rhsValue.location!;
    assert.equal(result.ast.lookupSourceValue({
        uri: loc.source.uri, offset: loc.span.start
    })?.element, rhsValue);
});

test('labels can prefix assignments without changing implicit calls', () => {
    const result = parse('First: Second: A(1) := 3; P(1);');
    assert.deepEqual(result.errors, []);
    assert.equal(result.assignments.length, 1);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.labels[0].labels.map(l => l.value), ['First', 'Second']);
});

test('malformed RHS reports an error and preserves the following statement', () => {
    const result = parse('A := I + ; P(1); B := 2;');
    assert.ok(result.errors.some(e => e.includes("Expected expression after '+'")));
    assert.deepEqual(result.assignments.map(a => a.target.segments[0].identifier.value), ['A', 'B']);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['P']);
});

test('empty RHS and missing semicolon recover without consuming END', () => {
    const result = parse('A := ; B := 2');
    assert.ok(result.errors.some(e => e.includes('Expected expression in assignment.')));
    assert.ok(result.errors.some(e => e.includes("Expected ';' after assignment.")));
    assert.equal(result.assignments.length, 2);
    assert.equal(result.assignments[0].expression, undefined);
});

test('invalid assignment index reports parser diagnostics without becoming CALL', () => {
    const result = parse('MyArray(1,) := 2; After;');
    assert.ok(result.errors.some(e => e.includes("Expected expression after ','")));
    assert.equal(result.assignments.length, 1);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['After']);
});

test('an equals sign inside a CALL argument does not classify the statement as an assignment', () => {
    const result = parse('P(I == 1); A := 3;');
    assert.deepEqual(result.errors, []);
    assert.equal(result.calls.length, 1);
    assert.equal(result.assignments.length, 1);
});

test('preprocessor macro replacements participate in the assignment expression', () => {
    const result = parse('#define START "7"\n A := START + 2;');
    assert.deepEqual(result.errors, []);
    assert.equal(result.assignments.length, 1);
    assert.ok(result.assignments[0].expression instanceof DyadicExpressionNode);
});
