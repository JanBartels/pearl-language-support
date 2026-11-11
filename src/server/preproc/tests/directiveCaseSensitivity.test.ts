// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { MacroTable } from '../macroTable';
import { ConditionalStack } from '../conditionalStack';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };

function preprocess(text: string) {
    const source = new FileSource('file:///directive-case.P', text);
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, logger).tokenize();
    const registry = { resolveInclude: () => null, addInclude: () => {} } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, new MacroTable(),
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const result = Preprocessor.createExpanded(tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), logger);
    return { text: result.source.text, problems };
}

test('external preprocessor rejects uppercase #IFDEF in an active branch', () => {
    const result = preprocess('#IFDEF FLAG\nMODULE M; PROBLEM; MODEND;\n');
    assert.match(result.text, /MODULE M/);
    assert.ok(result.problems.size() > 0);
});

test('uppercase #IFDEF does not open a nested conditional inside an inactive branch', () => {
    const result = preprocess('#ifdef UNKNOWN\n#IFDEF FLAG\n#endif\n'
        + 'MODULE Visible; PROBLEM; MODEND;\n');
    assert.match(result.text, /MODULE Visible/);
    assert.equal(result.problems.size(), 0);
});

test('lowercase #ifdef/#endif still delimit inactive sections', () => {
    const result = preprocess('#ifdef UNKNOWN\nDCL Hidden FIXED;\n#endif\n'
        + 'MODULE Visible; PROBLEM; MODEND;\n');
    assert.doesNotMatch(result.text, /Hidden/);
    assert.match(result.text, /MODULE Visible/);
    assert.equal(result.problems.size(), 0);
});
