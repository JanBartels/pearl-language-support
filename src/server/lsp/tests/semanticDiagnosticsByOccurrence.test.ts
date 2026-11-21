// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Validator } from '../../validation/validator';
import { defaultSettings } from '../../settings/pearlSettings';
import { mapDiagnostics } from '../diagnosticMapper';
import { DiagnosticPublicationManager } from '../diagnosticPublicationManager';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';
import type { WorkspaceManager } from '../../utility/workspace';

const unitUri = 'file:///tests/TEST.P';
const includeUri = 'file:///tests/testinc.h';
const root = `P=MPC603;
SC=2000;
MODULE M;
PROBLEM;
#include "testinc.h"
#include "testinc.h"
Main: PROC;
    DCL L FIXED;
    L := ExtVar;
END;
MODEND;`;
const header = `#ifndef TESTINC_H
#define TESTINC_H
DCL ExtVar FIXED;
#endif`;
const quiet: Logger = { info() {}, warn() {}, error() {} };

test('real semantic warning is scoped to the first executed include guard', async () => {
    const docs = new Map([
        [unitUri, TextDocument.create(unitUri, 'pearl', 1, root)],
        [includeUri, TextDocument.create(includeUri, 'pearl', 1, header)]
    ]);
    const registry = {
        get: (uri: string) => docs.get(uri) ?? null,
        resolveInclude: (_uri: string, name: string) =>
            name === 'testinc.h' ? docs.get(includeUri) ?? null : null
    } as unknown as DocumentRegistry;
    const validator = new Validator({} as WorkspaceManager, registry, quiet);
    const result = await validator.analyze(docs.get(unitUri)!, defaultSettings);
    const occurrences = result.includeOccurrences.filter(o => o.sourceUri === includeUri)
        .sort((a, b) => a.expandedSpan.start - b.expandedSpan.start);
    assert.equal(occurrences.length, 2);

    const warning = result.problems.toArray().find(problem =>
        problem.message === "Variable 'ExtVar' wird gelesen, aber niemals beschrieben.");
    assert.ok(warning, 'Missing read-but-never-written warning');
    assert.equal(warning.includeOccurrenceId, occurrences[0]!.id);

    const mapped = mapDiagnostics(result.problems, registry);
    const messages: Array<{ uri: string; messages: string[] }> = [];
    const publisher = new DiagnosticPublicationManager((uri, diagnostics) => {
        messages.push({ uri, messages: diagnostics.map(d => d.message) });
    });
    publisher.publish(unitUri, mapped,
        [...result.files.keys(), ...(result.includedSourceUris ?? [])],
        result.includeOccurrences);
    // Project-wide diagnostics are available immediately without a CodeLens
    // choice, with provenance visible in the message.
    assert.ok(messages.some(item => item.uri === includeUri &&
        item.messages.some(message => message.includes(warning.message))));

    assert.equal(publisher.selectContext(includeUri, unitUri, occurrences[0]!.id), true);
    assert.deepEqual(messages.at(-1), { uri: includeUri, messages: [warning.message] });
    assert.equal(publisher.selectContext(includeUri, unitUri, occurrences[1]!.id), true);
    // The inactive-region hint is expected; the semantic warning is not.
    assert.equal(messages.at(-1)?.uri, includeUri);
    assert.ok(messages.at(-1)?.messages.includes('Inaktiver Code (Präprozessor).'));
    assert.ok(!messages.at(-1)?.messages.includes(warning.message));
});

test('real compiler syntax/semantic errors in a guarded include are visible without editor selection', async () => {
    // This fixture does not open an editor for the included header. The
    // translation-unit analysis alone must make the header error visible.
    const badHeader = `#ifndef TESTINC_H
#define TESTINC_H
DCL Bad FIXED;
DCL Bad FIXED;
#endif`;
    const main = `P=MPC603;
SC=2000;
MODULE M;
PROBLEM;
#include "testinc.h"
#include "testinc.h"
MODEND;`;
    const docs = new Map([
        [unitUri, TextDocument.create(unitUri, 'pearl', 1, main)],
        [includeUri, TextDocument.create(includeUri, 'pearl', 0, badHeader)]
    ]);
    const registry = {
        get: (uri: string) => docs.get(uri) ?? null,
        resolveInclude: (_uri: string, name: string) =>
            name === 'testinc.h' ? docs.get(includeUri) ?? null : null
    } as unknown as DocumentRegistry;
    const result = await new Validator({} as WorkspaceManager, registry, quiet)
        .analyze(docs.get(unitUri)!, defaultSettings);
    const diagnostics = mapDiagnostics(result.problems, registry);
    const expected = diagnostics.get(includeUri)?.filter(item => item.severity === 1) ?? [];
    assert.ok(expected.length >= 1, 'Expected a compiler error in the header');
    const sent: Array<{ uri: string; diagnostics: string[] }> = [];
    const publisher = new DiagnosticPublicationManager((uri, items) => {
        sent.push({ uri, diagnostics: items.map(item => item.message) });
    });
    publisher.publish(unitUri, diagnostics,
        [...result.files.keys(), ...(result.includedSourceUris ?? [])],
        result.includeOccurrences);
    const published = sent.filter(item => item.uri === includeUri).at(-1);
    assert.ok(published, 'Header errors should be published without CodeLens');
    for (const error of expected) {
        assert.ok(published.diagnostics.some(msg => msg.includes(error.message)));
    }
});
