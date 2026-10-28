// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { ModuleNode } from '../../ast/module/moduleNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode as Code, SemanticDiagnosticSeverity as Severity } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(text: string) {
    const source = new FileSource('file:///compiler-settings.p', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    ), problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const modules = ast.getChildren().filter(child => child.kind === AstKind.Module) as ModuleNode[];
    return { problems: problems.toArray(), semantic, modules };
}

test('Missing P= produces a warning, not a syntax error or a semantic error', () => {
    const result = analyze(`SC=2000;\n! P=MPC603+(4);\nMODULE Test; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 1);
    assert.deepEqual(result.problems.map(problem => problem.message), []);
    const diagnostics = result.semantic.diagnostics;
    assert.deepEqual(diagnostics.map(diagnostic => diagnostic.code), [Code.MissingProcessorSetting]);
    assert.equal(diagnostics[0].severity, Severity.Warning);
    assert.equal(result.semantic.moduleConfigurations.get(result.modules[0])?.processor, undefined);
});

test('Present P= suppresses missing-processor warning and preserves configuration', () => {
    const result = analyze(`P=MPC603+(4);\nSC=2000;\nMODULE Test; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 1);
    assert.deepEqual(result.problems.map(problem => problem.message), []);
    assert.equal(result.semantic.diagnostics.some(d => d.code === Code.MissingProcessorSetting), false);
    assert.equal(result.semantic.moduleConfigurations.get(result.modules[0])?.processor?.name, 'MPC603');
});

test('PQ=MPC603+(4) reports one syntax error and recovers at semicolon', () => {
    const result = analyze(`PQ=MPC603+(4);\nSC=2000;\nMODULE Test; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 1);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0].message, /Unknown compiler control 'PQ'/);
    assert.equal(result.semantic.moduleConfigurations.get(result.modules[0])?.moduleSize?.size, BigInt(0x2000));
    assert.deepEqual(result.semantic.diagnostics.map(d => d.code), [Code.MissingProcessorSetting]);
});

test('Unknown preamble controls recover at MODULE even without semicolon', () => {
    const result = analyze(`PQ=MPC603+(4)\nMODULE Test; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 1);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0].message, /Unknown compiler control 'PQ'/);
});

test('Unknown preamble control does not discard later valid processor setting', () => {
    const result = analyze(`PQ=MPC603+(4);\nP=MPC604+FPU(4);\nSC=2000;\nMODULE Test; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 1);
    assert.equal(result.problems.length, 1);
    assert.equal(result.semantic.diagnostics.some(d => d.code === Code.MissingProcessorSetting), false);
    assert.equal(result.semantic.moduleConfigurations.get(result.modules[0])?.processor?.name, 'MPC604');
});

test('Each MODULE receives independent processor warning', () => {
    const result = analyze(`P=68000; MODULE First; PROBLEM; MODEND;\nSC=2000; MODULE Second; PROBLEM; MODEND;`);
    assert.equal(result.modules.length, 2);
    assert.equal(result.semantic.diagnostics.filter(d => d.code === Code.MissingProcessorSetting).length, 1);
});
