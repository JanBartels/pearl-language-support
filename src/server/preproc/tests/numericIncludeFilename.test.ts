// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Lexer } from '../../lexer/lexer';
import { TokenKind } from '../../lexer/token';
import { FileSource } from '../../source/fileSource';
import { ProblemCollection } from '../../core/problemCollection';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { MacroTable } from '../macroTable';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const rootUri = 'file:///project/Main.P';

function preprocess(text: string, includes: ReadonlyMap<string, string>) {
    const source = new FileSource(rootUri, text);
    const problems = new ProblemCollection();
    const registry = {
        resolveInclude: (from: string, path: string) => {
            const uri = new URL(path, from).href;
            const content = includes.get(uri);
            return content === undefined ? null : { uri, getText: () => content };
        },
        addInclude() {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source,
        context, problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    return { expanded, problems, context };
}

test('lexer treats a digit-led #include file-name segment as preprocessor text', () => {
    const source = new FileSource(rootUri,
        '#include "12_SharedTypes.h"\n#include 34_Numbers.inc\n#include "lib/.56_Name.7x"\n');
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    assert.equal(problems.size(), 0);
    for (const segment of ['12_SharedTypes', '34_Numbers', '.56_Name', '.7x']) {
        assert.ok(tokens.some(token => token.kind === TokenKind.PreprocessorText
            && source.getText(token.location.span) === segment), segment);
    }
});

test('external preprocessor resolves numeric file names recursively and preserves macro paths', () => {
    const root = '#define Dir "lib"\n#include "12_SharedTypes.h"\n#include Dir/56_Extra.inc\nMODULE M; PROBLEM; MODEND;';
    const includes = new Map([
        ['file:///project/12_SharedTypes.h', 'TYPE Shared FIXED;\n#include 34_Inner.def\n'],
        ['file:///project/34_Inner.def', 'TYPE Inner FLOAT;\n'],
        ['file:///project/lib/56_Extra.inc', 'TYPE Extra FIXED;\n']
    ]);
    const result = preprocess(root, includes);
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    for (const type of ['TYPE Shared FIXED;', 'TYPE Inner FLOAT;', 'TYPE Extra FIXED;']) {
        assert.ok(result.expanded.source.text.includes(type), type);
    }
    assert.deepEqual(new Set(result.context.includedSourceUris), new Set(includes.keys()));
    assert.equal(result.context.includeOccurrences.length, 3);
});

test('inactive #include with numeric file name does not emit lexer errors or dependencies', () => {
    const result = preprocess('#ifdef MISSING\n#include "12_SharedTypes.h"\n#endif\n', new Map());
    assert.deepEqual(result.problems.toArray().map(p => p.message), []);
    assert.deepEqual([...result.context.includedSourceUris], []);
});

test('ordinary malformed PEARL number literal remains invalid', () => {
    const source = new FileSource(rootUri,
        '#include "12_SharedTypes.h"\nMODULE M; PROBLEM; DCL X FIXED INIT(12_BOGUS); MODEND;');
    const problems = new ProblemCollection();
    new Lexer(source, problems, logger).tokenize();
    assert.ok(problems.toArray().some(p => p.message === 'Invalid number literal.'));
});
