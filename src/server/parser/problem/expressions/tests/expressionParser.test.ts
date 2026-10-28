// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstDumper } from '../../../../ast/astDumper';
import { DyadicExpressionNode } from '../../../../ast/problem/expressions/dyadicExpressionNode';
import { ExpressionNode } from '../../../../ast/problem/expressions/expressionNode';
import { LiteralExpressionNode } from '../../../../ast/problem/expressions/literalExpressionNode';
import { MonadicExpressionNode } from '../../../../ast/problem/expressions/monadicExpressionNode';
import { NameExpressionNode } from '../../../../ast/problem/expressions/nameExpressionNode';
import { ParenthesizedExpressionNode } from '../../../../ast/problem/expressions/parenthesizedExpressionNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Token, TokenKind } from '../../../../lexer/token';
import { TokenStream } from '../../../../lexer/tokenStream';
import { ParserContext } from '../../../parserContext';
import { ExpressionParser } from '../expressionParser';
import { FileSource } from '../../../../source/fileSource';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(text: string) {
    const source = new FileSource('file:///expression.pearl', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    let offset = 0;
    const stream: TokenStream = {
        current(): Token { return tokens[offset]; },
        peek(ahead = 0): Token { return tokens[Math.min(offset + ahead, tokens.length - 1)]; },
        next(): void { offset = Math.min(offset + 1, tokens.length - 1); },
        eof(): boolean { return tokens[offset].kind === TokenKind.EOF; },
        tokenText(token: Token): string { return token.location.source.getText(token.location.span); },
        getText(span) { return source.getText(span); }
    };
    const expression = new ExpressionParser(new ParserContext(stream, problems, logger)).parse();
    return { source, expression, rest: stream.tokenText(stream.current()),
        problems: problems.toArray().map(p => p.message) };
}

function binary(expr: ExpressionNode | undefined, operator: string): DyadicExpressionNode {
    assert.ok(expr instanceof DyadicExpressionNode);
    assert.equal(expr.operator.value, operator);
    return expr;
}

test('operator ranks and associativity follow PEARL 90 table 6.10', () => {
    const additive = binary(parse('A + B * C').expression, '+');
    binary(additive.right, '*');

    const left = binary(parse('A - B - C').expression, '-');
    binary(left.left, '-');

    const right = binary(parse('A ** B ** C').expression, '**');
    binary(right.right, '**');

    const logical = binary(parse('A < B AND C == D OR E').expression, 'OR');
    const and = binary(logical.left, 'AND');
    binary(and.left, '<');
    binary(and.right, '==');

    const fit = binary(parse('A FIT 3 + B').expression, '+');
    binary(fit.left, 'FIT');
});

test('monadic minus applies after exponentiation, before multiplication', () => {
    const outer = binary(parse('-A ** B * C').expression, '*');
    assert.ok(outer.left instanceof MonadicExpressionNode);
    binary(outer.left.operand, '**');

    const exponent = binary(parse('A ** -B').expression, '**');
    assert.ok(exponent.right instanceof MonadicExpressionNode);
});

test('parenthesized expressions retain both delimiters and parentage', () => {
    const { expression, problems } = parse('A * (B + C)');
    assert.deepEqual(problems, []);
    const multiply = binary(expression, '*');
    assert.ok(multiply.right instanceof ParenthesizedExpressionNode);
    assert.equal(multiply.right.openParenthesis.value, '(');
    assert.equal(multiply.right.closeParenthesis?.value, ')');
    binary(multiply.right.expression, '+');
    assert.equal(multiply.right.parent, multiply);
    assert.equal(multiply.right.expression?.parent, multiply.right);
});

test('name suffix is deliberately syntax-neutral for function and array uses', () => {
    const { expression, problems, rest } = parse('A(I, F(2)).B.CHAR(7);');
    assert.deepEqual(problems, []);
    assert.equal(rest, ';');
    assert.ok(expression instanceof NameExpressionNode);
    assert.deepEqual(expression.segments.map(s => s.identifier.value), ['A', 'B', 'CHAR']);
    assert.equal(expression.segments[0].suffix?.expressions.length, 2);
    assert.equal(expression.segments[2].suffix?.expressions.length, 1);
    assert.ok(expression.segments[0].suffix?.expressions[1] instanceof NameExpressionNode);
    assert.equal(expression.segments[0].parent, expression);
    assert.equal(expression.segments[0].suffix?.parent, expression.segments[0]);
});

test('numeric precision and string/bit literals retain source values', () => {
    const number = parse('15(31)');
    assert.deepEqual(number.problems, []);
    assert.ok(number.expression instanceof LiteralExpressionNode);
    assert.equal(number.expression.literal.value, '15');
    assert.equal(number.expression.precision?.value, '31');
    assert.equal(number.expression.openPrecision?.value, '(');
    assert.equal(number.expression.closePrecision?.value, ')');

    assert.ok(parse("'hello'").expression instanceof LiteralExpressionNode);
    assert.ok(parse("'1010'B").expression instanceof LiteralExpressionNode);
});

test('all expression language elements have source lookups', () => {
    const { expression, source, problems } = parse('A(2).X + -3(15)');
    assert.deepEqual(problems, []);
    assert.ok(expression);
    for (const [index, char] of Array.from(source.text).entries()) {
        if (char === ' ') continue;
        const found = expression.lookupSourceValue({ uri: source.uri, offset: index });
        assert.ok(found, `No lookup at ${index} (${char})`);
        assert.equal(found.element.location?.source, source);
    }
    assert.equal(expression.lookupSourceValue({ uri: 'file:///other.pearl', offset: 0 }), undefined);
    assert.ok(AstDumper.dump(expression).includes('NameSegment(X)'));
});

test('incomplete expressions preserve operators and delimiters', () => {
    const addition = parse('A + ;');
    assert.equal(addition.rest, ';');
    assert.deepEqual(addition.problems, ["Expected expression after '+'."]);
    assert.equal(binary(addition.expression, '+').right, undefined);

    const name = parse('F(1,);');
    assert.equal(name.rest, ';');
    assert.deepEqual(name.problems, ["Expected expression after ','."]);
    assert.ok(name.expression instanceof NameExpressionNode);
    assert.equal(name.expression.segments[0].suffix?.expressions.length, 2);

    const parens = parse('(A + ;');
    assert.equal(parens.rest, ';');
    assert.ok(parens.expression instanceof ParenthesizedExpressionNode);
    assert.equal(parens.expression.closeParenthesis, undefined);
    assert.equal(parens.problems.length, 2);
});
