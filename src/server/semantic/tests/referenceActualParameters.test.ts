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
    const source = new FileSource('file:///reference-actual-parameters.pearl',
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
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

const prefix = `
TYPE HS STRUCT[E FIXED];
DCL V HS;
DCL Protected INV HS INIT(42);
DCL Ptr REF HS;
DCL ConstPtr REF INV HS;
DCL VoidPtr REF STRUCT[];
DCL ConstVoidPtr REF INV STRUCT[];
`;

test('REF STRUCT[] by value accepts object addresses and compatible reference variables', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF STRUCT[]); END;
        R: PROC;
            P(V);
            P(Ptr);
            P(VoidPtr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('REF STRUCT[] must not discard INV protection from objects or pointers', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF STRUCT[]); END;
        R: PROC;
            P(Protected);
            P(ConstPtr);
            P(ConstVoidPtr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('REF INV STRUCT[] permits read-only and writable objects and references', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF INV STRUCT[]); END;
        R: PROC;
            P(V);
            P(Protected);
            P(Ptr);
            P(ConstPtr);
            P(VoidPtr);
            P(ConstVoidPtr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('REF by value requires a reference or address-producing object, not an ordinary value', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF STRUCT[]); END;
        R: PROC;
            P(42);
            P(V.E + 1);
            P(NIL);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('REF IDENT requires a reference object, not the address of an ordinary object', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF STRUCT[] IDENT); END;
        R: PROC;
            P(VoidPtr);
            P(V);
            P(NIL);
            P(42);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidIdentificationArgument,
        SemanticDiagnosticCode.InvalidIdentificationArgument,
        SemanticDiagnosticCode.InvalidIdentificationArgument
    ]);
});

test('REF STRUCT[] IDENT accepts writable typed refs but preserves INV protection', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF STRUCT[] IDENT); END;
        R: PROC;
            P(VoidPtr);
            P(ConstVoidPtr);
            P(Ptr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('CDL accepts a TYPE alias of REF PROC through REF STRUCT[] IDENT', () => {
    const result = analyze(`
        SPC CDL PROC(CHAR(1) IDENT, REF STRUCT[] IDENT) GLOBAL;
        TYPE TFunc REF PROC(FLOAT IDENT) RETURNS(BIT);
        CDLTest: PROC;
            DCL Func TFunc INIT(NIL);
            DCL Name CHAR(4);
            CDL(Name.CHAR(1), Func);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('typed REF by value checks target types and target INV, including aliases', () => {
    const result = analyze(`${prefix}
        TYPE MyRef REF HS;
        P: PROC(X MyRef); END;
        R: PROC;
            DCL Wrong FIXED;
            P(V);
            P(Ptr);
            P(Protected);
            P(ConstPtr);
            P(Wrong);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('function expressions and CALL use the same REF parameter rules', () => {
    const result = analyze(`${prefix}
        F: PROC(X REF INV STRUCT[]) RETURNS(FIXED); RETURN(1); END;
        G: PROC(X REF STRUCT[]) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            RETURN(F(ConstPtr) + G(ConstPtr));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('structure components and array elements retain owner protection for REF passing', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        DCL H STRUCT[Part HS, Ptr REF INV HS];
        DCL Stable INV HS INIT(7);
        DCL Values(3) HS;
        DCL RefToStable REF INV HS INIT(Stable);
        RW: PROC(X REF HS); END;
        RO: PROC(X REF INV HS); END;
        R: PROC;
            RW(H.Part);
            RW(Values(1));
            RW(RefToStable.E);
            RW(H.Ptr);
            RO(RefToStable.E);
            RO(H.Ptr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('INV on a pointer variable is independent from REF INV target protection', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        DCL V HS;
        DCL FrozenPtr INV REF HS INIT(V);
        P: PROC(X REF HS); END;
        R: PROC; P(FrozenPtr); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('REF parameter metadata is applied identically through REF PROC callable TYPE', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        TYPE Handler REF PROC(X REF STRUCT[]) RETURNS(FIXED);
        DCL F Handler;
        DCL R REF INV HS;
        T: PROC RETURNS(FIXED); RETURN(F(R)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType
    ]);
});

test('REF INV STRUCT[] IDENT still requires a reference variable of that exact type', () => {
    const result = analyze(`${prefix}
        P: PROC(X REF INV STRUCT[] IDENT); END;
        R: PROC;
            P(ConstVoidPtr);
            P(VoidPtr);
            P(ConstPtr);
            P(Protected);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidCallArgumentType,
        SemanticDiagnosticCode.InvalidIdentificationArgument
    ]);
});

test('external SPC ENTRY uses shared REF compatibility rules and helpful diagnostics', () => {
    const result = analyze(`${prefix}
        SPC External ENTRY(Arg REF STRUCT[]) GLOBAL;
        R: PROC; External(ConstPtr); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [SemanticDiagnosticCode.InvalidCallArgumentType]);
    assert.match(result.errors[0].message, /Aktualparameter 1 \('Arg'\)/);
    assert.match(result.errors[0].message, /REF STRUCT\[\]/);
    assert.match(result.errors[0].message, /REF INV/);
});
