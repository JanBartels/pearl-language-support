// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AstNode } from '../../../../ast/astNode';
import { SpcProcedureAttributeNode } from '../../../../ast/problem/specifications/spcProcedureAttributeNode';
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
import { SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(sourceText: string) {
    const source = new FileSource('file:///signature-test.pearl',
        `MODULE SignatureTest; PROBLEM; ${sourceText} MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry,
        new MacroTable(),
        new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();

    function findProcedureSpecification(node: AstNode): SpcProcedureAttributeNode | undefined {
        if (node instanceof SpcProcedureAttributeNode) return node;
        for (const child of node.getChildren()) {
            const found = findProcedureSpecification(child);
            if (found) return found;
        }
        return undefined;
    }

    return { ast, problems, specification: findProcedureSpecification(ast) };
}

test('SPC ENTRY supports an unnamed one-dimensional field parameter', () => {
    const result = parse('SPC MYPROC ENTRY( () FIXED ) GLOBAL;');
    assert.deepEqual(result.problems.toArray().map(problem => problem.message), []);
    const parameter = result.specification?.signature.parameters[0];
    assert.ok(parameter);
    assert.equal(result.specification?.signature.parameters.length, 1);
    assert.equal(parameter.name, undefined);
    assert.equal(parameter.dimensions?.rank, 1);

    const semantic = new SemanticAnalyzer().analyze(result.ast);
    assert.deepEqual(semantic.diagnostics
        .filter(diag => diag.severity === SemanticDiagnosticSeverity.Error)
        .map(diag => diag.message), []);
});

test('unnamed multidimensional and named field parameters retain their rank', () => {
    const result = parse('SPC MYPROC ENTRY( (,) FIXED IDENT, Data () FLOAT ) GLOBAL;');
    assert.deepEqual(result.problems.toArray().map(problem => problem.message), []);
    const parameters = result.specification?.signature.parameters;
    assert.equal(parameters?.length, 2);
    assert.equal(parameters?.[0]?.dimensions?.rank, 2);
    assert.equal(parameters?.[0]?.name, undefined);
    assert.equal(parameters?.[0]?.ident?.value, 'IDENT');
    assert.equal(parameters?.[1]?.name?.value, 'Data');
    assert.equal(parameters?.[1]?.dimensions?.rank, 1);
});

test('ordinary scalar parameters and empty signature remain unchanged', () => {
    const scalar = parse('SPC MYPROC ENTRY( FIXED ) GLOBAL;');
    assert.deepEqual(scalar.problems.toArray().map(problem => problem.message), []);
    assert.equal(scalar.specification?.signature.parameters[0]?.dimensions, undefined);
    const empty = parse('SPC MYPROC ENTRY() GLOBAL;');
    assert.deepEqual(empty.problems.toArray().map(problem => problem.message), []);
    assert.equal(empty.specification?.signature.parameters.length, 0);
});

test('virtual dimensions require a following parameter type', () => {
    const result = parse('SPC MYPROC ENTRY( () ) GLOBAL;');
    assert.ok(result.problems.some(problem =>
        problem.message === 'Expected parameter type in procedure signature.'));
});

test('REF PROC uses the same parameter grammar as SPC ENTRY', () => {
    const result = parse('DCL Callback REF PROC( () FIXED );');
    assert.deepEqual(result.problems.toArray().map(problem => problem.message), []);
});
