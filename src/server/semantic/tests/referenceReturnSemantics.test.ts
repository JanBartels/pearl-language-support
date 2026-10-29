// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
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

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(code: string) {
    const source = new FileSource('file:///reference-return.pearl',
        `MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return {
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

const hs = 'TYPE HS STRUCT[E FIXED]; DCL V HS; DCL P REF HS INIT(V);';
const invalidReturn = SemanticDiagnosticCode.InvalidReturnType;

test('RETURNS(REF HS) accepts the address of an object and a typed REF value', () => {
    const r = analyze(`${hs}
        Address: PROC RETURNS(REF HS); RETURN(V); END;
        Pointer: PROC RETURNS(REF HS); RETURN(P); END;
        Nested: PROC RETURNS(REF HS); RETURN((V)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('REF-returning function calls remain reference values when returned', () => {
    const r = analyze(`${hs}
        Source: PROC RETURNS(REF HS); RETURN(P); END;
        Forward: PROC RETURNS(REF HS); RETURN(Source()); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('RETURNS(REF HS) rejects incompatible object types and plain values', () => {
    const r = analyze(`${hs} DCL N FIXED;
        BadObject: PROC RETURNS(REF HS); RETURN(N); END;
        BadLiteral: PROC RETURNS(REF HS); RETURN(42); END;
        BadExpression: PROC RETURNS(REF HS); RETURN(N + 1); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [invalidReturn, invalidReturn, invalidReturn]);
    assert.ok(r.errors.every(e => e.location !== undefined));
});

test('typed REF results do not accept references to incompatible targets', () => {
    const r = analyze(`${hs} DCL Other REF FLOAT;
        Bad: PROC RETURNS(REF HS); RETURN(Other); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [invalidReturn]);
});

test('REF INV results accept protected objects and protected pointers', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL Protected INV HS INIT(42);
        DCL Writable REF HS INIT(V);
        DCL ReadOnly REF INV HS INIT(Protected);
        R1: PROC RETURNS(REF INV HS); RETURN(Protected); END;
        R2: PROC RETURNS(REF INV HS); RETURN(ReadOnly); END;
        R3: PROC RETURNS(REF INV HS); RETURN(Writable); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('writable REF results reject protected objects and protected pointers', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        DCL Protected INV HS INIT(42);
        DCL ReadOnly REF INV HS INIT(Protected);
        R1: PROC RETURNS(REF HS); RETURN(Protected); END;
        R2: PROC RETURNS(REF HS); RETURN(ReadOnly); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [invalidReturn, invalidReturn]);
});

test('REF STRUCT[] results obey target invariance and the VOID wildcard', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL Protected INV HS INIT(42);
        Good: PROC RETURNS(REF STRUCT[]); RETURN(V); END;
        Bad: PROC RETURNS(REF STRUCT[]); RETURN(Protected); END;
        ReadOnly: PROC RETURNS(REF INV STRUCT[]); RETURN(Protected); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [invalidReturn]);
});

test('TYPE aliases on both sides of a REF return are resolved for comparison', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        TYPE HSRef REF HS;
        DCL V HS;
        DCL P HSRef INIT(V);
        A: PROC RETURNS(HSRef); RETURN(V); END;
        B: PROC RETURNS(HSRef); RETURN(P); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('NIL is still valid for REF returns and invalid for non-REF returns', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        Good: PROC RETURNS(REF HS); RETURN((NIL)); END;
        Bad: PROC RETURNS(FIXED); RETURN(NIL); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [invalidReturn]);
});

test('unknown REF return operands do not cascade into return type errors', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        Bad: PROC RETURNS(REF HS); RETURN(Unknown); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [SemanticDiagnosticCode.UnknownIdentifier]);
});
