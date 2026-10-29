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
    const source = new FileSource('file:///complex-ident-actual-parameters.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
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

const mismatch = SemanticDiagnosticCode.InvalidCallArgumentType;

test('STRUCT IDENT checks types for CALL and expression functions', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        P: PROC(X HS IDENT); END;
        F: PROC(X HS IDENT) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            DCL Good HS;
            DCL Bad Other;
            P(Good);
            P(Bad);
            RETURN(F(Good) + F(Bad));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch, mismatch]);
    assert.ok(result.errors.every(d => /Aktualparameter 1 \('X'\)/.test(d.message)));
});

test('virtual IDENT arrays match rank and element type, not concrete bounds', () => {
    const result = analyze(`
        P1: PROC(A() FIXED IDENT); END;
        P2: PROC(A(,) FIXED IDENT); END;
        R: PROC;
            DCL One(-4:7) FIXED;
            DCL Two(2:4,5:9) FIXED;
            DCL Floats(10) FLOAT;
            P1(One);
            P2(Two);
            P1(Two);
            P2(One);
            P1(Floats);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch, mismatch, mismatch]);
    assert.match(result.errors[0].message, /VIRTUAL ARRAY\(rank 1\) OF FIXED/);
    assert.match(result.errors[0].message, /ARRAY\(2:4, 5:9\) OF FIXED/);
});

test('virtual IDENT arrays also accept another virtual array of the same rank', () => {
    const result = analyze(`
        P: PROC(A() FIXED IDENT); END;
        R: PROC(A() FIXED IDENT); P(A); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('virtual array IDENT checks the component type even for STRUCT element aliases', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        P: PROC(A() HS IDENT); END;
        R: PROC;
            DCL Good(3) HS;
            DCL Bad(3) Other;
            P(Good);
            P(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
});

test('structure IDENT accepts STRUCT members and array elements as objects', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        P: PROC(X HS IDENT); END;
        R: PROC(I FIXED);
            DCL Parent STRUCT[Item HS];
            DCL Records(3) HS;
            P(Parent.Item);
            P(Records(I));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('INV protection remains effective for complex IDENT actual parameters', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        Change: PROC(X HS IDENT); END;
        Inspect: PROC(X INV HS IDENT); END;
        R: PROC;
            DCL Frozen INV HS INIT(1);
            DCL Mutable HS;
            Change(Frozen);
            Inspect(Frozen);
            Inspect(Mutable);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('DATION ALPHIC IDENT without direction still accepts any matching direction', () => {
    const result = analyze(`
        SPC Device ENTRY(DATION ALPHIC IDENT) GLOBAL;
        SPC Text DATION INOUT ALPHIC GLOBAL;
        R: PROC; Device(Text); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});


test('SPC ENTRY uses the same virtual-array IDENT type check', () => {
    const result = analyze(`
        SPC External ENTRY(A() FIXED IDENT) GLOBAL;
        R: PROC;
            DCL Good(4) FIXED;
            DCL Bad(4) FLOAT;
            External(Good);
            External(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
});

test('REF PROC function calls use the same complex IDENT rules', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        TYPE Handler REF PROC(X HS IDENT) RETURNS(FIXED);
        R: PROC RETURNS(FIXED);
            DCL F Handler;
            DCL Good HS;
            DCL Bad Other;
            RETURN(F(Good) + F(Bad));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
});
