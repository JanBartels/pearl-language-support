// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver/node';
import { FileSource } from '../../source/fileSource';
import { SourceValue } from '../../core/sourceValue';
import { SymbolKind } from '../../semantic/symbolKind';
import { SemanticTypeKind } from '../../semantic/semanticType';
import { SemanticDiagnosticCode } from '../../semantic/semanticDiagnostic';
import { UNUSED_MACRO_DIAGNOSTIC_CODE } from '../../preproc/unusedMacroAnalyzer';
import type { AnalysisResult } from '../../validation/analysisResult';
import { DiagnosticPublicationManager } from '../diagnosticPublicationManager';
import { collectCrossUnitUnusedFacts, unusedDiagnosticSite } from '../crossUnitUnusedFacts';

const header = 'file:///project/Common.H';
const first = 'file:///project/Prog1.P';
const second = 'file:///project/Prog2.P';
const content = 'DCL Var1 INV FIXED INIT(1);\nDCL Var2 INV FIXED INIT(2);\nDCL Var3 INV FIXED INIT(3);\n';
const source = new FileSource(header, content);
const unusedSymbolCode = SemanticDiagnosticCode.UnusedSymbol;

/** Enough of TextDocument for source-offset -> LSP position mapping. */
const documents = {
    get(uri: string) {
        if (uri !== header) return null;
        return {
            positionAt(offset: number) {
                const before = content.slice(0, offset);
                const line = before.split('\n').length - 1;
                const character = before.length - (before.lastIndexOf('\n') + 1);
                return { line, character };
            }
        };
    }
};

function location(name: string, src = source) {
    const start = src.text.indexOf(name);
    assert.ok(start >= 0);
    return { source: src, span: { start, end: start + name.length } };
}

function result(
    unit: string,
    declarations: readonly { name: string; used: boolean; precision?: number }[],
    macros: readonly { name: string; used: boolean; replacement: string | null }[] = []
): AnalysisResult {
    const usages = declarations.map(({ name, used, precision }) => {
        const declaration = new SourceValue(name, location(name));
        return {
            declaration,
            symbol: {
                kind: SymbolKind.DataObject, name: declaration,
                assignmentProtected: true,
                type: { kind: SemanticTypeKind.Fixed, precision }
            },
            unused: !used,
            externallyVisible: false
        };
    });
    const groups = macros.map(({ name, used, replacement }) => ({
        definition: { name, location: location(name), replacement },
        references: used ? [{ kind: undefined }] : []
    }));
    return {
        rootAnalysis: {
            source: { uri: unit }, semanticContext: { symbolUsages: { all: usages } },
            macroOccurrences: { all: groups }
        },
        includedSourceUris: [header]
    } as unknown as AnalysisResult;
}

function warning(name: string, code: string = unusedSymbolCode): Diagnostic {
    const start = content.indexOf(name);
    const line = content.slice(0, start).split('\n').length - 1;
    const character = start - content.lastIndexOf('\n', start - 1) - 1;
    return {
        range: { start: { line, character }, end: { line, character: character + name.length } },
        severity: DiagnosticSeverity.Warning,
        code,
        message: code === UNUSED_MACRO_DIAGNOSTIC_CODE
            ? `Makro '${name}' wird nicht verwendet.`
            : `Symbol '${name}' wird nicht verwendet.`
    };
}

function fixture() {
    const sent: Array<{ uri: string; diagnostics: Diagnostic[] }> = [];
    const publisher = new DiagnosticPublicationManager((uri, diagnostics) => sent.push({ uri, diagnostics }));
    const publish = (unit: string, names: readonly string[],
        facts = collectCrossUnitUnusedFacts(result(unit,
            ['Var1','Var2','Var3'].map(name => ({ name, used: !names.includes(name) }))), documents)) => {
        publisher.publish(unit, new Map([[header, names.map(name => warning(name))]]),
            [header], [], facts);
    };
    return { sent, publisher, publish };
}

function lastHeader(f: ReturnType<typeof fixture>): Diagnostic[] {
    return f.sent.filter(item => item.uri === header).at(-1)?.diagnostics ?? [];
}

test('project-wide unused DCL warning disappears when another execution uses the same declaration', () => {
    const f = fixture();
    f.publish(first, ['Var2', 'Var3']);
    assert.equal(lastHeader(f).length, 2);
    f.publish(second, ['Var3']);
    assert.deepEqual(lastHeader(f).map(d => d.code), [unusedSymbolCode]);
    assert.match(lastHeader(f)[0]!.message, /Var3.*2 Kontexte/);
    assert.equal(lastHeader(f)[0]!.relatedInformation?.length, 1);
    assert.equal(lastHeader(f)[0]!.relatedInformation?.[0]?.message.includes('Prog2.P'), true);
});

test('explicitly selected include keeps the consolidated unused warning policy', () => {
    const f = fixture();
    f.publish(first, ['Var2', 'Var3']);
    f.publish(second, ['Var3']);
    assert.equal(f.publisher.selectContext(header, first), true);
    assert.deepEqual(lastHeader(f).map(d => d.message), ["Symbol 'Var3' wird nicht verwendet."]);
});

test('removing the only using unit restores the warning', () => {
    const f = fixture();
    f.publish(first, ['Var2', 'Var3']);
    f.publish(second, ['Var3']);
    f.publisher.removeUnit(second);
    assert.deepEqual(lastHeader(f).map(d => d.message), [
        "Symbol 'Var2' wird nicht verwendet.", "Symbol 'Var3' wird nicht verwendet."
    ]);
});

test('reanalyzing a previously using unit restores the warning, using it again removes it', () => {
    const f = fixture();
    f.publish(first, ['Var2', 'Var3']);
    f.publish(second, ['Var3']);
    f.publish(second, ['Var2', 'Var3']);
    assert.equal(lastHeader(f).length, 2);
    f.publish(second, ['Var3']);
    assert.equal(lastHeader(f).length, 1);
});

test('same physical name and position with a different resolved type is not a shared identity', () => {
    const f = fixture();
    const unusedA = collectCrossUnitUnusedFacts(result(first,
        [{ name: 'Var2', used: false, precision: 31 }]), documents);
    const usedB = collectCrossUnitUnusedFacts(result(second,
        [{ name: 'Var2', used: true, precision: 15 }]), documents);
    f.publisher.publish(first, new Map([[header, [warning('Var2')]]]), [header], [], unusedA);
    f.publisher.publish(second, new Map([[header, []]]), [header], [], usedB);
    assert.equal(lastHeader(f).length, 1);
});

test('a physically different declaration at another location is not the same symbol', () => {
    const f = fixture();
    f.publisher.publish(first, new Map([[header, [warning('Var2')]]]), [header], [],
        collectCrossUnitUnusedFacts(result(first, [{ name: 'Var2', used: false }]), documents));
    const other = collectCrossUnitUnusedFacts(result(second, [{ name: 'Var1', used: true }]), documents);
    f.publisher.publish(second, new Map([[header, []]]), [header], [], other);
    assert.equal(lastHeader(f).length, 1);
});

test('macro-generated names without a matching physical token do not provide usage evidence', () => {
    const unit = result(second, [{ name: 'Var2', used: true }]);
    const usage = (unit.rootAnalysis.semanticContext!.symbolUsages.all as unknown[])[0] as {
        declaration: SourceValue<string>; symbol: { name: SourceValue<string> }
    };
    const generatedName = new SourceValue('Generated', location('Var2'));
    const modified = result(second, [{ name: 'Var2', used: true }]);
    (modified.rootAnalysis.semanticContext!.symbolUsages.all as unknown[])[0] = {
        ...usage, declaration: generatedName, symbol: { ...usage.symbol, name: generatedName }
    };
    assert.deepEqual(collectCrossUnitUnusedFacts(modified, documents), []);
});

test('a used #define suppresses another unit unused warning but never an actually unused macro', () => {
    const macroContent = '#define M1 "1"\n#define M2 "2"\n';
    const macroSource = new FileSource(header, macroContent);
    const names = ['M1', 'M2'];
    const make = (unit: string, m1Used: boolean) => {
        const macroResult = {
            rootAnalysis: { source: { uri: unit }, semanticContext: undefined,
                macroOccurrences: { all: names.map(name => ({
                    definition: { name, replacement: name, location: location(name, macroSource) },
                    references: name === 'M1' && m1Used ? [{ kind: undefined }] : []
                })) } }, includedSourceUris: [header]
        } as unknown as AnalysisResult;
        return collectCrossUnitUnusedFacts(macroResult, {
            get: () => ({ positionAt(offset: number) {
                const before = macroContent.slice(0, offset);
                return { line: before.split('\n').length - 1,
                    character: offset - before.lastIndexOf('\n') - 1 };
            } })
        });
    };
    const diagnostics = (withM1: boolean) => new Map([[header, names
        .filter(n => n === 'M2' || withM1)
        .map(name => {
            const line = name === 'M1' ? 0 : 1;
            return { range: { start: { line, character: 8 }, end: { line, character: 10 } },
                severity: DiagnosticSeverity.Warning, code: UNUSED_MACRO_DIAGNOSTIC_CODE,
                message: `Makro '${name}' wird nicht verwendet.` };
        })]]);
    const f = fixture();
    f.publisher.publish(first, diagnostics(true), [header], [], make(first, false));
    f.publisher.publish(second, diagnostics(false), [header], [], make(second, true));
    assert.equal(lastHeader(f).length, 1);
    assert.match(lastHeader(f)[0]!.message, /M2/);
});

test('unknown warning codes, errors and direct root declarations are never filtered', () => {
    const f = fixture();
    const facts = collectCrossUnitUnusedFacts(result(second,
        [{ name: 'Var2', used: true }]), documents);
    const notUnused = { ...warning('Var2'), code: 'semantic.written-but-never-read' };
    const error = { ...warning('Var2'), severity: DiagnosticSeverity.Error };
    f.publisher.publish(first, new Map([[header, [notUnused, error]]]), [header]);
    f.publisher.publish(second, new Map([[header, []]]), [header], [], facts);
    assert.equal(lastHeader(f).length, 2);
    assert.equal(unusedDiagnosticSite(header, unusedSymbolCode, warning('Var2').range),
        facts[0]?.diagnosticSite);
});

test('a procedure from a shared include follows the same rule without changing its compiler usage', () => {
    const procSource = new FileSource(header, 'Shared: PROC; END;\n');
    const declaration = new SourceValue('Shared', location('Shared', procSource));
    const procedureResult = (unit: string, used: boolean): AnalysisResult => ({
        rootAnalysis: { source: { uri: unit }, macroOccurrences: { all: [] },
            semanticContext: { symbolUsages: { all: [{
                declaration, symbol: { kind: SymbolKind.Procedure, name: declaration },
                unused: !used, externallyVisible: false
            }] } } }, includedSourceUris: [header]
    }) as unknown as AnalysisResult;
    const docs = { get: () => ({ positionAt(offset: number) {
        return { line: 0, character: offset };
    } }) };
    const procWarning = {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
        code: unusedSymbolCode,
        severity: DiagnosticSeverity.Warning,
        message: "Symbol 'Shared' wird nicht verwendet."
    };
    const f = fixture();
    f.publisher.publish(first, new Map([[header, [procWarning]]]), [header], [],
        collectCrossUnitUnusedFacts(procedureResult(first, false), docs));
    f.publisher.publish(second, new Map([[header, []]]), [header], [],
        collectCrossUnitUnusedFacts(procedureResult(second, true), docs));
    assert.deepEqual(lastHeader(f), []);
});

test('ambiguous different declarations at one physical site are never suppressed', () => {
    const f = fixture();
    const two = collectCrossUnitUnusedFacts(result(first, [
        { name: 'Var2', used: false, precision: 15 },
        { name: 'Var2', used: false, precision: 31 }
    ]), documents);
    const using = collectCrossUnitUnusedFacts(result(second,
        [{ name: 'Var2', used: true, precision: 31 }]), documents);
    f.publisher.publish(first, new Map([[header, [warning('Var2')]]]), [header], [], two);
    f.publisher.publish(second, new Map([[header, []]]), [header], [], using);
    assert.equal(lastHeader(f).length, 1);
});

test('two macro replacements at the same directive site are not considered the same definition', () => {
    const f = fixture();
    const site = unusedDiagnosticSite(header, UNUSED_MACRO_DIAGNOSTIC_CODE, warning('Var2').range);
    f.publisher.publish(first, new Map([[header, [warning('Var2', UNUSED_MACRO_DIAGNOSTIC_CODE)]]]),
        [header], [], [{ sourceUri: header, diagnosticSite: site,
            identity: JSON.stringify([site, 'Var2', 'macro-replacement-A']), used: false }]);
    f.publisher.publish(second, new Map([[header, []]]), [header], [],
        [{ sourceUri: header, diagnosticSite: site,
            identity: JSON.stringify([site, 'Var2', 'macro-replacement-B']), used: true }]);
    assert.equal(lastHeader(f).length, 1);
});

test('a source with one known translation unit retains its ordinary Unused warning', () => {
    const f = fixture();
    f.publish(first, ['Var2', 'Var3']);
    assert.equal(lastHeader(f).length, 2);
});

test('real Validator -> mapped diagnostics -> publisher: DCL and #define uses across two .P files', async () => {
    const { Validator } = await import('../../validation/validator');
    const { mapDiagnostics } = await import('../diagnosticMapper');
    const { encodeAnalysisResult, decodeAnalysisResult } = await import('../../utility/transport/analysisResultTransport');
    const { defaultSettings } = await import('../../settings/pearlSettings');
    const realHeader = `DCL Var1 INV FIXED INIT(1);
DCL Var2 INV FIXED INIT(2);
DCL Var3 INV FIXED INIT(3);
#define WORD "FIXED"
#define NEVER "FLOAT"
`;
    const sources = new Map<string, string>([
        [header, realHeader],
        [first, `MODULE M; PROBLEM;
#include "Common.H"
P: PROC; DCL A FIXED; A := Var1; END; MODEND;`],
        [second, `MODULE M; PROBLEM;
#include "Common.H"
P: PROC; DCL A WORD; A := Var1 + Var2; END; MODEND;`]
    ]);
    const textDocument = (uri: string) => {
        const text = sources.get(uri)!;
        return { uri, version: 1, getText: () => text,
            positionAt(offset: number) {
                const prefix = text.slice(0, offset);
                return { line: prefix.split('\n').length - 1,
                    character: offset - prefix.lastIndexOf('\n') - 1 };
            }
        };
    };
    const registry = { get: (uri: string) => sources.has(uri) ? textDocument(uri) : null };
    const includeResolver = {
        resolveInclude: (_unitUri: string, includePath: string) =>
            includePath === 'Common.H' ? textDocument(header) : null,
        resolveIncludeUri: () => header
    };
    const validator = new Validator({ info() {}, warn() {}, error() {} });
    const f = fixture();
    for (const unit of [first, second]) {
        const original = await validator.analyze(textDocument(unit) as never,
            defaultSettings, includeResolver as never);
        // The production worker executor crosses exactly this transport boundary.
        const analyzed = decodeAnalysisResult(encodeAnalysisResult(original));
        const diagnostics = mapDiagnostics(analyzed.problems, registry as never);
        f.publisher.publish(unit, diagnostics,
            [...analyzed.files.keys(), ...(analyzed.includedSourceUris ?? [])],
            analyzed.includeOccurrences,
            collectCrossUnitUnusedFacts(analyzed, registry));
    }
    const published = lastHeader(f);
    assert.equal(published.length, 2);
    assert.deepEqual(published.map(d => d.message.replace(/ \(2 Kontexte\)$/, '')).sort(), [
        "Makro 'NEVER' wird nicht verwendet.",
        "Symbol 'Var3' wird nicht verwendet."
    ]);
    assert.deepEqual(published.map(d => d.code).sort(),
        [UNUSED_MACRO_DIAGNOSTIC_CODE, unusedSymbolCode].sort());
    f.publisher.removeUnit(second);
    assert.equal(lastHeader(f).length, 4,
        'Removing the using unit restores the DCL and macro warnings');
});
