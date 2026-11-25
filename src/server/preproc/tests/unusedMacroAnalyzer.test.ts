// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ProblemCollection } from '../../core/problemCollection';
import { ProblemTag } from '../../core/problemTag';
import { Lexer } from '../../lexer/lexer';
import { FileSource } from '../../source/fileSource';
import { ConditionalStack } from '../conditionalStack';
import { MacroOccurrenceIndex } from '../macroOccurrenceIndex';
import { MacroTable } from '../macroTable';
import { Preprocessor } from '../preprocessor';
import { PreprocessorConditionalBlockCollection } from '../preprocessorConditionalBlockCollection';
import { PreprocessorConditionalBlockStack } from '../preprocessorConditionalBlockStack';
import { PreprocessorContext } from '../preprocessorContext';
import { UnusedMacroAnalyzer } from '../unusedMacroAnalyzer';
import type { DocumentRegistry } from '../../utility/documentRegistry';
import type { Logger } from '../../utility/logging/logger';

const rootUri = 'file:///test/main.p';
const logger: Logger = { info() {}, warn() {}, error() {} };

function analyze(
    text: string,
    includes: Record<string, string> = {},
    predefined: Record<string, string> = {}
) {
    const macroTable = new MacroTable();
    for (const [name, replacement] of Object.entries(predefined)) {
        macroTable.define(name, replacement);
    }
    const registry = {
        resolveInclude: (_from: string, name: string) => {
            const uri = `file:///test/${name}`;
            const contents = includes[uri];
            return contents === undefined ? null : { uri, getText: () => contents };
        },
        addInclude() {}
    } as unknown as DocumentRegistry;
    const context = new PreprocessorContext(registry, macroTable,
        new ConditionalStack(), new PreprocessorConditionalBlockStack());
    const source = new FileSource(rootUri, text);
    const problems = new ProblemCollection();
    const expanded = Preprocessor.createExpanded(
        new Lexer(source, problems, logger).tokenize(), source, context,
        problems, [], new PreprocessorConditionalBlockCollection(), logger
    );
    const occurrences = new MacroOccurrenceIndex(context.macroDefinitions, expanded.macroReferences);
    return {
        unused: new UnusedMacroAnalyzer().analyze(occurrences),
        problems, occurrences, expanded
    };
}

test('unused #define is reported by definition identity, with its name location', () => {
    const source = '#define UNUSED "FIXED"\nMODULE; PROBLEM; MODEND;';
    const result = analyze(source);
    assert.deepEqual(result.unused.map(m => m.name), ['UNUSED']);
    assert.equal(result.unused[0]!.location!.span.start, source.indexOf('UNUSED'));
    assert.equal(result.problems.size(), 0);
});

test('expansion, #ifdef, #ifndef and include-path usage all count as uses', () => {
    const source = '#define A "FIXED"\n#define FLAG\n#define FILE "\'x.inc\'"\n' +
        '#ifdef FLAG\n#endif\n#ifndef FLAG\n#endif\n#include FILE\n' +
        'MODULE; PROBLEM; DCL X A; MODEND;';
    assert.deepEqual(analyze(source, { 'file:///test/x.inc': '\n' }).unused, []);
});

test('#undef remains navigable but does not count as a use of its definition', () => {
    const source = '#define T "FIXED"\n#undef T\nMODULE; PROBLEM; MODEND;';
    const result = analyze(source);
    assert.deepEqual(result.unused.map(m => m.name), ['T']);
    assert.deepEqual(result.occurrences.all[0]?.references.map(r => r.kind), ['undef']);
});

test('redefinitions and #undef distinguish the definition actually used', () => {
    const source = '#define T "FIXED"\n#define T "FLOAT"\nMODULE; PROBLEM; DCL X T; MODEND;';
    const result = analyze(source);
    assert.deepEqual(result.unused.map(m => m.name), ['T']);
    assert.equal(result.unused[0]!.location!.span.start, source.indexOf('T'));
});

test('nested replacement names count only when expanded', () => {
    const source = '#define INNER "FIXED"\n#define OUTER "INNER"\nMODULE; PROBLEM; MODEND;';
    assert.deepEqual(analyze(source).unused.map(m => m.name), ['INNER', 'OUTER']);
    const used = source.replace('MODEND;', 'DCL X OUTER; MODEND;');
    assert.deepEqual(analyze(used).unused, []);
});

test('inactive #define is not collected, and predefined settings macros are never warned', () => {
    const source = '#ifdef MISSING\n#define HIDDEN "FIXED"\n#endif\n' +
        'MODULE; PROBLEM; MODEND;';
    const result = analyze(source, {}, { EXTERNAL: 'FIXED' });
    assert.equal(result.occurrences.all.length, 0);
    assert.deepEqual(result.unused, []);
});

test('a #define in an included file retains its original source location', () => {
    const source = '#include "defs.inc"\nMODULE; PROBLEM; MODEND;';
    const result = analyze(source, { 'file:///test/defs.inc': '#define HEADER "FIXED"\n' });
    assert.deepEqual(result.unused.map(m => m.name), ['HEADER']);
    assert.equal(result.unused[0]?.location?.source.uri, 'file:///test/defs.inc');
});

test('multiple includes of the same definition produce one warning, only if never used', () => {
    const included = { 'file:///test/defs.inc': '#define T "FIXED"\n' };
    const source = '#include "defs.inc"\n#undef T\n#include "defs.inc"\nMODULE; PROBLEM; MODEND;';
    assert.deepEqual(analyze(source, included).unused.map(m => m.name), ['T']);
    assert.deepEqual(analyze(source.replace('MODEND;', 'DCL X T; MODEND;'), included).unused, []);
});

test('Validator forwards unused macro warnings with the existing Unnecessary tag', async () => {
    const { Validator } = await import('../../validation/validator');
    const validator = new Validator(
        {} as ConstructorParameters<typeof Validator>[0],
        { get: () => undefined } as unknown as DocumentRegistry,
        logger
    );
    const text = '#define USED "FIXED"\n#define UNUSED "FLOAT"\n' +
        'P=MPC603; SC=2000; MODULE M; PROBLEM; DCL A USED; T: TASK MAIN; A := 1; END; MODEND;';
    const result = await validator.analyze(
        { uri: rootUri, version: 1, getText: () => text } as Parameters<InstanceType<typeof Validator>['analyze']>[0],
        { macros: {}, warnOnCharTruncation: true } as Parameters<InstanceType<typeof Validator>['analyze']>[1]
    );
    const unused = result.problems.toArray().filter(p => p.message === "Makro 'UNUSED' wird nicht verwendet.");
    assert.equal(unused.length, 1);
    assert.deepEqual(unused[0]?.tags, [ProblemTag.Unnecessary]);
    assert.equal(unused[0]?.location.span.start, text.indexOf('UNUSED'));
    assert.equal(result.problems.toArray().some(p => p.message.includes("Makro 'USED'")), false);
});

test('whole-file guard is exempt without fabricating a macro use; nested default is not', () => {
    const header = '/* License */\n#ifndef __guard_h__\n#define __guard_h__\n\n' +
        '#ifndef InclDir\n#define InclDir " "\n#endif\nDCL X FIXED;\n#endif\n! End\n';
    const result = analyze('#include "defs.inc"\nMODULE; PROBLEM; MODEND;',
        { 'file:///test/defs.inc': header });
    assert.deepEqual(result.unused.map(m => m.name), ['InclDir']);
    const guard = result.occurrences.all.find(g => g.definition.name === '__guard_h__')!;
    assert.equal(guard.definition.isIncludeGuard, true);
    assert.deepEqual(guard.references, []);
    assert.equal(result.problems.size(), 0);
});

test('guard recognition is local to physical file and definition identity', () => {
    const header = '#ifndef Guard\n#define Guard\nDCL X FIXED;\n#endif\n';
    const result = analyze('#define OUTER\n#ifdef OUTER\n#include "defs.inc"\n#endif\n' +
        '#undef Guard\n#define Guard\nMODULE; PROBLEM; MODEND;',
        { 'file:///test/defs.inc': header });
    assert.deepEqual(result.unused.map(m => m.name), ['Guard']);
    assert.equal(result.unused[0]?.location?.source.uri, rootUri);
});

for (const [label, header] of Object.entries({
    'replacement text': '#ifndef Guard\n#define Guard "1"\n#endif\n',
    'alternative branch': '#ifndef Guard\n#define Guard\n#else\n#endif\n',
    'preceding content': 'DCL X FIXED;\n#ifndef Guard\n#define Guard\n#endif\n',
    'following content': '#ifndef Guard\n#define Guard\n#endif\nDCL X FIXED;\n',
    'missing endif': '#ifndef Guard\n#define Guard\n',
    'non-adjacent definition': '#ifndef Guard\nDCL X FIXED;\n#define Guard\n#endif\n',
    'guard removed in body': '#ifndef Guard\n#define Guard\n#undef Guard\n#endif\n'
})) {
    test(`guard-like pattern retains warning: ${label}`, () => {
        const result = analyze('#include "defs.inc"\nMODULE; PROBLEM; MODEND;',
            { 'file:///test/defs.inc': header });
        assert.deepEqual(result.unused.map(m => m.name), ['Guard']);
    });
}


test('Validator and worker transport preserve guard classification and unused diagnostics', async () => {
    const { Validator } = await import('../../validation/validator');
    const { encodeAnalysisResult, decodeAnalysisResult } = await import('../../utility/transport/analysisResultTransport');
    const header = '#ifndef Guard\n#define Guard\n#define Other\n#endif\n';
    const registry = {
        get: () => undefined,
        resolveInclude: (_from: string, name: string) => name === 'defs.inc'
            ? { uri: 'file:///test/defs.inc', getText: () => header } : null
    } as unknown as DocumentRegistry;
    const validator = new Validator({} as ConstructorParameters<typeof Validator>[0], registry, logger);
    const text = 'MODULE X; PROBLEM;\n#include "defs.inc"\nMODEND;';
    const original = await validator.analyze(
        { uri: rootUri, version: 1, getText: () => text } as Parameters<InstanceType<typeof Validator>['analyze']>[0],
        { macros: {}, warnOnCharTruncation: true } as Parameters<InstanceType<typeof Validator>['analyze']>[1]
    );
    const result = decodeAnalysisResult(structuredClone(encodeAnalysisResult(original)));
    for (const analysis of [original, result]) {
        assert.equal(analysis.rootAnalysis.macroDefinitions.find(d => d.name === 'Guard')?.isIncludeGuard, true);
        assert.equal(analysis.rootAnalysis.macroDefinitions.find(d => d.name === 'Other')?.isIncludeGuard, undefined);
        assert.equal([...analysis.problems].some(p => p.message === "Makro 'Guard' wird nicht verwendet."), false);
        assert.equal([...analysis.problems].some(p => p.message === "Makro 'Other' wird nicht verwendet."), true);
        assert.deepEqual(new UnusedMacroAnalyzer().analyze(analysis.rootAnalysis.macroOccurrences).map(d => d.name), ['Other']);
    }
});

test('nested include-path default remains a real macro use, guard is independent of repeat includes', () => {
    const header = '#ifndef __guard_h__\n#define __guard_h__\n' +
        '#ifndef InclDir\n#define InclDir " "\n#endif\n' +
        '#include "InclDir/H0/InclFile.h"\n#endif\n';
    const root = '#include "defs.inc"\nMODULE; PROBLEM; MODEND;';
    const includes = { 'file:///test/defs.inc': header, 'file:///test/ /H0/InclFile.h': '\n' };
    for (const text of [root, '#include "defs.inc"\n' + root]) {
        const result = analyze(text, includes);
        assert.deepEqual(result.unused, []);
        const incl = result.occurrences.all.find(g => g.definition.name === 'InclDir')!;
        assert.equal(incl.definition.isIncludeGuard, undefined);
        assert.ok(incl.references.length > 0);
    }
});
