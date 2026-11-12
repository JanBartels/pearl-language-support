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
