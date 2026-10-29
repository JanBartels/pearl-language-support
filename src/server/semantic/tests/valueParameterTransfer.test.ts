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
    const source = new FileSource('file:///value-parameter-transfer.pearl',
        `MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const preprocessorContext = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, preprocessorContext, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, preprocessorContext.activeBlockComments);
    return {
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}
const mismatch = SemanticDiagnosticCode.InvalidCallArgumentType;

test('STRUCT by value checks exact component types for CALL', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        P: PROC(X HS); END;
        R: PROC;
            DCL Good HS;
            DCL Bad Other;
            P(Good);
            P(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
    assert.match(result.errors[0].message, /Aktualparameter 1/);
});

test('STRUCT by value uses identical rules for a function in expressions', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        F: PROC(X HS) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            DCL Good HS;
            DCL Bad Other;
            RETURN(F(Good) + F(Bad));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
});

test('a typed REF actual is implicitly dereferenced for a scalar value formal', () => {
    const result = analyze(`
        DCL V FIXED;
        DCL P REF FIXED INIT(V);
        DCL C REF INV FIXED INIT(V);
        Accept: PROC(X FIXED); END;
        R: PROC; Accept(P); Accept(C); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('dereferenced REF value still obeys numeric type compatibility', () => {
    const result = analyze(`
        DCL V FLOAT;
        DCL P REF FLOAT INIT(V);
        Accept: PROC(X FIXED); END;
        R: PROC; Accept(P); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
});

test('typed REF to a structure can provide a STRUCT value to CALL', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL P REF HS INIT(V);
        Accept: PROC(X HS); END;
        R: PROC; Accept(P); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('typed REF to a different structure is rejected for STRUCT by value', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        DCL V Other;
        DCL P REF Other INIT(V);
        Accept: PROC(X HS); END;
        R: PROC; Accept(P); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
});

test('REF formals keep reference semantics and do not dereference actuals', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL P REF HS INIT(V);
        Accept: PROC(X REF HS); END;
        R: PROC; Accept(P); Accept(V); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('REF IDENT requires a REF variable, not the address of an ordinary object', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL P REF HS INIT(V);
        Accept: PROC(X REF HS IDENT); END;
        R: PROC; Accept(P); Accept(V); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('SPC ENTRY uses the same STRUCT value checks', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        SPC External ENTRY(X HS) GLOBAL;
        R: PROC;
            DCL Good HS;
            DCL Bad Other;
            External(Good);
            External(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
});

test('REF PROC function target uses the same REF actual value semantics', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE FPtr REF PROC(X HS) RETURNS(FIXED);
        DCL F FPtr;
        DCL V HS;
        DCL P REF HS INIT(V);
        R: PROC RETURNS(FIXED); RETURN(F(P)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('RETURN accepts a typed REF whose target fits the value result type', () => {
    const result = analyze(`
        R: PROC RETURNS(FIXED);
            DCL V FIXED;
            DCL P REF FIXED INIT(V);
            RETURN(P);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('RETURN diagnoses an incompatible dereferenced REF value', () => {
    const result = analyze(`
        R: PROC RETURNS(FIXED);
            DCL V FLOAT;
            DCL P REF FLOAT INIT(V);
            RETURN(P);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code),
        [SemanticDiagnosticCode.InvalidReturnType]);
});

test('RETURN checks matching and mismatched STRUCT values', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        Good: PROC RETURNS(HS);
            DCL V HS;
            RETURN(V);
        END;
        Bad: PROC RETURNS(HS);
            DCL V Other;
            RETURN(V);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code),
        [SemanticDiagnosticCode.InvalidReturnType]);
});
