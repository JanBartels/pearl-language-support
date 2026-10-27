// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
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
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';
import { SymbolReferenceCollector } from '../symbolReferenceCollector';
import { SymbolReferenceResolver } from '../symbolReferenceResolver';
import { SymbolReferenceKind } from '../symbolReference';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(declarations: string, body: string) {
    const source = new FileSource('file:///call-target-resolution.pearl',
        `MODULE Test; PROBLEM; ${declarations}\nRunner: TASK;\n${body}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const calls: CallStatementNode[] = [];
    function collect(node: AstNode): void {
        if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
        for (const child of node.getChildren()) collect(child);
    }
    collect(ast);
    const references = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const errors = semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error);
    return { problems: problems.toArray().map(p => p.message), semantic, calls, errors, resolutions };
}

test('explicit and implicit calls with unknown targets each report UnknownIdentifier', () => {
    const result = analyze('', 'CALL somethingUndefined; anotherUndefined(42);');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['somethingUndefined', 'anotherUndefined']);
    assert.deepEqual(result.errors.map(d => [d.code, d.message]), [
        [SemanticDiagnosticCode.UnknownIdentifier, "Unbekannter Bezeichner 'somethingUndefined'."],
        [SemanticDiagnosticCode.UnknownIdentifier, "Unbekannter Bezeichner 'anotherUndefined'."]
    ]);
    const calls = result.resolutions.all.filter(r => r.reference.kind === SymbolReferenceKind.Call);
    assert.deepEqual(calls.map(r => r.kind), ['unresolved', 'unresolved']);
    assert.deepEqual(calls.map(r => r.diagnostics.map(d => d.code)), [
        [SemanticDiagnosticCode.UnknownIdentifier], [SemanticDiagnosticCode.UnknownIdentifier]
    ]);
});

test('named REF PROC target is callable, retains its Named symbol type and checks arity', () => {
    const result = analyze(`
        TYPE TRefProc2 REF PROC(FIXED);
        DCL MyRefProc2 TRefProc2;
        DCL RIS REF INV STRUCT[];
    `, 'MyRefProc2(42); CALL MyRefProc2(42); MyRefProc2;');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value),
        ['MyRefProc2', 'MyRefProc2', 'MyRefProc2']);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArity]);
    const binding = result.semantic.bindings.get(result.calls[0].target!);
    assert.ok(binding && binding.kind === SymbolKind.DataObject);
    assert.equal(binding.type.kind, SemanticTypeKind.Named, 'type alias identity must survive');
    const calls = result.resolutions.all.filter(r => r.reference.kind === SymbolReferenceKind.Call);
    assert.ok(calls.every(r => r.kind === 'bound'));
});

test('chained TYPE aliases of REF PROC can be invoked', () => {
    const result = analyze(`
        TYPE RP REF PROC(FIXED);
        TYPE Alias RP;
        DCL Ref Alias;
    `, 'Ref(42);');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.calls.length, 1);
});

test('aliases of ordinary objects remain invalid call targets', () => {
    const result = analyze('TYPE Number FIXED; DCL x Number;', 'x; CALL x(4);');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidCallTarget,
        SemanticDiagnosticCode.InvalidCallTarget
    ]);
});

test('existing directly typed REF PROC, PROC and SPC calls remain valid', () => {
    const result = analyze(`
        DCL Direct REF PROC(FIXED);
        SPC External ENTRY(FIXED) GLOBAL;
        Local: PROC(X FIXED); END;
    `, 'Direct(1); CALL External(2); Local(3);');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.errors, []);
});

test('regression: REF PROC TYPE inside PROC with FLOAT IDENT and RETURN(BIT)', () => {
    const result = analyze(`
        TYPE TRefProc2 REF PROC(FIXED);
        DCL MyRefProc2 TRefProc2;
        DCL RIS REF INV STRUCT[];
        FloatProc: PROC(FLOAT IDENT) RETURNS(BIT);
            MyRefProc2(42);
            RETURN('1'B);
        END;
    `, 'CALL somethingUndefined;');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['MyRefProc2', 'somethingUndefined']);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.UnknownIdentifier]);
    const bound = result.semantic.bindings.get(result.calls[0].target!);
    assert.ok(bound && bound.kind === SymbolKind.DataObject);
});
