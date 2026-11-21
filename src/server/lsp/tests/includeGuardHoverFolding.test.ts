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
import { PreprocessorConditionalBlockLookup } from '../../preproc/preprocessorConditionalBlockLookup';
import { PreprocessorDirectiveKind } from '../../preproc/preprocessorConditionalLookupResult';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import { MacroTable } from '../../preproc/macroTable';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { FileSource } from '../../source/fileSource';
import { Analysis } from '../../validation/analysis';
import { AnalysisResult } from '../../validation/analysisResult';
import { PreprocessorConditionalBlockDocumentationProvider } from '../../documentation/preprocessorConditionalBlockDocumentationProvider';
import { createFoldingRangesForDocument } from '../createFoldingRangesForDocument';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const rootUri = 'file:///tests/Guard.P';
const headerUri = 'file:///tests/HGuard.h';
const rootText = 'MODULE M; PROBLEM;\n#include "HGuard.h"\n#include "HGuard.h"\nMODEND;';
const headerText = `#ifndef _guard_
#define _guard_
P: PROC;
 DCL L FIXED;
 L := 1;
END;
#endif
`;
const quiet: Logger = { info() {}, warn() {}, error() {} };

function fixture() {
    const source = new FileSource(rootUri, rootText);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quiet).tokenize();
    const registry = {
        resolveInclude: (_uri: string, name: string) => name === 'HGuard.h'
            ? { uri: headerUri, getText: () => headerText } : null
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const blocks = new PreprocessorConditionalBlockCollection();
    const expanded = Preprocessor.createExpanded(tokens, source, context,
        problems, [], blocks, quiet);
    const compilerTokens = new Lexer(expanded.source, problems, quiet).tokenize();
    const ast = new Parser(new ArrayTokenStream(compilerTokens, expanded.source), problems, quiet).parse();
    const analysis = new Analysis(source, tokens, ast, problems, [], blocks);
    const result = AnalysisResult.create(analysis, [analysis], [headerUri], context.includeOccurrences);
    const occurrences = result.includeOccurrences.filter(item => item.sourceUri === headerUri)
        .sort((a, b) => a.expandedSpan.start - b.expandedSpan.start);
    assert.equal(occurrences.length, 2);
    assert.equal(problems.size(), 0);

    // Lightweight editor view: the folding helper only needs these methods.
    const document = {
        uri: headerUri,
        getText: () => headerText,
        positionAt(offset: number) {
            const before = headerText.slice(0, Math.max(0, Math.min(offset, headerText.length)));
            const lines = before.split('\n');
            return { line: lines.length - 1, character: lines[lines.length - 1]!.length };
        }
    } as TextDocument;
    return { blocks, result, occurrences, document };
}

test('include-guard hover follows the selected execution, including #endif', () => {
    const { blocks, occurrences } = fixture();
    const cursor = { uri: headerUri, offset: headerText.indexOf('#ifndef') + 2 };
    const first = PreprocessorConditionalBlockLookup.lookup(blocks, cursor, occurrences[0]!.id);
    const second = PreprocessorConditionalBlockLookup.lookup(blocks, cursor, occurrences[1]!.id);
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.block.conditionSatisfied, true);
    assert.equal(second.block.conditionSatisfied, false);
    assert.match(PreprocessorConditionalBlockDocumentationProvider.getDocumentation(first), /Bedingung erfuellt|Bedingung erfüllt/);
    assert.match(PreprocessorConditionalBlockDocumentationProvider.getDocumentation(second), /Bedingung nicht erfuellt|Bedingung nicht erfüllt/);

    const endif = { uri: headerUri, offset: headerText.indexOf('#endif') + 2 };
    assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks, endif, occurrences[0]!.id)?.block.conditionSatisfied, true);
    assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks, endif, occurrences[1]!.id)?.block.conditionSatisfied, false);
});

test('preprocessor folding works for a directly opened included file, in either execution', () => {
    const { result, occurrences, document } = fixture();
    for (const occurrence of occurrences) {
        const folds = createFoldingRangesForDocument(document, result, occurrence, quiet);
        assert.ok(folds.some(fold => fold.startLine === 0 && fold.endLine === 5),
            `#ifndef range missing for ${occurrence.id}: ${JSON.stringify(folds)}`);
    }
});

test('AST folding uses the selected include execution, not the first matching URI', () => {
    const { result, occurrences, document } = fixture();
    const first = createFoldingRangesForDocument(document, result, occurrences[0], quiet);
    const second = createFoldingRangesForDocument(document, result, occurrences[1], quiet);
    assert.ok(first.some(fold => fold.startLine === 2 && fold.endLine === 4),
        `active procedure is not foldable: ${JSON.stringify(first)}`);
    assert.ok(!second.some(fold => fold.startLine === 2 && fold.endLine === 4),
        `inactive procedure must not be folded as active AST: ${JSON.stringify(second)}`);
});

test('conditional lookup does not borrow a different include occurrence', () => {
    const { blocks } = fixture();
    assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks,
        { uri: headerUri, offset: 1 }, 'missing-occurrence'), undefined);
});


test('conditional hover on #ifndef operand uses the selected include execution', () => {
    const { blocks, occurrences } = fixture();
    const nameOffset = headerText.indexOf('_guard_');
    assert.ok(nameOffset > 0);
    const directiveOffset = headerText.indexOf('#ifndef') + 2;

    for (const [index, occurrence] of occurrences.entries()) {
        const directive = PreprocessorConditionalBlockLookup.lookup(
            blocks, { uri: headerUri, offset: directiveOffset }, occurrence.id
        );
        assert.ok(directive);
        const expected = index === 0;
        assert.equal(directive.block.conditionSatisfied, expected);

        for (let i = 0; i < '_guard_'.length; i++) {
            const name = PreprocessorConditionalBlockLookup.lookup(
                blocks, { uri: headerUri, offset: nameOffset + i }, occurrence.id
            );
            assert.ok(name, `missing #ifndef operand hover at character ${i}`);
            assert.equal(name.block, directive.block);
            assert.equal(name.directive, directive.directive);
            assert.match(
                PreprocessorConditionalBlockDocumentationProvider.getDocumentation(name),
                expected ? /Bedingung erfüllt/ : /Bedingung nicht erfüllt/
            );
        }
    }
});

test('conditional hover does not claim spaces or the #define operand', () => {
    const { blocks, occurrences } = fixture();
    const nameOffset = headerText.indexOf('_guard_');
    const occurrenceId = occurrences[0]!.id;
    const lookup = (offset: number, uri = headerUri) =>
        PreprocessorConditionalBlockLookup.lookup(blocks, { uri, offset }, occurrenceId);

    assert.equal(lookup(nameOffset - 1), undefined); // space after #ifndef
    assert.equal(lookup(nameOffset + '_guard_'.length), undefined); // newline
    assert.equal(lookup(headerText.lastIndexOf('_guard_')), undefined); // #define operand
    assert.equal(lookup(nameOffset, rootUri), undefined);
    assert.equal(lookup(nameOffset, headerUri)?.directive, PreprocessorDirectiveKind.Ifndef);
    assert.equal(lookup(nameOffset, 'file:///tests/unrelated.inc'), undefined);
    assert.equal(PreprocessorConditionalBlockLookup.lookup(
        blocks, { uri: headerUri, offset: nameOffset }, 'not-an-occurrence'), undefined);
});

test('conditional hover on #ifdef operand distinguishes defined and undefined macros', () => {
    const text = `#define ENABLED
#ifdef ENABLED
#endif
#ifdef DISABLED
#endif
MODULE Hover; PROBLEM; MODEND;`;
    const uri = 'file:///tests/Ifdef.P';
    const source = new FileSource(uri, text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quiet).tokenize();
    const registry = { resolveInclude: () => null } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const blocks = new PreprocessorConditionalBlockCollection();
    Preprocessor.createExpanded(tokens, source, context, problems, [], blocks, quiet);
    assert.equal(problems.size(), 0);

    for (const [name, isDefined] of [['ENABLED', true], ['DISABLED', false]] as const) {
        const nameOffset = text.indexOf(name, text.indexOf(`#ifdef ${name}`));
        const directiveOffset = text.indexOf(`#ifdef ${name}`) + 2;
        const macro = PreprocessorConditionalBlockLookup.lookup(blocks, { uri, offset: nameOffset });
        const directive = PreprocessorConditionalBlockLookup.lookup(blocks, { uri, offset: directiveOffset });
        assert.ok(macro);
        assert.ok(directive);
        assert.equal(macro.block, directive.block);
        assert.equal(macro.block.conditionSatisfied, isDefined);
        assert.match(PreprocessorConditionalBlockDocumentationProvider.getDocumentation(macro),
            isDefined ? /Bedingung erfüllt/ : /Bedingung nicht erfüllt/);
        assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks,
            { uri, offset: nameOffset + name.length }), undefined);
    }
});
