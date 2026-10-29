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

function analyze(body: string) {
    const source = new FileSource('file:///argument-types.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    return {
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        syntax: problems.toArray().map(p => p.message),
        source
    };
}

const declarations = `
    F: PROC(I FIXED) RETURNS(FIXED);
        RETURN(I * 2);
    END;
`;

test('FLOAT expression passed to FIXED formal parameter reports at the actual argument', () => {
    const result = analyze(`${declarations}
        R: PROC(I FIXED) RETURNS(FIXED);
            DCL A8(10) FIXED;
            RETURN(A8(I) + F(I*1.0));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('I'\) von 'F'/);
    assert.match(result.errors[0].message, /erwartet FIXED, erhalten FLOAT\(23\)/);
    // The diagnostic highlights the argument, not F, A8, or RETURN.
    assert.equal(result.source.getText().slice(
        result.errors[0].location.span.start,
        result.errors[0].location.span.end), 'I');
});

test('correct FIXED argument and nested return function remain valid', () => {
    const result = analyze(`${declarations}
        R: PROC(I FIXED) RETURNS(FIXED);
            DCL A8(10) FIXED;
            RETURN(A8(F(I)) + F(I * 2));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('a nested wrong inner function argument does not trigger outer type cascades', () => {
    const result = analyze(`${declarations}
        R: PROC RETURNS(FIXED);
            DCL A(10) FIXED;
            RETURN(A(F(1.0)) + 3);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
});

test('wrong types at several argument positions yield individual diagnostics', () => {
    const result = analyze(`F: PROC(A FIXED, B CHAR(4)) RETURNS(FIXED);
        RETURN(A); END;
        R: PROC RETURNS(FIXED); RETURN(F(2.0, 5)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
    assert.match(result.errors[0].message, /Aktualparameter 1/);
    assert.match(result.errors[1].message, /Aktualparameter 2/);
});

test('scalar widening uses assignment rules, not strict type identity', () => {
    const result = analyze(`F: PROC(A FLOAT(55), B FIXED(31), C CHAR(10)) RETURNS(FIXED);
        RETURN(1); END;
        R: PROC RETURNS(FIXED); RETURN(F(3, 2, 'hi')); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('numeric and character narrowing are rejected', () => {
    const result = analyze(`F: PROC(A FLOAT(23), B FIXED(15), C CHAR(2)) RETURNS(FIXED);
        RETURN(1); END;
        R: PROC RETURNS(FIXED); RETURN(F(1.0(55), 3(31), 'abcd')); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('TYPE aliases are resolved only for comparing the actual parameter', () => {
    const result = analyze(`TYPE MyInt FIXED;
        F: PROC(X MyInt) RETURNS(FIXED); RETURN(X); END;
        R: PROC RETURNS(FIXED); RETURN(F(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /erwartet FIXED, erhalten FLOAT\(23\)/);
});

test('REF PROC call checks its scalar value parameter', () => {
    const result = analyze(`TYPE Fn REF PROC(FIXED) RETURNS(FIXED);
        DCL F Fn;
        R: PROC RETURNS(FIXED); RETURN(F(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
});

test('IDENT rejects values while context-dependent REF arguments remain deferred', () => {
    const result = analyze(`F: PROC(X FIXED IDENT) RETURNS(FIXED); RETURN(X); END;
        R: PROC RETURNS(FIXED); DCL P REF FIXED;
            RETURN(F(1.0) + F(P)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('formal names from grouped PROC parameters follow the argument positions', () => {
    const result = analyze(`F: PROC((A, B) FIXED, C CHAR(4)) RETURNS(FIXED);
        RETURN(A); END;
        R: PROC RETURNS(FIXED); RETURN(F(1.0, 2.0, 3)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('A'\) von 'F'/);
    assert.match(result.errors[1].message, /Aktualparameter 2 \('B'\) von 'F'/);
    assert.match(result.errors[2].message, /Aktualparameter 3 \('C'\) von 'F'/);
});

test('a named SPC ENTRY parameter is included when the procedure is external', () => {
    const result = analyze(`SPC External ENTRY(Arg FIXED) RETURNS(FIXED) GLOBAL;
        R: PROC RETURNS(FIXED); RETURN(External(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('Arg'\) von 'External'/);
});

test('a named REF PROC parameter survives a TYPE alias', () => {
    const result = analyze(`TYPE Fn REF PROC(Item FIXED) RETURNS(FIXED);
        TYPE Alias Fn;
        DCL F Alias;
        R: PROC RETURNS(FIXED); RETURN(F(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('Item'\) von 'F'/);
});

test('an unnamed REF PROC parameter keeps the numeric-only diagnostic', () => {
    const result = analyze(`TYPE Fn REF PROC(FIXED) RETURNS(FIXED);
        DCL F Fn;
        R: PROC RETURNS(FIXED); RETURN(F(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /^Aktualparameter 1 von 'F'/);
});

test('an explicitly named REF PROC parameter in DCL is included', () => {
    const result = analyze(`DCL G REF PROC(J FIXED) RETURNS(FIXED);
        R: PROC RETURNS(FIXED); RETURN(G(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('J'\) von 'G'/);
});

test('local SPC name is replaced by the corresponding PROC definition name', () => {
    const result = analyze(`SPC F ENTRY(SpecName FIXED) RETURNS(FIXED);
        F: PROC(DeclaredName FIXED) RETURNS(FIXED); RETURN(DeclaredName); END;
        R: PROC RETURNS(FIXED); RETURN(F(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('DeclaredName'\) von 'F'/);
});


test('documented SPC parameter names match Signature Help when source names are absent', () => {
    const result = analyze(`SPC External ENTRY(/* Count */ FIXED) RETURNS(FIXED) GLOBAL;
        R: PROC RETURNS(FIXED); RETURN(External(2.0)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('Count'\) von 'External'/);
});
