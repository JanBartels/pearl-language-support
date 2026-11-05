// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AstNode } from '../../../../ast/astNode';
import { CaseStatementNode } from '../../../../ast/problem/statements/caseStatementNode';
import { LabeledStatementNode } from '../../../../ast/problem/statements/labeledStatementNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { SemanticAnalyzer } from '../../../../semantic/semanticAnalyzer';
import { SemanticDiagnosticSeverity } from '../../../../semantic/semanticDiagnostic';
import { SymbolReferenceCollector } from '../../../../semantic/symbolReferenceCollector';
import { SymbolReferenceResolver } from '../../../../semantic/symbolReferenceResolver';
import { SymbolReferenceKind } from '../../../../semantic/symbolReference';
import { SymbolKind } from '../../../../semantic/symbolKind';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(body: string) {
    const source = new FileSource('file:///case-boundary-label.P',
        `P=MPC603; SC=2000; MODULE CaseLabel; PROBLEM;
        Run: PROC;
            DCL FixedVar FIXED;
            ${body}
        END;
        MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const references = new SymbolReferenceCollector().collect(ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const cases: CaseStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof CaseStatementNode) cases.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    return { source, ast, problems: problems.toArray().map(p => p.message),
        semantic, resolutions, cases };
}

test('label immediately before the next ALT remains valid and does not consume ALT', () => {
    const r = analyze(`CASE FixedVar
        ALT
            RETURN;
        GotoMarke:
        ALT
            RETURN;
        FIN;`);
    assert.deepEqual(r.problems, []);
    assert.equal(r.cases.length, 1);
    assert.equal(r.cases[0].alternatives.length, 2);
    const first = r.cases[0].alternatives[0];
    const last = first.body[first.body.length - 1];
    assert.ok(last instanceof LabeledStatementNode);
    assert.equal(last.statement, undefined);
    assert.deepEqual(last.labels.map(l => l.value), ['GotoMarke']);
    const offset = r.source.text.indexOf('GotoMarke:');
    const lookup = r.ast.lookupSourceValue({ uri: r.source.uri, offset });
    assert.equal(lookup?.element, last.labels[0]);
    assert.equal(lookup?.node, last);
    assert.equal(r.semantic.bindings.get(last.labels[0])?.kind, SymbolKind.Label);
    assert.deepEqual(r.semantic.diagnostics
        .filter(d => d.severity === SemanticDiagnosticSeverity.Error)
        .map(d => d.message), []);
});

test('a GOTO resolves to a label just before the following ALT', () => {
    const r = analyze(`CASE FixedVar
        ALT
            GOTO GotoMarke;
        GotoMarke:
        ALT
            RETURN;
        FIN;`);
    assert.deepEqual(r.problems, []);
    const jump = r.resolutions.all.find(reference =>
        reference.reference.kind === SymbolReferenceKind.JumpTarget
        && reference.reference.identifier.value === 'GotoMarke');
    assert.equal(jump?.kind, 'bound');
    if (jump?.kind === 'bound') {
        assert.equal(jump.symbol.kind, SymbolKind.Label);
        assert.equal(jump.declaration.value, 'GotoMarke');
        assert.equal(r.resolutions.referencesOf(jump.declaration).length, 1);
    }
});

test('a label before OUT preserves the OUT branch', () => {
    const r = analyze(`CASE FixedVar ALT RETURN; Ende: OUT RETURN; FIN;`);
    assert.deepEqual(r.problems, []);
    assert.equal(r.cases[0].alternatives.length, 1);
    assert.ok(r.cases[0].outClause);
    const last = r.cases[0].alternatives[0].body.at(-1);
    assert.ok(last instanceof LabeledStatementNode);
    assert.equal(last.statement, undefined);
});
