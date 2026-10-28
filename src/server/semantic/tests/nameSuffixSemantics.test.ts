// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { ReturnStatementNode } from '../../ast/problem/statements/returnStatementNode';
import { NameExpressionNode } from '../../ast/problem/expressions/nameExpressionNode';
import { DyadicExpressionNode } from '../../ast/problem/expressions/dyadicExpressionNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode, SemanticDiagnosticSeverity } from '../semanticDiagnostic';
import { SemanticTypeKind } from '../semanticType';
import { SymbolKind } from '../symbolKind';
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
    const source = new FileSource('file:///name-suffix.pearl',
        `MODULE M; PROBLEM; ${body} MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
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
        semantic,
        returns,
        errors: semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error),
        syntax: problems.toArray().map(p => p.message)
    };
}

const header = `DCL A(10) FIXED;
    F: PROC(I FIXED) RETURNS(FIXED);
       RETURN(I);
    END;
`;

test('A(I) and F(I) have identical syntax and semantic result types', () => {
    const result = analyze(`${header}
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(A(I) + F(I));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const sum = result.returns[1].expression;
    assert.ok(sum instanceof DyadicExpressionNode);
    assert.ok(sum.left instanceof NameExpressionNode);
    assert.ok(sum.right instanceof NameExpressionNode);
    assert.equal(sum.left.segments[0].suffix?.expressions.length, 1);
    assert.equal(sum.right.segments[0].suffix?.expressions.length, 1);
    assert.deepEqual(result.semantic.expressionTypes.get(sum.left),
        { kind: SemanticTypeKind.Fixed, precision: undefined });
    assert.deepEqual(result.semantic.expressionTypes.get(sum.right),
        { kind: SemanticTypeKind.Fixed, precision: undefined });
    assert.deepEqual(result.semantic.expressionTypes.get(sum),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
    assert.equal(result.semantic.bindings.get(sum.left.segments[0].identifier)?.kind,
        SymbolKind.DataObject);
    assert.equal(result.semantic.bindings.get(sum.right.segments[0].identifier)?.kind,
        SymbolKind.Procedure);
    const leftIndex = sum.left.segments[0].suffix!.expressions[0] as NameExpressionNode;
    const rightArg = sum.right.segments[0].suffix!.expressions[0] as NameExpressionNode;
    assert.equal(result.semantic.bindings.get(leftIndex.segments[0].identifier)?.kind,
        SymbolKind.Parameter);
    assert.equal(result.semantic.bindings.get(rightArg.segments[0].identifier)?.kind,
        SymbolKind.Parameter);
});

test('nested function argument and array index are recursively analyzed', () => {
    const result = analyze(`${header}
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(F(A(I + 1)));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[1].expression!)?.kind,
        SemanticTypeKind.Fixed);
});

test('a two-dimensional array accepts exactly two FIXED indices', () => {
    const result = analyze(`DCL A(2,3) FIXED;
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(A(I, 2));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[0].expression!)?.kind,
        SemanticTypeKind.Fixed);
});

test('array rank mismatch produces one diagnostic and no return cascade', () => {
    const result = analyze(`${header}
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(A(I, 2));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidArrayIndexCount]);
});

test('array index must be FIXED, not CHAR', () => {
    const result = analyze(`${header}
        R: PROC RETURNS(FIXED);
            RETURN(A('bad'));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidArrayIndexType]);
});

test('function arity mismatch uses existing CALL arity diagnostic', () => {
    const result = analyze(`${header}
        R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(F(I, 2));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidCallArity]);
});

test('a scalar cannot be indexed or called', () => {
    const result = analyze(`R: PROC(I FIXED) RETURNS(FIXED);
            RETURN(I(2));
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidNameSuffix]);
});

test('parameterless function allows both F and F()', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); RETURN(1); END;
        R: PROC RETURNS(FIXED); RETURN(F + F()); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[1].expression!)?.kind,
        SemanticTypeKind.Fixed);
});

test('subprogram cannot be used as a function expression', () => {
    const result = analyze(`P: PROC(I FIXED); END;
        R: PROC RETURNS(FIXED); RETURN(P(1)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidFunctionExpression]);
});

test('an unknown index argument still gets its own binding diagnosis', () => {
    const result = analyze(`DCL A(10) FIXED;
        R: PROC RETURNS(FIXED); RETURN(A(Missing)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.UnknownIdentifier]);
});

test('TYPE alias to array retains declared type while indexing uses element type', () => {
    const result = analyze(`TYPE Vector(10) FIXED;
        DCL A Vector;
        R: PROC(I FIXED) RETURNS(FIXED); RETURN(A(I)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.semantic.expressionTypes.get(result.returns[0].expression!),
        { kind: SemanticTypeKind.Fixed, precision: undefined });
});

test('virtual array formal parameter can be indexed with its declared rank', () => {
    const result = analyze(`R: PROC(A(,) FIXED IDENT, I FIXED, J FIXED) RETURNS(FIXED);
        RETURN(A(I,J)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[0].expression!)?.kind,
        SemanticTypeKind.Fixed);
});

test('REF PROC result is recognized after resolving a named target', () => {
    const result = analyze(`TYPE FunctionRef REF PROC(FIXED) RETURNS(FIXED);
        DCL F FunctionRef;
        R: PROC(I FIXED) RETURNS(FIXED); RETURN(F(I)); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.semantic.expressionTypes.get(result.returns[0].expression!)?.kind,
        SemanticTypeKind.Fixed);
});
