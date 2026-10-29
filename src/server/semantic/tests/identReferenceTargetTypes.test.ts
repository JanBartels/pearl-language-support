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
    const source = new FileSource('file:///ident-reference-target-types.pearl',
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
const protection = SemanticDiagnosticCode.InvalidIdentificationArgument;

test('a non-REF STRUCT IDENT formal checks the target type of a REF actual', () => {
    const result = analyze(`
        TYPE HS2 STRUCT[E FIXED];
        TYPE Other2 STRUCT[E FLOAT];
        POther2: PROC(X HS2 IDENT); END;
        ROther2: PROC;
            DCL LGood HS2;
            DCL LBad Other2;
            DCL LRefGood REF HS2;
            DCL LRefBad REF Other2;
            POther2(LGood);
            POther2(LBad);
            POther2(LRefGood);
            POther2(LRefBad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch, mismatch]);
    assert.match(result.errors[0].message, /erwartet HS2, erhalten Other2/);
    assert.match(result.errors[1].message, /erwartet HS2, erhalten REF Other2/);
});

test('function calls share IDENT target type validation with CALL', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        F: PROC(X HS IDENT) RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED);
            DCL Good REF HS;
            DCL Bad REF Other;
            RETURN(F(Good) + F(Bad));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
    assert.match(result.errors[0].message, /erwartet HS, erhalten REF Other/);
});

test('IDENT through REF respects target protection, not INV on the pointer variable', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        P: PROC(X HS IDENT); END;
        Q: PROC(X INV HS IDENT); END;
        R: PROC;
            DCL V HS;
            DCL Mutable REF HS;
            DCL FrozenPointer INV REF HS INIT(V);
            DCL FrozenTarget REF INV HS;
            P(Mutable);
            P(FrozenPointer);
            P(FrozenTarget);
            Q(FrozenTarget);
            Q(FrozenPointer);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [protection]);
    assert.match(result.errors[0].message, /INV-geschuetzt|INV-geschützt/);
});

test('a non-REF IDENT formal rejects untyped VOID references', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        P: PROC(X HS IDENT); END;
        R: PROC;
            DCL Ptr REF STRUCT[];
            P(Ptr);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
});

test('REF target comparison also resolves a TYPE alias of the reference', () => {
    const result = analyze(`
        TYPE HS STRUCT[E FIXED];
        TYPE Other STRUCT[E FLOAT];
        TYPE PtrHS REF HS;
        TYPE PtrOther REF Other;
        P: PROC(X HS IDENT); END;
        R: PROC;
            DCL Good PtrHS;
            DCL Bad PtrOther;
            P(Good);
            P(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
    assert.match(result.errors[0].message, /erwartet HS, erhalten/);
});

test('scalar IDENT also rejects REF with an incompatible target type', () => {
    const result = analyze(`
        P: PROC(X FIXED IDENT); END;
        R: PROC;
            DCL Good REF FIXED;
            DCL Bad REF FLOAT;
            P(Good);
            P(Bad);
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code), [mismatch]);
});
