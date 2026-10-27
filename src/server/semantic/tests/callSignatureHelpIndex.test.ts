// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
import { ActualParameterListNode } from '../../ast/problem/statements/actualParameterListNode';
import { CallStatementNode } from '../../ast/problem/statements/callStatementNode';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { CallSignatureIndex } from '../callSignatureIndex';
import { CallSignatureHelpIndex } from '../callSignatureHelpIndex';
import { SemanticAnalyzer } from '../semanticAnalyzer';
import { SourceValue } from '../../core/sourceValue';
import { MacroSource } from '../../source/macroSource';

const logger: Logger = { info() {}, warn() {}, error() {} };
const uri = 'file:///signature-help.pearl';

function fixture(statement: string) {
    const text = `MODULE Test; PROBLEM; P: PROC(A FIXED, B FIXED, C FIXED); END;
Runner: TASK;
${statement}
END; MODEND;`;
    const source = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const preprocessor = Preprocessor.create(tokens, source, new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(preprocessor, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const index = new CallSignatureHelpIndex(ast, new CallSignatureIndex(ast, semantic));
    const calls: CallStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    return {
        text, calls,
        at: (needle: string, delta = 0) => index.lookup({
            uri, offset: text.indexOf(needle, text.indexOf('Runner: TASK')) + delta
        }),
        offset: (offset: number, searchUri = uri) => index.lookup({ uri: searchUri, offset })
    };
}

test('explicit and implicit calls: opening, commas and closed list boundaries', () => {
    for (const statement of ['CALL P(1, 2, 3);', 'P(1, 2, 3);']) {
        const f = fixture(statement);
        assert.equal(f.calls.length, 1);
        assert.equal(f.at('P(1', 2)?.activeParameter, 0);
        assert.equal(f.at(', 2', 1)?.activeParameter, 1);
        assert.equal(f.at(', 3', 1)?.activeParameter, 2);
        assert.equal(f.at(', 3', 3)?.activeParameter, 2); // before ')'
        assert.equal(f.at(');', 1), undefined); // after ')'
        assert.equal(f.at('P(1', 0), undefined); // on target
    }
});

test('commas nested in expressions never advance the outer argument slot', () => {
    const f = fixture('P(1, F(2, 3), 4);');
    assert.equal(f.at('2, 3', 3)?.activeParameter, 1);
    assert.equal(f.at(', 4', 1)?.activeParameter, 2);
});

test('open calls retain trailing empty slots at EOF or before a recovery boundary', () => {
    const f = fixture('P(1,');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].actualParameters?.closeParenthesis, undefined);
    assert.equal(f.calls[0].actualParameters?.recoveryBoundary?.value, 'END');
    assert.equal(f.at('P(1,', 4)?.activeParameter, 1);
    assert.equal(f.at('END; MODEND;', 0), undefined);
});

test('an incomplete call at source EOF admits cursor immediately after comma', () => {
    const text = 'P(1,';
    const f = fixture(text);
    // The fixture appends END and MODEND, so the parser does not reach EOF.
    // Verify the zero-width EOF recovery end through a separate fixture.
    const source = new FileSource('file:///eof.pearl', 'MODULE; PROBLEM; P: PROC(A FIXED); END; T: TASK; P(1,');
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const stream = Preprocessor.create(tokens, source, new PreprocessorContext(
        {} as DocumentRegistry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()), problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const index = new CallSignatureHelpIndex(ast,
        new CallSignatureIndex(ast, new SemanticAnalyzer().analyze(ast)));
    assert.equal(index.lookup({ uri: source.uri, offset: source.length })?.activeParameter, 1);
    assert.equal(f.calls[0].actualParameters?.parameters.length, 2);
});

test('different URIs with identical offsets never match', () => {
    const f = fixture('P(1, 2);');
    const cursor = f.text.indexOf('P(1, 2);');
    assert.equal(f.offset(cursor + 2, 'file:///another.pearl'), undefined);
});

test('non-callable selector assignments have no signature site', () => {
    const f = fixture("DCL Dummy FIXED;\nMyChar.CHAR(7) = '2';\nMyBits.BIT(3) = '1'B;");
    assert.equal(f.calls.length, 0);
    assert.equal(f.at('CHAR(7)', 5), undefined);
    assert.equal(f.at('BIT(3)', 4), undefined);
});

test('collapsed macro delimiters do not produce a cursor interval', () => {
    const physicalSource = new FileSource(uri, 'MAKECALL');
    const macroSource = new MacroSource({
        source: physicalSource, span: { start: 0, end: 8 }
    }, 'P(1,2)');
    const sv = (value: string, start: number, end: number) =>
        new SourceValue(value, { source: macroSource, span: { start, end } });
    const call = new CallStatementNode(undefined, sv('P', 0, 1),
        new ActualParameterListNode(sv('(', 1, 2), [], [], sv(')', 5, 6)));
    const signatures = { get: () => [{ kind: 'procedure' }] } as unknown as CallSignatureIndex;
    const index = new CallSignatureHelpIndex(call, signatures);
    assert.equal(index.lookup({ uri, offset: 5 }), undefined);
});

test('two distinct call sites mapping to the same physical interval are ambiguous', () => {
    const physicalSource = new FileSource(uri, 'P(1);');
    const sv = (value: string, start: number, end: number) =>
        new SourceValue(value, { source: physicalSource, span: { start, end } });
    const makeCall = () => new CallStatementNode(undefined, sv('P', 0, 1),
        new ActualParameterListNode(sv('(', 1, 2), [], [], sv(')', 3, 4)));
    const root = {
        kind: AstKind.ProblemPart, getChildren: () => [makeCall(), makeCall()]
    } as unknown as AstNode;
    const signatures = { get: () => [{ kind: 'procedure' }] } as unknown as CallSignatureIndex;
    const index = new CallSignatureHelpIndex(root, signatures);
    assert.equal(index.lookup({ uri, offset: 2 }), undefined);
});

test('a call entirely inside an include uses the include URI, not the root URI', () => {
    const includeUri = 'file:///sub/procedures.inc';
    const includeSource = new FileSource(includeUri, 'P(1,2);');
    const sv = (value: string, start: number, end: number) =>
        new SourceValue(value, { source: includeSource, span: { start, end } });
    const call = new CallStatementNode(undefined, sv('P', 0, 1),
        new ActualParameterListNode(sv('(', 1, 2), [], [sv(',', 3, 4)], sv(')', 5, 6)));
    const signatures = { get: () => [{ kind: 'procedure' }] } as unknown as CallSignatureIndex;
    const index = new CallSignatureHelpIndex(call, signatures);
    assert.equal(index.lookup({ uri: includeUri, offset: 4 })?.activeParameter, 1);
    assert.equal(index.lookup({ uri, offset: 4 }), undefined);
});
