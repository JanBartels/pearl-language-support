// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AstNode } from '../../../../ast/astNode';
import { InterruptStatementNode } from '../../../../ast/problem/statements/interruptStatementNode';
import { TaskingStatementNode } from '../../../../ast/problem/statements/taskingStatementNode';
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
    const source = new FileSource('file:///interrupt-statements.P',
        `P=MPC603; SC=2000; MODULE M; SYSTEM; Alarm: EV(00000001); PROBLEM;
         SPC Alarm INTERRUPT; Runner: TASK MAIN; ${body} END; MODEND;`);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext({} as DocumentRegistry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const nodes: AstNode[] = [];
    const visit = (node: AstNode): void => {
        nodes.push(node);
        node.getChildren().forEach(visit);
    };
    visit(ast);
    return { source, ast, nodes,
        statements: nodes.filter((node): node is InterruptStatementNode => node instanceof InterruptStatementNode),
        syntax: problems.toArray().map(problem => problem.message) };
}

test('ENABLE, DISABLE and TRIGGER produce independent AST statements and source lookup', () => {
    const r = parse(`ENABLE Alarm; DISABLE Alarm; TRIGGER Alarm;`);
    assert.deepEqual(r.syntax, []);
    assert.deepEqual(r.statements.map(node => node.keyword.value), ['ENABLE', 'DISABLE', 'TRIGGER']);
    assert.ok(r.statements.every(node => node.interrupt?.segments[0]?.identifier.value === 'Alarm'));
    assert.ok(r.statements.every(node => node.semicolon?.value === ';'));
    for (const statement of r.statements) {
        const location = statement.keyword.location!;
        const lookup = r.ast.lookupSourceValue({ uri: location.source.uri, offset: location.span.start });
        assert.equal(lookup?.element, statement.keyword);
        assert.match(statement.documentationProvider().getDocumentation(statement, lookup!)!,
            new RegExp(`^# ${statement.keyword.value}`));
        const target = statement.interrupt!.segments[0].identifier;
        const targetLocation = target.location!;
        assert.equal(r.ast.lookupSourceValue({
            uri: targetLocation.source.uri, offset: targetLocation.span.start
        })?.element, target);
    }
});

test('interrupt control statements are valid within nested control structures', () => {
    const r = parse(`IF '1'B1 THEN ENABLE Alarm; ELSE DISABLE Alarm; FIN;
        BEGIN TRIGGER Alarm; END;`);
    assert.deepEqual(r.syntax, []);
    assert.equal(r.statements.length, 3);
});

test('missing operand is a syntax error and subsequent statements survive', () => {
    const r = parse(`ENABLE; DISABLE Alarm; TRIGGER; ENABLE Alarm;`);
    assert.equal(r.statements.length, 4);
    assert.equal(r.statements[0].interrupt, undefined);
    assert.equal(r.statements[2].interrupt, undefined);
    assert.equal(r.syntax.filter(message => /Expected interrupt name/.test(message)).length, 2);
});

test('missing semicolon before the next interrupt or task statement recovers locally', () => {
    const r = parse(`ENABLE Alarm DISABLE Alarm; TRIGGER Alarm; ACTIVATE Runner;`);
    assert.equal(r.statements.length, 3);
    assert.ok(r.nodes.some(node => node instanceof TaskingStatementNode));
    assert.equal(r.statements[0].semicolon, undefined);
    assert.equal(r.syntax.filter(message => /Expected ';'/.test(message)).length, 1);
});
