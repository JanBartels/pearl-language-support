// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { IfStatementNode } from '../../../../ast/problem/statements/ifStatementNode';
import { CaseStatementNode } from '../../../../ast/problem/statements/caseStatementNode';
import { RepetitionNode } from '../../../../ast/problem/statements/repetitionNode';
import { CallStatementNode } from '../../../../ast/problem/statements/callStatementNode';
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
    const source = new FileSource('file:///direct-expressions.pearl',
        `MODULE M; PROBLEM; Runner: PROC(I FIXED);\n${body}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const nodes: AstNode[] = [];
    const visit = (node: AstNode): void => {
        nodes.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    return { source, ast, nodes, syntax: problems.toArray().map(p => p.message) };
}

test('IF, CASE and both REPEAT forms attach expressions from the live stream', () => {
    const result = parse(`
        IF I > 1 THEN RETURN; FIN;
        CASE I+1 ALT (1:2, 8) RETURN; OUT RETURN; FIN;
        FOR J FROM I+1 BY 2 TO I+4 WHILE J < 8 REPEAT RETURN; END;
    `);
    assert.deepEqual(result.syntax, []);
    const ifNode = result.nodes.find(n => n instanceof IfStatementNode) as IfStatementNode;
    const caseNode = result.nodes.find(n => n instanceof CaseStatementNode) as CaseStatementNode;
    const repeat = result.nodes.find(n => n instanceof RepetitionNode) as RepetitionNode;
    assert.ok(ifNode.condition);
    assert.ok(caseNode.selector);
    assert.equal(caseNode.alternatives[0].ranges.length, 2);
    assert.ok(caseNode.alternatives[0].ranges[0].upper);
    assert.ok(repeat.fromClause?.expression);
    assert.ok(repeat.byClause?.expression);
    assert.ok(repeat.toClause?.expression);
    assert.ok(repeat.whileClause?.expression);
});

test('malformed IF and REPEAT expressions report errors but preserve delimiters', () => {
    const result = parse(`
        IF I + THEN RETURN; FIN;
        FOR J FROM 1 BY I + TO 5 REPEAT RETURN; END;
        IF I > 1 THEN RETURN; FIN;
    `);
    assert.deepEqual(result.syntax, ["Expected expression after '+'.", "Expected expression after '+'."]);
    const ifs = result.nodes.filter(n => n instanceof IfStatementNode) as IfStatementNode[];
    const repetition = result.nodes.find(n => n instanceof RepetitionNode) as RepetitionNode;
    assert.equal(ifs[0].condition, undefined);
    assert.ok(ifs[1].condition);
    assert.equal(repetition.byClause?.expression, undefined);
    assert.ok(repetition.toClause?.expression);
});

test('an invalid operator inside parentheses has one location-specific diagnostic', () => {
    const result = parse(`IF (I = 0) THEN RETURN; FIN;`);
    assert.equal(result.syntax.length, 1);
    assert.match(result.syntax[0], /Operator '='.*'=='/);
    assert.equal(result.nodes.filter(n => n instanceof IfStatementNode).length, 1);
});

test('implicit calls are decided before parsing arguments, never from symbol types', () => {
    const result = parse(`
        A(1,) = 2;
        P(I + 1);
        CALL P(I + 2);
    `);
    assert.deepEqual(result.syntax, []);
    const calls = result.nodes.filter(n => n instanceof CallStatementNode) as CallStatementNode[];
    assert.equal(calls.length, 2);
    assert.ok(calls.every(c => c.actualParameters?.parameters[0].expression));
});

test('nested expressions in CALL retain original SourceValues for hover and references', () => {
    const result = parse(`P(I+1, P(I*2));`);
    assert.deepEqual(result.syntax, []);
    const call = result.nodes.find(n => n instanceof CallStatementNode) as CallStatementNode;
    const parameter = call.actualParameters!.parameters[1];
    const identifier = parameter.tokens[0];
    const location = identifier.location!;
    assert.equal(result.ast.lookupSourceValue({
        uri: location.source.uri, offset: location.span.start
    })?.element, identifier);
});

test('preprocessor macro expansion keeps CALL lookahead and IF parsing in order', () => {
    const result = parse(`#define VALUE "7"
        P(VALUE);
        IF I == VALUE THEN RETURN; FIN;
    `);
    assert.deepEqual(result.syntax, []);
    const call = result.nodes.find(n => n instanceof CallStatementNode) as CallStatementNode;
    const ifNode = result.nodes.find(n => n instanceof IfStatementNode) as IfStatementNode;
    assert.ok(call.actualParameters?.parameters[0].expression);
    assert.ok(ifNode.condition);
});
