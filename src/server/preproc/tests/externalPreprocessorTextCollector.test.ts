// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { collectExternalPreprocessorText } from '../externalPreprocessorTextCollector';
import { TokenKind, type Token } from '../../lexer/token';
import type { TokenStream } from '../../lexer/tokenStream';
import type { Span } from '../../core/span';

function stream(source: FileSource, ranges: Array<[number, number]>): TokenStream {
    const tokens: Token[] = ranges.map(([start, end]) => ({
        kind: TokenKind.Identifier, location: { source, span: { start, end } }
    }));
    tokens.push({kind: TokenKind.EOF, location: {source, span: {start: source.length, end: source.length}}});
    let index = 0;
    return {
        current: () => tokens[index]!,
        peek: (offset = 0) => tokens[Math.min(index + offset, tokens.length - 1)]!,
        next: () => { if (index < tokens.length - 1) index++; },
        eof: () => tokens[index]!.kind === TokenKind.EOF,
        tokenText: (token: Token) => token.location.source.getText(token.location.span),
        getText: (span: Span) => source.getText(span)
    };
}

test('preserves whitespace between emitted tokens and their locations', () => {
    const source = new FileSource('file:///example.p', 'DCL  Name\nFIXED;');
    const result = collectExternalPreprocessorText(stream(source, [[0,3], [5,9], [10,15], [15,16]]), source);
    assert.equal(result.source.text, source.text);
    assert.deepEqual(result.source.mapLocation({source: result.source, span: {start: 5, end: 9}}),
        {source, span: {start: 5, end: 9}});
});

test('does not reintroduce deleted directive or inactive region', () => {
    const source = new FileSource('file:///example.p', 'A\n#define X "Z"\nB');
    const result = collectExternalPreprocessorText(stream(source, [[0,1], [source.length-1, source.length]]), source);
    assert.equal(result.source.text, 'AB');
});

test('does not inject whitespace between unrelated emitted source fragments', () => {
    const root = new FileSource('file:///main.p', 'AB');
    const other = new FileSource('file:///inc.p', 'CD');
    const tokens: Token[] = [
        {kind: TokenKind.Identifier, location: {source: root, span: {start: 0,end: 1}}},
        {kind: TokenKind.Identifier, location: {source: other, span: {start: 0,end: 2}}},
        {kind: TokenKind.EOF, location: {source: root, span: {start: 2,end: 2}}}
    ];
    let index = 0;
    const tokenStream = {
        current: () => tokens[index]!, peek: () => tokens[index]!,
        next: () => {index++;}, eof: () => index >= 2,
        tokenText: (t: Token) => t.location.source.getText(t.location.span),
        getText: (s: Span) => root.getText(s)
    } satisfies TokenStream;
    const result = collectExternalPreprocessorText(tokenStream, root);
    assert.equal(result.source.text, 'ACD');
});
