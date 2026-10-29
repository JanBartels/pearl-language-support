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
    const source = new FileSource('file:///diagnostic-named-structure-types.pearl',
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

test('CALL and function diagnostics preserve both declared STRUCT TYPE names', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        POther2: PROC(X HS); END;
        FOther2: PROC(X HS) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            DCL V Other;
            POther2(V);
            RETURN(FOther2(V));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch, mismatch]);
    for (const error of result.errors) {
        assert.match(error.message, /erwartet HS, erhalten Other\./);
        assert.doesNotMatch(error.message, /STRUCT\[\.\.\.\]/);
    }
});

test('REF parameter diagnostics retain named target types', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        P: PROC(X REF HS); END;
        R: PROC;
            DCL V REF Other;
            P(V);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
    assert.match(result.errors[0].message, /erwartet REF HS, erhalten REF Other\./);
});

test('array IDENT diagnostics retain their named element types', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        P: PROC(X() HS IDENT); END;
        R: PROC;
            DCL V(4) Other;
            P(V);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
    assert.match(result.errors[0].message, /VIRTUAL ARRAY\(rank 1\) OF HS/);
    assert.match(result.errors[0].message, /ARRAY\(1:4\) OF Other/);
});

test('anonymous STRUCT mismatch displays components without inventing TYPE names', () => {
    const result = analyze(`
        P: PROC(X STRUCT[E FIXED] IDENT); END;
        R: PROC;
            DCL V STRUCT[E FLOAT];
            P(V);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(e => e.code), [mismatch]);
    assert.match(result.errors[0].message, /erwartet STRUCT\[E FIXED\], erhalten STRUCT\[E FLOAT\]/);
});
