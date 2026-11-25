// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver/node';
import { DiagnosticPublicationManager } from '../diagnosticPublicationManager';
import type { IncludeOccurrence } from '../../preproc/includeOccurrence';
import { includeOccurrenceId } from '../../preproc/includeOccurrence';

const moduleA = 'file:///project/Module1.P';
const moduleB = 'file:///project/Module2.P';
const include = 'file:///project/Include.h';

function diagnostic(message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error): Diagnostic {
    return {
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 }
        },
        severity,
        message
    };
}

/** Expected LSP presentation for a problem shared by several include contexts. */
function contextDiagnostic(
    message: string,
    origins: string[],
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
): Diagnostic {
    const base = diagnostic(message, severity);
    const sorted = [...origins].sort();
    return {
        ...base,
        message: `${message} (${sorted.length} ${sorted.length === 1 ? 'Kontext' : 'Kontexte'})`,
        relatedInformation: [{
            location: { uri: include, range: base.range },
            message: `Betroffene Kontexte: ${sorted.join(', ')}`
        }]
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
    const declared = diagnostic('Declaration context', DiagnosticSeverity.Warning);
    const specified = diagnostic('Specification context', DiagnosticSeverity.Warning);

    publisher.publish(moduleA, new Map([[include, [declared]]]), [include]);
    // Explicit choice remains stable as further translation units appear.
    assert.equal(publisher.selectContext(include, moduleA), true);
    sent.length = 0;
    publisher.publish(moduleB, new Map([[include, [specified]]]), [include]);

    // Module2 must not overwrite the visible Module1 interpretation.
    assert.deepEqual(sent, [{ uri: moduleB, diagnostics: [] }]);

    sent.length = 0;
    publisher.publish(moduleB, new Map([[include, [diagnostic('Revised specification', DiagnosticSeverity.Warning)]]]), [include]);
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

    assert.deepEqual(sent, [{ uri: include, diagnostics: [other] }]);
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
    const fromA = diagnostic('Declaration diagnostic', DiagnosticSeverity.Warning);
    const fromB = diagnostic('Specification diagnostic', DiagnosticSeverity.Warning);
    publisher.publish(moduleA, new Map([[include, [fromA]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [fromB]]]), [include]);

    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleB), true);
    assert.deepEqual(sent, [{ uri: include, diagnostics: [fromB] }]);

    sent.length = 0;
    publisher.publish(moduleA, new Map([[include, [diagnostic('Revised declaration', DiagnosticSeverity.Warning)]]]), [include]);
    assert.deepEqual(sent, [{ uri: moduleA, diagnostics: [] }]);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Revised specification', DiagnosticSeverity.Warning)]]]), [include]);
    assert.deepEqual(sent.at(-1), {
        uri: include,
        diagnostics: [diagnostic('Revised specification', DiagnosticSeverity.Warning)]
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
    assert.deepEqual(sent, [{ uri: include, diagnostics: [first] }]);
});


const scopedOccurrences: IncludeOccurrence[] = [10, 20].map((directiveOffset, index) => {
    const sites = [{ includingUri: moduleA, directiveOffset, includedUri: include }];
    return {
        id: includeOccurrenceId(sites), sourceUri: include, sites,
        expandedSpan: { start: index * 100, end: index * 100 + 40 }
    };
});

function inactiveHint(occurrenceId: string): Diagnostic & { includeOccurrenceId: string } {
    return { ...diagnostic('Inaktiver Code (Präprozessor).', DiagnosticSeverity.Hint),
        tags: [DiagnosticTag.Unnecessary], includeOccurrenceId: occurrenceId };
}

test('include guard hint belongs to the second execution, not the first', () => {
    const { publisher, sent } = fixture();
    const ordinary = diagnostic('Real compiler diagnostic');
    const disabled = inactiveHint(scopedOccurrences[1]!.id);
    publisher.publish(moduleA, new Map([[include, [ordinary, disabled]]]),
        [include], scopedOccurrences);
    // Unselected execution: compiler errors remain visible, but the
    // inactive-region hint must not dim the whole physical file.
    assert.deepEqual(sent.at(-1), {
        uri: include, diagnostics: [contextDiagnostic('Real compiler diagnostic', ['Module1.P'])]
    });

    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[0]!.id), true);
    assert.deepEqual(sent, [{ uri: include,
        diagnostics: [contextDiagnostic('Real compiler diagnostic', ['Module1.P'])] }]);
    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id), true);
    assert.deepEqual(sent, [{ uri: include, diagnostics: [
        contextDiagnostic('Real compiler diagnostic', ['Module1.P']),
        { ...diagnostic(disabled.message, DiagnosticSeverity.Hint),
            tags: [DiagnosticTag.Unnecessary] }] }]);
    assert.equal('includeOccurrenceId' in sent[0]!.diagnostics[1]!, false);
});

test('chosen execution is retained across reanalysis, and stale scope does not leak', () => {
    const { publisher, sent } = fixture();
    const second = scopedOccurrences[1]!.id;
    publisher.publish(moduleA, new Map([[include, [inactiveHint(second)]]]),
        [include], scopedOccurrences);
    publisher.selectContext(include, moduleA, second);
    sent.length = 0;
    publisher.publish(moduleA, new Map([[include, [inactiveHint(second)]]]),
        [include], scopedOccurrences);
    assert.deepEqual(sent.at(-1), { uri: include, diagnostics: [{ ...diagnostic('Inaktiver Code (Präprozessor).', DiagnosticSeverity.Hint),
        tags: [DiagnosticTag.Unnecessary] }] });
    sent.length = 0;
    publisher.publish(moduleA, new Map([[include, [diagnostic('Other')]]]),
        [include], scopedOccurrences.slice(0, 1));
    assert.deepEqual(sent.at(-1), { uri: include, diagnostics: [diagnostic('Other')] });
});


test('shared include exposes all compiler errors in the project overview', () => {
    const { publisher, sent } = fixture();
    const first = diagnostic('From unit A');
    const second = diagnostic('From unit B');
    publisher.publish(moduleA, new Map([[include, [first]]]), [include]);
    assert.deepEqual(sent.at(-1), { uri: include, diagnostics: [first] });
    sent.length = 0;
    publisher.publish(moduleB, new Map([[include, [second]]]), [include]);
    assert.deepEqual(sent.filter(item => item.uri === include), [
        { uri: include, diagnostics: [
            contextDiagnostic('From unit A', ['Module1.P']),
            contextDiagnostic('From unit B', ['Module2.P'])
        ] }
    ]);
    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleB), true);
    assert.deepEqual(sent, [{ uri: include, diagnostics: [
        contextDiagnostic('From unit A', ['Module1.P']),
        contextDiagnostic('From unit B', ['Module2.P'])
    ] }]);
});

test('warnings scoped to the active execution disappear in a guarded execution', () => {
    const { publisher, sent } = fixture();
    const warning = {
        ...diagnostic("Variable 'ExtVar' wird gelesen, aber niemals beschrieben.", DiagnosticSeverity.Warning),
        includeOccurrenceId: scopedOccurrences[0]!.id
    };
    publisher.publish(moduleA, new Map([[include, [warning]]]),
        [include], scopedOccurrences);
    // Without selection, the project overview retains the warning together
    // with its include occurrence, rather than losing it altogether.
    assert.deepEqual(sent.at(-1), {
        uri: include,
        diagnostics: [contextDiagnostic(warning.message, ['Module1.P, Include 1'], DiagnosticSeverity.Warning)]
    });
    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[0]!.id), true);
    assert.deepEqual(sent.at(-1), {
        uri: include, diagnostics: [diagnostic(warning.message, DiagnosticSeverity.Warning)]
    });
    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id), true);
    assert.deepEqual(sent.at(-1), { uri: include, diagnostics: [] });
});

// Dev_0_3 / package 14: project diagnostics must not depend on editor context.

test('opening a folder reports both units errors from an unopened shared header', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[include, [diagnostic('Syntax error in A')]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Type error in B')]]]), [include]);
    assert.deepEqual(sent.filter(entry => entry.uri === include).at(-1), {
        uri: include,
        diagnostics: [
            contextDiagnostic('Syntax error in A', ['Module1.P']),
            contextDiagnostic('Type error in B', ['Module2.P'])
        ]
    });
    // No selectContext() call, and no editor-open state is required.
});

test('selecting a guarded execution hides its unused warning, never another context error', () => {
    const { publisher, sent } = fixture();
    const warning = {
        ...diagnostic('ExtVar read but never written', DiagnosticSeverity.Warning),
        includeOccurrenceId: scopedOccurrences[0]!.id
    };
    publisher.publish(moduleA, new Map([[include, [warning]]]),
        [include], scopedOccurrences);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Genuine syntax error')]]]), [include]);
    sent.length = 0;
    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id), true);
    assert.deepEqual(sent, [{
        uri: include,
        diagnostics: [contextDiagnostic('Genuine syntax error', ['Module2.P'])]
    }]);
    // The warning is absent, while the error remains visible in Problems.
});

test('reanalyzing or removing an owning unit clears stale global errors', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[include, [diagnostic('Old error')]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Still broken')]]]), [include]);
    sent.length = 0;
    publisher.publish(moduleA, new Map(), [include]);
    assert.deepEqual(sent.filter(entry => entry.uri === include).at(-1), {
        uri: include,
        diagnostics: [contextDiagnostic('Still broken', ['Module2.P'])]
    });
    sent.length = 0;
    publisher.removeUnit(moduleB);
    assert.deepEqual(sent.filter(entry => entry.uri === include).at(-1), {
        uri: include,
        diagnostics: []
    });
});

test('identical project errors are deduplicated with all owning units named', () => {
    const { publisher, sent } = fixture();
    const same = diagnostic('Unknown type');
    publisher.publish(moduleA, new Map([[include, [same]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [same]]]), [include]);
    assert.deepEqual(sent.filter(entry => entry.uri === include).at(-1), {
        uri: include,
        diagnostics: [contextDiagnostic('Unknown type', ['Module1.P','Module2.P'])]
    });
});

test('unused warnings stay searchable without dimming unrelated include executions', () => {
    const { publisher, sent } = fixture();
    const warning = {
        ...diagnostic('Unused ExtVar', DiagnosticSeverity.Warning),
        tags: [DiagnosticTag.Unnecessary],
        includeOccurrenceId: scopedOccurrences[0]!.id
    };
    publisher.publish(moduleA, new Map([[include, [warning]]]),
        [include], scopedOccurrences);
    assert.deepEqual(sent.filter(entry => entry.uri === include).at(-1), {
        uri: include,
        diagnostics: [contextDiagnostic('Unused ExtVar', ['Module1.P, Include 1'], DiagnosticSeverity.Warning)]
    });
    publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id);
    assert.deepEqual(sent.at(-1), { uri: include, diagnostics: [] });
});

// Dev_0_3 / package 15: a selected error must not be republished as an
// additional project-wide error at the same physical source location.

test('selected and other unit reporting the same error produce one diagnostic', () => {
    const { publisher, sent } = fixture();
    const same = diagnostic("Der Bezeichner 'GlobProcHuhu' ist in diesem Gültigkeitsbereich bereits vereinbart.");
    publisher.publish(moduleA, new Map([[include, [same]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [same]]]), [include]);
    sent.length = 0;

    assert.equal(publisher.selectContext(include, moduleB), true);
    assert.deepEqual(sent, [{
        uri: include,
        diagnostics: [contextDiagnostic(same.message, ['Module1.P', 'Module2.P'])]
    }]);
});

test('identical errors in two executions of the same header are merged after selection', () => {
    const { publisher, sent } = fixture();
    const same = diagnostic('Duplicate declaration');
    const first = { ...same, includeOccurrenceId: scopedOccurrences[0]!.id };
    const second = { ...same, includeOccurrenceId: scopedOccurrences[1]!.id };
    publisher.publish(moduleA, new Map([[include, [first, second]]]),
        [include], scopedOccurrences);
    sent.length = 0;

    assert.equal(publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id), true);
    assert.deepEqual(sent, [{
        uri: include,
        diagnostics: [contextDiagnostic('Duplicate declaration', ['Module1.P, Include 1', 'Module1.P, Include 2'])]
    }]);
});

test('global errors stay deduplicated without leaking warnings or inactive hints', () => {
    const { publisher, sent } = fixture();
    const same = diagnostic('Duplicate declaration');
    const warning = {
        ...diagnostic('Read but never written', DiagnosticSeverity.Warning),
        includeOccurrenceId: scopedOccurrences[0]!.id
    };
    const hint = inactiveHint(scopedOccurrences[1]!.id);
    publisher.publish(moduleA, new Map([[include, [
        { ...same, includeOccurrenceId: scopedOccurrences[0]!.id },
        { ...same, includeOccurrenceId: scopedOccurrences[1]!.id },
        warning,
        hint
    ]]]), [include], scopedOccurrences);
    sent.length = 0;

    publisher.selectContext(include, moduleA, scopedOccurrences[1]!.id);
    assert.deepEqual(sent.at(-1), {
        uri: include,
        diagnostics: [
            contextDiagnostic('Duplicate declaration', ['Module1.P, Include 1', 'Module1.P, Include 2']),
            { ...diagnostic(hint.message, DiagnosticSeverity.Hint), tags: [DiagnosticTag.Unnecessary] }
        ]
    });
});

test('different errors at the same physical range must remain distinct', () => {
    const { publisher, sent } = fixture();
    publisher.publish(moduleA, new Map([[include, [diagnostic('Error A')]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [diagnostic('Error B')]]]), [include]);
    sent.length = 0;

    publisher.selectContext(include, moduleA);
    assert.deepEqual(sent, [{ uri: include, diagnostics: [
        contextDiagnostic('Error A', ['Module1.P']),
        contextDiagnostic('Error B', ['Module2.P'])
    ] }]);
});

// 0.3.x: the Problems view must remain readable for many include contexts.
test('nineteen owning units keep the message first and attach one provenance detail', () => {
    const { publisher, sent } = fixture();
    const same = diagnostic('Undefined identifier EXTERNAL_VALUE');
    for (let i = 19; i >= 1; i--) {
        const unitUri = `file:///project/STRESS_${String(i).padStart(2, '0')}.P`;
        publisher.publish(unitUri, new Map([[include, [same]]]), [include]);
    }

    const last = sent.filter(item => item.uri === include).at(-1);
    assert.ok(last);
    assert.equal(last.diagnostics.length, 1);
    const actual = last.diagnostics[0]!;
    assert.equal(actual.message, 'Undefined identifier EXTERNAL_VALUE (19 Kontexte)');
    assert.equal(actual.relatedInformation?.length, 1);
    assert.equal(actual.relatedInformation?.[0]?.location.uri, include);
    assert.equal(actual.relatedInformation?.[0]?.location.range.start.line, 0);
    assert.equal(actual.relatedInformation?.[0]?.message,
        `Betroffene Kontexte: ${Array.from({length: 19}, (_, i) =>
            `STRESS_${String(i + 1).padStart(2, '0')}.P`).join(', ')}`);
});

test('context presentation keeps pre-existing related diagnostic information', () => {
    const { publisher, sent } = fixture();
    const original = diagnostic('Problem with original related location');
    const extra = {
        location: { uri: moduleA, range: original.range },
        message: 'Original cause'
    };
    publisher.publish(moduleA, new Map([[include, [{ ...original, relatedInformation: [extra] }]]]), [include]);
    publisher.publish(moduleB, new Map([[include, [{ ...original, relatedInformation: [extra] }]]]), [include]);
    const last = sent.filter(item => item.uri === include).at(-1);
    assert.equal(last?.diagnostics.length, 1);
    assert.equal(last?.diagnostics[0]?.message, 'Problem with original related location (2 Kontexte)');
    assert.deepEqual(last?.diagnostics[0]?.relatedInformation?.[0], extra);
    assert.equal(last?.diagnostics[0]?.relatedInformation?.[1]?.message,
        'Betroffene Kontexte: Module1.P, Module2.P');
});
