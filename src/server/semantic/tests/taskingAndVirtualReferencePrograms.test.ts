// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function analyzeFixture(fileName: string) {
    const text = readFileSync(join(__dirname, 'fixtures', fileName), 'utf8');
    const source = new FileSource(`file:///compiler-probes/${fileName}`, text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return {
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

test('RTOS-UH: PRIORITY, EVERY and WHEN RESUME compile; INV FIXED priority is valid', () => {
    const result = analyzeFixture('TaskingConfirmedAliases.P');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('RTOS-UH: mutable FIXED cannot be used as an ACTIVATE priority', () => {
    const result = analyzeFixture('TaskingMutablePriority.P');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidTaskPriority]);
});

test('RTOS-UH: CONTINUE rejects PRIO; the subsequent ACTIVATE survives recovery', () => {
    const result = analyzeFixture('TaskingContinuePriority.P');
    assert.deepEqual(result.syntax, ['CONTINUE does not allow PRIO or PRIORITY.']);
    assert.deepEqual(result.errors, []);
});

test('RTOS-UH: one- and two-dimensional fields fit virtual reference targets', () => {
    const result = analyzeFixture('VirtualArrayReference.P');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('virtual array references do not accept mismatched ranks or element types', () => {
    const result = analyzeFixture('VirtualArrayReferenceInvalid.P');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidAssignmentValueType,
        SemanticDiagnosticCode.InvalidAssignmentValueType
    ]);
});

test('LSP intentionally rejects known negative tasking durations despite compiler acceptance', () => {
    const result = analyzeFixture('TaskingNegativeDurationLsp.P');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.NegativeTaskingDuration,
        SemanticDiagnosticCode.NegativeTaskingDuration,
        SemanticDiagnosticCode.NegativeTaskingDuration
    ]);
});
