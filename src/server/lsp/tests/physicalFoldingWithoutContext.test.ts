// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Logger } from '../../utility/logging/logger';
import { createFoldingRangesForDocument } from '../createFoldingRangesForDocument';

const logger: Logger = { info() {}, warn() {}, error() {} };

function physicalFolds(text: string) {
    const document = TextDocument.create('file:///tests/HGuard.h', 'pearl', 1, text);
    // Simulates a shared include opened before any CodeLens context was chosen.
    return createFoldingRangesForDocument(document, undefined, undefined, logger);
}

test('a newly opened shared header folds its include guard without an analysis or selection', () => {
    const folds = physicalFolds('#ifndef GUARD\n#define GUARD\nDCL Value FIXED;\n#endif\n');
    assert.deepEqual(folds, [{ startLine: 0, endLine: 2 }]);
});

test('physical folding recognizes both branches and nested conditions without evaluating macros', () => {
    const folds = physicalFolds([
        '#ifdef FIRST',
        'DCL A FIXED;',
        '#ifndef SECOND',
        'DCL B FIXED;',
        '#endif',
        '#else',
        'DCL C FIXED;',
        '#endif',
        ''
    ].join('\n'));
    assert.deepEqual(folds, [
        { startLine: 0, endLine: 4 },
        { startLine: 2, endLine: 3 },
        { startLine: 5, endLine: 6 }
    ]);
});

test('directive-looking strings and line comments do not create folding regions', () => {
    const folds = physicalFolds([
        '! #ifdef COMMENT',
        "DCL Text CHAR(20) INIT('#ifdef STRING');",
        '! #endif',
        ''
    ].join('\n'));
    assert.deepEqual(folds, []);
});

test('block comments fold without a parent analysis or selected include occurrence', () => {
    const folds = physicalFolds('/* line one\nline two\nline three */\nDCL A FIXED;\n');
    assert.deepEqual(folds, [{ startLine: 0, endLine: 1 }]);
});
