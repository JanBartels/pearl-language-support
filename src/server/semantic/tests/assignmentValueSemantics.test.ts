// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(code: string) {
    const source = new FileSource('file:///assignment-values.pearl',
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
        source,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
    };
}

const mismatch = SemanticDiagnosticCode.InvalidAssignmentValueType;

test('FIXED widths, FLOAT widening and FLOAT-to-FIXED narrowing', () => {
    const r = analyze(`R: PROC;
        DCL Small FIXED(15), Wide FIXED(31), F FLOAT(31);
        Wide := Small;
        Small := Wide;
        F := Small;
        Small := F;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch, mismatch]);
    assert.match(r.errors[0].message, /erwartet FIXED\(15\), erhalten FIXED\(31\)/);
    assert.match(r.errors[1].message, /erwartet FIXED\(15\), erhalten FLOAT\(31\)/);
});

test('BIT narrowing remains invalid while CHAR assignments pad or truncate', () => {
    const r = analyze(`R: PROC;
        DCL B4 BIT(4), B8 BIT(8), C3 CHAR(3), C5 CHAR(5);
        B8 := B4;
        B4 := B8;
        C5 := C3;
        C3 := C5;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch]);
    assert.match(r.errors[0].message, /BIT\(4\).*BIT\(8\)/);
});

test('STRUCT assignment preserves exact component types and named diagnostics', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED]; TYPE Other STRUCT[E FLOAT];
        R: PROC;
            DCL Good HS, Bad Other;
            Good := Good;
            Good := Bad;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch]);
    assert.match(r.errors[0].message, /erwartet HS, erhalten Other/);
});

test('anonymous STRUCT assignment checks each component, without scalar widening', () => {
    const r = analyze(`R: PROC;
        DCL Left STRUCT[E FIXED], Right STRUCT[E FLOAT];
        Left := Right;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch]);
    assert.match(r.errors[0].message, /STRUCT\[E FIXED\].*STRUCT\[E FLOAT\]/);
});

test('array element assignment allowed but whole-array assignment prohibited', () => {
    const r = analyze(`R: PROC;
        DCL A(10) FIXED, B(10) FIXED;
        A(1) := B(2);
        A := B;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [SemanticDiagnosticCode.InvalidArrayAssignment]);
    assert.equal(r.errors[0].location.span.start, r.source.text.indexOf('A := B'));
});

test('value assignment to a structured array component uses the selected component type', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED, F FLOAT];
        R: PROC(I FIXED);
            DCL Records(10) HS;
            Records(I).E := 42;
            Records(I).E := 1.5;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch]);
});

test('REF actual is dereferenced for non-REF assignment targets', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL V HS, P REF HS INIT(V);
            DCL F FIXED, Rf REF FLOAT;
            V := P;
            F := Rf;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [mismatch]);
});

test('REF destination assignments remain deferred to 8.3d', () => {
    const r = analyze(`TYPE HS STRUCT[E FIXED];
        R: PROC;
            DCL V HS, P REF HS;
            P := V;
            P := NIL;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('invalid assignment target does not trigger secondary value diagnostic', () => {
    const r = analyze(`R: PROC;
        DCL X INV FIXED INIT(1);
        X := 1.5;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [SemanticDiagnosticCode.AssignmentToInvariant]);
});

test('invalid right operand retains original diagnostic without assignment cascade', () => {
    const r = analyze(`R: PROC;
        DCL A FIXED;
        A := Unknown;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(e => e.code), [SemanticDiagnosticCode.UnknownIdentifier]);
});
