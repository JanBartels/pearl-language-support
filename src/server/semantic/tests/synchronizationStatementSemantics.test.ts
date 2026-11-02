// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { AstKind } from '../../ast/astKind';
import { SynchronizationStatementNode } from '../../ast/problem/statements/synchronizationStatementNode';
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
    const statements: SynchronizationStatementNode[] = [];
    function visit(node: AstNode): void {
        if (node.kind === AstKind.SynchronizationStatement) {
            statements.push(node as SynchronizationStatementNode);
        }
        for (const child of node.getChildren()) visit(child);
    }
    visit(root);
    return { statements, semantic, syntax: problems.toArray().map(problem => problem.message) };
}

test('all synchronization statements accept matching SEMA/BOLT operands', () => {
    const result = analyze(`DCL S SEMA; DCL B BOLT;
        Main: TASK;
            REQUEST S; RELEASE S; ENTER B; LEAVE B; RESERVE B; FREE B;
        END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements.length, 6);
    assert.deepEqual(result.semantic.diagnostics, []);
    for (const statement of result.statements) {
        assert.ok(result.semantic.bindings.has(statement.operands[0].segments[0].identifier));
    }
});

test('operand lists resolve each name and reject mismatched types', () => {
    const result = analyze(`DCL S SEMA; DCL B BOLT;
        Main: TASK; REQUEST S, B; ENTER B, S; END;`);
    assert.deepEqual(result.syntax, []);
    assert.equal(result.statements.length, 2);
    assert.deepEqual(result.semantic.diagnostics.map(d => d.code), [
        SemanticDiagnosticCode.InvalidSynchronizationOperand,
        SemanticDiagnosticCode.InvalidSynchronizationOperand
    ]);
});

test('missing list operand recovers at semicolon', () => {
    const result = analyze(`DCL S SEMA; Main: TASK; REQUEST S,; RELEASE S; END;`);
    assert.ok(result.syntax.length > 0);
    assert.equal(result.statements.length, 2);
});
