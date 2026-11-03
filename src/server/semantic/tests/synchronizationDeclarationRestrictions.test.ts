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
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(declarations: string) {
    const text = `P=MPC603; SC=2000; MODULE M; PROBLEM; ${declarations} MODEND;`;
    const source = new FileSource('file:///synchronization-restrictions.pearl', text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, context.activeBlockComments);
    return { semantic, syntax: problems.toArray(), diagnostics: semantic.diagnostics };
}

function errorCodes(code: string): SemanticDiagnosticCode[] {
    const result = analyze(code);
    assert.deepEqual(result.syntax.map(p => p.message), [], 'no parser errors expected');
    return result.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
        .map(d => d.code);
}

test('SPC INV SEMA and INV BOLT are semantic errors at the INV keyword', () => {
    const program = 'SPC InvSema INV SEMA GLOBAL; SPC InvBolt INV BOLT GLOBAL;';
    const result = analyze(program);
    assert.deepEqual(result.syntax.map(p => p.message), []);
    assert.deepEqual(result.diagnostics.map(d => d.code), [
        SemanticDiagnosticCode.InvalidInvariantSynchronizationObject,
        SemanticDiagnosticCode.InvalidInvariantSynchronizationObject
    ]);
    assert.ok(result.diagnostics.every(d => d.severity === SemanticDiagnosticSeverity.Error));
    assert.ok(result.diagnostics.every(d => d.location.source.getText(d.location.span) === 'INV'));
});

test('DCL INV SEMA and INV BOLT produce a single semantically useful error', () => {
    assert.deepEqual(errorCodes('DCL S INV SEMA; DCL B INV BOLT;'), [
        SemanticDiagnosticCode.InvalidInvariantSynchronizationObject,
        SemanticDiagnosticCode.InvalidInvariantSynchronizationObject
    ]);
});

test('PRESET for a SEMA array is rejected even with matching element count', () => {
    const result = analyze('DCL SC(1:2) SEMA PRESET(1,2);');
    assert.deepEqual(result.syntax.map(p => p.message), []);
    assert.deepEqual(result.diagnostics.map(d => d.code), [
        SemanticDiagnosticCode.UnsupportedSemaArrayPreset
    ]);
    assert.equal(result.semantic.semaPresetValues.size, 0);
});

test('PRESET for an array rejects one value without emitting misleading count errors', () => {
    assert.deepEqual(errorCodes('DCL SC(1:2) SEMA PRESET(1);'), [
        SemanticDiagnosticCode.UnsupportedSemaArrayPreset
    ]);
});

test('SEMA arrays without PRESET remain valid', () => {
    assert.deepEqual(errorCodes('DCL SC(1:2) SEMA;'), []);
});

test('scalar SEMA and lists of SEMA variables retain valid PRESET semantics', () => {
    const result = analyze('DCL A SEMA PRESET(0); DCL (B, C) SEMA PRESET(1, 2);');
    assert.deepEqual(result.syntax.map(p => p.message), []);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual([...result.semantic.semaPresetValues.values()].map(values =>
        values.map(value => value.value)), [[0n], [1n], [2n]]);
});

test('ordinary mutable SEMA and BOLT specifications remain valid', () => {
    assert.deepEqual(errorCodes('SPC S SEMA GLOBAL; SPC B BOLT GLOBAL;'), []);
});

test('INV is also rejected for a structure containing a SEMA value', () => {
    assert.deepEqual(errorCodes('DCL C INV STRUCT[Lock SEMA];'), [
        SemanticDiagnosticCode.InvalidInvariantSynchronizationObject
    ]);
});

test('INV protects a reference variable without making its SEMA target invariant', () => {
    // The REF boundary must not be traversed by the synchronization restriction.
    assert.deepEqual(errorCodes('SPC R INV REF SEMA GLOBAL;'), []);
});
