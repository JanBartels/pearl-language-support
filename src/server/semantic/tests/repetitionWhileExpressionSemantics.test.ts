// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../ast/astNode';
import { RepetitionNode } from '../../ast/problem/statements/repetitionNode';
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
    const source = new FileSource('file:///repeat-while-typing.pearl',
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
    const repetitions: RepetitionNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof RepetitionNode) repetitions.push(node);
        for (const child of node.getChildren()) visit(child);
    };
    visit(root);
    return {
        source, root, repetitions, semantic,
        syntaxProblems: problems.toArray(),
        syntax: problems.toArray().map(p => p.message),
        codes: semantic.diagnostics.map(d => d.code).filter(code =>
            code !== SemanticDiagnosticCode.MissingProcessorSetting
            && code !== SemanticDiagnosticCode.MissingScModuleSize)
    };
}

test('WHILE comparison has typed BIT(1) AST and symbol bindings', () => {
    const r = analyze('WHILE I + 2*3 > 0 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const clause = r.repetitions[0].whileClause!;
    assert.ok(clause.expression instanceof DyadicExpressionNode);
    assert.equal(clause.expression.parent, clause);
    assert.deepEqual(r.semantic.expressionTypes.get(clause.expression),
        { kind: SemanticTypeKind.Bit, length: 1 });
    const at = r.source.text.indexOf('I + 2');
    const lookup = r.root.lookupSourceValue({uri: r.source.uri, offset: at});
    assert.equal(lookup?.element.value, 'I');
    assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind, SymbolKind.Parameter);
    assert.match(r.repetitions[0].headerText(), /WHILE\s+I\s*\+\s*2/);
});

test('WHILE numerical condition is rejected once', () => {
    const r = analyze('WHILE I + 1 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.InvalidWhileCondition]);
    const diagnostic = r.semantic.diagnostics.find(d =>
        d.code === SemanticDiagnosticCode.InvalidWhileCondition)!;
    assert.equal(diagnostic.location.span.start, r.source.text.indexOf('I + 1'));
});

test('WHILE BIT(2) is invalid, BIT(1) is valid and implicit BIT is deferred', () => {
    assert.deepEqual(analyze('DCL B BIT(2); WHILE B REPEAT END;').codes,
        [SemanticDiagnosticCode.InvalidWhileCondition]);
    assert.deepEqual(analyze('DCL B BIT(1); WHILE B REPEAT END;').codes, []);
    assert.deepEqual(analyze('DCL B BIT; WHILE B REPEAT END;').codes, []);
});

test('WHILE resolves implicit FOR variable before repetition body', () => {
    const r = analyze('FOR J FROM 1 TO 10 WHILE J < I REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const clause = r.repetitions[0].whileClause!;
    assert.ok(clause.expression);
    const at = r.source.text.indexOf('J < I');
    const lookup = r.root.lookupSourceValue({uri: r.source.uri, offset: at});
    assert.equal(lookup?.element.value, 'J');
    assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind,
        SymbolKind.LoopControlVariable);
    assert.ok(r.repetitions[0].fromClause?.expression);
    assert.ok(r.repetitions[0].toClause?.expression);
});

test('WHILE unknown names and array bounds use existing expression diagnostics', () => {
    const unknown = analyze('WHILE Missing > 0 REPEAT END;');
    assert.deepEqual(unknown.codes, [SemanticDiagnosticCode.UnknownIdentifier]);
    const bounds = analyze('DCL A(10) FIXED; WHILE A(11) > 0 REPEAT END;');
    assert.deepEqual(bounds.syntax, []);
    assert.deepEqual(bounds.codes, [SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
});

test('WHILE invalid assignment operators are diagnosed at the operator', () => {
    const r = analyze('WHILE I = 0 REPEAT RETURN; END;');
    assert.equal(r.syntax.length, 1);
    assert.match(r.syntax[0], /Operator '='.*nicht zulässig/);
    assert.equal(r.syntaxProblems[0].location.span.start, r.source.text.indexOf('I = 0') + 2);
    assert.equal(r.repetitions[0].whileClause?.expression, undefined);
    assert.deepEqual(r.codes, []);
    const nested = analyze('WHILE (I := 0) REPEAT END;');
    assert.equal(nested.syntax.length, 1);
    assert.match(nested.syntax[0], /Operator ':='/);
    assert.equal(nested.repetitions[0].whileClause?.expression, undefined);
});

test('WHILE equality operators remain accepted', () => {
    const r = analyze('WHILE I == 0 REPEAT END; WHILE I /= 0 REPEAT END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.ok(r.repetitions.every(n => n.whileClause?.expression instanceof DyadicExpressionNode));
});

test('incomplete WHILE expression emits syntax error without losing REPEAT', () => {
    const r = analyze('WHILE I + REPEAT RETURN; END; RETURN;');
    assert.deepEqual(r.syntax, ["Expected expression after '+'."]);
    assert.deepEqual(r.codes, []);
    assert.equal(r.repetitions[0].whileClause?.expression, undefined);
    assert.deepEqual(r.repetitions[0].whileClause?.expressionTokens.map(t => t.value), ['I','+']);
});

test('nested WHILE loops are separately typed and keep their scopes', () => {
    const r = analyze('WHILE I > 0 REPEAT WHILE I == 1 REPEAT RETURN; END; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.repetitions.length, 2);
    assert.ok(r.repetitions.every(n => n.whileClause?.expression));
});

test('WHILE and FIXED clauses can coexist; unconditional REPEAT remains valid', () => {
    const r = analyze('FOR J FROM 1 BY 2 TO 10 REPEAT RETURN; END; REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.repetitions.length, 2);
    assert.equal(r.repetitions[0].whileClause, undefined);
    assert.ok(r.repetitions[0].fromClause?.expression);
    assert.ok(r.repetitions[0].byClause?.expression);
    assert.ok(r.repetitions[0].toClause?.expression);
});
