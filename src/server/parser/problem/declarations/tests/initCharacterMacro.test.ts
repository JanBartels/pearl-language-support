// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AstNode } from '../../../../ast/astNode';
import { InitElementNode } from '../../../../ast/problem/declarations/initElementNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { SemanticAnalyzer } from '../../../../semantic/semanticAnalyzer';
import { SemanticConstantKind, SemanticInitialValueKind } from '../../../../semantic/semanticConstantValue';
import { SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(text: string) {
    const source = new FileSource('file:///char-macro-test.pearl', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry,
        new MacroTable(),
        new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(
        tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger
    );
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);

    const findInitializers = (node: AstNode): InitElementNode[] => [
        ...(node instanceof InitElementNode ? [node] : []),
        ...node.getChildren().flatMap(findInitializers)
    ];

    return { source, problems, ast, semantic, initializers: findInitializers(ast) };
}

const testInput = String.raw`#define Progname "'MyProg'"
#define Version "'V1.2.3'"
MODULE Demo;
PROBLEM;
DCL VersionStr CHAR(40) INIT( ''\AEB1\''Progname''\3D\''Version''\FF\'');
MODEND;`;

test('INIT parses adjacent CHAR fragments from macro expansion as one element', () => {
    const result = analyze(testInput);
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.equal(result.initializers.length, 1);
    const value = result.initializers[0]?.value;
    assert.equal(value?.kind, 'characterString');
    if (value?.kind !== 'characterString') return;
    assert.deepEqual(value.literals.map(part => part.value), [
        String.raw`''\AEB1\''`, "'MyProg'", String.raw`''\3D\''`,
        "'V1.2.3'", String.raw`''\FF\''`
    ]);

    // Every fragment is addressable at its original editor location,
    // including macro invocations (not their replacement-text offsets).
    const prognameOffset = testInput.indexOf('Progname', testInput.indexOf('DCL '));
    const versionOffset = testInput.indexOf('Version', testInput.indexOf('Progname', prognameOffset) + 1);
    const progname = value.literals[1]!;
    const version = value.literals[3]!;
    assert.equal(progname.location?.span.start, prognameOffset);
    assert.equal(version.location?.span.start, versionOffset);
    assert.equal(result.initializers[0]?.lookupSourceValue({ uri: result.source.uri, offset: prognameOffset })?.element, progname);
    assert.equal(result.initializers[0]?.lookupSourceValue({ uri: result.source.uri, offset: versionOffset })?.element, version);
});

test('joined literal is decoded once, retaining apostrophes at macro boundaries', () => {
    const result = analyze(testInput);
    assert.deepEqual(result.semantic.diagnostics
        .filter(d => d.severity === SemanticDiagnosticSeverity.Error)
        .map(d => d.message), []);
    const initialValue = [...result.semantic.initialValues]
        .find(([symbol]) => symbol.name.value === 'VersionStr')?.[1];
    assert.equal(initialValue?.kind, SemanticInitialValueKind.Constant);
    if (initialValue?.kind !== SemanticInitialValueKind.Constant) return;
    assert.equal(initialValue.values.length, 1);
    const value = initialValue.values[0];
    assert.equal(value?.kind, SemanticConstantKind.Character);
    if (value?.kind === SemanticConstantKind.Character) {
        assert.equal(value.value, "\u00ae\u00b1'MyProg'='V1.2.3'\u00ff".padEnd(40, " "));
    }
});

test('a single ordinary CHAR INIT literal remains one fragment', () => {
    const result = analyze("MODULE Demo; PROBLEM; DCL Plain CHAR(10) INIT('Hello'); MODEND;");
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    const value = result.initializers[0]?.value;
    assert.equal(value?.kind, 'characterString');
    if (value?.kind === 'characterString') {
        assert.deepEqual(value.literals.map(part => part.value), ["'Hello'"]);
    }
});

test('whitespace-separated literals are not implicitly concatenated', () => {
    const result = analyze("MODULE Demo; PROBLEM; DCL Plain CHAR(10) INIT('A' 'B'); MODEND;");
    assert.ok(result.problems.some(p => p.message === "Expected ')' after initialization list."));
});

test('missing macros are not hidden by the string-literal parser', () => {
    const result = analyze("MODULE Demo; PROBLEM; DCL Plain CHAR(10) INIT('A'Missing); MODEND;");
    assert.ok(result.problems.some(p => p.message === "Expected ')' after initialization list."));
});
