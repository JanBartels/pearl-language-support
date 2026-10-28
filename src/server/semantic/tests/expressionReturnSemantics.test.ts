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
    const source = new FileSource('file:///expression-typing.pearl',
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
    const walk = (node: AstNode): void => {
        if (node instanceof ReturnStatementNode) returns.push(node);
        for (const child of node.getChildren()) walk(child);
    };
    walk(root);
    const errors = semantic.diagnostics.filter(d => d.severity === SemanticDiagnosticSeverity.Error);
    return { semantic, returns, errors, syntax: problems.toArray().map(p => p.message) };
}

test('formal parameter A is bound and A + 2*3 has FIXED(15) type', () => {
    const result = analyze(`RetTest: PROC(A FIXED) RETURNS(FIXED);
        RETURN(A + 2*3); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const sum = result.returns[0].expression;
    assert.ok(sum instanceof DyadicExpressionNode);
    assert.equal(sum.operator.value, '+');
    assert.equal(result.semantic.expressionTypes.get(sum)?.kind, SemanticTypeKind.Fixed);
    assert.deepEqual(result.semantic.expressionTypes.get(sum),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
    assert.ok(sum.left instanceof NameExpressionNode);
    const binding = result.semantic.bindings.get(sum.left.segments[0].identifier);
    assert.equal(binding?.kind, SymbolKind.Parameter);
    assert.equal(binding?.name.value, 'A');
    assert.deepEqual(result.semantic.expressionTypes.get(sum.right!),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('return with FLOAT expression in FIXED procedure is rejected', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); RETURN(1.5 + 2); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidReturnType]);
});

test('invalid mixed arithmetic is reported at the operator, without return type cascade', () => {
    const result = analyze(`F: PROC(A FIXED) RETURNS(FIXED); RETURN(A + 'text'); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidExpressionOperands]);
    assert.equal(result.errors[0].location !== undefined, true);
});

test('unresolved name in expression produces a single diagnostic', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); RETURN(Missing + 2); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.UnknownIdentifier]);
});

test('numeric precision widening is allowed and narrowing is rejected', () => {
    const good = analyze(`F: PROC(A FIXED(15)) RETURNS(FIXED(31)); RETURN(A); END;`);
    assert.deepEqual(good.syntax, []);
    assert.deepEqual(good.errors, []);
    const bad = analyze(`F: PROC(A FIXED(31)) RETURNS(FIXED(15)); RETURN(A); END;`);
    assert.deepEqual(bad.syntax, []);
    assert.deepEqual(bad.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidReturnType]);
});

test('TYPE aliases resolve without modifying the AST or replacing the binding type', () => {
    const result = analyze(`TYPE IntType FIXED;
        F: PROC(A IntType) RETURNS(IntType); RETURN(A*3); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
    const expression = result.returns[0].expression!;
    assert.deepEqual(result.semantic.expressionTypes.get(expression),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('expression results survive SemanticContext.withAdditionalDiagnostics()', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); RETURN(4); END;`);
    const cloned = result.semantic.withAdditionalDiagnostics([{
        code: SemanticDiagnosticCode.InvalidReturnType,
        location: result.returns[0].keyword.location!,
        severity: SemanticDiagnosticSeverity.Warning,
        message: 'test'
    }]);
    const expression = result.returns[0].expression!;
    assert.deepEqual(cloned.expressionTypes.get(expression),
        { kind: SemanticTypeKind.Fixed, precision: 15 });
});

test('return inside a nested block uses enclosing procedure result type', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); BEGIN RETURN('wrong'); END; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors.map(d => d.code),
        [SemanticDiagnosticCode.InvalidReturnType]);
});

test('REF arithmetic and RETURN do not produce premature diagnostics before contextual dereferencing', () => {
    const result = analyze(`F: PROC RETURNS(FIXED); DCL P REF FIXED; RETURN(P + 1); END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.errors, []);
});
