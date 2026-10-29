// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstNode } from '../../../../ast/astNode';
import { CallStatementNode } from '../../../../ast/problem/statements/callStatementNode';
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
import { SymbolReferenceCollector } from '../../../../semantic/symbolReferenceCollector';
import { SymbolReferenceKind } from '../../../../semantic/symbolReference';
import { SymbolReferenceResolver } from '../../../../semantic/symbolReferenceResolver';
import { SymbolOccurrenceIndex } from '../../../../semantic/symbolOccurrenceIndex';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function parse(body: string, declarations = '') {
    const source = new FileSource('file:///implicit-call-test.pearl',
        `MODULE CallTest; PROBLEM; ${declarations}\nRunner: TASK;\n${body}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const calls: CallStatementNode[] = [];
    const labels: LabeledStatementNode[] = [];
    function visit(node: AstNode): void {
        if (node instanceof CallStatementNode) calls.push(node);
        if (node instanceof LabeledStatementNode) labels.push(node);
        for (const child of node.getChildren()) visit(child);
    }
    visit(ast);
    return { ast, calls, labels, problems: problems.toArray().map(p => p.message) };
}

test('explicit and implicit calls share CallStatementNode and preserve source tokens', () => {
    const result = parse(`CALL P(1); P(2, (3 + 4)); Q; Q();`);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['P', 'P', 'Q', 'Q']);
    assert.deepEqual(result.calls.map(c => c.keyword?.value), ['CALL', undefined, undefined, undefined]);
    assert.deepEqual(result.calls.map(c => c.argumentsList?.length), [1, 2, undefined, 0]);
    assert.deepEqual(result.calls[1].argumentsList?.[1].map(t => t.value), ['(', '3', '+', '4', ')']);
    assert.ok(result.calls[0].target?.location);
    assert.ok(result.calls[1].target?.location);
});

test('assignment targets, indexed variables and BIT/CHAR selectors are never calls', () => {
    const result = parse(`
        MyChar.CHAR(7) = '2';
        MyChar.CHARACTER(5) := 'A';
        MyBits.BIT(3) = '1'B;
        MyArray(7) = 2;
        MyArray(7).CHAR(2) = '3';
        MyArray(1, 2) := 4;
        RealCall(7);
    `);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['RealCall']);
});

test('assignment subscripts with incomplete content emit assignment, not CALL diagnostics', () => {
    const result = parse('MyArray(1,) = 2; MyChar.CHAR(7) = \'2\'; After;');
    assert.deepEqual(result.problems, ["Expected expression after ','."]);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['After']);
});

test('labels may prefix implicit calls, and a colon is never a call', () => {
    const result = parse('First: Second: P(1);');
    assert.deepEqual(result.problems, []);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].target?.value, 'P');
    assert.equal(result.labels.length, 1);
    assert.deepEqual(result.labels[0].labels.map(l => l.value), ['First', 'Second']);
});

test('implicit call resolves using existing semantic bindings and occurrence indices', () => {
    const result = parse('P(2); CALL P(1);', 'P: PROC(X FIXED); END;');
    assert.deepEqual(result.problems, []);
    assert.equal(result.calls.length, 2);
    const semantic = new SemanticAnalyzer().analyze(result.ast);
    const references = new SymbolReferenceCollector().collect(result.ast);
    assert.deepEqual(references.all.filter(r => r.kind === SymbolReferenceKind.Call)
        .map(r => r.identifier.value), ['P', 'P']);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    const callResolutions = resolutions.all.filter(r => r.reference.kind === SymbolReferenceKind.Call);
    assert.equal(callResolutions.length, 2);
    assert.ok(callResolutions.every(r => r.kind === 'bound'));
    const occurrences = new SymbolOccurrenceIndex(resolutions, semantic);
    assert.equal(occurrences.lookup(result.calls[0].target!)?.references.length, 2);
});

test('unknown procedure names remain available as unresolved references', () => {
    const result = parse('MissingProcedure(1);');
    assert.deepEqual(result.problems, []);
    const semantic = new SemanticAnalyzer().analyze(result.ast);
    const references = new SymbolReferenceCollector().collect(result.ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    assert.equal(resolutions.all.length, 1);
    assert.equal(resolutions.all[0].kind, 'unresolved');
});

test('malformed implicit parameter lists recover at the next statement', () => {
    const result = parse('Broken(1,); Good; Unclosed(1; Final;');
    assert.deepEqual(result.calls.map(c => c.target?.value),
        ['Broken', 'Good', 'Unclosed', 'Final']);
    assert.ok(result.problems.includes('Expected CALL argument after comma.'));
    assert.ok(result.problems.includes("Expected ')' after CALL arguments."));
});

test('a missing semicolon before END does not consume the enclosing body', () => {
    const result = parse('P(1)');
    assert.deepEqual(result.calls.map(c => c.target?.value), ['P']);
    assert.ok(result.problems.includes("Expected ';' after procedure call."));
});

test('GLOBAL SPC, REF PROC and RTOS-UH builtins use the existing resolution path', () => {
    const result = parse('External(1); ViaReference(2); SETPIX(1, 2, 3);',
        'SPC External ENTRY(FIXED) GLOBAL; DCL ViaReference REF PROC(FIXED);');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value),
        ['External', 'ViaReference', 'SETPIX']);
    const semantic = new SemanticAnalyzer().analyze(result.ast);
    const references = new SymbolReferenceCollector().collect(result.ast);
    const resolutions = new SymbolReferenceResolver().resolve(references, semantic);
    assert.deepEqual(resolutions.all.filter(r => r.reference.kind === SymbolReferenceKind.Call)
        .map(r => r.kind), ['bound', 'bound', 'builtin']);
});

test('simple scalar assignments are not implicit calls', () => {
    const result = parse('Value = 1; Other := 2; Proc;');
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.calls.map(c => c.target?.value), ['Proc']);
});
