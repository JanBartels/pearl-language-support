// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../../../source/fileSource';
import { Lexer } from '../../../../lexer/lexer';
import { TokenKind } from '../../../../lexer/token';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { Parser } from '../../../parser';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function tokenize(text: string) {
    const source = new FileSource('file:///hex-identifier.P', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    return {
        tokens: tokens.filter(token => token.kind !== TokenKind.EOF),
        diagnostics: problems.toArray().map(problem => problem.message),
    };
}

function parse(systemDeclarations: string, problemDeclarations = '') {
    const source = new FileSource('file:///hex-identifier.P',
        `P=MPC603; SC=2000; MODULE M;
         SYSTEM; ${systemDeclarations}
         PROBLEM; ${problemDeclarations}
         MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    return {
        ast,
        diagnostics: problems.toArray().map(problem => problem.message),
    };
}

test('A-F-leading hex strings keep Identifier kind and lexically carry their hex alternative', () => {
    const { tokens, diagnostics } = tokenize('FF0F0006 FACE FG0F0006 0240FFFC 12345678');
    assert.deepEqual(diagnostics, []);
    assert.deepEqual(tokens.map(token => token.kind), [
        TokenKind.Identifier, TokenKind.Identifier, TokenKind.Identifier,
        TokenKind.HexDigitSequence, TokenKind.IntegerLiteral,
    ]);
    assert.deepEqual(tokens.map(token => token.hexDigitIdentifier),
        [true, true, undefined, undefined, undefined]);
});

test('RTOS-UH BU(FF0F0006,8) and numeric-leading BU address both parse', () => {
    const { diagnostics } = parse(
        'Port1: BU(FF0F0006,8) <->; Port2: BU(0240FFFC) <-;');
    assert.deepEqual(diagnostics, []);
});

test('EV accepts A-F-leading hexadecimal mask as well as numeric mask', () => {
    const { diagnostics } = parse(
        'MyEvent: EV(ABCDEF12); NumericEvent: EV(12345678);');
    assert.deepEqual(diagnostics, []);
});

test('hex-looking identifiers remain valid identifiers outside hex grammar', () => {
    const { diagnostics } = parse('', 'DCL FACE FIXED; DCL BEEF FIXED;');
    assert.deepEqual(diagnostics, []);
});

test('nonhex identifiers do not become valid BU or EV arguments', () => {
    for (const declaration of [
        'Port: BU(FG0F0006,8) <->;',
        'Event: EV(ABCDEX12);',
    ]) {
        const { diagnostics } = parse(declaration);
        assert.ok(diagnostics.includes('Expected hexadecimal number.'),
            `Expected hexadecimal-number diagnostic for ${declaration}: ${diagnostics.join(', ')}`);
    }
});
