// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { FileSource } from '../../source/fileSource';
import { Lexer } from '../../lexer/lexer';
import { ConditionalStack } from '../conditionalStack';
import { MacroTable } from '../macroTable';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorInactiveRegionCollector } from '../preprocessorInactiveRegionCollector';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function collect(text: string, enabled: readonly string[] = []) {
    const source = new FileSource('file:///inactive.p', text);
    const problems = new ProblemCollection();
    const table = new MacroTable();
    for (const macro of enabled) table.define(macro, null);
    const blocks = new PreprocessorConditionalBlockCollection();
    const context = new PreprocessorContext(
        {} as DocumentRegistry, table, new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, [], blocks, logger
    );
    assert.deepEqual(problems.toArray().map(p => p.message), []);
    return new PreprocessorInactiveRegionCollector().collect(blocks)
        .map(location => source.getText(location.span));
}

test('disabled #ifdef branch is a single inactive range excluding directive lines', () => {
    assert.deepEqual(collect('#ifdef NOT_DEFINED\nDCL X FIXED;\n#endif\nDCL Y FIXED;\n'),
        ['DCL X FIXED;\n']);
});

test('only #else branch is inactive when condition is true', () => {
    assert.deepEqual(collect('#ifdef FEATURE\nDCL Active FIXED;\n#else\nDCL Inactive FIXED;\n#endif\n', ['FEATURE']),
        ['DCL Inactive FIXED;\n']);
});

test('false #ifndef with #else marks its first branch', () => {
    assert.deepEqual(collect('#ifndef FEATURE\nDCL Inactive FIXED;\n#else\nDCL Active FIXED;\n#endif\n', ['FEATURE']),
        ['DCL Inactive FIXED;\n']);
});

test('nested inactive branches are merged and not reported twice', () => {
    assert.deepEqual(collect('#ifdef MISSING\nfirst\n#ifdef CHILD\ninner\n#else\nother\n#endif\nlast\n#endif\n', ['CHILD']),
        ['first\n#ifdef CHILD\ninner\n#else\nother\n#endif\nlast\n']);
});

test('independent inactive branches stay separate', () => {
    assert.deepEqual(collect('#ifdef NO\nfirst\n#endif\nactive\n#ifndef YES\nsecond\n#endif\n', ['YES']),
        ['first\n', 'second\n']);
});

test('CRLF and empty branches are handled without false ranges', () => {
    assert.deepEqual(collect('#ifdef NO\r\nX;\r\n#endif\r\n#ifdef NO\r\n#endif\r\n'),
        ['X;\r\n']);
});
