// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { MonadicExpressionNode } from '../../ast/problem/expressions/monadicExpressionNode';
import { DyadicExpressionNode } from '../../ast/problem/expressions/dyadicExpressionNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
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
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///conversion-operator-semantics.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root);
    const returns: ReturnStatementNode[] = [];
    function walk(node: AstNode): void {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    }
    walk(root);
    return {
        semantic, returns,
        syntax: problems.toArray().map(problem => problem.message),
        errors: semantic.diagnostics.filter(diagnostic =>
            diagnostic.severity === SemanticDiagnosticSeverity.Error)
    };
}

test('TOFIXED follows RTOS-UH BIT(lg) -> FIXED(lg - 1) and CHAR(1) -> FIXED(7)', () => {
    const r = analyze(`R: PROC RETURNS(FIXED(31));
        RETURN(TOFIXED '1010'B); RETURN(TOFIXED 'A');
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const types = r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!));
    assert.deepEqual(types, [
        { kind: SemanticTypeKind.Fixed, precision: 3 },
        { kind: SemanticTypeKind.Fixed, precision: 7 }
    ]);
});

test('TOFLOAT retains FIXED precision, TOBIT includes the sign bit in RTOS-UH', () => {
    const r = analyze(`F: PROC RETURNS(FLOAT(31)); RETURN(TOFLOAT 3(31)); END;
        B: PROC RETURNS(BIT(32)); RETURN(TOBIT 3(31)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Float, precision: 31 },
        { kind: SemanticTypeKind.Bit, length: 32 }
    ]);
});

test('TOCHAR produces CHARACTER(1); ENTIER and ROUND produce FIXED(g)', () => {
    const r = analyze(`C: PROC RETURNS(CHAR(1)); RETURN(TOCHAR 65); END;
        E: PROC RETURNS(FIXED(31)); RETURN(ENTIER 2.5(31)); END;
        R: PROC RETURNS(FIXED(31)); RETURN(ROUND 2.5(31)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Character, length: 1 },
        { kind: SemanticTypeKind.Fixed, precision: 31 },
        { kind: SemanticTypeKind.Fixed, precision: 31 }
    ]);
});

test('conversion operators report invalid operand types at the operator', () => {
    const r = analyze(`R: PROC RETURNS(FIXED(31));
        RETURN(TOCHAR 'A'); RETURN(TOBIT 1.5); RETURN(ROUND 1);
        RETURN(ENTIER 'A'); RETURN(TOFLOAT 'A'); RETURN(TOFIXED 'ABC');
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code),
        Array(6).fill(SemanticDiagnosticCode.InvalidExpressionOperands));
    assert.deepEqual(r.errors.map(d => d.location.source.getText(d.location.span)),
        ['TOCHAR', 'TOBIT', 'ROUND', 'ENTIER', 'TOFLOAT', 'TOFIXED']);
});

test('FIT takes FIXED precision from its right operand', () => {
    const r = analyze(`R: PROC(A FIXED(31), B FIXED(15)) RETURNS(FIXED(31));
        RETURN(A FIT B); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const expression = r.returns[0].expression;
    assert.ok(expression instanceof DyadicExpressionNode);
    assert.deepEqual(r.semantic.expressionTypes.get(expression),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('FIT takes FLOAT precision from its right operand', () => {
    const r = analyze(`R: PROC(A FLOAT(55), B FLOAT(23)) RETURNS(FLOAT(55));
        RETURN(A FIT B); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!),
        { kind: SemanticTypeKind.Float, precision: 23 });
});

test('FIT requires two FIXED or two FLOAT operands', () => {
    const r = analyze(`R: PROC RETURNS(FIXED); RETURN(1 FIT 1.0); RETURN('A' FIT 1); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidExpressionOperands, SemanticDiagnosticCode.InvalidExpressionOperands]);
    assert.ok(r.errors.every(d => d.location.source.getText(d.location.span) === 'FIT'));
});

test('nested conversions are typed recursively without changing the AST', () => {
    const r = analyze(`R: PROC RETURNS(FIXED(31)); RETURN(TOFIXED (TOBIT 7(31))); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const expression = r.returns[0].expression;
    assert.ok(expression instanceof MonadicExpressionNode);
    assert.deepEqual(r.semantic.expressionTypes.get(expression),
        { kind: SemanticTypeKind.Fixed, precision: 31 });
});

test('explicit TYPE aliases are resolved for FIT and conversion operands', () => {
    const r = analyze(`TYPE Number FIXED(31);
        R: PROC(A Number) RETURNS(FLOAT(31)); RETURN(TOFLOAT (A FIT A)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.semantic.expressionTypes.get(r.returns[0].expression!),
        { kind: SemanticTypeKind.Float, precision: 31 });
});

test('unspecified declaration precisions remain unspecified in conversion results', () => {
    const r = analyze(`R: PROC(A FIXED, B FIXED) RETURNS(FLOAT(31));
        RETURN(TOFLOAT A); RETURN(TOFLOAT (A FIT B)); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Float, precision: undefined },
        { kind: SemanticTypeKind.Float, precision: undefined }
    ]);
});

test('REF operand conversion is deferred until contextual dereferencing is implemented', () => {
    const r = analyze(`R: PROC(P REF FIXED) RETURNS(FIXED); RETURN(TOBIT P); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('conversions and FIT work through the existing IF and FOR expression integration', () => {
    const r = analyze(`R: PROC;
        DCL B BIT(8), X FIXED(31), Y FIXED(15);
        FOR I FROM TOFIXED B TO (X FIT Y)
            WHILE TOBIT 1(1) == '1'B
        REPEAT RETURN; END;
        IF TOFLOAT Y > 1.0 THEN RETURN; FIN;
    END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});

test('declared BIT and CHAR types are converted without inserting default lengths', () => {
    const r = analyze(`DCL Bits BIT(8), Letter CHAR(1);
        R: PROC RETURNS(FIXED(31));
            RETURN(TOFIXED Bits); RETURN(TOFIXED Letter);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Fixed, precision: 7 },
        { kind: SemanticTypeKind.Fixed, precision: 7 }
    ]);
});

test('RTOS-UH sign bit is included in TOBIT and excluded in TOFIXED', () => {
    const r = analyze(`DCL F15 FIXED(15), F31 FIXED(31), B16 BIT(16), B32 BIT(32);
        A: PROC RETURNS(BIT(32)); RETURN(TOBIT F15); RETURN(TOBIT F31); END;
        B: PROC RETURNS(FIXED(31)); RETURN(TOFIXED B16); RETURN(TOFIXED B32); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Bit, length: 16 },
        { kind: SemanticTypeKind.Bit, length: 32 },
        { kind: SemanticTypeKind.Fixed, precision: 15 },
        { kind: SemanticTypeKind.Fixed, precision: 31 }
    ]);
});

test('unspecified lengths remain unspecified in TOBIT and TOFIXED', () => {
    const r = analyze(`A: PROC(V FIXED) RETURNS(BIT(32)); RETURN(TOBIT V); END;
        B: PROC(V BIT) RETURNS(FIXED(31)); RETURN(TOFIXED V); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.returns.map(ret => r.semantic.expressionTypes.get(ret.expression!)), [
        { kind: SemanticTypeKind.Bit, length: undefined },
        { kind: SemanticTypeKind.Fixed, precision: undefined }
    ]);
});

test('TOFIXED does not produce the invalid type FIXED(0) from BIT(1)', () => {
    const r = analyze(`R: PROC RETURNS(FIXED); RETURN(TOFIXED '1'B); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidExpressionOperands]);
    assert.equal(r.errors[0].location.source.getText(r.errors[0].location.span), 'TOFIXED');
});
