// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import { formatSemanticType } from '../../documentation/semanticTypeDocumentation';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { canonicalizeSemanticType, isTypeAssignable, semanticTypeEquals } from '../semanticTypeComparison';
import { SymbolKind } from '../symbolKind';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(code: string) {
    const source = new FileSource('file:///ref-target-invariant.pearl',
        `MODULE RefInvariant; PROBLEM; ${code} MODEND;`);
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
    assert.deepEqual(problems.toArray().map(p => p.message), []);
    const symbols = [...semantic.bindings.values()]
        .filter(symbol => symbol.kind === SymbolKind.DataObject);
    function symbol(name: string) {
        const result = symbols.find(s => s.name.value === name);
        assert.ok(result && result.kind === SymbolKind.DataObject, `Missing symbol ${name}`);
        return result;
    }
    return { semantic, symbol };
}

test('semantic REF INV survives resolution, comparison, formatting and canonicalization', () => {
    const { symbol, semantic } = analyze(`
DCL Plain REF STRUCT[];
DCL ReadOnly REF INV STRUCT[];
DCL ConstPointer INV REF INV STRUCT[] INIT(NIL);
DCL Typed REF INV FIXED;
DCL Normal REF FIXED;
`);
    assert.deepEqual(semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error), []);
    const plain = symbol('Plain');
    const readOnly = symbol('ReadOnly');
    const constPointer = symbol('ConstPointer');
    const typed = symbol('Typed');
    const normal = symbol('Normal');
    assert.equal(plain.type.kind, SemanticTypeKind.VoidReference);
    assert.equal(readOnly.type.kind, SemanticTypeKind.VoidReference);
    assert.equal(typed.type.kind, SemanticTypeKind.Reference);
    assert.equal(normal.type.kind, SemanticTypeKind.Reference);
    assert.equal(plain.type.kind === SemanticTypeKind.VoidReference && plain.type.targetInvariant, false);
    assert.equal(readOnly.type.kind === SemanticTypeKind.VoidReference && readOnly.type.targetInvariant, true);
    assert.equal(typed.type.kind === SemanticTypeKind.Reference && typed.type.targetInvariant, true);
    assert.equal(semanticTypeEquals(plain.type, readOnly.type), false);
    assert.equal(semanticTypeEquals(typed.type, normal.type), false);
    assert.equal(formatSemanticType(readOnly.type), 'REF INV STRUCT[]');
    assert.equal(formatSemanticType(typed.type), 'REF INV FIXED');
    assert.equal(formatSemanticType(canonicalizeSemanticType(typed.type)), 'REF INV FIXED(15)');
    assert.equal(constPointer.assignmentProtected, true);
    assert.equal(readOnly.assignmentProtected, false);
});

test('REF assignment compatibility is directional and preserves target protection', () => {
    const { symbol } = analyze(`
DCL Void REF STRUCT[];
DCL ReadOnlyVoid REF INV STRUCT[];
DCL Writable REF FIXED;
DCL ReadOnly REF INV FIXED;
`);
    const voidRef = symbol('Void').type;
    const readOnlyVoid = symbol('ReadOnlyVoid').type;
    const writable = symbol('Writable').type;
    const readOnly = symbol('ReadOnly').type;
    assert.equal(isTypeAssignable(readOnly, writable), true);
    assert.equal(isTypeAssignable(writable, readOnly), false);
    assert.equal(isTypeAssignable(readOnlyVoid, writable), true);
    assert.equal(isTypeAssignable(readOnlyVoid, readOnly), true);
    assert.equal(isTypeAssignable(voidRef, writable), true);
    assert.equal(isTypeAssignable(voidRef, readOnly), false);
    assert.equal(isTypeAssignable(voidRef, readOnlyVoid), false);
    assert.equal(isTypeAssignable(readOnlyVoid, voidRef), true);
    assert.equal(isTypeAssignable(readOnlyVoid, readOnlyVoid), true);
});

test('REF INIT cannot discard target INV, but can add it', () => {
    const result = analyze(`
DCL Protected INV FIXED INIT(1);
DCL Ordinary FIXED;
DCL Invalid REF FIXED INIT(Protected);
DCL ValidProtected REF INV FIXED INIT(Protected);
DCL ValidOrdinary REF INV FIXED INIT(Ordinary);
DCL ValidWritable REF FIXED INIT(Ordinary);
DCL ValidNil REF INV FIXED INIT(NIL);
`);
    const invalid = result.semantic.diagnostics.filter(d => d.code === SemanticDiagnosticCode.InvalidInitialization);
    assert.equal(invalid.length, 1);
    assert.equal(result.semantic.initialValues.has(result.symbol('Invalid')), false);
    for (const name of ['ValidProtected', 'ValidOrdinary', 'ValidWritable', 'ValidNil']) {
        assert.equal(result.semantic.initialValues.has(result.symbol(name)), true, name);
    }
});

test('REF INV STRUCT[] INIT accepts protected targets but bare REF STRUCT[] does not', () => {
    const result = analyze(`
DCL Protected INV FIXED INIT(1);
DCL Ordinary FIXED;
DCL WritableVoid REF STRUCT[] INIT(Ordinary);
DCL RejectedVoid REF STRUCT[] INIT(Protected);
DCL ReadOnlyVoid REF INV STRUCT[] INIT(Protected);
DCL ReadOnlyOrdinary REF INV STRUCT[] INIT(Ordinary);
`);
    const invalid = result.semantic.diagnostics.filter(d => d.code === SemanticDiagnosticCode.InvalidInitialization);
    assert.equal(invalid.length, 1);
    assert.equal(result.semantic.initialValues.has(result.symbol('RejectedVoid')), false);
    for (const name of ['WritableVoid', 'ReadOnlyVoid', 'ReadOnlyOrdinary']) {
        assert.equal(result.semantic.initialValues.has(result.symbol(name)), true, name);
    }
});

test('arrays of REF INV retain the target protection during INIT', () => {
    const result = analyze(`
DCL Protected INV FIXED INIT(1);
DCL Ordinary FIXED;
DCL Allowed(2) REF INV FIXED INIT(Protected, Ordinary);
DCL Rejected(2) REF FIXED INIT(Protected, Ordinary);
`);
    assert.equal(result.semantic.diagnostics.filter(
        d => d.code === SemanticDiagnosticCode.InvalidInitialization
    ).length, 1);
    assert.equal(result.semantic.initialValues.has(result.symbol('Allowed')), true);
    assert.equal(result.semantic.initialValues.has(result.symbol('Rejected')), false);
});

test('procedure parameter signatures retain REF INV even for VOID references', () => {
    const { semantic } = analyze(`
SPC Reader ENTRY(REF INV STRUCT[]) GLOBAL;
SPC Writer ENTRY(REF STRUCT[]) GLOBAL;
`);
    const procedures = [...semantic.bindings.values()]
        .filter(symbol => symbol.kind === SymbolKind.Procedure);
    const reader = procedures.find(p => p.name.value === 'Reader');
    const writer = procedures.find(p => p.name.value === 'Writer');
    assert.ok(reader && reader.kind === SymbolKind.Procedure && reader.signature);
    assert.ok(writer && writer.kind === SymbolKind.Procedure && writer.signature);
    assert.equal(formatSemanticType(reader.signature), 'PROC(REF INV STRUCT[])');
    assert.equal(formatSemanticType(writer.signature), 'PROC(REF STRUCT[])');
    assert.equal(semanticTypeEquals(reader.signature, writer.signature), false);
});
