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

function analyze(body: string, prelude = '') {
    const source = new FileSource('file:///repeat-fixed-clauses.pearl',
        `MODULE M; PROBLEM; ${prelude} R: PROC(I FIXED); ${body} END; MODEND;`);
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


test('FROM/BY/TO expressions are typed FIXED and bind names with original source locations', () => {
    const r = analyze('FOR J FROM I + 1 BY I*2 TO I + 100 WHILE J < I REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    const loop = r.repetitions[0];
    for (const clause of [loop.fromClause!, loop.byClause!, loop.toClause!]) {
        assert.ok(clause.expression instanceof DyadicExpressionNode);
        assert.equal(clause.expression.parent, clause);
        assert.equal(r.semantic.expressionTypes.get(clause.expression)?.kind, SemanticTypeKind.Fixed);
    }
    for (const label of ['I + 1', 'I*2', 'I + 100']) {
        const at = r.source.text.indexOf(label);
        const lookup = r.root.lookupSourceValue({uri:r.source.uri, offset: at});
        assert.equal(lookup?.element.value, 'I');
        assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind, SymbolKind.Parameter);
    }
    const at = r.source.text.indexOf('J < I');
    const j = r.root.lookupSourceValue({uri: r.source.uri, offset: at});
    assert.equal(r.semantic.bindings.get(j!.element as any)?.kind, SymbolKind.LoopControlVariable);
});

test('FROM, BY, TO reject non-FIXED expression types at the argument position', () => {
    const r = analyze("DCL B BIT(1); FOR J FROM 1.5 BY 'A' TO B REPEAT RETURN; END;");
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.InvalidRepetitionFixedExpression));
    for (const [index, token] of ['1.5', "'A'", 'B REPEAT'].entries()) {
        const diagnostic = r.semantic.diagnostics.find(d =>
            d.code === SemanticDiagnosticCode.InvalidRepetitionFixedExpression
            && d.message.includes(['FROM', 'BY', 'TO'][index]))!;
        assert.ok(diagnostic);
        assert.equal(diagnostic.location.span.start, r.source.text.indexOf(token));
        assert.match(diagnostic.message, /FIXED/);
    }
});

test('different FIXED precisions are permitted (no forced FIXED(15))', () => {
    const r = analyze('DCL X FIXED(31); FOR J FROM X BY 2 TO 100(31) REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.semantic.expressionTypes.get(r.repetitions[0].fromClause!.expression!)?.kind,
        SemanticTypeKind.Fixed);
});

test('loop control variable cannot be used in FROM, BY or TO but is valid in WHILE', () => {
    const r = analyze('FOR J FROM J BY J TO J WHILE J > 0 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, Array(3).fill(SemanticDiagnosticCode.UnknownIdentifier));
    const at = r.source.text.indexOf('J > 0');
    const lookup = r.root.lookupSourceValue({uri:r.source.uri, offset:at});
    assert.equal(r.semantic.bindings.get(lookup!.element as any)?.kind,
        SymbolKind.LoopControlVariable);
});

test('a known constant array index out of bounds is checked inside FROM and TO', () => {
    const r = analyze('DCL A(10) FIXED; FOR J FROM A(11) TO A(0) REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, [SemanticDiagnosticCode.ConstantIndexOutOfBounds,
        SemanticDiagnosticCode.ConstantIndexOutOfBounds]);
});

test('BY 0 stays valid (no unsupported semantic step-size constraint)', () => {
    const r = analyze('FOR J FROM -2 BY 0 TO 10 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('FROM/BY/TO are valid without an explicit FOR variable', () => {
    const r = analyze('FROM I BY 1 TO I + 10 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.ok(r.repetitions[0].fromClause?.expression);
    assert.ok(r.repetitions[0].toClause?.expression);
});

test('unambiguous assignment operators are diagnosed in FROM and BY', () => {
    const r = analyze('FOR J FROM I = 0 BY (I := 1) TO 10 REPEAT RETURN; END;');
    assert.equal(r.syntax.length, 2);
    assert.match(r.syntax[0], /Operator '='.*nicht zulässig/);
    assert.match(r.syntax[1], /Operator ':='.*nicht zulässig/);
    assert.equal(r.repetitions[0].fromClause?.expression, undefined);
    assert.equal(r.repetitions[0].byClause?.expression, undefined);
    assert.ok(r.repetitions[0].toClause?.expression);
});

test('unrecognized incomplete BY expression is preserved as source tokens', () => {
    const r = analyze('FOR J FROM 1 BY I + TO 10 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.deepEqual(r.repetitions[0].byClause?.expressionTokens.map(t => t.value), ['I', '+']);
    assert.equal(r.repetitions[0].byClause?.expression, undefined);
    assert.ok(r.repetitions[0].toClause?.expression);
});

test('reference types are not prematurely diagnosed without contextual dereference support', () => {
    const r = analyze('DCL Ptr REF FIXED; FOR J FROM Ptr TO 10 REPEAT RETURN; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
});

test('nested FOR loops keep their independent control variables', () => {
    const r = analyze('FOR J FROM 1 TO 2 REPEAT FOR K FROM I TO J WHILE K < J '
        + 'REPEAT RETURN; END; END;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.codes, []);
    assert.equal(r.repetitions.length, 2);
    assert.ok(r.repetitions[1].toClause?.expression);
});

test('FROM and TO can contain typed function calls and nested argument diagnostics', () => {
    const prelude = 'F: PROC(X FIXED) RETURNS(FIXED); RETURN(X); END;';
    const ok = analyze('FOR J FROM F(I) BY 1 TO F(10) REPEAT RETURN; END;', prelude);
    assert.deepEqual(ok.syntax, []);
    assert.deepEqual(ok.codes, []);
    const invalid = analyze('FOR J FROM F(I*1.0) TO F(10) REPEAT RETURN; END;', prelude);
    assert.deepEqual(invalid.syntax, []);
    assert.deepEqual(invalid.codes, [SemanticDiagnosticCode.InvalidCallArgumentType]);
});
