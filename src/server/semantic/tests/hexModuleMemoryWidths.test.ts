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
import { collectBlockComments } from '../../validation/analysis';
import { CompilerControlAnalyzer } from '../compilerControlAnalyzer';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import {
    SemanticDiagnosticCode as Code, SemanticDiagnosticSeverity as Severity
} from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(text: string) {
    const source = new FileSource('file:///hex-memory-widths.P', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    ), problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantics = new SemanticAnalyzer().analyze(ast);
    const modules = ast.getChildren().filter(n => n.kind === AstKind.Module) as ModuleNode[];
    const commentDiagnostics = new CompilerControlAnalyzer().analyze(
        ast, collectBlockComments(tokens), semantics);
    return { syntax: problems.toArray().map(p => p.message), semantics, modules, commentDiagnostics };
}

function moduleSource(setting: string, comments = ''): string {
    return `P=MPC603; ${setting}; MODULE Test; PROBLEM; ${comments} MODEND;`;
}

test('S and SC accept 1..8 hexadecimal digits, with or without dollar prefix', () => {
    for (const [setting, size] of [
        ['S=F', 15n], ['SC=$1', 1n],
        ['SC=FFFFFFFF', 0xFFFFFFFFn], ['SC=$FFFFFFFF', 0xFFFFFFFFn],
        ['SC=00000000', 0n]
    ] as const) {
        const r = analyze(moduleSource(setting));
        assert.deepEqual(r.syntax, [], setting);
        assert.equal(r.semantics.diagnostics.some(d => d.code === Code.InvalidCompilerSettingValue), false, setting);
        assert.equal(r.semantics.moduleConfigurations.get(r.modules[0])?.moduleSize?.size, size, setting);
    }
});

test('S and SC reject nine hex digits even if numeric value fits in 32 bits', () => {
    for (const setting of ['S=123456789', 'SC=$123456789', 'SC=000000001', 'SC=FFFFFFFFF']) {
        const r = analyze(moduleSource(setting));
        assert.deepEqual(r.syntax, [], setting);
        assert.equal(r.semantics.diagnostics.filter(d => d.code === Code.InvalidCompilerSettingValue).length, 1, setting);
        assert.equal(r.semantics.moduleConfigurations.get(r.modules[0])?.moduleSize, undefined, setting);
    }
});

test('CODE and VAR both accept exactly eight hex digits', () => {
    const r = analyze(moduleSource('SC=2000,CODE=$FFFFFFFF,VAR=FFFFFFFF'));
    assert.deepEqual(r.syntax, []);
    assert.equal(r.semantics.diagnostics.some(d => d.code === Code.InvalidCompilerSettingValue), false);
    assert.equal(r.semantics.moduleConfigurations.get(r.modules[0])?.moduleSize?.codeAddress, 0xFFFFFFFFn);
    assert.equal(r.semantics.moduleConfigurations.get(r.modules[0])?.moduleSize?.varAddress, 0xFFFFFFFFn);
});

test('oversized CODE and VAR fields are reported independently at their value', () => {
    for (const [setting, value] of [
        ['SC=2000,CODE=$123456789,VAR=$2000', '$123456789'],
        ['SC=2000,CODE=$1000,VAR=123456789', '123456789']
    ] as const) {
        const r = analyze(moduleSource(setting));
        assert.deepEqual(r.syntax, [], setting);
        const errors = r.semantics.diagnostics.filter(d => d.code === Code.InvalidCompilerSettingValue);
        assert.equal(errors.length, 1, setting);
        assert.equal(errors[0].location.source.getText(errors[0].location.span), value, setting);
        assert.equal(r.semantics.moduleConfigurations.get(r.modules[0])?.moduleSize, undefined, setting);
    }
});

test('R control comments allow eight digits with both signs and optional prefixes', () => {
    const r = analyze(moduleSource('SC=2000', [
        '/*+R=FFFFFFFF note */', '/*-R=$12345678 note */',
        '/*+RFFFFFFFF note */', '/*+R$1 note */'
    ].join('\n')));
    assert.deepEqual(r.syntax, []);
    assert.equal(r.commentDiagnostics.filter(d => d.code === Code.InvalidRCompilerOptionLength).length, 0);
});

test('R control comments warn for nine digits in every supported spelling', () => {
    const r = analyze(moduleSource('SC=2000', [
        '/*+R=FFFFFFFFF note */', '/*-R=$012345678 note */',
        '/*+R000000001 note */', '/*-R$FFFFFFFFF note */'
    ].join('\n')));
    assert.deepEqual(r.syntax, []);
    const warnings = r.commentDiagnostics.filter(d => d.code === Code.InvalidRCompilerOptionLength);
    assert.equal(warnings.length, 4);
    assert.ok(warnings.every(d => d.severity === Severity.Warning));
});

test('unknown or malformed comments are not reinterpreted as R memory settings', () => {
    const r = analyze(moduleSource('SC=2000', [
        '/*+RESERVE=123456789 note */', '/*+R=G123456789 note */',
        '/*+L comment */', '/* plain comment */'
    ].join('\n')));
    assert.deepEqual(r.syntax, []);
    assert.equal(r.commentDiagnostics.some(d => d.code === Code.InvalidRCompilerOptionLength), false);
});
