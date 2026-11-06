// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticInitialValueKind } from '../semanticConstantValue';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SymbolKind } from '../symbolKind';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(declarations: string) {
    const source = new FileSource('file:///virtual-reference-initialization.P',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${declarations} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);

    function dataObject(name: string) {
        const symbol = [...semantic.bindings.values()].find(value =>
            value.kind === SymbolKind.DataObject && value.name.value === name);
        assert.ok(symbol && symbol.kind === SymbolKind.DataObject, `Missing ${name}`);
        return symbol;
    }

    return {
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        semantic,
        dataObject
    };
}

test('RTOS-UH: REF () INV FIXED array INIT accepts invariant arrays with different bounds', () => {
    const result = analyze(`
        DCL Map3 (1:3) INV FIXED INIT (1,2,3);
        DCL Map4 (4) INV FIXED INIT (1,2,3,4);
        DCL RMap (2) REF () INV FIXED INIT(Map3, Map4);
    `);

    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const initial = result.semantic.initialValues.get(result.dataObject('RMap'));
    assert.ok(initial && initial.kind === SemanticInitialValueKind.Reference);
    assert.equal(initial.elementCount, 2n);
    assert.deepEqual(initial.values, [result.dataObject('Map3'), result.dataObject('Map4')]);
});

test('virtual REF INIT accepts writable and invariant arrays without depending on their bounds', () => {
    const result = analyze(`
        DCL First(1:3) FIXED;
        DCL Second(20:21) INV FIXED INIT(1,2);
        DCL Pointers(2) REF () INV FIXED INIT(First, Second);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.initialValues.has(result.dataObject('Pointers')), true);
});

test('virtual REF INIT rejects mismatched element type and number of dimensions', () => {
    const result = analyze(`
        DCL TwoDim(2,2) INV FIXED INIT(1,2,3,4);
        DCL Characters(2) INV CHAR(2) INIT('A','B');
        DCL WrongRank REF () INV FIXED INIT(TwoDim);
        DCL WrongElement REF () INV FIXED INIT(Characters);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidInitialization,
        SemanticDiagnosticCode.InvalidInitialization
    ]);
});

test('virtual REF INIT still rejects discarding INV protection', () => {
    const result = analyze(`
        DCL Protected(3) INV FIXED INIT(1,2,3);
        DCL Writable(3) FIXED;
        DCL Invalid REF () FIXED INIT(Protected);
        DCL Valid REF () FIXED INIT(Writable);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidInitialization]);
    assert.equal(result.semantic.initialValues.has(result.dataObject('Invalid')), false);
    assert.equal(result.semantic.initialValues.has(result.dataObject('Valid')), true);
});

test('scalar REF INIT retains exact target type checking', () => {
    const result = analyze(`
        DCL Scalar FIXED;
        DCL Values(3) FIXED;
        DCL Valid REF FIXED INIT(Scalar);
        DCL Invalid REF FIXED INIT(Values);
        DCL InvalidVirtual REF () FIXED INIT(Scalar);
    `);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidInitialization,
        SemanticDiagnosticCode.InvalidInitialization
    ]);
    assert.equal(result.semantic.initialValues.has(result.dataObject('Valid')), true);
});
