// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ProblemCollection } from '../../core/problemCollection';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import type { Logger } from '../../utility/logging/logger';
import type { AnalysisIncludeSourceSnapshotSet, AnalysisSourceSnapshot } from '../../utility/analysisSourceSnapshot';
import { SnapshotIncludeSourceResolver } from '../../utility/snapshotIncludeSourceResolver';
import { ConditionalStack } from '../conditionalStack';
import { MacroTable } from '../macroTable';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';

const logger: Logger = { info() {}, warn() {}, error() {} };

test('captured includes preserve repeated nested occurrences and missing-file watches', () => {
    const root: AnalysisSourceSnapshot = {
        uri: 'file:///project/Main.P', languageId: 'pearl', version: 6,
        text: `MODULE Main; PROBLEM;
#include "Outer.h"
#include "Outer.h"
#include "Missing.h"
MODEND;`
    };
    const outer: AnalysisSourceSnapshot = {
        uri: 'file:///project/Outer.h', languageId: 'pearl', version: 2,
        text: '#include "Inner.h"\nTYPE Outer FIXED;\n'
    };
    const inner: AnalysisSourceSnapshot = {
        uri: 'file:///project/Inner.h', languageId: 'pearl', version: 4,
        text: 'TYPE Inner FLOAT;\n'
    };
    const missing = 'file:///project/Missing.h';
    const capture: AnalysisIncludeSourceSnapshotSet = {
        sources: [outer, inner],
        resolutions: [
            { includingUri: root.uri, includePath: 'Outer.h', targetUri: outer.uri, found: true },
            { includingUri: outer.uri, includePath: 'Inner.h', targetUri: inner.uri, found: true },
            { includingUri: root.uri, includePath: 'Missing.h', targetUri: missing, found: false }
        ]
    };
    const resolver = new SnapshotIncludeSourceResolver(root, capture);
    const fileSource = new FileSource(root.uri, root.text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        resolver, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const expanded = Preprocessor.createExpanded(
        new Lexer(fileSource, problems, logger).tokenize(), fileSource, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    assert.equal(context.includeOccurrences.filter(item => item.sourceUri === outer.uri).length, 2);
    assert.equal(context.includeOccurrences.filter(item => item.sourceUri === inner.uri).length, 2);
    assert.deepEqual(new Set(context.includedSourceUris), new Set([outer.uri, inner.uri]));
    assert.deepEqual(new Set(context.watchedIncludeUris), new Set([outer.uri, inner.uri, missing]));
    assert.equal((expanded.source.text.match(/TYPE Inner FLOAT/g) ?? []).length, 2);
    assert.equal(problems.size(), 1); // The missing include, never a separate translation unit.
});

test('macro-expanded include paths and inactive branches use only executed lookups', () => {
    const root: AnalysisSourceSnapshot = {
        uri: 'file:///project/Main.P', languageId: 'pearl', version: 9,
        text: `#define Dir "lib"
#ifdef NOT_DEFINED
#include "Uncaptured.h"
#endif
#include Dir/12_Types.h
MODULE Main; PROBLEM; MODEND;`
    };
    const include: AnalysisSourceSnapshot = {
        uri: 'file:///project/lib/12_Types.h', languageId: 'pearl', version: 1,
        text: 'TYPE Number FIXED;\n'
    };
    const resolver = new SnapshotIncludeSourceResolver(root, {
        sources: [include],
        resolutions: [{
            includingUri: root.uri, includePath: 'lib/12_Types.h',
            targetUri: include.uri, found: true
        }]
    });
    const source = new FileSource(root.uri, root.text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        resolver, new MacroTable(), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    assert.equal(problems.size(), 0);
    assert.equal(context.includeOccurrences.length, 1);
    assert.deepEqual([...context.includedSourceUris], [include.uri]);
    assert.match(expanded.source.text, /TYPE Number FIXED/);
});
