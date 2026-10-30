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
    const source = new FileSource('file:///ident-actual-parameters.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const errors = semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error);
    return { syntax: problems.toArray().map(p => p.message), errors, source };
}

const definitions = `
    P: PROC(A FIXED IDENT, B FIXED);
    END;
    F: PROC(A FIXED IDENT) RETURNS(FIXED);
        RETURN(A);
    END;
`;

test('CALL and expression function enforce IDENT object requirement equally', () => {
    const result = analyze(`${definitions}
        R: PROC;
            DCL V FIXED;
            P(V+1, 2);
            CALL P(2, 3);
            IF F(V+1) == 1 THEN RETURN; FIN;
        END;`);
    // Assignment is not implemented yet; parser may preserve it as an opaque statement.
    assert.deepEqual(result.errors.map(d => d.code), [
        SemanticDiagnosticCode.InvalidIdentificationArgument,
        SemanticDiagnosticCode.InvalidIdentificationArgument,
        SemanticDiagnosticCode.InvalidIdentificationArgument
    ]);
    assert.ok(result.errors.every(d => /IDENT/.test(d.message)));
    assert.match(result.errors[0].message, /Aktualparameter 1 \('A'\)/);
});

test('simple names, structure members and array elements are IDENT objects', () => {
    const result = analyze(`${definitions}
        R: PROC;
            DCL V FIXED;
            DCL S STRUCT[Z FIXED];
            DCL Arr(10) FIXED;
            P(V, 1);
            P(S.Z, 1);
            P(Arr(2), 1);
            IF F(S.Z) == 2 THEN RETURN; FIN;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('IDENT requires exact scalar type rather than numeric widening', () => {
    const result = analyze(`P: PROC(A FLOAT(55) IDENT); END;
        R: PROC; DCL V FLOAT(23); P(V); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
});

test('ordinary CALL value arguments still use scalar widening and reject narrowing', () => {
    const result = analyze(`P: PROC(A FLOAT(55), B FIXED(15)); END;
        R: PROC; P(1, 2.0); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArgumentType]);
});

test('builtin MID FIXED positions accept value expressions and literals', () => {
    const result = analyze(`R: PROC RETURNS(FIXED);
        DCL Text CHAR(10);
        DCL Start FIXED;
        DCL Finish FIXED;
        RETURN(LEN(MID(Text, 2, 4)));
        RETURN(LEN(MID(Text, Start + 1, Finish)));
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('reference and complex parameter passing is not mislabeled as IDENT scalar failure', () => {
    const result = analyze(`TYPE HS STRUCT[E FIXED];
        P: PROC(A HS IDENT); END;
        R: PROC; DCL V HS; P(V); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('built-in CALL with IDENT uses the same object classification', () => {
    const result = analyze(`R: PROC;
        DCL Color FIXED;
        GETPIX(1, 2, Color);
        CALL GETPIX(1, 2, 3);
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
    assert.match(result.errors[0].message, /Aktualparameter 3 \('Farbe'\)/);
});

test('a REF PROC signature uses IDENT even through a TYPE alias', () => {
    const result = analyze(`TYPE Callback REF PROC(X FIXED IDENT) RETURNS(FIXED);
        R: PROC RETURNS(FIXED);
            DCL Handler Callback;
            DCL X FIXED;
            RETURN(Handler(X) + Handler(X + 1));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});

test('NIL cannot serve as an IDENT argument even without an inferred scalar type', () => {
    const result = analyze(`F: PROC(X FIXED IDENT) RETURNS(FIXED);
        RETURN(X); END;
        R: PROC RETURNS(FIXED); RETURN(F(NIL)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidIdentificationArgument]);
});
