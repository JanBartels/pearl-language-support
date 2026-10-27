// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { ActualParameterListNode } from '../../../../ast/problem/statements/actualParameterListNode';
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
    const source = new FileSource('file:///actual-parameters.pearl',
        `MODULE M; PROBLEM; T: TASK;\n${body}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const calls: CallStatementNode[] = [];
    function visit(node: AstNode): void {
        if (node instanceof CallStatementNode) calls.push(node);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return { source, ast, calls, problems: problems.toArray().map(p => p.message) };
}

function parameterList(call: CallStatementNode): ActualParameterListNode {
    assert.ok(call.actualParameters);
    return call.actualParameters;
}

test('separators and parentheses are retained with original source positions', () => {
    const { calls, source, problems } = parse('CALL P(1, A(2, 3), V.CHAR(7), Z[1, 2]);');
    assert.deepEqual(problems, []);
    assert.equal(calls.length, 1);
    const call = calls[0];
    const list = parameterList(call);
    assert.equal(list.openParenthesis.value, '(');
    assert.equal(list.closeParenthesis?.value, ')');
    assert.equal(list.commas.length, 3);
    assert.equal(list.parameters.length, 4);
    assert.deepEqual(list.parameters.map(p => p.tokens.map(t => t.value)), [
        ['1'], ['A', '(', '2', ',', '3', ')'],
        ['V', '.', 'CHAR', '(', '7', ')'], ['Z', '[', '1', ',', '2', ']']
    ]);
    assert.equal(call.getChildren()[0], list);
    assert.equal(list.parent, call);
    assert.ok(list.parameters.every(p => p.parent === list));

    for (const sourceValue of [list.openParenthesis, ...list.commas, list.closeParenthesis!]) {
        const location = sourceValue.location!;
        assert.equal(location.source, source);
        assert.equal(source.getText(location.span), sourceValue.value);
        const lookup = call.lookupSourceValue({ uri: source.uri, offset: location.span.start });
        assert.equal(lookup?.node, list);
        assert.equal(lookup?.element, sourceValue);
        assert.equal(call.lookupSourceValue({ uri: 'file:///other.pearl',
            offset: location.span.start }), undefined);
    }
    const expressionToken = list.parameters[1].tokens[2];
    assert.equal(call.lookupSourceValue({ uri: source.uri,
        offset: expressionToken.location!.span.start })?.element, expressionToken);
    assert.equal(call.argumentsList?.[1][2], expressionToken);
});

test('P; and P() remain distinct and P() has no empty argument', () => {
    const { calls, problems } = parse('P; P(); CALL Q();');
    assert.deepEqual(problems, []);
    assert.equal(calls[0].actualParameters, undefined);
    assert.equal(calls[0].argumentsList, undefined);
    assert.equal(parameterList(calls[1]).parameters.length, 0);
    assert.equal(calls[1].argumentsList?.length, 0);
    assert.equal(parameterList(calls[2]).parameters.length, 0);
});

test('empty parameter slots and trailing comma survive recovery without changing legacy arity', () => {
    const { calls, problems } = parse('P(, 1,); Q;');
    assert.deepEqual(calls.map(call => call.target?.value), ['P', 'Q']);
    const list = parameterList(calls[0]);
    assert.equal(list.parameters.length, 3);
    assert.deepEqual(list.parameters.map(p => p.tokens.map(t => t.value)), [[], ['1'], []]);
    assert.equal(list.commas.length, 2);
    assert.equal(list.closeParenthesis?.value, ')');
    assert.equal(calls[0].argumentsList?.length, 2);
    assert.deepEqual(problems, ['Expected CALL argument.', 'Expected CALL argument after comma.']);
});

test('unfinished calls preserve their open parenthesis, comma and trailing empty slot', () => {
    const { calls, problems } = parse('P(1,; Q; R(\n');
    assert.deepEqual(calls.map(call => call.target?.value), ['P', 'Q', 'R']);
    const p = parameterList(calls[0]);
    assert.equal(p.closeParenthesis, undefined);
    assert.equal(p.commas.length, 1);
    assert.deepEqual(p.parameters.map(param => param.tokens.map(t => t.value)), [['1'], []]);
    assert.equal(calls[0].argumentsList?.length, 1);
    const r = parameterList(calls[2]);
    assert.equal(r.closeParenthesis, undefined);
    assert.equal(r.parameters.length, 1);
    assert.equal(r.parameters[0].tokens.length, 0);
    assert.equal(calls[2].argumentsList?.length, 0);
    assert.ok(problems.filter(p => p === "Expected ')' after CALL arguments.").length >= 2);
});

test('selector and array assignments are not converted to calls or parameter ASTs', () => {
    const { calls, problems } = parse(`
        MyChar.CHAR(7) = '2';
        MyChar.CHARACTER(7) = '2';
        MyBits.BIT(3) = '1'B;
        MyArray(7) = 2;
        MyArray(7).CHAR(2) = '2';
        Actual(1, MyChar.CHAR(7));
    `);
    assert.deepEqual(problems, []);
    assert.deepEqual(calls.map(c => c.target?.value), ['Actual']);
    assert.equal(parameterList(calls[0]).parameters.length, 2);
});

test('incomplete array assignment does not produce a speculative CALL node or diagnostic', () => {
    const { calls, problems } = parse('Array(1,) = 5; After;');
    assert.deepEqual(problems, []);
    assert.deepEqual(calls.map(c => c.target?.value), ['After']);
});
