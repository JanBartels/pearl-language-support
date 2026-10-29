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

function analyze(body: string) {
    const source = new FileSource('file:///nil-comparison.pearl',
        `MODULE M; PROBLEM; TYPE HS STRUCT[E FIXED]; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(),
        source, context, problems, [], new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    return { source, semantic, syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error) };
}

test('STRUCT == NIL reports invalid operands at the operator, not an IF condition error', () => {
    const r = analyze(`HP: PROC(Param HS);
        IF Param.E == 42 THEN RETURN; FIN;
        IF Param == NIL THEN ; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidExpressionOperands]);
    assert.equal(r.source.text.slice(r.errors[0].location.span.start,
        r.errors[0].location.span.end), '==');
});

test('REF IS NIL / ISNT NIL (and NIL IS REF) are valid reference comparisons', () => {
    const r = analyze(`DCL P REF HS;
        HP: PROC;
            IF P IS NIL THEN RETURN; FIN;
            IF P ISNT (NIL) THEN RETURN; FIN;
            IF NIL IS P THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('ordinary equality with NIL is invalid even for references or with parentheses', () => {
    const r = analyze(`DCL P REF HS;
        HP: PROC;
            IF P == NIL THEN RETURN; FIN;
            IF (NIL) /= P THEN RETURN; FIN;
            IF NIL == NIL THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands
    ]);
});

test('IS NIL requires another reference operand', () => {
    const r = analyze(`HP: PROC(Param HS);
        IF Param IS NIL THEN RETURN; FIN;
        IF NIL IS NIL THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands
    ]);
});

test('unknown comparison operand does not cause a duplicate NIL error', () => {
    const r = analyze(`HP: PROC; IF Missing IS NIL THEN RETURN; FIN; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.UnknownIdentifier]);
});


test('IS and ISNT reject operands when neither is a reference (including STRUCT members)', () => {
    const r = analyze(`HP: PROC(Param HS);
        IF Param.E IS 42 THEN RETURN; FIN;
        IF Param.E ISNT Param.E THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands
    ]);
    assert.deepEqual(r.errors.map(d => r.source.text.slice(d.location.span.start, d.location.span.end)),
        ['IS', 'ISNT']);
});

test('IS and ISNT accept pointer-pointer and pointer-object comparisons', () => {
    const r = analyze(`DCL P REF HS, Q REF HS, V HS;
        HP: PROC;
            IF P IS Q THEN RETURN; FIN;
            IF P IS V THEN RETURN; FIN;
            IF V ISNT P THEN RETURN; FIN;
            IF P IS (V) THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('IS and ISNT reject a pointer compared to a computed value or literal', () => {
    const r = analyze(`DCL P REF FIXED, V FIXED;
        HP: PROC;
            IF P IS 42 THEN RETURN; FIN;
            IF P IS (V + 1) THEN RETURN; FIN;
            IF 3 ISNT P THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands,
        SemanticDiagnosticCode.InvalidExpressionOperands
    ]);
});

test('IS permits object addresses obtained from array and structure selection', () => {
    const r = analyze(`DCL P REF FIXED, A(10) FIXED, V HS;
        HP: PROC;
            IF P IS A(2) THEN RETURN; FIN;
            IF V.E ISNT P THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('IS does not mistake a function result for an addressable object', () => {
    const r = analyze(`DCL P REF FIXED;
        F: PROC RETURNS(FIXED); RETURN(1); END;
        HP: PROC;
            IF P IS F() THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidExpressionOperands]);
});

test('mixed REF/STRUCT comparisons in a single procedure report every invalid operator', () => {
    const r = analyze(`HP: PROC(Param HS);
        DCL P REF HS;
        IF Param.E == 42 THEN RETURN; FIN;
        IF Param == NIL THEN ; FIN;
        IF Param ISNT NIL THEN ; FIN;
        IF Param.E IS 42 THEN ; FIN;
        IF P == 42 THEN ; FIN;
        IF P IS 42 THEN ; FIN;
        IF P IS NIL THEN ; FIN;
        IF P IS Param THEN ; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), Array(5).fill(
        SemanticDiagnosticCode.InvalidExpressionOperands));
    assert.deepEqual(r.errors.map(d => r.source.text.slice(d.location.span.start, d.location.span.end)),
        ['==', 'ISNT', 'IS', '==', 'IS']);
});

test('typed REF FIXED is dereferenced for an ordinary value comparison', () => {
    const r = analyze(`DCL F REF FIXED;
        HP: PROC;
            IF F == 42 THEN RETURN; FIN;
            IF F < 42 THEN RETURN; FIN;
            IF F == 'X' THEN RETURN; FIN;
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidExpressionOperands]);
    assert.equal(r.source.text.slice(r.errors[0].location.span.start,
        r.errors[0].location.span.end), '==');
});
