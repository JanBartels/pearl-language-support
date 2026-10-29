// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { IfStatementNode } from '../../ast/problem/statements/ifStatementNode';
import { DyadicExpressionNode } from '../../ast/problem/expressions/dyadicExpressionNode';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SemanticDiagnosticCode } from '../semanticDiagnostic';
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
    const source = new FileSource('file:///if-typing.pearl',
        `MODULE M; PROBLEM; R: PROC(I FIXED); ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const root = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(root);
    const statements: IfStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof IfStatementNode) statements.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(root);
    return { source, root, statements, semantic,
        syntaxProblems: problems.toArray(),
        syntax: problems.toArray().map(p => p.message),
        codes: semantic.diagnostics.map(d => d.code).filter(code =>
            code !== SemanticDiagnosticCode.MissingProcessorSetting
            && code !== SemanticDiagnosticCode.MissingScModuleSize) };
}

test('IF comparison is a typed BIT(1) child and resolves names', () => {
    const result = analyze(`IF I + 2*3 > 0 THEN RETURN; ELSE RETURN; FIN;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.codes, []);
    const statement = result.statements[0];
    assert.ok(statement.condition instanceof DyadicExpressionNode);
    assert.equal(statement.condition.parent, statement);
    assert.deepEqual(result.semantic.expressionTypes.get(statement.condition),
        { kind: SemanticTypeKind.Bit, length: 1 });
    const tokenOffset = result.source.text.indexOf('I + 2');
    const lookup = result.root.lookupSourceValue({uri: result.source.uri, offset: tokenOffset});
    assert.equal(lookup?.element.value, 'I');
    assert.equal(result.semantic.bindings.get(lookup!.element as any)?.kind, SymbolKind.Parameter);
    assert.match(statement.conditionText(), /I\s*\+\s*2/);
});

test('IF numerical condition is rejected once, while body is still analyzed', () => {
    const result = analyze(`IF I + 1 THEN RETURN; FIN;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.codes, [SemanticDiagnosticCode.InvalidIfCondition]);
    const diagnosis = result.semantic.diagnostics.find(d =>
        d.code === SemanticDiagnosticCode.InvalidIfCondition)!;
    assert.equal(diagnosis.location.span.start, result.source.text.indexOf('I + 1'));
});

test('IF BIT(2) is invalid, BIT(1) is valid, and unsized BIT stays deferred', () => {
    const invalid = analyze(`DCL B BIT(2); IF B THEN RETURN; FIN;`);
    assert.deepEqual(invalid.codes, [SemanticDiagnosticCode.InvalidIfCondition]);
    const valid = analyze(`DCL B BIT(1); IF B THEN RETURN; FIN;`);
    assert.deepEqual(valid.codes, []);
    const implicit = analyze(`DCL B BIT; IF B THEN RETURN; FIN;`);
    assert.deepEqual(implicit.codes, []);
});

test('unknown symbols are diagnosed in IF conditions', () => {
    const result = analyze(`IF Unknown == 2 THEN RETURN; FIN;`);
    assert.deepEqual(result.codes, [SemanticDiagnosticCode.UnknownIdentifier]);
});

test('incomplete IF header reports expression syntax without consuming THEN', () => {
    const result = analyze(`IF I + THEN RETURN; FIN; RETURN;`);
    assert.deepEqual(result.syntax, ["Expected expression after '+'."]);
    assert.equal(result.statements.length, 1);
    assert.equal(result.statements[0].condition, undefined);
    assert.deepEqual(result.codes, []);
});

test('nested IF condition analyses and body RETURN remain available', () => {
    const result = analyze(`IF I > 1 THEN IF I == 3 THEN RETURN; FIN; FIN;`);
    assert.deepEqual(result.codes, []);
    assert.equal(result.statements.length, 2);
    assert.ok(result.statements.every(s => s.condition));
});

test('array index diagnostics also work inside IF conditions without a second type error', () => {
    const result = analyze(`DCL A(10) FIXED; IF A(11) > 0 THEN RETURN; FIN;`);
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.codes, [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
    assert.ok(result.statements[0].condition);
});


test('IF assignment operator = is a syntax error at the operator, not silent fallback', () => {
    const result = analyze('IF I = 0 THEN RETURN; FIN; RETURN;');
    assert.equal(result.syntax.length, 1);
    assert.match(result.syntax[0], /Operator '='.*nicht zulässig.*'=='/);
    assert.equal(result.syntaxProblems[0].location.span.start,
        result.source.text.indexOf('I = 0') + 2);
    assert.equal(result.syntaxProblems[0].location.span.end,
        result.source.text.indexOf('I = 0') + 3);
    assert.equal(result.statements[0].condition, undefined);
    assert.deepEqual(result.codes, []);
});

test('IF rejects nested = and := but preserves subsequent statements', () => {
    const nested = analyze('IF (I = 0) THEN RETURN; FIN;');
    assert.equal(nested.syntax.length, 1);
    assert.match(nested.syntax[0], /Operator '='/);
    assert.equal(nested.syntaxProblems[0].location.span.start,
        nested.source.text.indexOf('I = 0') + 2);

    const assignment = analyze('IF I := 0 THEN RETURN; FIN;');
    assert.equal(assignment.syntax.length, 1);
    assert.match(assignment.syntax[0], /Operator ':='/);
    assert.equal(assignment.syntaxProblems[0].location.span.start,
        assignment.source.text.indexOf('I := 0') + 2);
});

test('IF == and /= remain valid comparisons without syntax errors', () => {
    const result = analyze('IF I == 0 THEN RETURN; FIN; IF I /= 0 THEN RETURN; FIN;');
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.codes, []);
    assert.ok(result.statements.every(s => s.condition instanceof DyadicExpressionNode));
});

test('IF quoted equal sign does not trigger an operator diagnostic', () => {
    const result = analyze("IF '=' == '=' THEN RETURN; FIN;");
    assert.deepEqual(result.syntax, []);
    assert.deepEqual(result.codes, []);
    assert.ok(result.statements[0].condition);
});
