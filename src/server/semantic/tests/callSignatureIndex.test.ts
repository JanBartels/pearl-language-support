// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { CallStatementNode } from '../../ast/problem/statements/callStatementNode';
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
import { CallSignatureIndex } from '../callSignatureIndex';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(declarations: string, statements: string) {
    const source = new FileSource('file:///signature-index.pearl',
        `MODULE Test; PROBLEM; ${declarations}\nRunner: TASK;\n${statements}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const signatures = new CallSignatureIndex(ast, semantic);
    const calls: CallStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    return { calls, signatures, semantic, problems: problems.toArray().map(problem => problem.message) };
}

test('PROC names and IDENT accompany the procedure type but do not change it', () => {
    const result = analyze(`
        Proc: PROC((A, B) FIXED, FLOAT IDENT) RETURNS(BIT);
            RETURN('1'B);
        END;
    `, 'CALL Proc(1, 2, 3);');
    assert.deepEqual(result.problems, []);
    const call = result.calls[0];
    const sig = result.signatures.get(call)?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['A', 'B', undefined]);
    assert.deepEqual(sig.parameters.map(p => p.byIdentification), [false, false, true]);
    assert.equal(sig.procedureType.hasResult, true);
    assert.equal(sig.procedureType.resultType?.kind, SemanticTypeKind.Bit);
    assert.strictEqual(sig.parameters[0].name?.value, 'A');
});

test('SPC ENTRY keeps optional formal names and unnamed parameters', () => {
    const result = analyze('SPC External ENTRY(Arg FIXED, FLOAT IDENT) GLOBAL;',
        'External(1, 2);');
    assert.deepEqual(result.problems, []);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['Arg', undefined]);
    assert.equal(sig.parameters[1].byIdentification, true);
});

test('local SPC and matching PROC use definition parameter names without new binding logic', () => {
    const result = analyze(`
        SPC Local ENTRY(SpecName FIXED);
        Local: PROC(DeclaredName FIXED); END;
    `, 'Local(1);');
    assert.deepEqual(result.problems, []);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['DeclaredName']);
});

test('TYPE aliases of REF PROC preserve signature and parameter names without replacing Named type', () => {
    const result = analyze(`
        TYPE R REF PROC(X FIXED, FLOAT IDENT);
        TYPE Alias R;
        DCL Ref Alias;
    `, 'Ref(42, 3);');
    assert.deepEqual(result.problems, []);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['X', undefined]);
    const binding = result.semantic.bindings.get(result.calls[0].target!);
    assert.ok(binding && binding.kind === SymbolKind.DataObject);
    assert.equal(binding.type.kind, SemanticTypeKind.Named);
});

test('direct REF PROC is recognized and metadata comes from its own declaration', () => {
    const result = analyze('DCL Direct REF PROC(N FIXED);', 'Direct(42);');
    assert.deepEqual(result.problems, []);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['N']);
});

test('builtin procedures expose original variants, including repeated parameters', () => {
    const result = analyze('', 'WRITE(Thing, 1, 2);');
    assert.deepEqual(result.problems, []);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'builtin');
    assert.equal(sig.builtin.name, 'WRITE');
    assert.deepEqual(sig.signature.parameters.map(p => p.name), ['Station', 'Objekt']);
    assert.equal(sig.signature.repeatedParameter?.name, 'Objekt');
});

test('unresolved and noncallable names have no signature; no extra diagnostics', () => {
    const result = analyze('DCL X FIXED;', 'CALL Missing; X(1);');
    assert.equal(result.calls.length, 2);
    assert.equal(result.signatures.get(result.calls[0]), undefined);
    assert.equal(result.signatures.get(result.calls[1]), undefined);
    assert.equal(result.semantic.diagnostics.length > 0, true);
});

test('partially typed calls still have a compiler-side signature', () => {
    const result = analyze('P: PROC(A FIXED, B FIXED); END;', 'P(1,');
    assert.equal(result.calls.length, 1);
    const sig = result.signatures.get(result.calls[0])?.[0];
    assert.ok(sig && sig.kind === 'procedure');
    assert.deepEqual(sig.parameters.map(p => p.name?.value), ['A', 'B']);
    assert.equal(result.calls[0].actualParameters?.closeParenthesis, undefined);
});
