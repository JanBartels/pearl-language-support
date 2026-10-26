// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { MacroSource } from '../../source/macroSource';
import { appendIncludeOriginDocumentation } from '../includeOriginDocumentation';

const root = new FileSource('file:///project/main.p', 'HELLO');
const include = new FileSource('file:///project/lib/definitions_file.inc', 'NAME');
const at = (source: FileSource, end: number) => ({ source, span: { start: 0, end } });

test('hover: bound symbol declared in include shows only the include filename', () => {
    const result = appendIncludeOriginDocumentation('**Type**', at(include, 4), root.uri, root.uri);
    assert.match(result, /Deklariert in Include-Datei/);
    assert.match(result, /`definitions_file\.inc`/);
    assert.ok(!result.includes('definitions\\_file'));
});

test('hover: symbols from the current file or root source have no note', () => {
    assert.equal(appendIncludeOriginDocumentation('hover', at(root, 5), root.uri, root.uri), 'hover');
    assert.equal(appendIncludeOriginDocumentation('hover', at(include, 4), include.uri, root.uri), 'hover');
    assert.equal(appendIncludeOriginDocumentation('hover', undefined, root.uri, root.uri), 'hover');
});

test('hover: macro source locations are traced to their real physical declaration', () => {
    const expanded = new MacroSource(at(include, 4), 'NAME');
    const result = appendIncludeOriginDocumentation('Macro',
        { source: expanded, span: { start: 0, end: 4 } }, root.uri, root.uri);
    assert.match(result, /`definitions_file\.inc`/);
});

test('hover: real include TYPE binding supplies the declaration file', async () => {
    const { ProblemCollection } = await import('../../core/problemCollection');
    const { Lexer } = await import('../../lexer/lexer');
    const { Parser } = await import('../../parser/parser');
    const { Preprocessor } = await import('../../preproc/preprocessor');
    const { PreprocessorContext } = await import('../../preproc/preprocessorContext');
    const { MacroTable } = await import('../../preproc/macroTable');
    const { ConditionalStack } = await import('../../preproc/conditionalStack');
    const { PreprocessorConditionalBlockStack } = await import('../../preproc/preprocessorConditionalBlockStack');
    const { PreprocessorConditionalBlockCollection } = await import('../../preproc/preprocessorConditionalBlockCollection');
    const { SemanticAnalyzer } = await import('../../semantic/semanticAnalyzer');
    const { lookupBoundSymbol } = await import('../../semantic/bindingIndex');
    const { AstLookupResultDocumentationProvider } = await import('../astLookupResultDocumentationProvider');
    const uri = 'file:///project/root.p';
    const incUri = 'file:///project/lib/symbol_defs.inc';
    const inc = 'TYPE Shared FIXED;';
    const text = 'MODULE Main; PROBLEM;\n#include "lib/symbol_defs.inc"\nDCL x REF Shared; MODEND;';
    const registry = {
        resolveInclude: () => ({ uri: incUri, getText: () => inc }),
        addInclude: () => undefined
    } as never;
    const logger = { info() {}, warn() {}, error() {} };
    const problems = new ProblemCollection();
    const source = new FileSource(uri, text);
    const tokens = new Lexer(source, problems, logger).tokenize();
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const stream = Preprocessor.create(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    const ast = new Parser(stream, problems, logger).parse();
    const semantic = new SemanticAnalyzer().analyze(ast);
    const nameOffset = text.lastIndexOf('Shared');
    const lookup = ast.lookupSourceValue({ uri, offset: nameOffset });
    assert.ok(lookup);
    const symbol = lookupBoundSymbol(semantic.bindings, lookup.element);
    assert.ok(symbol);
    assert.equal(symbol.definition?.location?.source.uri, incUri);
    const hover = AstLookupResultDocumentationProvider.getDocumentation(lookup, semantic);
    assert.ok(hover);
    const decorated = appendIncludeOriginDocumentation(hover,
        (symbol.definition ?? symbol.name).location, uri, uri);
    assert.match(decorated, /`symbol_defs\.inc`/);
    assert.equal(problems.size(), 0);
});
