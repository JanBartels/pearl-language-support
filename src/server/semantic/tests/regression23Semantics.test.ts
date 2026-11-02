// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { TokenKind, type Token } from '../../lexer/token';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { CompilerControlAnalyzer } from '../compilerControlAnalyzer';
import { collectBlockComments } from '../../validation/analysis';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///Regression23.P',
        `P=MPC603; SC=2000; MODULE Regression23; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const tokenStream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const tokens: Token[] = [];
    for (;;) {
        const token = tokenStream.current();
        tokens.push(token);
        if (token.kind === TokenKind.EOF) break;
        tokenStream.next();
    }
    const ast = new Parser(Preprocessor.create(new Lexer(source, new ProblemCollection(), logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), new ProblemCollection(), [],
        new PreprocessorConditionalBlockCollection(), logger), problems, logger).parse();
    const semantics = new SemanticAnalyzer().analyze(ast);
    return { source, ast, semantics, syntax: problems.toArray().map(problem => problem.message),
        errors: semantics.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error)
            .map(d => d.message),
        compiler: new CompilerControlAnalyzer().analyze(ast, collectBlockComments(tokens), semantics)
            .map(d => d.message) };
}

const cases = [
    ['Reg1 ROUND yields FIXED(15)', `Reg1: PROC; DCL RX FIXED; RX = ROUND(42 / 47.11) + 1; END;`],
    ['Reg2 FIXED division yields default FLOAT', `Reg2: PROC; DCL F FLOAT; F = 1(31) / 10; END;`],
    ['Reg3 FIT after ROUND', `Reg3: PROC; DCL F FLOAT; DCL X FIXED(31); X = ROUND(F) FIT 1(31); END;`],
    ['Reg4 direct procedure address', `TYPE Callback REF PROC RETURNS(BIT);
        Reg4GP: PROC(CB Callback) GLOBAL; END;
        Reg4CB: PROC RETURNS(BIT); RETURN('0'B); END;
        Reg4: PROC; Reg4GP(Reg4CB); END;`],
    ['Reg5 TOFIXED BIT(1)', `SPC Reg5P PROC(FIXED, CHAR(4)) GLOBAL;
        Reg5: PROC; DCL B_1 BIT(1), B BIT;
            Reg5P(3, TOCHAR(TOFIXED(B)));
            Reg5P(3, TOCHAR(TOFIXED(B_1)));
        END;`],
    ['Reg6 BIT truncation', `Reg6: PROC; DCL B16 BIT(16), B32 BIT(32); B16 = B32; END;`],
    ['Reg7 generic REF source', `Reg7: PROC;
        DCL V REF STRUCT[], C REF CHAR(255), X REF FIXED;
        C = V; X = V; END;`],
    ['Reg9 INSTR literal', `Reg9: PROC; DCL X REF FIXED, C REF CHAR(255);
        X = INSTR(C, 1, 4, '1234', 1, 4); END;`],
    ['Reg10 precision of array bounds', `TYPE T STRUCT[Klein(128) CHAR, Gross(100000) CHAR];
        Reg10: PROC; DCL P REF T, X15 FIXED, X31 FIXED(31);
            X15 = 1 UPB P.Klein; X31 = 1 UPB P.Gross; END;`],
    ['Reg11 total array assignment', `Reg11: PROC; DCL (A,B)(128) CHAR; A = B; END;`],
    ['Reg12 +G in header', `Reg12: PROC /*+G*/ GLOBAL; END;`]
] as const;

for (const [name, code] of cases) {
    test(name, () => {
        const result = analyze(code);
        assert.deepEqual(result.syntax, [], `syntax: ${name}`);
        assert.deepEqual(result.errors, [], `semantic: ${name}`);
        assert.deepEqual(result.compiler, [], `compiler comments: ${name}`);
    });
}

test('REF PROC rejects wrong result types without confusing return value and address', () => {
    const result = analyze(`TYPE CB REF PROC RETURNS(BIT);
        Handler: PROC(CBArg CB); END;
        Wrong: PROC RETURNS(FIXED); RETURN(1); END;
        Main: PROC; Handler(Wrong); END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.errors.some(message => message.includes('Handler') && message.includes('CB')),
        JSON.stringify(result.errors));
});

test('REF PROC with parameters rejects mismatched procedure signatures', () => {
    const result = analyze(`TYPE CB REF PROC(FIXED) RETURNS(BIT);
        Handler: PROC(CBArg CB); END;
        Wrong: PROC RETURNS(BIT); RETURN('0'B); END;
        Main: PROC; Handler(Wrong); END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.errors.some(message => message.includes('Handler')),
        JSON.stringify(result.errors));
});

test('incompatible total array assignments remain an error', () => {
    const result = analyze(`Bad: PROC; DCL A(128) CHAR, B(127) CHAR; A = B; END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.errors.some(message => message.includes('Zuweisung')),
        JSON.stringify(result.errors));
});

test('SHIFT negative distance requires parentheses; positive distance does not', () => {
    const valid = analyze(`S: PROC; DCL B BIT(8); B = B SHIFT 2; B = B SHIFT (-2); END;`);
    assert.deepEqual(valid.syntax, []);
    const invalid = analyze(`S: PROC; DCL B BIT(8); B = B SHIFT -2; END;`);
    assert.ok(invalid.syntax.some(message => message.includes('SHIFT')));
});

test('REF PROC assignment accepts a direct procedure address', () => {
    const result = analyze(`TYPE CB REF PROC RETURNS(BIT);
        DCL Slot CB;
        Good: PROC RETURNS(BIT); RETURN('1'B); END;
        Main: PROC; Slot = Good; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});

test('REF PROC assignment rejects different return signature', () => {
    const result = analyze(`TYPE CB REF PROC RETURNS(BIT);
        DCL Slot CB;
        Wrong: PROC RETURNS(BIT(2)); RETURN('11'B); END;
        Main: PROC; Slot = Wrong; END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.errors.some(message => message.includes('Slot') || message.includes('Zuweisung')),
        JSON.stringify(result.errors));
});


test('FIXED and FLOAT assignments reject mismatching widths while BIT and CHAR adapt', () => {
    const result = analyze(`R: PROC;
        DCL I15 FIXED, I31 FIXED(31), F23 FLOAT, F31 FLOAT(31);
        DCL B8 BIT(8), B16 BIT(16), C3 CHAR(3), C6 CHAR(6);
        I15 = I31; I31 = I15;
        F23 = F31; F31 = F23;
        I15 = I31 FIT I15; I31 = I15 FIT I31;
        F23 = F31 FIT F23; F31 = F23 FIT F31;
        B8 = B16; B16 = B8;
        C3 = C6; C6 = C3;
    END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.errors.length, 4, JSON.stringify(result.errors));
    assert.ok(result.errors.every(message => message.startsWith('Zuweisung:')),
        JSON.stringify(result.errors));
});
