// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Lexer } from '../../lexer/lexer';
import { ProblemCollection } from '../../core/problemCollection';
import { FileSource } from '../../source/fileSource';
import type { AnalysisSourceSnapshot } from '../../utility/analysisSourceSnapshot';
import { AnalysisSnapshotCollector, type SnapshotSourceProvider } from '../../utility/analysisSnapshotCollector';
import { SnapshotIncludeSourceResolver } from '../../utility/snapshotIncludeSourceResolver';
import { createPredefinedMacroTable } from '../createPredefinedMacroTable';
import { Validator } from '../../validation/validator';
import { LocalAnalysisExecutor } from '../../utility/localAnalysisExecutor';
import type { WorkspaceManager } from '../../utility/workspace';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import { ConditionalStack } from '../conditionalStack';
import { Preprocessor } from '../preprocessor';
import { PreprocessorContext } from '../preprocessorContext';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import type { IncludeSourceResolver } from '../includeSourceResolver';
import type { PearlSettings } from '../../settings/pearlSettings';
import type { Logger } from '../../utility/logging/logger';

const logger: Logger = { info() {}, warn() {}, error() {} };
const settings: PearlSettings = {
    traceServer: 'off', workingDirMode: 'file', maxNumberOfProblems: 100,
    warnOnCharTruncation: true, macros: { Outside: 'sub' }
};
function src(uri: string, text: string): AnalysisSourceSnapshot {
    return { uri, languageId: 'pearl', version: 1, text };
}

function preprocess(root: AnalysisSourceSnapshot, resolver: IncludeSourceResolver) {
    const source = new FileSource(root.uri, root.text);
    const problems = new ProblemCollection();
    const context = new PreprocessorContext(
        resolver, createPredefinedMacroTable(settings), new ConditionalStack(),
        new PreprocessorConditionalBlockStack()
    );
    const result = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    return {
        text: result.source.text,
        included: [...context.includedSourceUris].sort(),
        watched: [...context.watchedIncludeUris].sort(),
        occurrenceSites: context.includeOccurrences.map(item => [item.id, item.sourceUri, item.sites.length]).sort(),
        problemCount: problems.size()
    };
}

test('captured replay is equivalent to live preprocessor for nested, repeated, guarded and missing includes', () => {
    const root = src('file:///project/main.P', `#define Enabled
#ifdef Never
#include "inactive.h"
#endif
#include Outside/outer.h
#include Outside/outer.h
#include "missing.h"
MODULE Test; PROBLEM; MODEND;`);
    const outer = src('file:///project/sub/outer.h', '#include "inner.h"\nTYPE Outer FIXED;\n');
    const inner = src('file:///project/sub/inner.h', '#ifndef INNER_INCLUDED\n#define INNER_INCLUDED\nTYPE Inner FIXED;\n#endif\n');
    const files = new Map([root, outer, inner].map(item => [item.uri, item]));
    const live: SnapshotSourceProvider = {
        get(uri) {
            const source = files.get(uri);
            return source ? { ...source, getText: () => source.text } : null;
        },
        resolveIncludeUri(uri, includePath) { return new URL(includePath, uri).href; },
        resolveInclude(uri, includePath) {
            return this.get(this.resolveIncludeUri(uri, includePath));
        }
    };
    const expected = preprocess(root, live);
    const capture = new AnalysisSnapshotCollector(live, logger).collect(root, settings);
    const actual = preprocess(root, new SnapshotIncludeSourceResolver(root, capture));
    assert.deepEqual(actual, expected);
    assert.equal(actual.occurrenceSites.filter(item => item[1] === inner.uri).length, 2);
    assert.equal(actual.included.length, 2);
    assert.equal(actual.watched.length, 3);
    assert.equal(actual.problemCount, 1);
    assert.ok(!capture.resolutions.some(item => item.includePath === 'inactive.h'));
});


test('full Validator analysis produces identical result with live and captured include access', async () => {
    const root = src('file:///project/main.P', `#include "outer.h"
#include "outer.h"
#include "missing.h"
MODULE Main; PROBLEM;
TYPE Number FIXED;
MODEND;`);
    const outer = src('file:///project/outer.h', '#include "inner.h"\nTYPE Outer FIXED;\n');
    const inner = src('file:///project/inner.h', 'TYPE Inner FIXED;\n');
    const documents = new Map([root, outer, inner].map(item => [item.uri, item]));
    const live: SnapshotSourceProvider = {
        get(uri) {
            const document = documents.get(uri);
            return document ? { ...document, getText: () => document.text } : null;
        },
        resolveIncludeUri(uri, includePath) { return new URL(includePath, uri).href; },
        resolveInclude(uri, includePath) {
            return this.get(this.resolveIncludeUri(uri, includePath));
        }
    };
    const validator = new Validator({} as WorkspaceManager, live as unknown as DocumentRegistry, logger);
    const executor = new LocalAnalysisExecutor((document, configuration, resolver) =>
        validator.analyze(document, configuration, resolver));
    const baseline = await executor.execute({ source: root, settings });
    const captures = new AnalysisSnapshotCollector(live, logger).collect(root, settings);
    const replay = await executor.execute({ source: root, settings, includeSnapshots: captures });

    assert.deepEqual(replay.includedSourceUris, baseline.includedSourceUris);
    assert.deepEqual(replay.watchedIncludeUris, baseline.watchedIncludeUris);
    assert.deepEqual(replay.includeOccurrences.map(item => [item.id, item.sourceUri, item.expandedSpan]),
        baseline.includeOccurrences.map(item => [item.id, item.sourceUri, item.expandedSpan]));
    assert.equal(replay.problems.size(), baseline.problems.size());
    assert.deepEqual(replay.rootAnalysis.source.uri, baseline.rootAnalysis.source.uri);
    assert.equal(replay.rootAnalysis.ast.constructor.name, baseline.rootAnalysis.ast.constructor.name);
});
