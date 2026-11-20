// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { DiagnosticPublicationManager } from '../diagnosticPublicationManager';

const moduleA = 'file:///project/Module1.P';
const moduleB = 'file:///project/Module2.P';
const include = 'file:///project/Include.h';

function diagnostic(message: string): Diagnostic {
    return {
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 }
        },
        severity: DiagnosticSeverity.Error,
        message
    };
}

function fixture(): {
    publisher: DiagnosticPublicationManager;
    sent: Array<{ uri: string; diagnostics: Diagnostic[] }>;
} {
    const sent: Array<{ uri: string; diagnostics: Diagnostic[] }> = [];
    const publisher = new DiagnosticPublicationManager((uri, diagnostics) => {
        sent.push({ uri, diagnostics });
    });
    return { publisher, sent };
}

test('analyzing Module2 must not clear Module1 diagnostics', () => {
    const { publisher, sent } = fixture();
    const firstDiagnostic = diagnostic('Problem in Module1');
    const secondDiagnostic = diagnostic('Problem in Module2');

    publisher.publish(moduleA, new Map([[moduleA, [firstDiagnostic]]]));
    publisher.publish(moduleB, new Map([[moduleB, [secondDiagnostic]]]));

    assert.deepEqual(sent, [
        { uri: moduleA, diagnostics: [firstDiagnostic] },
        { uri: moduleB, diagnostics: [secondDiagnostic] }
    ]);
});

test('reanalyzing Module1 must only replace diagnostics owned by Module1', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[moduleA, [diagnostic('Old problem in Module1')]]]));
    publisher.publish(moduleB, new Map([[moduleB, [diagnostic('Problem in Module2')]]]));

    sent.length = 0;
    publisher.publish(moduleA, new Map([[moduleA, []]]));

    assert.deepEqual(sent, [
        { uri: moduleA, diagnostics: [] }
    ]);
});

test('closing Module1 clears only its diagnostics', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[moduleA, [diagnostic('A')]]]));
    publisher.publish(moduleB, new Map([[moduleB, [diagnostic('B')]]]));

    sent.length = 0;
    publisher.removeUnit(moduleA);

    assert.deepEqual(sent, [{ uri: moduleA, diagnostics: [] }]);
});

test('a shared include keeps its selected context when another unit is analyzed', () => {
    const { publisher, sent } = fixture();
    const declared = diagnostic('Declaration context');
    const specified = diagnostic('Specification context');

    publisher.publish(moduleA, new Map([[include, [declared]]]), [include]);
    sent.length = 0;
    publisher.publish(moduleB, new Map([[include, [specified]]]), [include]);

    // Module2 must not overwrite the visible Module1 interpretation.
    assert.deepEqual(sent, [{ uri: moduleB, diagnostics: [] }]);

    sent.length = 0;
    publisher.publish(moduleB, new Map([[include, [diagnostic('Revised specification')]]]), [include]);
    // The selected include context is still Module1.
    assert.deepEqual(sent, [{ uri: moduleB, diagnostics: [] }]);
});

test('dropping one owner of a shared include preserves the other interpretation', () => {
    const { publisher, sent } = fixture();
    const other = diagnostic('Other unit');
    publisher.publish(moduleA, new Map([[include, [diagnostic('First unit')]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [other]]]), [include]);

    sent.length = 0;
    publisher.removeUnit(moduleA);

    assert.deepEqual(sent, [
        { uri: moduleA, diagnostics: [] },
        { uri: include, diagnostics: [other] }
    ]);
});

test('removing a formerly included file clears only diagnostics from its unit', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[include, [diagnostic('From include')]]]), [include]);
    publisher.publish(moduleB, new Map([[moduleB, [diagnostic('Independent')]]]));

    sent.length = 0;
    publisher.publish(moduleA, new Map(), []);

    assert.deepEqual(sent, [
        { uri: moduleA, diagnostics: [] },
        { uri: include, diagnostics: [] }
    ]);
});

test('explicit include selection switches only its diagnostics', () => {
    const { publisher, sent } = fixture();
    const fromA = diagnostic('Declaration diagnostic');
    const fromB = diagnostic('Specification diagnostic');
    publisher.publish(moduleA, new Map([[include, [fromA]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [fromB]]]), [include]);

    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleB), true);
    assert.deepEqual(sent, [{ uri: include, diagnostics: [fromB] }]);

    sent.length = 0;
    publisher.publish(moduleA, new Map([[include, [diagnostic('Revised declaration')]]]), [include]);
    assert.deepEqual(sent, [{ uri: moduleA, diagnostics: [] }]);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Revised specification')]]]), [include]);
    assert.deepEqual(sent.at(-1), {
        uri: include,
        diagnostics: [diagnostic('Revised specification')]
    });
});

test('invalid explicit diagnostic context does not alter publication', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[include, [diagnostic('Declaration')]]]), [include]);
    publisher.publish(moduleB, new Map([[moduleB, [diagnostic('Other')]]]), [moduleB]);
    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleB), false);
    assert.deepEqual(sent, []);
});

test('diagnostic context falls back to remaining parent when the chosen unit closes', () => {
    const { publisher, sent } = fixture();
    const first = diagnostic('Declaration');
    const second = diagnostic('Specification');
    publisher.publish(moduleA, new Map([[include, [first]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [second]]]), [include]);
    publisher.selectContext(include, moduleB);
    sent.length = 0;
    publisher.removeUnit(moduleB);
    assert.deepEqual(sent, [
        { uri: moduleB, diagnostics: [] },
        { uri: include, diagnostics: [first] }
    ]);
});
