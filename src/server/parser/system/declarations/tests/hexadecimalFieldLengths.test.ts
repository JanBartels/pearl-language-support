// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../../../source/fileSource';
import { Lexer } from '../../../../lexer/lexer';
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

function parse(systemDeclarations: string): string[] {
    const source = new FileSource('file:///hex-lengths.P',
        `P=MPC603; SC=2000; MODULE M; SYSTEM; ${systemDeclarations} PROBLEM; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry,
        new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    new Parser(stream, problems, logger).parse();
    return problems.toArray().map(problem => problem.message);
}

test('RTOS-UH EV accepts 1 through 8 hexadecimal digits', () => {
    const diagnostics = parse([
        'One: EV(1);',
        'Two: EV(FF);',
        'Seven: EV(ABCDEF0);',
        'Eight: EV(12345678);',
    ].join(' '));
    assert.deepEqual(diagnostics, []);
});

test('EV rejects hexadecimal masks longer than eight digits', () => {
    for (const value of ['123456789', 'FFFFFFFFF']) {
        const diagnostics = parse(`Long: EV(${value});`);
        assert.ok(diagnostics.includes('event mask must consist of 1 to 8 hexadecimal digits.'),
            `${value}: ${diagnostics.join(', ')}`);
    }
});

test('EV does not accept an empty hexadecimal mask', () => {
    const diagnostics = parse('Empty: EV();');
    assert.ok(diagnostics.includes('Expected hexadecimal number.'),
        diagnostics.join(', '));
});

test('RTOS-UH AI permits exactly two or four hex digits', () => {
    const diagnostics = parse([
        'Short: /A1/Dialog(AI=$3C) <->;',
        'Long: /A1/Dialog(AI=$3C00) <->;',
    ].join(' '));
    assert.deepEqual(diagnostics, []);
});

test('AI rejects one, three and five hex digits', () => {
    for (const value of ['$3', '$3C0', '$3C000']) {
        const diagnostics = parse(`Wrong: /A1/Dialog(AI=${value}) <->;`);
        assert.ok(diagnostics.includes('AI requires 2 or 4 hexadecimal digits.'),
            `${value}: ${diagnostics.join(', ')}`);
    }
});

test('MB remains exactly two hex digits', () => {
    assert.deepEqual(parse('Good: /A1/Dialog(MB=$80) <->;'), []);
    for (const value of ['$8', '$800']) {
        const diagnostics = parse(`Bad: /A1/Dialog(MB=${value}) <->;`);
        assert.ok(diagnostics.includes('MB requires exactly 2 hexadecimal digits.'),
            `${value}: ${diagnostics.join(', ')}`);
    }
});
