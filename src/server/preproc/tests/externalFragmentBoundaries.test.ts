// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { ProblemCollection } from '../../core/problemCollection';
import { MacroTable } from '../macroTable';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorContext } from '../preprocessorContext';
import { Preprocessor } from '../preprocessor';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { MacroReference } from '../macroReference';

const logger: Logger = { info() {}, warn() {}, error() {} };
const rootUri = 'file:///tests/fragment.P';
const includeUri = 'file:///tests/testinc.h';

function expand(input: string, included?: string) {
    const source = new FileSource(rootUri, input);
    const problems = new ProblemCollection();
    const refs: MacroReference[] = [];
    const includes: string[] = [];
    const registry = {
        resolveInclude: (_uri: string, path: string) => {
            includes.push(path);
            return path === '/home/jan/pearl-lsp/testinc.h' && included !== undefined
                ? { uri: includeUri, getText: () => included }
                : null;
        },
        addInclude: () => undefined
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(
        registry, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const result = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, refs, new PreprocessorConditionalBlockCollection(), logger
    );
    return { result, problems, includes };
}

test('removed #define retains physical line separation between PEARL identifiers', () => {
    const { result, problems } = expand(
        'MODULE; PROBLEM;\nDCL A FIXED\n#define X "20"\nDCL B FIXED;\nMODEND;\n'
    );
    assert.match(result.source.text, /FIXED\s+DCL B/);
    assert.equal(problems.size(), 0);
});

test('disabled branch retains physical newline and does not join identifiers', () => {
    const { result, problems } = expand(
        'MODULE; PROBLEM;\nDCL A FIXED\n#ifdef NEVER\nDCL X FIXED;\n#endif\nDCL B FIXED;\nMODEND;\n'
    );
    assert.match(result.source.text, /FIXED\s+DCL B/);
    assert.doesNotMatch(result.source.text, /DCL X FIXED/);
    assert.equal(problems.size(), 0);
});

test('generated comment delimiters remain untouched by boundary preservation', () => {
    const { result, problems } = expand(
        'MODULE; PROBLEM;\n#define Open "/*"\n#define Close "*/"\nSPC A(Open 0:40 Close) FIXED GLOBAL;\nMODEND;\n'
    );
    assert.match(result.source.text, /SPC A\(\/\* 0:40 \*\/\) FIXED GLOBAL;/);
    assert.equal(problems.size(), 0);
});

test('both established #include path spellings remain supported', () => {
    const { result, includes, problems } = expand(
        `#ifndef InclDir\n#define InclDir "'/home/jan/pearl-lsp'"\n#endif\nMODULE; PROBLEM;\n#include InclDir/testinc.h\n#include "InclDir/testinc.h"\nMODEND;\n`,
        'DCL Test FIXED;\n'
    );
    assert.deepEqual(includes, [
        '/home/jan/pearl-lsp/testinc.h',
        '/home/jan/pearl-lsp/testinc.h'
    ]);
    assert.equal((result.source.text.match(/DCL Test FIXED;/g) ?? []).length, 2);
    assert.equal(problems.size(), 0);
});
