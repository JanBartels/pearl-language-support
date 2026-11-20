// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { ProblemCollection } from '../../core/problemCollection';
import { ArrayTokenStream } from '../../lexer/arrayTokenStream';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { createFoldingRangesForDocument } from '../createFoldingRangesForDocument';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function editor(uri: string, text: string): TextDocument {
    return {
        uri,
        getText: () => text,
        positionAt(offset: number) {
            const preceding = text.slice(0, Math.max(0, Math.min(offset, text.length)));
            const lines = preceding.split('\n');
            return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
        }
    } as TextDocument;
}

function directProgram(text: string) {
    const uri = 'file:///tests/Struct.P';
    const source = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const ast = new Parser(new ArrayTokenStream(tokens, source), problems, logger).parse();
    const blocks = new PreprocessorConditionalBlockCollection();
    const analysis = new Analysis(source, tokens, ast, problems, [], blocks);
    const result = AnalysisResult.create(analysis, [analysis]);
    return {
        folds: createFoldingRangesForDocument(editor(uri, text), result, undefined, logger),
        problems
    };
}

test('TYPE STRUCT folds from STRUCT to the closing bracket', () => {
    const { folds, problems } = directProgram([
        'MODULE M; PROBLEM;',
        'TYPE TestStruct STRUCT [',
        '    Element1 FIXED,',
        '    Element2 FLOAT',
        '];',
        'MODEND;'
    ].join('\n'));
    assert.equal(problems.size(), 0);
    assert.ok(folds.some(f => f.startLine === 1 && f.endLine === 3), JSON.stringify(folds));
});

test('nested STRUCTs each contribute their own folding region', () => {
    const { folds, problems } = directProgram([
        'MODULE M; PROBLEM;',
        'TYPE Outer STRUCT [',
        '    Child STRUCT [',
        '        Value FIXED',
        '    ],',
        '    Flag BIT(1)',
        '];',
        'MODEND;'
    ].join('\n'));
    assert.equal(problems.size(), 0);
    assert.ok(folds.some(f => f.startLine === 1 && f.endLine === 5), JSON.stringify(folds));
    assert.ok(folds.some(f => f.startLine === 2 && f.endLine === 3), JSON.stringify(folds));
});

test('DCL with STRUCT uses the same AST folding implementation', () => {
    const { folds, problems } = directProgram([
        'MODULE M; PROBLEM;',
        'DCL Store STRUCT [',
        '    Value FIXED,',
        '    Other FLOAT',
        '];',
        'MODEND;'
    ].join('\n'));
    assert.equal(problems.size(), 0);
    assert.ok(folds.some(f => f.startLine === 1 && f.endLine === 3), JSON.stringify(folds));
});

test('a shared guarded include folds STRUCT only in its active occurrence', () => {
    const headerUri = 'file:///tests/HStruct.h';
    const rootUri = 'file:///tests/Root.P';
    const headerText = [
        '#ifndef GUARD',
        '#define GUARD',
        'TYPE TestStruct STRUCT [',
        '    Element1 FIXED,',
        '    Element2 FLOAT',
        '];',
        '#endif',
        ''
    ].join('\n');
    const rootText = 'MODULE M; PROBLEM;\n#include "HStruct.h"\n#include "HStruct.h"\nMODEND;';
    const source = new FileSource(rootUri, rootText);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const registry = {
        resolveInclude: (_uri: string, filename: string) => filename === 'HStruct.h'
            ? { uri: headerUri, getText: () => headerText } : null
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const blocks = new PreprocessorConditionalBlockCollection();
    const expanded = Preprocessor.createExpanded(tokens, source, context,
        problems, [], blocks, logger);
    const compilerTokens = new Lexer(expanded.source, problems, logger).tokenize();
    const ast = new Parser(new ArrayTokenStream(compilerTokens, expanded.source),
        problems, logger).parse();
    const analysis = new Analysis(source, tokens, ast, problems, [], blocks);
    const result = AnalysisResult.create(analysis, [analysis], [headerUri], context.includeOccurrences);
    const occurrences = result.includeOccurrences.filter(item => item.sourceUri === headerUri)
        .sort((a, b) => a.expandedSpan.start - b.expandedSpan.start);
    assert.equal(problems.size(), 0);
    assert.equal(occurrences.length, 2);

    const document = editor(headerUri, headerText);
    const first = createFoldingRangesForDocument(document, result, occurrences[0], logger);
    const second = createFoldingRangesForDocument(document, result, occurrences[1], logger);
    const structRegion = (fold: { startLine: number; endLine: number }) =>
        fold.startLine === 2 && fold.endLine === 4;
    assert.ok(first.some(structRegion), JSON.stringify(first));
    assert.ok(!second.some(structRegion), JSON.stringify(second));
    assert.ok(first.some(f => f.startLine === 0 && f.endLine === 5));
    assert.ok(second.some(f => f.startLine === 0 && f.endLine === 5));
});
