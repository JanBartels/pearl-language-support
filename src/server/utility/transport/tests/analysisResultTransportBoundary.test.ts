// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentRegistry } from '../../documentRegistry';
import type { WorkspaceManager } from '../../workspace';
import type { PearlSettings } from '../../../settings/pearlSettings';
import { Validator } from '../../../validation/validator';

const settings: PearlSettings = {
    traceServer: 'off', maxNumberOfProblems: 100, workingDirMode: 'file',
    warnOnCharTruncation: true, macros: {}
};

test('an actual AnalysisResult loses essential class APIs under raw structuredClone', async () => {
    const document = TextDocument.create('file:///transfer.P', 'pearl', 1,
        'MODULE Transfer; PROBLEM; DCL X FIXED; MODEND;');
    const validator = new Validator(
        {} as WorkspaceManager,
        { resolveInclude: () => null } as unknown as DocumentRegistry,
        { info() {}, warn() {}, error() {} }
    );
    const result = await validator.analyze(document, settings);
    assert.equal(typeof result.getFile, 'function');
    assert.equal(typeof result.rootAnalysis.ast.lookupSourceValue, 'function');
    assert.equal(typeof result.rootAnalysis.source.mapLocation, 'function');
    assert.equal(typeof result.rootAnalysis.symbolOccurrences.lookup, 'function');

    // Native structuredClone copies fields/Maps, not arbitrary prototypes.
    // This is deliberately NOT a possible AnalysisExecutor implementation.
    const clone = structuredClone(result) as unknown as {
        getFile?: unknown;
        rootAnalysis: {
            ast: { lookupSourceValue?: unknown };
            source: { mapLocation?: unknown };
            symbolOccurrences: { lookup?: unknown };
        };
    };
    assert.equal(typeof clone.getFile, 'undefined');
    assert.equal(typeof clone.rootAnalysis.ast.lookupSourceValue, 'undefined');
    assert.equal(typeof clone.rootAnalysis.source.mapLocation, 'undefined');
    assert.equal(typeof clone.rootAnalysis.symbolOccurrences.lookup, 'undefined');
});
