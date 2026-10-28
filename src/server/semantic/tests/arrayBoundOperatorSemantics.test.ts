// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { RepetitionNode } from '../../ast/problem/statements/repetitionNode';
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
    const source = new FileSource('file:///array-bound-ops.pearl', `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const stream = Preprocessor.create(new Lexer(source, problems, logger).tokenize(), source,
        new PreprocessorContext({} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
            new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root);
    const returns: ReturnStatementNode[] = [];
    const repetitions: RepetitionNode[] = [];
    function walk(node: AstNode): void {
        if (node instanceof ReturnStatementNode) returns.push(node);
        if (node instanceof RepetitionNode) repetitions.push(node);
        for (const child of node.getChildren()) walk(child);
    }
    walk(root);
    return { source, root, semantic, returns, repetitions,
        syntax: problems.toArray().map(p => p.message),
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error) };
}

const expectFixed = (type: any, precision: number) =>
    assert.deepEqual(type, { kind: SemanticTypeKind.Fixed, precision });

test('monadic LWB/UPB determine FIXED(31) for known array bounds in RETURN', () => {
    const result = analyze(`DCL A(-2:5, 3:9) FIXED;
        R: PROC RETURNS(FIXED(31)); RETURN(LWB A + UPB A); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const sum = result.returns[0].expression as DyadicExpressionNode;
    assert.ok(sum.left instanceof MonadicExpressionNode);
    assert.ok(sum.right instanceof MonadicExpressionNode);
    expectFixed(result.semantic.expressionTypes.get(sum.left), 31);
    expectFixed(result.semantic.expressionTypes.get(sum.right), 31);
    expectFixed(result.semantic.expressionTypes.get(sum), 31);
});

test('dyadic LWB/UPB select any valid dimension and can be used in FOR', () => {
    const r = analyze(`DCL A(-2:5, 3:9) FIXED;
        R: PROC; FOR J FROM 2 LWB A TO 2 UPB A REPEAT RETURN; END; END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    const loop = r.repetitions[0];
    assert.ok(loop.fromClause?.expression instanceof DyadicExpressionNode);
    assert.ok(loop.toClause?.expression instanceof DyadicExpressionNode);
    expectFixed(r.semantic.expressionTypes.get(loop.fromClause!.expression!), 31);
    expectFixed(r.semantic.expressionTypes.get(loop.toClause!.expression!), 31);
});

test('a named INV FIXED dimension can select a dimension of a TYPE alias array', () => {
    const r = analyze(`TYPE T FIXED; DCL Dim INV FIXED INIT(2), A(5,10) T;
        R: PROC RETURNS(FIXED(31)); RETURN(Dim UPB A); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    expectFixed(r.semantic.expressionTypes.get(r.returns[0].expression!), 31);
});

test('only constant dimensions outside 1:rank cause a dimension diagnostic', () => {
    const r = analyze(`DCL A(5,10) FIXED;
        R: PROC RETURNS(FIXED(31));
            RETURN(3 UPB A); RETURN(0 LWB A); RETURN((-1) UPB A);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), Array(3).fill(SemanticDiagnosticCode.InvalidArrayBoundDimension));
    assert.ok(r.errors.every(d => /1:2/.test(d.message)));
    assert.deepEqual(r.errors.map(d => d.location.source.getText(d.location.span)), ['3', '0', '(']);
});

test('dynamic FIXED dimension is valid and its value is not guessed', () => {
    const r = analyze(`DCL A(5,10) FIXED;
        R: PROC(I FIXED) RETURNS(FIXED(31)); RETURN(I LWB A); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    expectFixed(r.semantic.expressionTypes.get(r.returns[0].expression!), 31);
});

test('a virtual array has a known rank but unknown bounds', () => {
    const ok = analyze(`R: PROC(A(,) FIXED IDENT) RETURNS(FIXED(31)); RETURN(2 UPB A); END;`);
    assert.deepEqual(ok.syntax, []);
    assert.deepEqual(ok.errors, []);
    expectFixed(ok.semantic.expressionTypes.get(ok.returns[0].expression!), 31);
    const bad = analyze(`R: PROC(A(,) FIXED IDENT) RETURNS(FIXED(31)); RETURN(3 LWB A); END;`);
    assert.deepEqual(bad.syntax, []);
    assert.deepEqual(bad.errors.map(d => d.code), [SemanticDiagnosticCode.InvalidArrayBoundDimension]);
});

test('nonarray operands and non-FIXED dimensions are diagnosed on operator', () => {
    const r = analyze(`DCL A(10) FIXED, X FIXED, C CHAR(5), B BIT(8);
        R: PROC RETURNS(FIXED(31));
            RETURN(LWB X); RETURN(UPB B); RETURN(1.5 LWB A);
            RETURN(2 UPB C); RETURN(LWB C);
        END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors.map(d => d.code), Array(5).fill(SemanticDiagnosticCode.InvalidExpressionOperands));
    assert.ok(r.errors.every(d => /Operandentypen/.test(d.message)));
});

test('monadic UPB of CHAR has the distinct FIXED(15) result required by report', () => {
    const r = analyze(`DCL C CHAR(10);
        R: PROC RETURNS(FIXED); RETURN(UPB C); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
    expectFixed(r.semantic.expressionTypes.get(r.returns[0].expression!), 15);
});

test('REF array operands remain deferred pending contextual dereference support', () => {
    const r = analyze(`DCL A(10) FIXED, P REF FIXED;
        R: PROC RETURNS(FIXED(31)); RETURN(UPB P); END;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.errors, []);
});
