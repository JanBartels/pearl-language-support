// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { SemaSetStatementNode } from '../../ast/problem/statements/semaSetStatementNode';
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

const logger: Logger = { info() {}, warn() {}, error() {} };
function analyze(code: string) {
    const source = new FileSource('file:///synchronization.pearl',
        `P=MPC603; SC=2000; MODULE M; PROBLEM; ${code} MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root, context.activeBlockComments);
    const statements: SemaSetStatementNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.SemaSetStatement) {
            statements.push(node as SemaSetStatementNode);
        }
        for (const child of node.getChildren()) visit(child);
    }
    visit(root);
    return { statements, semantic, syntax: problems.toArray().map(problem => problem.message) };
}

test('SEMASET accepts FIXED(15) expressions and SEMA components', () => {
    const result = analyze(`DCL S SEMA; DCL N FIXED(15); TYPE ST STRUCT[Lock SEMA]; DCL V ST;
        Main: TASK; SEMASET N + 1, S; SEMASET 2, V.Lock; END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements.length, 2);
    assert.deepEqual(result.semantic.diagnostics, []);
    assert.ok(result.semantic.bindings.has(result.statements[0].sema!.segments[0].identifier));
});

test('SEMASET rejects non-FIXED(15) value and non-SEMA object', () => {
    const result = analyze(`DCL S SEMA; DCL B BOLT; DCL N FIXED(31);
        Main: TASK; SEMASET N, B; END;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.semantic.diagnostics.map(d => d.code), [
        SemanticDiagnosticCode.InvalidSemaSetValue,
        SemanticDiagnosticCode.InvalidSynchronizationOperand
    ]);
});

test('SEMASET recovers after missing value operand', () => {
    const result = analyze(`DCL S SEMA; Main: TASK; SEMASET , S; RELEASE S; END;`);
    assert.ok(result.syntax.length > 0);
});
