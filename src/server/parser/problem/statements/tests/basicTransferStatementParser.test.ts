// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../../../ast/astNode';
import { BasicTransferStatementNode } from '../../../../ast/problem/statements/basicTransferStatementNode';
import { ProblemCollection } from '../../../../core/problemCollection';
import { Lexer } from '../../../../lexer/lexer';
import { Parser } from '../../../parser';
import { Preprocessor } from '../../../../preproc/preprocessor';
import { ConditionalStack } from '../../../../preproc/conditionalStack';
import { MacroTable } from '../../../../preproc/macroTable';
import { PreprocessorContext } from '../../../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../../../source/fileSource';
import type { DocumentRegistry } from '../../../../utility/documentRegistry';
import type { Logger } from '../../../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
function parse(body: string) {
    const source = new FileSource('file:///take-send-parser.P',
        `P=MPC603; SC=2000; MODULE M;
         SYSTEM; Eingang: BU(0240FFFC) <-; Ausgang: BU(0240FFF8) ->;
         PROBLEM; SPC Eingang DATION IN BASIC; SPC Ausgang DATION OUT BASIC;
         DCL Wort BIT(16), Kurz FIXED(15), Lang FIXED(31);
         Probe: TASK; ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const nodes: AstNode[] = [];
    const visit = (node: AstNode): void => { nodes.push(node); node.getChildren().forEach(visit); };
    visit(ast);
    return { ast, statements: nodes.filter((node): node is BasicTransferStatementNode =>
        node instanceof BasicTransferStatementNode),
        syntax: problems.toArray().map(p => p.message) };
}

test('TAKE/SEND preserve the multi-object lists accepted by RTOS-UH 16.7-M', () => {
    const r = parse('TAKE Wort,Kurz FROM Eingang; SEND Wort,Kurz+1 TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.keyword.value), ['TAKE', 'SEND']);
    assert.deepEqual(r.statements.map(s => s.objects.length), [2, 2]);
    assert.deepEqual(r.statements.map(s => s.commas.length), [1, 1]);
    assert.deepEqual(r.statements.map(s => s.directionKeyword?.value), ['FROM', 'TO']);
    assert.ok(r.statements.every(s => s.semicolon && s.dation));
    assert.equal(r.statements[1].objects[1].dumpLabel().startsWith('Dyadic'), true);
});

test('Original compiler accepts TAKE FROM and SEND TO without data objects', () => {
    const r = parse('TAKE FROM Eingang; SEND TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.objects.length), [0, 0]);
});

test('TAKE/SEND grammar includes simple expressions and selected names', () => {
    const r = parse('TAKE Wort FROM Eingang; SEND (Kurz + 1)*2 TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    assert.equal(r.statements[1].objects.length, 1);
});

test('BY RST, S and CONTROL are syntax errors, retaining later statements', () => {
    for (const option of ['RST(Kurz)', 'S(Lang)', 'CONTROL(1)']) {
        const r = parse(`TAKE Wort FROM Eingang BY ${option}; SEND Wort TO Ausgang BY ${option}; TAKE Wort FROM Eingang;`);
        assert.equal(r.syntax.filter(m => m.includes('does not support BY')).length, 2);
        assert.equal(r.statements.length, 3);
        assert.equal(r.statements[0].unsupportedBy?.value, 'BY');
        assert.ok(r.statements[0].semicolon);
        assert.ok(r.statements[1].semicolon);
        assert.ok(r.statements[2].semicolon);
    }
});

test('Malformed object lists recover at subsequent TAKE/SEND statements', () => {
    const r = parse('TAKE Wort, FROM Eingang; SEND Wort, TO Ausgang; TAKE Wort FROM Eingang;');
    assert.equal(r.statements.length, 3);
    assert.equal(r.syntax.filter(m => m.includes('after')).length >= 2, true);
    assert.ok(r.statements[2].semicolon);
});

test('AST keyword hover and name lookup are local to the TAKE/SEND node', () => {
    const r = parse('TAKE Wort FROM Eingang; SEND Wort TO Ausgang;');
    assert.deepEqual(r.syntax, []);
    const take = r.statements[0];
    const hit = r.ast.lookupSourceValue({ uri: take.keyword.location!.source.uri,
        offset: take.keyword.location!.span.start });
    assert.equal(hit?.element, take.keyword);
    assert.match(take.documentationProvider().getDocumentation(take, hit!)!, /^# TAKE/);
    const send = r.statements[1];
    const direction = send.directionKeyword!;
    const directionHit = r.ast.lookupSourceValue({ uri: direction.location!.source.uri,
        offset: direction.location!.span.start });
    assert.equal(directionHit?.element, direction);
    assert.match(send.documentationProvider().getDocumentation(send, directionHit!)!, /^# TO/);
    const dationName = take.dation!.segments[0].identifier;
    const nameHit = r.ast.lookupSourceValue({ uri: dationName.location!.source.uri,
        offset: dationName.location!.span.start });
    assert.equal(nameHit?.element, dationName);
});
