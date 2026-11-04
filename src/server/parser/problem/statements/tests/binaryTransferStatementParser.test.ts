// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../../../ast/astNode';
import { BinaryTransferStatementNode } from '../../../../ast/problem/statements/binaryTransferStatementNode';
import { CallStatementNode } from '../../../../ast/problem/statements/callStatementNode';
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
    const source = new FileSource('file:///binary-transfer-parser.p',
        `P=MPC603; SC=2000; MODULE M; SYSTEM; Disk:/ED/data;
         PROBLEM; SPC Disk DATION INOUT ALPHIC;
         DCL Status FIXED(31), FileName CHAR(24), A FIXED, B FLOAT,
             Values(3) FIXED, Matrix(2,3) FIXED; Main: TASK MAIN; ${body} END; MODEND;`);
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
    return { ast, statements: nodes.filter((node): node is BinaryTransferStatementNode =>
        node instanceof BinaryTransferStatementNode),
        syntax: problems.toArray().map(p => p.message) };
}

test('READ/WRITE retain object expressions, DATION expression, S formats and punctuation', () => {
    const r = parse('WRITE A+3, Values TO Disk BY S(Status), S(Status); READ A, B FROM Disk BY S(Status);');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.keyword.value), ['WRITE', 'READ']);
    assert.equal(r.statements[0].objects.length, 2);
    assert.equal(r.statements[0].objectCommas.length, 1);
    assert.equal(r.statements[0].directionKeyword?.value, 'TO');
    assert.equal(r.statements[0].formats.length, 2);
    assert.equal(r.statements[0].formats[0].variable?.segments[0].identifier.value, 'Status');
    assert.equal(r.statements[1].objects.length, 2);
    assert.equal(r.statements[1].directionKeyword?.value, 'FROM');
    assert.equal(r.statements[1].formats.length, 1);
    assert.ok(r.statements.every(s => s.semicolon));
});

test('READ/WRITE accept full arrays and statements without S controls', () => {
    const r = parse('READ Values FROM Disk; WRITE Values, A, B TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.objects.length), [1, 3]);
    assert.deepEqual(r.statements.map(s => s.formats.length), [0, 0]);
});

test('READ and S keyword documentation and normal name lookup are available immediately', () => {
    const r = parse('READ A FROM Disk BY S(Status);');
    assert.deepEqual(r.syntax, []);
    const statement = r.statements[0];
    const keywordLoc = statement.keyword.location!;
    const hit = r.ast.lookupSourceValue({ uri: keywordLoc.source.uri, offset: keywordLoc.span.start });
    assert.equal(hit?.element, statement.keyword);
    assert.match(statement.documentationProvider().getDocumentation(statement, hit!)!, /^# READ/);
    const s = statement.formats[0];
    const sloc = s.keyword.location!;
    const shit = r.ast.lookupSourceValue({ uri: sloc.source.uri, offset: sloc.span.start });
    assert.equal(shit?.element, s.keyword);
    assert.match(s.documentationProvider().getDocumentation(s, shit!)!, /^# S/);
    const name = statement.dation!;
    const loc = statement.keyword.location!;
    assert.ok(name.lookupSourceValue({ uri: loc.source.uri,
        offset: (name as any).segments[0].identifier.location.span.start }));
});

test('READ/WRITE local recovery preserves later statements', () => {
    const r = parse('READ A, FROM Disk; WRITE B TO Disk BY S(Status),; READ A FROM Disk;');
    assert.equal(r.statements.length, 3);
    assert.ok(r.syntax.some(m => m.includes("after ','")));
    assert.ok(r.statements[2].semicolon);
});

test('READ/WRITE BY rejects unsupported positioning formats, without swallowing the following statement', () => {
    const r = parse('READ A FROM Disk BY RST(Status); WRITE A TO Disk;');
    assert.equal(r.statements.length, 2);
    assert.ok(r.syntax.some(m => m.includes('expects S(')));
});

test('READ/WRITE retain last-dimension segments as dedicated AST nodes', () => {
    const r = parse('READ Values(1:3) FROM Disk; WRITE Values(2:3), Values(1) TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.objects.length), [1, 2]);
    assert.equal(r.statements[0].objects[0].kind.toString(), r.statements[1].objects[0].kind.toString());
    assert.equal(r.statements[0].objects[0].dumpLabel(), 'IoSegment');
    assert.equal(r.statements[1].objects[1].dumpLabel(), 'NameExpression');
});


test('multidimensional segments use a range only in the last dimension', () => {
    const r = parse('READ Matrix(1, 2:3) FROM Disk; WRITE Matrix(2, 1:3) TO Disk;');
    assert.deepEqual(r.syntax, []);
    assert.equal(r.statements[0].objects[0].dumpLabel(), 'IoSegment');
    assert.equal(r.statements[1].objects[0].dumpLabel(), 'IoSegment');
});


test('OPEN missing semicolon recovers at the new READ/WRITE statement boundaries', () => {
    const r = parse('OPEN Disk READ Values FROM Disk; WRITE Values TO Disk;');
    assert.equal(r.statements.length, 2);
    assert.ok(r.syntax.some(message => message.includes("after OPEN statement")));
});


test('READ/WRITE compatibility calls remain ordinary calls alongside binary transfer syntax', () => {
    const r = parse(`READ(Disk, A); WRITE(Disk, A, B);
        READ A FROM Disk;
        WRITE (A+1) TO Disk;
        WRITE (A), B TO Disk;`);
    assert.deepEqual(r.syntax, []);
    const calls: CallStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node instanceof CallStatementNode) calls.push(node);
        node.getChildren().forEach(visit);
    };
    visit(r.ast);
    assert.deepEqual(calls.map(call => call.target?.value), ['READ', 'WRITE']);
    assert.deepEqual(r.statements.map(statement => statement.keyword.value),
        ['READ', 'WRITE', 'WRITE']);
    assert.deepEqual(r.statements.map(statement => statement.objects.length), [1, 1, 2]);
});
