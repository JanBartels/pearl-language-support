// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AstKind } from '../../ast/astKind';
import type { AstNode } from '../../ast/astNode';
import { CallStatementNode } from '../../ast/problem/statements/callStatementNode';
import { ProblemCollection } from '../../core/problemCollection';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { CallSignatureIndex } from '../../semantic/callSignatureIndex';
import type { CallSignatureInformation } from '../../semantic/callSignatureInformation';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { collectBlockComments } from '../analysis';

const logger: Logger = { info() {}, warn() {}, error() {} };

/** Use precisely the external-text -> compiler-lexer -> parser path of Validator. */
function analyze(
    declarations: string,
    call: string,
    includes: Record<string, string> = {}
) {
    const source = new FileSource('file:///root.P',
        `MODULE Demo; PROBLEM;\n${declarations}\nRunner: TASK;\n${call}\nEND; MODEND;`);
    const problems = new ProblemCollection();
    const originalTokens = new Lexer(source, problems, logger).tokenize();
    const registry = {
        resolveInclude: (_parent: string, path: string) =>
            Object.prototype.hasOwnProperty.call(includes, path)
                ? { uri: `file:///${path}`, getText: () => includes[path] }
                : null,
        addInclude: () => {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const expanded = Preprocessor.createExpanded(
        originalTokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger
    );
    const compilerTokens = new Lexer(expanded.source, problems, logger).tokenize();
    const ast = new Parser(
        new ArrayTokenStream(compilerTokens, expanded.source), problems, logger
    ).parse();
    const compilerComments = collectBlockComments(compilerTokens);
    const semantic = new SemanticAnalyzer().analyze(ast, compilerComments);
    const signatures = new CallSignatureIndex(ast, semantic, compilerComments);
    const calls: CallStatementNode[] = [];
    const visit = (node: AstNode): void => {
        if (node.kind === AstKind.CallStatement) calls.push(node as CallStatementNode);
        for (const child of node.getChildren()) visit(child);
    };
    visit(ast);
    const info = signatures.get(calls[0])?.[0];
    assert.ok(info && info.kind === 'procedure', 'Expected a bound procedure signature');
    const signature = info as Extract<CallSignatureInformation, { kind: 'procedure' }>;
    return { signature, expanded, compilerComments, problems: problems.toArray() };
}

test('SPC ENTRY documentary names survive the second lexer', () => {
    const r = analyze('SPC P ENTRY(/* Device */ FIXED, /* Flag */ BIT) GLOBAL;', 'P(1, 2);');
    assert.deepEqual(r.signature.parameters.map(p => [p.name?.value, p.nameOrigin]),
        [['Device', 'comment'], ['Flag', 'comment']]);
    assert.equal(r.compilerComments.length, 2);
    assert.ok(r.compilerComments.every(c => c.location.source === r.expanded.source));
});

test('REF PROC documentary names survive the second lexer', () => {
    const r = analyze('DCL R REF PROC(/* Value */ FIXED);', 'R(42);');
    assert.deepEqual(r.signature.parameters.map(p => [p.name?.value, p.nameOrigin]),
        [['Value', 'comment']]);
});

test('macro-generated parameter comments remain documentary names', () => {
    const r = analyze(`#define ParameterDoc "/* Counter */"
SPC P ENTRY(ParameterDoc FIXED);`, 'P(42);');
    assert.deepEqual(r.signature.parameters.map(p => [p.name?.value, p.nameOrigin]),
        [['Counter', 'comment']]);
    const name = r.signature.parameters[0].name;
    assert.ok(name?.location);
    assert.equal(name.location.source, r.expanded.source);
    assert.equal(name.location.source.getText(name.location.span), 'Counter');
    // Expanded locations must map back to the original macro invocation.
    const mapped = r.expanded.source.mapLocation(name.location);
    assert.equal(mapped.source.uri, 'file:///root.P');
    assert.equal(mapped.source.getText(mapped.span), 'ParameterDoc');
});

test('inactive branch comments cannot supply parameter names', () => {
    const r = analyze(`#ifdef NOT_DEFINED
/* Wrong */
#endif
SPC P ENTRY(/* Right */ FIXED);`, 'P(42);');
    assert.equal(r.compilerComments.length, 1);
    assert.equal(r.signature.parameters[0].name?.value, 'Right');
});

test('included SPC ENTRY comments preserve their original origin', () => {
    const r = analyze('#include "defs.inc"', 'P(42);', {
        'defs.inc': 'SPC P ENTRY(/* Included */ FIXED) GLOBAL;\n'
    });
    const name = r.signature.parameters[0].name;
    assert.equal(name?.value, 'Included');
    assert.ok(name?.location);
    assert.equal(name.location.source, r.expanded.source);
    const mapped = r.expanded.source.mapLocation(name.location);
    assert.equal(mapped.source.uri, 'file:///defs.inc');
    assert.equal(mapped.source.getText(mapped.span), 'Included');
});
