// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import { ConditionalStack } from '../conditionalStack';
import { MacroTable } from '../macroTable';
import { Preprocessor } from '../preprocessor';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorContext } from '../preprocessorContext';

const quiet: Logger = { info() {}, warn() {}, error() {} };
const fileA = 'file:///project/A.h';
const fileB = 'file:///project/B.h';

function activeIncludes(declarations: boolean): string[] {
    const source = new FileSource('file:///project/main.P', `
#ifdef DEKLARATIONEN
#include A.h
#else
#include B.h
#endif
`);
    const files = new Map([
        ['A.h', { uri: fileA, getText: () => 'TYPE A FIXED;' }],
        ['B.h', { uri: fileB, getText: () => 'TYPE B FIXED;' }]
    ]);
    const registry = {
        resolveInclude: (_sourceUri: string, name: string) => files.get(name) ?? null
    } as unknown as DocumentRegistry;
    const macros = new MacroTable();
    if (declarations) macros.define('DEKLARATIONEN', null);
    const context = new PreprocessorContext(
        registry, macros, new ConditionalStack(), new PreprocessorConditionalBlockStack()
    );
    const problems = new ProblemCollection();
    const tokens = new Lexer(source, problems, quiet).tokenize();
    Preprocessor.createExpanded(
        tokens, source, context, problems, [],
        new PreprocessorConditionalBlockCollection(), quiet
    );
    return [...context.includedSourceUris];
}

test('preprocessor records only the declaration branch include', () => {
    assert.deepEqual(activeIncludes(true), [fileA]);
});

test('preprocessor records only the specification branch include', () => {
    assert.deepEqual(activeIncludes(false), [fileB]);
});
