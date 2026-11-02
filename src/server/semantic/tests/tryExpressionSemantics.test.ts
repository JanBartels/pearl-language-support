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
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
import { TryExpressionNode } from '../../ast/problem/expressions/tryExpressionNode';

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(code: string) {
    const source = new FileSource('file:///try.pearl',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const expressions: TryExpressionNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.TryExpression) expressions.push(node as TryExpressionNode);
        for (const child of node.getChildren()) visit(child);
    }
    visit(root);
    return { semantic, expressions, syntax: problems.toArray().map(p => p.message) };
}

test('TRY accepts SEMA names, indices and structure components in BIT expressions', () => {
    const result = analyze(`DCL S SEMA; DCL A(3) SEMA;
        TYPE State STRUCT[Gate SEMA]; DCL V State;
        Main: TASK;
            IF TRY S THEN RELEASE S; FIN;
            IF TRY A(2) AND TRY V.Gate THEN RELEASE A(2); FIN;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.equal(result.expressions.length, 3);
    for (const expression of result.expressions) {
        assert.ok(expression.sema);
        assert.ok(result.semantic.bindings.has(expression.sema!.segments[0].identifier));
    }
});

test('TRY diagnoses a BOLT operand without misclassifying it as an unknown name', () => {
    const result = analyze(`DCL B BOLT; Main: TASK; IF TRY B THEN ENTER B; FIN; END;`);
    assert.deepEqual(result.syntax, []);
    assert.ok(result.semantic.diagnostics.some(d => d.code === SemanticDiagnosticCode.InvalidExpressionOperands));
    assert.ok(!result.semantic.diagnostics.some(d => d.code === SemanticDiagnosticCode.UnknownIdentifier));
});

test('TRY recovers when its name is missing', () => {
    const result = analyze(`DCL S SEMA; Main: TASK; IF TRY THEN RELEASE S; FIN; END;`);
    assert.ok(result.syntax.length > 0);
});
