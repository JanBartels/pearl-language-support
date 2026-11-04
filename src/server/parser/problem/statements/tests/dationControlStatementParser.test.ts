// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../../../ast/astNode';
import { DationControlStatementNode } from '../../../../ast/problem/statements/dationControlStatementNode';
import { InterruptStatementNode } from '../../../../ast/problem/statements/interruptStatementNode';
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
    const source = new FileSource('file:///dation-control-parser.p',
        `P=MPC603; SC=2000; MODULE M; SYSTEM; Disk:/ED/testfile; Alarm: EV(00000001);
         PROBLEM; SPC Disk DATION INOUT ALPHIC; SPC Alarm INTERRUPT;
         DCL Status FIXED, Name CHAR(24); Main: TASK MAIN; ${body} END; MODEND;`);
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
    return { ast, nodes,
        statements: nodes.filter((node): node is DationControlStatementNode => node instanceof DationControlStatementNode),
        syntax: problems.toArray().map(problem => problem.message) };
}

test('OPEN and CLOSE preserve their option syntax and provide keyword hover', () => {
    const r = parse("OPEN Disk BY IDF(Name), OLD, EXCLUSIVE, RST(Status); CLOSE Disk BY RST(Status), PRM;");
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.keyword.value), ['OPEN', 'CLOSE']);
    assert.deepEqual(r.statements[0].options.map(o => o.keyword.value),
        ['IDF', 'OLD', 'EXCLUSIVE', 'RST']);
    assert.deepEqual(r.statements[1].options.map(o => o.keyword.value), ['RST', 'PRM']);
    for (const statement of r.statements) {
        const loc = statement.keyword.location!;
        const hit = r.ast.lookupSourceValue({ uri: loc.source.uri, offset: loc.span.start });
        assert.equal(hit?.element, statement.keyword);
        assert.match(statement.documentationProvider().getDocumentation(statement, hit!)!,
            new RegExp(`^# ${statement.keyword.value}`));
        const name = statement.dation!.segments[0].identifier;
        const targetLoc = name.location!;
        assert.equal(r.ast.lookupSourceValue({ uri: targetLoc.source.uri,
            offset: targetLoc.span.start })?.element, name);
        for (const option of statement.options) {
            const l = option.keyword.location!;
            const o = r.ast.lookupSourceValue({ uri: l.source.uri, offset: l.span.start });
            assert.equal(o?.element, option.keyword);
            assert.match(option.documentationProvider().getDocumentation(option, o!)!,
                new RegExp(`^# ${option.keyword.value}`));
        }
    }
});

test('OPEN/CLOSE work in nested statements without changing common dispatch', () => {
    const r = parse('BEGIN OPEN Disk; IF \'1\'B1 THEN CLOSE Disk BY CAN; FIN; END;');
    assert.deepEqual(r.syntax, []);
    assert.equal(r.statements.length, 2);
});

test('missing arguments and delimiters do not swallow following statements', () => {
    const r = parse('OPEN Disk BY IDF(), NEW; CLOSE Disk BY PRM; OPEN Disk DISABLE Alarm;');
    assert.equal(r.statements.length, 3);
    assert.ok(r.nodes.some(n => n instanceof InterruptStatementNode));
    assert.ok(r.syntax.some(m => /Expected CHARACTER expression/.test(m)));
    assert.ok(r.syntax.some(m => /Expected ';'/.test(m)));
});

test('unknown BY option recovers at comma and preserves the next option', () => {
    const r = parse('OPEN Disk BY UNKNOWN, RST(Status); CLOSE Disk;');
    assert.ok(r.syntax.some(m => /Expected OPEN\/CLOSE BY option/.test(m)));
    assert.equal(r.statements.length, 2);
    assert.deepEqual(r.statements[0].options.map(o => o.keyword.value), ['RST']);
});

test('CLOSE-only CAN/PRM are retained for targeted diagnostics and keyword hover', () => {
    const r = parse('OPEN Disk BY CAN, PRM; CLOSE Disk BY CAN; CLOSE Disk BY PRM;');
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(s => s.options.map(o => o.keyword.value)),
        [['CAN', 'PRM'], ['CAN'], ['PRM']]);
    for (const statement of r.statements) {
        for (const option of statement.options) {
            const location = option.keyword.location!;
            const hit = r.ast.lookupSourceValue({ uri: location.source.uri, offset: location.span.start });
            assert.equal(hit?.element, option.keyword);
            assert.match(option.documentationProvider().getDocumentation(option, hit!)!,
                new RegExp(`^# ${option.keyword.value}`));
        }
    }
});
