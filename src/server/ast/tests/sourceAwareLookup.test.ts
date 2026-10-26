// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TranslationUnitNode } from '../module/translationUnitNode';
import { OneIdentifierOrListNode } from '../problem/identifiers/oneIdentifierOrListNode';
import { SourceValue } from '../../core/sourceValue';
import { FileSource } from '../../source/fileSource';
import { MacroSource } from '../../source/macroSource';
import { AnalysisResult } from '../../validation/analysisResult';
import { Analysis } from '../../validation/analysis';
import { ProblemCollection } from '../../core/problemCollection';
import { PreprocessorConditionalBlockCollection } from '../../preproc/preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlock } from '../../preproc/preprocessorConditionalBlock';
import { PreprocessorConditionalBlockLookup } from '../../preproc/preprocessorConditionalBlockLookup';
import { CompilerOptionLookup } from '../../lexer/compilerOptionLookup';
import { createCommentToken } from '../../lexer/tokenFactory';
import { CommentKind } from '../../lexer/token';
import { Lexer } from '../../lexer/lexer';
import { Parser } from '../../parser/parser';
import { MacroTable } from '../../preproc/macroTable';
import { Preprocessor } from '../../preproc/preprocessor';
import { PreprocessorContext } from '../../preproc/preprocessorContext';
import { ConditionalStack } from '../../preproc/conditionalStack';
import { PreprocessorConditionalBlockStack } from '../../preproc/preprocessorConditionalBlockStack';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { lookupSymbolDefinition } from '../../semantic/bindingIndex';
import { SemanticAnalyzer } from '../../semantic/semanticAnalyzer';

const quiet: Logger = { info() {}, warn() {}, error() {} };

function at(source: FileSource, start: number, size: number) {
    return { source, span: { start, end: start + size } };
}

test('AST lookup checks the URI before accepting an offset and continues past foreign children', () => {
    const rootSource = new FileSource('file:///main.p', 'Main');
    const includeSource = new FileSource('file:///shared.inc', 'Other');
    const foreign = new SourceValue('Other', at(includeSource, 0, 5));
    const local = new SourceValue('Main', at(rootSource, 0, 4));
    const root = new TranslationUnitNode();
    // Deliberately search the foreign child first, as happens with #includes.
    root.addChild(new OneIdentifierOrListNode(false, [foreign]));
    root.addChild(new OneIdentifierOrListNode(false, [local]));

    assert.equal(root.lookupSourceValue({ uri: rootSource.uri, offset: 1 })?.element, local);
    assert.equal(root.lookupSourceValue({ uri: includeSource.uri, offset: 1 })?.element, foreign);
    assert.equal(root.lookupSourceValue({ uri: 'file:///absent.p', offset: 1 }), undefined);
});

test('AST lookup maps nested macro locations to the physical invocation', () => {
    const source = new FileSource('file:///main.p', '  Invoke');
    const other = new FileSource('file:///other.p', '  Invoke');
    const first = new MacroSource(at(source, 2, 6), 'Middle');
    const second = new MacroSource({ source: first, span: { start: 0, end: 6 } }, 'Value');
    const expanded = new SourceValue('Value', { source: second, span: { start: 0, end: 5 } });
    const root = new OneIdentifierOrListNode(false, [expanded]);

    assert.equal(root.lookupSourceValue({ uri: source.uri, offset: 3 })?.element, expanded);
    assert.equal(root.lookupSourceValue({ uri: other.uri, offset: 3 }), undefined);
});

test('macro lookup cannot return a reference from a different include file', () => {
    const main = new FileSource('file:///main.p', 'ABCD');
    const include = new FileSource('file:///included.inc', 'ABCD');
    const ast = new TranslationUnitNode();
    const mainMacro = { definition: { name: 'MAIN', replacement: '1' }, location: at(main, 0, 4) };
    const includeMacro = { definition: { name: 'INCLUDE', replacement: '2' }, location: at(include, 0, 4) };
    const analysis = new Analysis(main, [], ast, new ProblemCollection(),
        [includeMacro, mainMacro], new PreprocessorConditionalBlockCollection());
    const result = AnalysisResult.create(analysis, [analysis]);

    assert.equal(result.lookupMacro({ uri: main.uri, offset: 1 }), mainMacro);
    assert.equal(result.lookupMacro({ uri: include.uri, offset: 1 }), includeMacro);
    assert.equal(result.lookupMacro({ uri: 'file:///missing.p', offset: 1 }), undefined);
});

test('conditional hover matches each directive against its own source location', () => {
    const main = new FileSource('file:///main.p', '#ifdef X\n#else\n#endif');
    const include = new FileSource('file:///included.inc', '#ifdef X\n#else\n#endif');
    const block = new PreprocessorConditionalBlock(true, 'X', undefined,
        at(include, 0, 6), at(include, 9, 5), at(include, 15, 6), true);
    const blocks = new PreprocessorConditionalBlockCollection();
    blocks.add(block);

    assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks, { uri: main.uri, offset: 1 }), undefined);
    assert.equal(PreprocessorConditionalBlockLookup.lookup(blocks, { uri: include.uri, offset: 1 })?.block, block);
});

test('compiler option hover ignores identically positioned options in other files', () => {
    const main = new FileSource('file:///main.p', '/*+A*/');
    const include = new FileSource('file:///included.inc', '/*+B*/');
    const comments = [createCommentToken(at(include, 0, 6), CommentKind.Block),
        createCommentToken(at(main, 0, 6), CommentKind.Block)];

    assert.equal(CompilerOptionLookup.lookupAt(comments, { uri: main.uri, offset: 3 })?.option, 'A');
    assert.equal(CompilerOptionLookup.lookupAt(comments, { uri: include.uri, offset: 3 })?.option, 'B');
});

test('real preprocessor include preserves physical identity through AST lookup', () => {
    const parentText = 'MODULE; PROBLEM;\nTYPE Root FIXED;\n#include INC\nMODEND;';
    const includeText = 'TYPE Child FIXED;';
    const parent = new FileSource('file:///main.p', parentText);
    const includeUri = 'file:///INC';
    const registry = {
        resolveInclude: (_source: string, name: string) => name === 'INC'
            ? { uri: includeUri, getText: () => includeText } : null,
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
    const problems = new ProblemCollection();
    const tokens = new Lexer(parent, problems, quiet).tokenize();
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, parent, context, problems, [],
        new PreprocessorConditionalBlockCollection(), quiet);
    const ast = new Parser(stream, problems, quiet).parse();
    const localOffset = parentText.indexOf('Root');
    const includeOffset = includeText.indexOf('Child');

    assert.equal(ast.lookupSourceValue({ uri: parent.uri, offset: localOffset })?.element.value, 'Root');
    assert.equal(ast.lookupSourceValue({ uri: includeUri, offset: includeOffset })?.element.value, 'Child');
    assert.notEqual(ast.lookupSourceValue({ uri: parent.uri, offset: includeOffset })?.element.value, 'Child');
});

test('a shared include with two analyzed parents has no arbitrary semantic context', async () => {
    const { DocumentRegistry } = await import('../../utility/documentRegistry');
    const registry = new DocumentRegistry({ get: () => undefined } as never);
    const shared = 'file:///shared.inc';
    const first = 'file:///first.p';
    const second = 'file:///second.p';
    const makeResult = (uri: string) => {
        const source = new FileSource(uri, 'MODULE; PROBLEM; MODEND;');
        const analysis = new Analysis(source, [], new TranslationUnitNode(),
            new ProblemCollection(), [], new PreprocessorConditionalBlockCollection());
        return AnalysisResult.create(analysis, [analysis]);
    };
    const firstResult = makeResult(first);
    const secondResult = makeResult(second);
    registry.addInclude(first, shared);
    registry.setAnalysisResult(first, 1, firstResult);
    assert.equal(registry.getAnalysisResultForSource(shared, 0), firstResult);

    registry.addInclude(second, shared);
    registry.setAnalysisResult(second, 1, secondResult);
    assert.equal(registry.getAnalysisResultForSource(shared, 0), undefined);
});

test('semantic navigation via source-aware lookup uses the correct declaration in a real include', () => {
    const parentText = 'MODULE; PROBLEM;\nTYPE Root FIXED;\n#include INC\nDCL r REF Root;\nMODEND;';
    const includeText = 'TYPE Child FIXED;\nDCL c REF Child;';
    const parent = new FileSource('file:///main.p', parentText);
    const includeUri = 'file:///INC';
    const registry = {
        resolveInclude: (_uri: string, name: string) => name === 'INC'
            ? { uri: includeUri, getText: () => includeText } : null,
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
    const problems = new ProblemCollection();
    const tokens = new Lexer(parent, problems, quiet).tokenize();
    const stream = Preprocessor.create(tokens, parent, new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(), new PreprocessorConditionalBlockStack()
    ), problems, [], new PreprocessorConditionalBlockCollection(), quiet);
    const ast = new Parser(stream, problems, quiet).parse();
    const context = new SemanticAnalyzer().analyze(ast);

    const rootUse = ast.lookupSourceValue({ uri: parent.uri, offset: parentText.indexOf('Root;') });
    const childUse = ast.lookupSourceValue({ uri: includeUri, offset: includeText.indexOf('Child;') });
    assert.ok(rootUse);
    assert.ok(childUse);
    const rootDefinition = lookupSymbolDefinition(context.bindings, rootUse.element);
    const childDefinition = lookupSymbolDefinition(context.bindings, childUse.element);
    assert.equal(rootDefinition?.value, 'Root');
    assert.equal(rootDefinition?.location?.source.uri, parent.uri);
    assert.equal(childDefinition?.value, 'Child');
    assert.equal(childDefinition?.location?.source.uri, includeUri);
});
