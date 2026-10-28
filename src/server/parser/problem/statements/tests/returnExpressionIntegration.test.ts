// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstDumper } from '../../../../ast/astDumper';
import { AstNode } from '../../../../ast/astNode';
import { ReturnStatementNode } from '../../../../ast/problem/statements/returnStatementNode';
import { DyadicExpressionNode } from '../../../../ast/problem/expressions/dyadicExpressionNode';
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
    const source = new FileSource('file:///return-expression-test.pearl',
        `MODULE M; PROBLEM; F: PROC RETURNS(FIXED); ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const preprocessorContext = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, preprocessorContext, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const returns: ReturnStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    return { source, ast, returns, problems: problems.toArray().map(p => p.message) };
}

test('RETURN uses ExpressionParser through the complete module parser', () => {
    const result = parse('RETURN(-(A ** B) + C * F(2));');
    assert.deepEqual(result.problems, []);
    assert.equal(result.returns.length, 1);
    const statement = result.returns[0];
    assert.ok(statement.expression instanceof DyadicExpressionNode);
    assert.equal(statement.expression.operator.value, '+');
    assert.equal(statement.expression.parent, statement);
    assert.equal(statement.openParenthesis?.value, '(');
    assert.equal(statement.closeParenthesis?.value, ')');
    assert.match(AstDumper.dump(result.ast), /ReturnStatement\(expression\)/);
    assert.match(AstDumper.dump(result.ast), /DyadicExpression\(\+\)/);
    const identifierOffset = result.source.text.indexOf('F(2)');
    const found = result.ast.lookupSourceValue({ uri: result.source.uri, offset: identifierOffset });
    assert.equal(found?.element.value, 'F');
});

test('RETURN without an expression remains valid', () => {
    const result = parse('RETURN;');
    assert.deepEqual(result.problems, []);
    assert.equal(result.returns.length, 1);
    assert.equal(result.returns[0].expression, undefined);
    assert.equal(result.returns[0].getChildren().length, 0);
});

test('a broken RETURN recovers before the next statement', () => {
    const result = parse('RETURN(A +); RETURN(2);');
    assert.equal(result.returns.length, 2);
    assert.ok(result.problems.some(m => m.includes("Expected expression after '+'")));
    assert.ok(result.returns[1].expression);
});
