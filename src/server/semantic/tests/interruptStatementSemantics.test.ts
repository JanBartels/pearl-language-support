// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { InterruptStatementNode } from '../../ast/problem/statements/interruptStatementNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
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

function analyze(body: string, declarations = '') {
    const source = new FileSource('file:///interrupt-semantics.P',
        `P=MPC603; SC=2000; MODULE M; SYSTEM; Alarm: EV(00000001); PROBLEM;
         SPC Alarm INTERRUPT; DCL Value FIXED; ${declarations}
         Worker: TASK; END; Runner: TASK MAIN; ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast, context.activeBlockComments);
    const statements: InterruptStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof InterruptStatementNode) statements.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    return { statements, semantic,
        syntax: problems.toArray().map(problem => problem.message),
        codes: semantic.diagnostics.map(problem => problem.code) };
}

test('all three operations bind their interrupt operand to its SPC/SYSTEM object', () => {
    const r = analyze(`ENABLE Alarm; DISABLE Alarm; TRIGGER Alarm; WHEN Alarm ACTIVATE Worker;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.statements.length, 3);
    for (const statement of r.statements) {
        const name = statement.interrupt!.segments[0].identifier;
        assert.equal(r.semantic.bindings.get(name)?.kind, SymbolKind.DataObject);
        assert.equal(r.semantic.bindings.get(name)?.name.value, 'Alarm');
    }
});

test('wrong operand types and TASK names produce dedicated semantic diagnostics', () => {
    const r = analyze(`ENABLE Value; DISABLE Worker; TRIGGER Value;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.InvalidInterruptOperand));
});

test('unknown names report only the existing UnknownIdentifier diagnostic', () => {
    const r = analyze(`ENABLE Missing1; DISABLE Missing2; TRIGGER Missing3;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.UnknownIdentifier));
});

test('malformed statements keep independent diagnostics and following bindings', () => {
    const r = analyze(`ENABLE; DISABLE Value; TRIGGER Alarm;`);
    assert.equal(r.syntax.filter(message => /Expected interrupt name/.test(message)).length, 1);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidInterruptOperand]);
    assert.equal(r.semantic.bindings.get(r.statements[2].interrupt!.segments[0].identifier)?.name.value, 'Alarm');
});
